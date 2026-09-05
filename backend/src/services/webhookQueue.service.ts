/**
 * Webhook Queue Service - Async webhook delivery via DB-backed job queue
 *
 * Uses the existing JobRun/JobLease infrastructure for distributed
 * job execution with lease protection.
 *
 * Changes in this version:
 * - Issue 3.2: Unique jobId per retry attempt (includes attempt number)
 * - Issue 3.1: scheduledAt backoff delay is applied for retries
 * - Issue 3.4/3.5: Uses webhook.maxRetries instead of hardcoded MAX_DELIVERY_ATTEMPTS
 * - Issue 3.6: Creates WebhookDeliveryAttempt records per attempt instead of WebhookDelivery
 */

import { prisma } from '../config/database';
import { acquireJobLease, releaseJobLease, DEFAULT_JOB_LEASE_MS } from './jobLock.service';
import {
  WebhookPayload,
  WebhookDeliveryResult,
  deliverWebhook,
} from './webhook.service';
import { validateWebhookUrl } from './urlValidator';
import { resolveWebhookSecretAtDelivery } from './webhookSecretRotation';

// Queue configuration
const QUEUE_POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_QUEUE_POLL_INTERVAL_MS || '5000', 10);
const QUEUE_CONCURRENCY = 5; // Max concurrent webhook deliveries

// Retry backoff schedule (in milliseconds)
export const RETRY_BACKOFF = [
  60_000,     // 1 min
  300_000,    // 5 min
  900_000,    // 15 min
  3_600_000,  // 1 hour
  14_400_000, // 4 hours
  28_800_000, // 8 hours
  43_200_000, // 12 hours
  86_400_000, // 24 hours
  172_800_000,// 2 days
];

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
let activeJobs = 0;

/**
 * Queue a single webhook delivery as a JobRun record.
 * @param webhookId - The webhook ID to deliver to
 * @param payload - The webhook payload
 * @param attempt - The attempt number (1-based)
 * @param scheduledAt - Optional custom scheduled time (for backoff delay)
 */
export async function queueWebhookDelivery(
  webhookId: string,
  payload: WebhookPayload,
  attempt: number = 1,
  scheduledAt?: Date
): Promise<string> {
  // Issue 3.2: Include attempt number in jobId to avoid collision on retry
  const jobId = `webhook-delivery-${webhookId}-${payload.id}-attempt${attempt}`;

  const jobRun = await prisma.jobRun.create({
    data: {
      jobId,
      jobType: 'webhook',
      status: 'pending',
      workerId: undefined,
      // Issue 3.1: Use provided scheduledAt or default to now (immediate delivery)
      scheduledAt: scheduledAt || new Date(),
      attempt,
      data: JSON.stringify({ webhookId, payload }),
    },
  });

  return jobRun.id;
}

/**
 * Ensure a WebhookDelivery record exists for this webhook+payload combination.
 * Creates a new delivery record if none exists.
 */
async function ensureDeliveryRecord(
  webhookId: string,
  payload: WebhookPayload,
  attempt: number
): Promise<string> {
  // Check if a delivery record already exists for this webhook+eventId
  let delivery = await prisma.webhookDelivery.findFirst({
    where: { webhookId, eventId: payload.id },
    select: { id: true },
  });

  if (!delivery) {
    const newDelivery = await prisma.webhookDelivery.create({
      data: {
        webhookId,
        eventId: payload.id,
        eventType: payload.type,
        payload: JSON.stringify(payload),
        url: '', // Will be set from webhook config at delivery time
        status: 'delivering',
        attemptNumber: attempt,
      },
    });
    delivery = newDelivery;
  }

  return delivery.id;
}

/**
 * Process a single webhook delivery job.
 * Includes SSRF re-validation at delivery time.
 */
