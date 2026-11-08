/**
 * Phase 10: Tracked Job Runner
 *
 * Wraps background job execution with:
 *   1. Durable lease acquisition (cluster-safe single-winner gate)
 *   2. JobRun record creation only for runs that actually execute
 *   3. Handler execution with bounded, transient-only retries
 *   4. Lease heartbeat for the whole attempt sequence
 *   5. JobRun status/attempt/error persistence (completed / failed)
 *
 * Item 4 changes:
 *  - Lease-loss ("another worker owns this job") no longer creates a JobRun
 *    row. Previously every non-winning worker wrote a `skipped` row on every
 *    tick, which flooded the audit table. Real runs and real failures are
 *    still fully recorded. The tracked result still reports `skipped` so
 *    callers (schedulers) keep their behaviour.
 *  - Retries use an actual `attempt` counter and an exponential backoff with
 *    jitter. Only transient infrastructure errors (DB connection/reset/timeout,
 *    IMAP network, SMTP transport/timeout) are retried; deterministic business
 *    and validation failures fail fast.
 *
 * Retry safety with the lease:
 *  - The lease is acquired once per execution and is owned by the same worker
 *    for every retry attempt. No other worker can take the lease while the
 *    holder is alive (the lease is renewed by the heartbeat for the entire
 *    attempt sequence), so a retry can never double-claim.
 *  - Handlers are required to be idempotent for retry safety. The inbound mail
 *    handler already is: it claims a message row with a conditional UPDATE
 *    (`received|failed AND ticketId IS NULL -> processing`) and dedups by the
 *    unique `dedupKey`, so re-running the handler cannot create a second
 *    ticket. Webhook deliveries use a per-request delivery record keyed by
 *    webhook+event id. Retrying therefore re-executes the same work rather
 *    than duplicating it.
 */

import { prisma } from '../config/database';
import { acquireJobLease, DEFAULT_JOB_LEASE_MS, getJobLeaseName, heartbeatJobLease, releaseJobLease } from './jobLock.service';
import { computeBackoffDelay, isTransientError } from './transientError';

const db = prisma;

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** Max handler executions per tracked run (1 = no retries). */
export const JOB_RUNNER_MAX_ATTEMPTS = parseBoundedInt(process.env.JOB_RUNNER_MAX_ATTEMPTS, 3, 1, 10);
/** Base delay for exponential retry backoff. */
export const JOB_RETRY_BASE_BACKOFF_MS = parseBoundedInt(process.env.JOB_RUNNER_BACKOFF_BASE_MS, 1_000, 10, 60_000);
/** Cap for exponential retry backoff. */
export const JOB_RETRY_MAX_BACKOFF_MS = parseBoundedInt(process.env.JOB_RUNNER_BACKOFF_MAX_MS, 30_000, 100, 600_000);

export interface JobRetryPolicy {
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Injectable sleep so tests do not wait on real backoff timers. */
  sleep?: (ms: number) => Promise<void>;
}

export interface JobRunConfig {
  jobId: string;          // logical job id (e.g. "intune-full-sync")
  jobType: string;        // category (e.g. "sync", "reminder")
  handler: () => Promise<unknown>;
  workerId?: string;      // optional; defaults to hostname+pid
  scheduledAt?: Date;     // optional; defaults to now()
  leaseMs?: number;       // optional; defaults to DEFAULT_JOB_LEASE_MS
  retryPolicy?: JobRetryPolicy;
}

