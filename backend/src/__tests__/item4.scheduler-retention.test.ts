/**
 * Item 4: scheduler backoff/jitter, retry classification and retention bounds.
 *
 * These tests exercise the pure scheduling/backoff helpers plus the bounded,
 * batch-based pruning policy without needing a live database.
 */

const mockJobRunFindMany = jest.fn();
const mockJobRunDeleteMany = jest.fn();
const mockJobLeaseFindMany = jest.fn();
const mockJobLeaseDeleteMany = jest.fn();
const mockQueryRaw = jest.fn();

const mockPrisma = {
  $queryRaw: mockQueryRaw,
  jobRun: { findMany: mockJobRunFindMany, deleteMany: mockJobRunDeleteMany },
  jobLease: { findMany: mockJobLeaseFindMany, deleteMany: mockJobLeaseDeleteMany },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import {
  computeSchedulerDelayMs,
  SCHEDULER_MAX_BACKOFF_MS,
  SCHEDULER_MAX_JITTER_MS,
} from '../services/intervalScheduler';
import { computeRetryDelayMs } from '../services/jobRunner.service';
import { computeBackoffDelay, isTransientError } from '../services/transientError';
import {
  JOB_RUN_RETENTION_DAYS,
  JOB_LEASE_RETENTION_DAYS,
  runJobRetentionPrune,
} from '../services/jobRetention.service';

describe('Item 4: scheduler backoff and jitter', () => {
  it('uses the semantic interval plus bounded jitter when there are no failures', () => {
    const intervalMs = 60_000;
    expect(computeSchedulerDelayMs(intervalMs, 0, () => 0)).toBe(intervalMs);
    expect(computeSchedulerDelayMs(intervalMs, 0, () => 0.5)).toBe(intervalMs + 3_000);
  });

  it('grows exponentially with consecutive failures', () => {
    const intervalMs = 60_000;
    expect(computeSchedulerDelayMs(intervalMs, 1, () => 0)).toBe(120_000);
    expect(computeSchedulerDelayMs(intervalMs, 2, () => 0)).toBe(240_000);
    expect(computeSchedulerDelayMs(intervalMs, 3, () => 0)).toBe(480_000);
  });

  it('caps the backoff multiplier and the absolute delay', () => {
    // 2^10 exceeds the multiplier cap (8): capped delay before the 24h ceiling.
    expect(computeSchedulerDelayMs(60_000, 10, () => 0)).toBe(480_000);
    // A very large interval cannot exceed the absolute 24h ceiling.
    const delay = computeSchedulerDelayMs(10 * 3_600_000, 3, () => 0);
    expect(delay).toBe(SCHEDULER_MAX_BACKOFF_MS);
    expect(delay + SCHEDULER_MAX_JITTER_MS).toBeGreaterThanOrEqual(delay);
  });

  it('never produces negative or unbounded jitter', () => {
    const delay = computeSchedulerDelayMs(60_000, 0, () => 2.5);
    expect(delay).toBe(66_000);
    expect(computeSchedulerDelayMs(60_000, 0, () => -1)).toBe(60_000);
  });
});

describe('Item 4: retry backoff', () => {
  it('grows per failed attempt and is capped', () => {
    expect(computeBackoffDelay(1, 1000, 30_000, () => 1)).toBe(1000);
    expect(computeBackoffDelay(2, 1000, 30_000, () => 1)).toBe(2000);
    expect(computeBackoffDelay(3, 1000, 30_000, () => 1)).toBe(4000);
    expect(computeBackoffDelay(8, 1000, 30_000, () => 1)).toBe(30_000);
  });

  it('applies jitter into [50%, 100%] of the capped delay', () => {
    expect(computeBackoffDelay(3, 1000, 30_000, () => 0)).toBe(2000);
    expect(computeBackoffDelay(3, 1000, 30_000, () => 0.5)).toBe(3000);
    expect(computeRetryDelayMs(3, () => 1)).toBe(4_000);
  });
});

describe('Item 4: transient error classification', () => {
  it('retries known transient infrastructure codes', () => {
    for (const code of ['P1001', 'P1017', 'P2024', 'P2034', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'EPIPE']) {
      expect(isTransientError({ code })).toBe(true);
    }
  });

  it('retries network/transport-shaped failures', () => {
    expect(isTransientError({ message: 'socket hang up' })).toBe(true);
    expect(isTransientError({ message: 'the database connection timed out' })).toBe(true);
    expect(isTransientError({ message: 'SMTP transport timed out while connecting' })).toBe(true);
  });

  it('never retries deterministic business/validation failures', () => {
    expect(isTransientError({ code: 'EAUTH' })).toBe(false);
    expect(isTransientError({ code: 'P2002', message: 'connection reset' })).toBe(false);
    expect(isTransientError({ message: 'validation failed', statusCode: 400 })).toBe(false);
    expect(isTransientError({ message: 'ticket reference is invalid' })).toBe(false);
  });
});

describe('Item 4: retention pruning bounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes terminal JobRuns in bounded batches and stops when drained', async () => {
    mockJobRunFindMany
      .mockResolvedValueOnce(Array.from({ length: 3 }, (_, i) => ({ id: `run-${i}` })))
      .mockResolvedValueOnce([]);
    mockJobRunDeleteMany.mockResolvedValue({ count: 3 });
    mockJobLeaseFindMany.mockResolvedValue([]);
    mockJobLeaseDeleteMany.mockResolvedValue({ count: 0 });

    const result = await runJobRetentionPrune({ batchSize: 3, maxBatches: 5, now: new Date('2026-11-05T00:00:00Z') });

    expect(result.deletedJobRuns).toBe(3);
    expect(mockJobRunFindMany).toHaveBeenCalledTimes(2);
    expect(mockJobRunDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['run-0', 'run-1', 'run-2'] } } });
    expect(mockJobRunFindMany.mock.calls[0][0].where.status.in).toEqual(['completed', 'skipped', 'failed']);
    expect(mockJobRunFindMany.mock.calls[0][0].take).toBe(3);
  });

  it('honours maxBatches as a hard upper bound', async () => {
    mockJobRunFindMany.mockResolvedValue([{ id: 'run-1' }, { id: 'run-2' }]);
    mockJobRunDeleteMany.mockResolvedValue({ count: 2 });
    mockJobLeaseFindMany.mockResolvedValue([]);

    await runJobRetentionPrune({ batchSize: 2, maxBatches: 3, now: new Date('2026-11-05T00:00:00Z') });

    expect(mockJobRunFindMany).toHaveBeenCalledTimes(3);
    expect(mockJobRunDeleteMany).toHaveBeenCalledTimes(3);
  });

  it('only prunes leases stale beyond the lease retention window', async () => {
    mockJobRunFindMany.mockResolvedValue([]);
    mockJobLeaseFindMany.mockResolvedValue([{ id: 'lease-stale' }]);
    const now = new Date('2026-11-05T00:00:00Z');

    await runJobRetentionPrune({ batchSize: 10, maxBatches: 1, now });

    const where = mockJobLeaseFindMany.mock.calls[0][0].where;
    expect(where.leaseUntil.lt).toEqual(new Date(now.getTime() - JOB_LEASE_RETENTION_DAYS * 86_400_000));
    expect(where.heartbeatAt.lt).toEqual(where.leaseUntil.lt);
    expect(mockJobLeaseDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['lease-stale'] } } });
  });

  it('uses the documented default retention windows', () => {
    expect(JOB_RUN_RETENTION_DAYS).toBe(30);
    expect(JOB_LEASE_RETENTION_DAYS).toBe(7);
  });
});