export async function processWebhookDeliveryJob(
  _jobRunId: string,
  webhookId: string,
  payload: WebhookPayload,
  attempt: number
): Promise<WebhookDeliveryResult> {
  const db = prisma;

  // Ensure delivery record exists before attempting delivery
  const deliveryId = await ensureDeliveryRecord(webhookId, payload, attempt);

  try {
    // Get webhook config from DB
    const webhook = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      // Create failed attempt record
      await createAttemptRecord(db, deliveryId, webhookId, payload, attempt, {
        success: false,
        errorMessage: `Webhook ${webhookId} not found in database`,
        attemptNumber: attempt,
      });

      await updateDeliveryStatus(db, deliveryId, 'failed', attempt);

      return {
        success: false,
        errorMessage: `Webhook ${webhookId} not found in database`,
        attemptNumber: attempt,
      };
    }

    if (!webhook.isActive || webhook.isArchived || webhook.status === 'paused') {
      await createAttemptRecord(db, deliveryId, webhookId, payload, attempt, {
        success: false,
        errorMessage: `Webhook ${webhookId} is not active`,
        attemptNumber: attempt,
      });

      await updateDeliveryStatus(db, deliveryId, 'failed', attempt);

      return {
        success: false,
        errorMessage: `Webhook ${webhookId} is not active`,
        attemptNumber: attempt,
      };
    }

    // SSRF re-validation at delivery time (DNS rebinding protection)
    const urlValidation = validateWebhookUrl(webhook.url);
    if (!urlValidation.valid) {
      await createAttemptRecord(db, deliveryId, webhookId, payload, attempt, {
        success: false,
        errorMessage: `URL validation failed: ${urlValidation.reason}`,
        attemptNumber: attempt,
      });

      await updateDeliveryStatus(db, deliveryId, 'failed', attempt);

      return {
        success: false,
        errorMessage: `URL validation failed: ${urlValidation.reason}`,
        attemptNumber: attempt,
      };
    }

    // The transport in deliverWebhook resolves immediately before each socket
    // connection and pins it to the validated address. Do not pre-resolve here:
    // that would only reintroduce a validation-to-connect TOCTOU window.
    //
    // Signing-secret rotation (Issue #8): prefer the current secret, but keep
    // verifying with the previous secret while the deprecation window is still
    // open so consumers that have not yet picked up the new secret can still
    // verify the signature. The previous secret is never persisted beyond the
    // window and is never returned to clients.
    const secret = resolveWebhookSecretAtDelivery(webhook);
    const result = await deliverWebhook(payload, {
      url: webhook.url,
      secret,
      maxRetries: 1,
      timeoutMs: webhook.timeoutMs,
    });

    const finalResult = {
      ...result,
      attemptNumber: attempt,
    };

    // Create attempt record with delivery details
    await createAttemptRecord(db, deliveryId, webhookId, payload, attempt, finalResult, {
      responseHeaders: undefined, // Will be captured if needed
    });

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhookId },
      data: {
        lastDeliveryStatus: result.success ? 'success' : 'failed',
        lastDeliveredAt: new Date(),
        failureCount: result.success ? 0 : webhook.failureCount + 1,
        updatedAt: new Date(),
      },
    });

    if (result.success) {
      await updateDeliveryStatus(db, deliveryId, 'success', attempt);
    }

    return finalResult;
  } catch (error) {
    await createAttemptRecord(db, deliveryId, webhookId, payload, attempt, {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      attemptNumber: attempt,
    });

    await updateDeliveryStatus(db, deliveryId, 'failed', attempt);

    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      attemptNumber: attempt,
    };
  }
}

/**
 * Create a WebhookDeliveryAttempt record for tracking individual delivery attempts.
 */
