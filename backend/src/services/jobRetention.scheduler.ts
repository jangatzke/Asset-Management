import { IntervalScheduler } from './intervalScheduler';
import { executeJobRetentionPrune } from './jobRetention.service';

/**
 * Maintenance scheduler for JobRun/JobLease retention pruning.
 *
 * The pruning work itself is cluster-safe: it runs through executeTrackedJob
 * under the `job-retention-prune` lease, so even when multiple instances arm
 * this timer only one worker performs destructive cleanup per tick.
 *
 * `getConfig` returns a static enabled config; the interval is fixed at 6
 * hours (configurable via JOB_RETENTION_INTERVAL_MINUTES).
 */
function retentionIntervalMinutes(): number {
  const parsed = Number(process.env.JOB_RETENTION_INTERVAL_MINUTES);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1440) return 360;
  return parsed;
}

export function createJobRetentionScheduler(): IntervalScheduler {
  return new IntervalScheduler({
    name: 'JobRetentionScheduler',
    jobId: 'job-retention-prune',
    jobType: 'maintenance',
    defaultIntervalMinutes: retentionIntervalMinutes(),
    getConfig: async () => ({ enabled: true, intervalMinutes: retentionIntervalMinutes() }),
    handler: async () => executeJobRetentionPrune(),
  });
}

let jobRetentionScheduler: IntervalScheduler | null = null;

export function initializeJobRetentionScheduler(): IntervalScheduler {
  jobRetentionScheduler = createJobRetentionScheduler();
  return jobRetentionScheduler;
}

export function getJobRetentionScheduler(): IntervalScheduler | null {
  return jobRetentionScheduler;
}
