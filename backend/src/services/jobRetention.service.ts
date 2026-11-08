/**
 * Item 4: JobRun / JobLease retention pruning.
 *
 * Policy:
 *  - `job_runs` rows in terminal states (`completed`, `skipped`, `failed`)
 *    whose `finishedAt` is older than `JOB_RUN_RETENTION_DAYS` (default 30)
 *    are deleted in bounded batches.
 *  - `job_leases` rows whose `leaseUntil` AND `heartbeatAt` are older than
 *    `JOB_LEASE_RETENTION_DAYS` (default 7) are deleted. A lease is only
 *    removed when it has been inactive for the full window, so a live or
 *    recently-renewed lease is never pruned.
 *  - `running`/`pending` job_runs are always retained: they represent work
 *    that may still be in flight and are needed for crash recovery/audit.
 *
 * Cluster safety:
 *  - Pruning runs through `executeTrackedJob` under the `job-retention-prune`
 *    lease, so only one worker performs destructive cleanup at a time. The
 *    delete statements themselves are bounded (`DELETE ... LIMIT` style loop
 *    via Prisma deleteMany in batches) and tolerant of concurrent appends.
 */

import { prisma } from '../config/database';
import { executeTrackedJob } from './jobRunner.service';

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** Retention window for terminal JobRun rows, in days. */
export const JOB_RUN_RETENTION_DAYS = parseBoundedInt(process.env.JOB_RUN_RETENTION_DAYS, 30, 1, 3650);
/** Retention window for stale JobLease rows, in days. */
export const JOB_LEASE_RETENTION_DAYS = parseBoundedInt(process.env.JOB_LEASE_RETENTION_DAYS, 7, 1, 3650);
/** Max rows deleted per batch (bounds a single maintenance step). */
export const JOB_PRUNE_BATCH_SIZE = parseBoundedInt(process.env.JOB_PRUNE_BATCH_SIZE, 500, 1, 10_000);
/** Max batches per pruning run (bounds total work per tick). */
export const JOB_PRUNE_MAX_BATCHES = parseBoundedInt(process.env.JOB_PRUNE_MAX_BATCHES, 20, 1, 1000);
/** Scheduled lease key / job identity for the pruning maintenance job. */
export const JOB_PRUNE_JOB_ID = 'job-retention-prune';

const TERMINAL_RUN_STATUSES = ['completed', 'skipped', 'failed'];

export interface JobPruneOptions {
  runRetentionDays?: number;
  leaseRetentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
  now?: Date;
}

export interface JobPruneResult {
  deletedJobRuns: number;
  deletedJobLeases: number;
  batches: number;
}

/**
 * Delete terminal JobRun rows older than the retention window. Bounded by
 * `maxBatches * batchSize` so one run cannot lock the table for a long period.
 */
async function pruneJobRuns(db: typeof prisma, cutoff: Date, batchSize: number, maxBatches: number): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await db.jobRun.findMany({
      where: {
        status: { in: TERMINAL_RUN_STATUSES },
        finishedAt: { lt: cutoff },
      },
      select: { id: true },
      take: batchSize,
    });

    if (rows.length === 0) break;

    const ids = rows.map((row) => row.id);
    await db.jobRun.deleteMany({ where: { id: { in: ids } } });
    deleted += ids.length;

    if (rows.length < batchSize) break;
  }
  return deleted;
}

/**
 * Delete JobLease rows that have been stale beyond the retention window.
 * `leaseUntil` and `heartbeatAt` must both be older than the cutoff.
 */
async function pruneJobLeases(db: typeof prisma, cutoff: Date, batchSize: number): Promise<number> {
  // JobLeases are one row per schedule, so a single bounded deleteMany call is
  // enough; still honour the batch size to keep locks short.
  const rows = await db.jobLease.findMany({
    where: {
      leaseUntil: { lt: cutoff },
      heartbeatAt: { lt: cutoff },
    },
    select: { id: true },
    take: batchSize,
  });

  if (rows.length === 0) return 0;

  const ids = rows.map((row) => row.id);
  await db.jobLease.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

/**
 * Execute the retention/pruning work (idempotent, bounded). Safe to call from
 * cron/admin maintenance handlers; it does not itself acquire the lease.
 */
export async function runJobRetentionPrune(options: JobPruneOptions = {}): Promise<JobPruneResult> {
  const now = options.now ?? new Date();
  const runDays = options.runRetentionDays ?? JOB_RUN_RETENTION_DAYS;
  const leaseDays = options.leaseRetentionDays ?? JOB_LEASE_RETENTION_DAYS;
  const batchSize = options.batchSize ?? JOB_PRUNE_BATCH_SIZE;
  const maxBatches = options.maxBatches ?? JOB_PRUNE_MAX_BATCHES;

  const runCutoff = new Date(now.getTime() - runDays * 86_400_000);
  const leaseCutoff = new Date(now.getTime() - leaseDays * 86_400_000);

  const deletedJobRuns = await pruneJobRuns(prisma, runCutoff, batchSize, maxBatches);
  const deletedJobLeases = await pruneJobLeases(prisma, leaseCutoff, batchSize);

  console.log(
    '[JobRetention] Pruned',
    deletedJobRuns,
    'job_runs and',
    deletedJobLeases,
    'job_leases older than the retention window',
  );

  return { deletedJobRuns, deletedJobLeases, batches: maxBatches };
}

/**
 * Cluster-safe pruning entry point: runs the pruning under a durable lease so
 * two workers can never perform destructive cleanup concurrently.
 */
export async function executeJobRetentionPrune(options: JobPruneOptions = {}): Promise<void> {
  await executeTrackedJob({
    jobId: JOB_PRUNE_JOB_ID,
    jobType: 'maintenance',
    handler: async () => runJobRetentionPrune(options),
  });
}