async function createAttemptRecord(
  db: typeof prisma,
  deliveryId: string,
  webhookId: string,
  payload: WebhookPayload,
  attemptNumber: number,
  result: WebhookDeliveryResult,
  extra?: { responseHeaders?: string }
): Promise<void> {
  await db.webhookDeliveryAttempt.create({
    data: {
      deliveryId,
      webhookId,
      eventPayloadId: payload.id,
      eventType: payload.type,
      payload: JSON.stringify(payload),
      attemptNumber,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.errorMessage,
      responseStatus: result.statusCode,
      responseHeaders: extra?.responseHeaders,
      durationMs: result.durationMs,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

/**
 * Update the WebhookDelivery status based on the latest attempt result.
 */
async function updateDeliveryStatus(
  db: typeof prisma,
  deliveryId: string,
  status: 'pending' | 'delivering' | 'success' | 'failed' | 'expired',
  attemptNumber: number
): Promise<void> {
  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      attemptNumber,
      updatedAt: new Date(),
    },
  });
}

/**
 * Retry a failed webhook delivery with backoff.
 * Uses webhook.maxRetries instead of hardcoded MAX_DELIVERY_ATTEMPTS.
 */
export async function retryFailedDelivery(
  webhookId: string,
  payload: WebhookPayload,
  currentAttempt: number
): Promise<void> {
  const db = prisma;

  // Get webhook to check maxRetries
  const webhook = await db.webhook.findUnique({
    where: { id: webhookId },
    select: { maxRetries: true, isActive: true, isArchived: true, status: true },
  });

  if (!webhook) {
    console.warn(`[WebhookQueue] Webhook ${webhookId} not found for retry decision`);
    return;
  }

  const maxRetries = webhook.maxRetries;
  const nextAttempt = currentAttempt + 1;

  // Issue 3.4/3.5: Use webhook.maxRetries instead of hardcoded MAX_DELIVERY_ATTEMPTS
  if (nextAttempt > maxRetries) {
    // Circuit breaker: mark webhook as paused
    try {
      await db.webhook.update({
        where: { id: webhookId },
        data: {
          status: 'paused',
          updatedAt: new Date(),
        },
      });
      console.warn(`[WebhookQueue] Circuit breaker triggered for webhook ${webhookId} after ${maxRetries} retries (maxRetries=${maxRetries})`);
    } catch {
      // Webhook may have been deleted
    }
    return;
  }

  // Calculate backoff delay
  const backoffIndex = Math.min(nextAttempt - 1, RETRY_BACKOFF.length - 1);
  const delayMs = RETRY_BACKOFF[backoffIndex];

  // Issue 3.1: Calculate the scheduledAt time with backoff delay
  const scheduledAt = new Date(Date.now() + delayMs);

  // Issue 3.2: queueWebhookDelivery now includes attempt number in jobId
  await queueWebhookDelivery(webhookId, payload, nextAttempt, scheduledAt);

  console.log(`[WebhookQueue] Retrying webhook ${webhookId} in ${delayMs / 1000}s (attempt ${nextAttempt}/${maxRetries})`);
}

/**
 * Poll for pending webhook jobs and process them.
 */
async function processPendingJobs(): Promise<void> {
  if (activeJobs >= QUEUE_CONCURRENCY) return;

  const db = prisma;

  // Find pending webhook jobs that are due
  const pendingJobs = await db.jobRun.findMany({
    where: {
      jobType: 'webhook',
      status: 'pending',
      scheduledAt: {
        lte: new Date(),
      },
    },
    take: QUEUE_CONCURRENCY - activeJobs,
    orderBy: { createdAt: 'asc' },
  });

  for (const job of pendingJobs) {
    activeJobs++;

    // Try to acquire lease
    const leaseName = `webhook-delivery-${job.id}`;
    const lease = await acquireJobLease(leaseName, `${process.env.HOSTNAME || 'unknown'}-${process.pid}`, DEFAULT_JOB_LEASE_MS);

    if (!lease) {
      activeJobs--;
      continue; // Another worker has this job
    }

    // Process job in background
    (async () => {
      try {
        // Update status to running
        await db.jobRun.update({
          where: { id: job.id },
          data: { status: 'running', startedAt: new Date(), updatedAt: new Date() },
        });

        // Parse job data
        const jobData = JSON.parse(job.data as string || '{}') as { webhookId: string; payload: WebhookPayload };
        
        if (!jobData.webhookId || !jobData.payload) {
          throw new Error('Invalid job data: missing webhookId or payload');
        }

        // Issue 3.2: Pass attempt number from job to processor
        const result = await processWebhookDeliveryJob(job.id, jobData.webhookId, jobData.payload, job.attempt);

        if (result.success) {
          await db.jobRun.update({
            where: { id: job.id },
            data: {
              status: 'completed',
              finishedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          // Retry with backoff
          await retryFailedDelivery(
            jobData.webhookId,
            jobData.payload,
            job.attempt
          );

          await db.jobRun.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              error: result.errorMessage,
              finishedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      } catch (error) {
        await db.jobRun.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } finally {
        await releaseJobLease(leaseName, `${process.env.HOSTNAME || 'unknown'}-${process.pid}`);
        activeJobs--;
      }
    })();
  }
}

/**
 * Start the webhook queue worker.
 */
export function startWebhookQueueWorker(): void {
  if (isRunning) return;

  isRunning = true;
  console.log(`[WebhookQueue] Worker started (poll interval: ${QUEUE_POLL_INTERVAL_MS}ms)`);

  pollTimer = setInterval(() => {
    processPendingJobs().catch(err => {
      console.error('[WebhookQueue] Error processing pending jobs:', err);
    });
  }, QUEUE_POLL_INTERVAL_MS);

  // Process immediately on start
  processPendingJobs().catch(err => {
    console.error('[WebhookQueue] Error on initial processing:', err);
  });
}

/**
 * Stop the webhook queue worker.
 */
export function stopWebhookQueueWorker(): void {
  if (!isRunning) return;

  isRunning = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  console.log('[WebhookQueue] Worker stopped');
}

/**
 * Check if the webhook queue worker is running.
 */
export function isWebhookQueueRunning(): boolean {
  return isRunning;
}
