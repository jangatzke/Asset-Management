/**
 * Webhook Queue Service - Async webhook delivery via DB-backed job queue
 *
 * Uses the existing JobRun/JobLease infrastructure for distributed
 * job execution with lease protection.
 */

import { prisma } from '../config/database';
import { acquireJobLease, releaseJobLease, DEFAULT_JOB_LEASE_MS } from './jobLock.service';
import {
  WebhookPayload,
  WebhookDeliveryResult,
  deliverWebhook,
} from './webhook.service';
import { checkResolvedIp, validateWebhookUrl } from './urlValidator';

// Queue configuration
const QUEUE_POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_QUEUE_POLL_INTERVAL_MS || '5000', 10);
const QUEUE_CONCURRENCY = 5; // Max concurrent webhook deliveries
const MAX_DELIVERY_ATTEMPTS = 10;

// Retry backoff schedule (in milliseconds)
const RETRY_BACKOFF = [
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
 */
export async function queueWebhookDelivery(
  webhookId: string,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<string> {
  const jobId = `webhook-delivery-${webhookId}-${payload.id}`;

  const jobRun = await prisma.jobRun.create({
    data: {
      jobId,
      jobType: 'webhook',
      status: 'pending',
      workerId: undefined,
      scheduledAt: new Date(),
      attempt,
      data: JSON.stringify({ webhookId, payload }),
    },
  });

  return jobRun.id;
}

/**
 * Process a single webhook delivery job.
 * Includes SSRF re-validation at delivery time.
 */
export async function processWebhookDeliveryJob(
  _jobRunId: string,
  webhookId: string,
  payload: WebhookPayload
): Promise<WebhookDeliveryResult> {
  const db = prisma;

  try {
    // Get webhook config from DB
    const webhook = await db.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return {
        success: false,
        errorMessage: `Webhook ${webhookId} not found in database`,
        attemptNumber: 1,
      };
    }

    if (!webhook.isActive || webhook.isArchived || webhook.status === 'paused') {
      return {
        success: false,
        errorMessage: `Webhook ${webhookId} is not active`,
        attemptNumber: 1,
      };
    }

    // SSRF re-validation at delivery time (DNS rebinding protection)
    const urlValidation = validateWebhookUrl(webhook.url);
    if (!urlValidation.valid) {
      return {
        success: false,
        errorMessage: `URL validation failed: ${urlValidation.reason}`,
        attemptNumber: 1,
      };
    }

    // Resolve hostname and verify IPs haven't changed to private ranges
    try {
      const dns = await import('dns');
      const { promisify } = await import('util');
      const resolve4 = promisify(dns.resolve4);

      const url = new URL(webhook.url);
      const hostname = url.hostname.replace(/\.$/, '');

      try {
        const ips = await resolve4(hostname);
        for (const ip of ips) {
          const ipCheck = checkResolvedIp(ip);
          if (!ipCheck.safe) {
            return {
              success: false,
              errorMessage: `DNS rebinding detected: ${hostname} resolved to blocked IP ${ip}: ${ipCheck.reason}`,
              attemptNumber: 1,
            };
          }
        }
      } catch {
        // DNS resolution failed - allow delivery but log warning
        console.warn(`[WebhookQueue] DNS resolution failed for ${hostname}, proceeding with delivery`);
      }
    } catch (error) {
      console.warn(`[WebhookQueue] SSRF check failed for ${webhook.url}:`, error);
      // Don't block delivery if SSRF check module fails
    }

    // Deliver with HMAC signature
    const result = await deliverWebhook(payload, {
      url: webhook.url,
      secret: webhook.secret,
      maxRetries: 1,
      timeoutMs: webhook.timeoutMs,
    });

    // Update delivery record
    await db.webhookDelivery.create({
      data: {
        webhookId,
        eventId: payload.id,
        eventType: payload.type,
        payload: JSON.stringify(payload),
        signature: result.signature,
        url: webhook.url,
        status: result.success ? 'success' : 'failed',
        responseStatus: result.statusCode,
        errorMessage: result.errorMessage,
        durationMs: result.durationMs,
        attemptNumber: result.attemptNumber,
      },
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

    return result;
  } catch (error) {
    await db.webhookDelivery.create({
      data: {
        webhookId,
        eventId: payload.id,
        eventType: payload.type,
        payload: JSON.stringify(payload),
        url: '',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        attemptNumber: 1,
      },
    });

    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      attemptNumber: 1,
    };
  }
}

/**
 * Retry a failed webhook delivery with backoff.
 */
async function retryFailedDelivery(
  webhookId: string,
  payload: WebhookPayload,
  currentAttempt: number
): Promise<void> {
  const nextAttempt = currentAttempt + 1;

  if (nextAttempt > MAX_DELIVERY_ATTEMPTS) {
    // Circuit breaker: mark webhook as paused
    try {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          status: 'paused',
          updatedAt: new Date(),
        },
      });
      console.warn(`[WebhookQueue] Circuit breaker triggered for webhook ${webhookId} after ${MAX_DELIVERY_ATTEMPTS} failures`);
    } catch {
      // Webhook may have been deleted
    }
    return;
  }

  // Calculate backoff delay
  const backoffIndex = Math.min(nextAttempt - 1, RETRY_BACKOFF.length - 1);
  const delayMs = RETRY_BACKOFF[backoffIndex];
  // Re-queue with scheduled delay
  await queueWebhookDelivery(webhookId, payload, nextAttempt);

  console.log(`[WebhookQueue] Retrying webhook ${webhookId} in ${delayMs / 1000}s (attempt ${nextAttempt}/${MAX_DELIVERY_ATTEMPTS})`);
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

        const result = await processWebhookDeliveryJob(job.id, jobData.webhookId, jobData.payload);

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