export interface JobRunResult {
  status: 'completed' | 'failed' | 'skipped';
  jobId: string;
  jobRunId: string;
  error?: string;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Exponential backoff with full-jitter for one retry attempt.
 *
 * `attempt` is the 1-based number of the attempt that is about to be retried
 * *after* a failure; delay for the next attempt is based on the failed attempt
 * count. The exponential value is capped, then jittered into [50%, 100%] of the
 * capped value so cluster workers do not retry in lock-step.
 */
export function computeRetryDelayMs(
  failedAttempt: number,
  rand: () => number = Math.random,
  baseBackoffMs: number = JOB_RETRY_BASE_BACKOFF_MS,
  maxBackoffMs: number = JOB_RETRY_MAX_BACKOFF_MS,
): number {
  // Delegates to the shared helper so retry backoff and the confirmation queue
  // use one implementation. See computeBackoffDelay().
  return computeBackoffDelay(failedAttempt, baseBackoffMs, maxBackoffMs, rand);
}

/**
 * Execute a tracked job with durable lease protection and bounded retries.
 */
export async function executeTrackedJob(config: JobRunConfig): Promise<JobRunResult> {
  const workerId = config.workerId || `${process.env.HOSTNAME || 'unknown'}-${process.pid}`;
  const leaseName = getJobLeaseName(config.jobId);
  const leaseMs = config.leaseMs ?? DEFAULT_JOB_LEASE_MS;
  const maxAttempts = config.retryPolicy?.maxAttempts ?? JOB_RUNNER_MAX_ATTEMPTS;
  const baseBackoffMs = config.retryPolicy?.baseBackoffMs ?? JOB_RETRY_BASE_BACKOFF_MS;
  const maxBackoffMs = config.retryPolicy?.maxBackoffMs ?? JOB_RETRY_MAX_BACKOFF_MS;
  const sleep = config.retryPolicy?.sleep ?? defaultSleep;

  // 1. Acquire the durable lease BEFORE creating a JobRun record. Lease loss is
  //    a normal cluster outcome, not a run; it must not create audit noise.
  //    Acquisition failure is fail-closed: skip safely without touching the DB
  //    beyond the lease attempt itself.
  let acquired = false;
  try {
    const lease = await acquireJobLease(leaseName, workerId, leaseMs);
    acquired = lease !== null;
  } catch (error) {
    console.warn('[JobRunner] Lease acquisition failed for:', config.jobId, error);
    acquired = false;
  }

  if (!acquired) {
    // Suppressed audit row: only a log line, no JobRun row.
    console.log('[JobRunner] Skipped (lease held by another worker):', config.jobId);
    return { status: 'skipped', jobId: config.jobId, jobRunId: '' };
  }

  // 2. This worker won the lease — record the run.
  const jobRun = await db.jobRun.create({
    data: {
      jobId: config.jobId,
      jobType: config.jobType,
      status: 'running',
      workerId,
      scheduledAt: config.scheduledAt || new Date(),
      startedAt: new Date(),
      attempt: 1,
    },
  });

  const jobRunId = jobRun.id;
  let attempt = 1;

  // 3. Renew the lease for the whole attempt sequence so a retry cannot lose
  //    the lease mid-way (and therefore cannot be double-claimed).
  const heartbeatIntervalMs = Math.max(1000, Math.floor(leaseMs / 3));
  let leaseLost = false;
  const heartbeatTimer = setInterval(() => {
    void heartbeatJobLease(leaseName, workerId, leaseMs)
      .then((renewed) => {
        if (!renewed && !leaseLost) {
          leaseLost = true;
          console.warn('[JobRunner] Lost job lease during execution (another worker may take over):', config.jobId);
        }
      })
      .catch((error: unknown) => {
        console.warn('[JobRunner] Job lease heartbeat failed for:', config.jobId, error);
      });
  }, heartbeatIntervalMs);

  try {
    // 4. Attempt loop: retry only transient infrastructure failures.
    for (;;) {
      try {
        await config.handler();

        await db.jobRun.update({
          where: { id: jobRunId },
          data: {
            status: 'completed',
            attempt,
            error: null,
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return { status: 'completed', jobId: config.jobId, jobRunId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const canRetry = isTransientError(error) && attempt < maxAttempts;

        if (canRetry) {
          // Persist the attempt counter and the failure observed so far, then
          // back off with jitter before the next attempt. Status stays
          // `running` — the row is only failed when retries are exhausted.
          attempt += 1;
          await db.jobRun.update({
            where: { id: jobRunId },
            data: {
              attempt,
              error: message.slice(0, 2000),
              updatedAt: new Date(),
            },
          });
          console.warn('[JobRunner] Transient failure, retrying attempt', attempt, 'of', maxAttempts, 'for:', config.jobId);
          await sleep(computeRetryDelayMs(attempt - 1, Math.random, baseBackoffMs, maxBackoffMs));
          continue;
        }

        // Deterministic failure or retry budget exhausted: final failed state.
        await db.jobRun.update({
          where: { id: jobRunId },
          data: {
            status: 'failed',
            attempt,
            error: message,
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        throw error;
      }
    }
  } finally {
    // 5. Always stop the heartbeat and release the owned lease.
    clearInterval(heartbeatTimer);
    try {
      await releaseJobLease(leaseName, workerId);
    } catch (releaseError) {
      // Argument-style logging (no template interpolation) to avoid
      // format-string injection. The job already finished; do not rethrow.
      console.warn('[JobRunner] Failed to release job lease for:', config.jobId, releaseError);
    }
  }
}
