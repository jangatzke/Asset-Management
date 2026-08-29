/**
 * Phase 10: Tracked Job Runner
 *
 * Wraps background job execution with:
 *   1. JobRun record creation (pending)
 *   2. Durable lease acquisition
 *   3. Handler execution (only if lease acquired)
 *   4. Lease release in finally block
 *   5. JobRun status update (completed / failed / skipped)
 */

import { prisma } from '../config/database';
import { acquireJobLease, DEFAULT_JOB_LEASE_MS, getJobLeaseName, releaseJobLease } from './jobLock.service';

const db = prisma;

export interface JobRunConfig {
  jobId: string;          // logical job id (e.g. "intune-full-sync")
  jobType: string;        // category (e.g. "sync", "reminder")
  handler: () => Promise<unknown>;
  workerId?: string;      // optional; defaults to hostname+pid
  scheduledAt?: Date;     // optional; defaults to now()
  leaseMs?: number;       // optional; defaults to DEFAULT_JOB_LEASE_MS
}

export interface JobRunResult {
  status: 'completed' | 'failed' | 'skipped';
  jobId: string;
  jobRunId: string;
  error?: string;
}

/**
 * Execute a tracked job with durable lease protection.
 */
export async function executeTrackedJob(config: JobRunConfig): Promise<JobRunResult> {
  const workerId = config.workerId || `${process.env.HOSTNAME || 'unknown'}-${process.pid}`;
  const leaseName = getJobLeaseName(config.jobId);
  const leaseMs = config.leaseMs ?? DEFAULT_JOB_LEASE_MS;

  // 1. Create pending JobRun record
  const jobRun = await db.jobRun.create({
    data: {
      jobId: config.jobId,
      jobType: config.jobType,
      status: 'pending',
      workerId,
      scheduledAt: config.scheduledAt || new Date(),
      attempt: 1,
    },
  });

  const jobRunId = jobRun.id;
  let acquired = false;

  try {
    // 2. Attempt to acquire durable lease. Failure is fail-closed: skip safely.
    const lease = await acquireJobLease(leaseName, workerId, leaseMs);
    acquired = lease !== null;

    if (!acquired) {
      // Lease not available — skip execution, record as skipped.
      await db.jobRun.update({
        where: { id: jobRunId },
        data: {
          status: 'skipped',
          finishedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { status: 'skipped', jobId: config.jobId, jobRunId };
    }

    // 3. Lease acquired — mark running and execute handler
    await db.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 4. Execute the handler
    await config.handler();

    // 5. Mark completed
    await db.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { status: 'completed', jobId: config.jobId, jobRunId };
  } catch (error) {
    // Mark failed with error message
    await db.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    throw error;
  } finally {
    // 6. Always release owned lease in finally block
    if (acquired) {
      try {
        await releaseJobLease(leaseName, workerId);
      } catch (releaseError) {
        // Log but do not rethrow — the job already finished
        // Argument-style logging (no template interpolation) to avoid format-string injection.
        console.warn('[JobRunner] Failed to release job lease for:', config.jobId, releaseError);
      }
    }
  }
}
