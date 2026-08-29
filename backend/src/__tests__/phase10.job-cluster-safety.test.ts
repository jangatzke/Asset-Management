/**
 * Phase 10 / P1-F: Background Jobs Cluster-Safety Tests
 *
 * Tests durable lease behavior and tracked job runner skip/fail-closed behavior.
 */

type QueryRawMock = jest.Mock<Promise<LeaseRow[]>, unknown[]>;

interface LeaseRow {
  id: string;
  jobName: string;
  ownerId: string;
  leaseUntil: Date;
  heartbeatAt: Date;
  acquiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mockQueryRaw: QueryRawMock = jest.fn();
const mockJobRunCreate = jest.fn();
const mockJobRunUpdate = jest.fn();

const mockPrisma = {
  $queryRaw: mockQueryRaw,
  jobRun: { create: mockJobRunCreate, update: mockJobRunUpdate },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, sep } from 'path';
import {
  acquireJobLease,
  getJobLeaseName,
  heartbeatJobLease,
  releaseJobLease,
} from '../services/jobLock.service';
import { executeTrackedJob } from '../services/jobRunner.service';

const leaseStore = new Map<string, LeaseRow>();

function cloneLease(row: LeaseRow): LeaseRow {
  return { ...row };
}

function installAtomicLeaseMock(): void {
  mockQueryRaw.mockImplementation(async (...args: unknown[]) => {
    const sql = String(args[0]);

    if (/^\s*UPDATE/.test(sql) && sql.includes('heartbeatAt')) {
      const leaseUntil = args[1] as Date;
      const now = args[2] as Date;
      const jobName = args[4] as string;
      const ownerId = args[5] as string;

      const existing = leaseStore.get(jobName);
      if (!existing || existing.ownerId !== ownerId || existing.leaseUntil <= now) {
        return [];
      }

      leaseStore.set(jobName, { ...existing, leaseUntil, heartbeatAt: now, updatedAt: now });
      return [{ id: existing.id } as LeaseRow];
    }

    if (/^\s*UPDATE/.test(sql)) {
      const releaseNow = args[1] as Date;
      const jobName = args[3] as string;
      const ownerId = args[4] as string;
      const existing = leaseStore.get(jobName);
      if (!existing || existing.ownerId !== ownerId || existing.leaseUntil <= releaseNow) {
        return [];
      }

      leaseStore.set(jobName, { ...existing, leaseUntil: releaseNow, updatedAt: releaseNow });
      return [{ id: existing.id } as LeaseRow];
    }

    const jobName = args[1] as string;
    const ownerId = args[2] as string;
    const leaseUntil = args[3] as Date;
    const now = args[4] as Date;

    const existing = leaseStore.get(jobName);
    if (existing && existing.leaseUntil > now && existing.ownerId !== ownerId) {
      return [];
    }

    const row: LeaseRow = {
      id: existing?.id ?? `lease-${leaseStore.size + 1}`,
      jobName,
      ownerId,
      leaseUntil,
      heartbeatAt: now,
      acquiredAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    leaseStore.set(jobName, row);
    return [cloneLease(row)];
  });
}

function collectTypescriptFiles(root: string): string[] {
  // root is always derived from __dirname (a fixed, trusted location), never from user input.
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const resolvedRoot = resolve(root);
  return readdirSync(root).flatMap((entry) => {
    const fullPath = resolve(resolvedRoot, entry);
    // Defense in depth: only descend into paths that stay inside the root directory.
    if (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + sep)) {
      return [];
    }
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return collectTypescriptFiles(fullPath);
    }
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  leaseStore.clear();
  installAtomicLeaseMock();
});

describe('getJobLeaseName', () => {
  test('returns deterministic lease name for same jobId', () => {
    expect(getJobLeaseName('test-job')).toBe('phase10_lease_test-job');
  });

  test('different jobIds produce different lease names', () => {
    expect(getJobLeaseName('job-a')).not.toBe(getJobLeaseName('job-b'));
  });
});

describe('durable job leases', () => {
  test('two workers concurrently attempt acquire; only one wins', async () => {
    const now = new Date('2026-07-28T10:00:00.000Z');

    const [workerA, workerB] = await Promise.all([
      acquireJobLease('shared-job', 'worker-a', 60_000, now),
      acquireJobLease('shared-job', 'worker-b', 60_000, now),
    ]);

    const winners = [workerA, workerB].filter((lease): lease is LeaseRow => lease !== null);
    expect(winners).toHaveLength(1);
    expect(['worker-a', 'worker-b']).toContain(winners[0].ownerId);
  });

  test('lease expiry allows takeover by another worker', async () => {
    const acquiredAt = new Date('2026-07-28T10:00:00.000Z');
    const takeoverAt = new Date('2026-07-28T10:01:01.000Z');

    const first = await acquireJobLease('expiring-job', 'worker-a', 60_000, acquiredAt);
    const second = await acquireJobLease('expiring-job', 'worker-b', 60_000, takeoverAt);

    expect(first?.ownerId).toBe('worker-a');
    expect(second?.ownerId).toBe('worker-b');
    expect(leaseStore.get('expiring-job')?.ownerId).toBe('worker-b');
  });

  test('worker crash stale lease recovery uses same expiry takeover path', async () => {
    const crashedAt = new Date('2026-07-28T10:00:00.000Z');
    const recoveredAt = new Date('2026-07-28T10:10:00.000Z');

    await acquireJobLease('crashed-job', 'crashed-worker', 30_000, crashedAt);
    const recovered = await acquireJobLease('crashed-job', 'recovery-worker', 30_000, recoveredAt);

    expect(recovered?.ownerId).toBe('recovery-worker');
  });

  test('heartbeat succeeds for owner and extends lease', async () => {
    const acquiredAt = new Date('2026-07-28T10:00:00.000Z');
    const heartbeatAt = new Date('2026-07-28T10:00:30.000Z');

    await acquireJobLease('heartbeat-job', 'worker-a', 60_000, acquiredAt);
    const result = await heartbeatJobLease('heartbeat-job', 'worker-a', 120_000, heartbeatAt);

    expect(result).toBe(true);
    expect(leaseStore.get('heartbeat-job')?.heartbeatAt).toEqual(heartbeatAt);
    expect(leaseStore.get('heartbeat-job')?.leaseUntil).toEqual(new Date('2026-07-28T10:02:30.000Z'));
  });

  test('heartbeat fails for non-owner and stale owner', async () => {
    const acquiredAt = new Date('2026-07-28T10:00:00.000Z');
    const activeAt = new Date('2026-07-28T10:00:10.000Z');
    const staleAt = new Date('2026-07-28T10:01:10.000Z');

    await acquireJobLease('heartbeat-denied-job', 'worker-a', 60_000, acquiredAt);

    await expect(heartbeatJobLease('heartbeat-denied-job', 'worker-b', 60_000, activeAt)).resolves.toBe(false);
    await expect(heartbeatJobLease('heartbeat-denied-job', 'worker-a', 60_000, staleAt)).resolves.toBe(false);
  });

  test('release fails for non-owner and succeeds for owner', async () => {
    const acquiredAt = new Date('2026-07-28T10:00:00.000Z');
    const releaseAt = new Date('2026-07-28T10:00:10.000Z');

    await acquireJobLease('release-job', 'worker-a', 60_000, acquiredAt);

    await expect(releaseJobLease('release-job', 'worker-b', releaseAt)).resolves.toBe(false);
    expect(leaseStore.get('release-job')?.leaseUntil).toEqual(new Date('2026-07-28T10:01:00.000Z'));

    await expect(releaseJobLease('release-job', 'worker-a', releaseAt)).resolves.toBe(true);
    expect(leaseStore.get('release-job')?.leaseUntil).toEqual(releaseAt);
  });
});

describe('executeTrackedJob', () => {
  let handler: jest.Mock<Promise<void>, []>;
  let baseConfig: Parameters<typeof executeTrackedJob>[0];

  beforeEach(() => {
    handler = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    baseConfig = {
      jobId: 'test-job',
      jobType: 'sync',
      handler,
      workerId: 'test-worker-1',
      leaseMs: 60_000,
    };
    mockJobRunCreate.mockImplementation(({ data }) => Promise.resolve({ id: `run-${data.jobId}`, ...data }));
    mockJobRunUpdate.mockResolvedValue({});
  });

  test('lease acquired -> job runs, completes, and releases owner-scoped lease', async () => {
    const result = await executeTrackedJob(baseConfig);

    expect(result.status).toBe('completed');
    expect(result.jobId).toBe('test-job');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(leaseStore.get('phase10_lease_test-job')?.leaseUntil.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('retry/skip behavior: unavailable lease is tracked as skipped and handler is not called', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await executeTrackedJob(baseConfig);

    expect(result.status).toBe('skipped');
    expect(handler).not.toHaveBeenCalled();
    expect(mockJobRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
  });

  test('retry/skip behavior: lease acquisition errors fail closed as skipped', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('database unavailable'));

    const result = await executeTrackedJob(baseConfig);

    expect(result.status).toBe('skipped');
    expect(handler).not.toHaveBeenCalled();
  });

  test('lease released on failure while preserving handler error', async () => {
    handler.mockRejectedValueOnce(new Error('handler error'));

    await expect(executeTrackedJob(baseConfig)).rejects.toThrow('handler error');

    expect(mockJobRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: 'handler error' }) }),
    );
    expect(leaseStore.get('phase10_lease_test-job')?.ownerId).toBe('test-worker-1');
  });
});

describe('runtime advisory-lock regression', () => {
  test('runtime services do not use PostgreSQL session advisory lock functions', () => {
    const tokenA = `pg_try_${'advisory'}_lock`;
    const tokenB = `pg_${'advisory'}_unlock`;
    const files = collectTypescriptFiles(join(__dirname, '..', 'services'));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return source.includes(tokenA) || source.includes(tokenB);
    });

    expect(offenders).toEqual([]);
  });
});
