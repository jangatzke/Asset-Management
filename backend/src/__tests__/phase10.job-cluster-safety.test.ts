/**
 * Phase 10: Background Jobs Cluster-Safety Tests
 *
 * Tests for advisory lock service and tracked job runner.
 */

var mockPrisma: any = {
  $queryRawUnsafe: jest.fn(),
  jobRun: { create: jest.fn(), update: jest.fn() },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import { tryAcquireAdvisoryLock, releaseAdvisoryLock, getLockKey } from '../services/jobLock.service';
import { executeTrackedJob } from '../services/jobRunner.service';

const mockQueryRaw = mockPrisma.$queryRawUnsafe as jest.MockedFunction<typeof mockPrisma.$queryRawUnsafe>;
const mockJobRunCreate = mockPrisma.jobRun.create as jest.Mock;
const mockJobRunUpdate = mockPrisma.jobRun.update as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getLockKey', () => {
  test('returns deterministic key for same jobId', () => {
    expect(getLockKey('test-job')).toBe('phase10_lock_test-job');
  });

  test('different jobIds produce different keys', () => {
    expect(getLockKey('job-a')).not.toBe(getLockKey('job-b'));
  });
});

describe('tryAcquireAdvisoryLock / releaseAdvisoryLock', () => {
  test('tryAcquireAdvisoryLock returns true when lock acquired', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }]);
    const result = await tryAcquireAdvisoryLock('test-lock');
    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
      'test-lock',
    );
  });

  test('tryAcquireAdvisoryLock returns false when lock unavailable', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ acquired: false }]);
    const result = await tryAcquireAdvisoryLock('test-lock');
    expect(result).toBe(false);
  });

  test('releaseAdvisoryLock returns true when lock was held', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ released: true }]);
    const result = await releaseAdvisoryLock('test-lock');
    expect(result).toBe(true);
  });

  test('releaseAdvisoryLock returns false when lock not held', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ released: false }]);
    const result = await releaseAdvisoryLock('test-lock');
    expect(result).toBe(false);
  });
});

describe('executeTrackedJob', () => {
  let handler: jest.Mock;
  let baseConfig: Parameters<typeof executeTrackedJob>[0];

  beforeEach(() => {
    handler = jest.fn();
    baseConfig = {
      jobId: 'test-job',
      jobType: 'sync',
      handler,
      workerId: 'test-worker-1',
    };
  });

  test('advisory lock acquired -> job runs and completes', async () => {
    handler.mockResolvedValue(undefined);
    mockJobRunCreate.mockResolvedValue({ id: 'run-1', ...baseConfig, status: 'pending' } as any);
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }]); // tryAcquireAdvisoryLock
    mockJobRunUpdate
      .mockResolvedValueOnce({} as any) // set running
      .mockResolvedValueOnce({} as any); // set completed

    const result = await executeTrackedJob(baseConfig);

    expect(result.status).toBe('completed');
    expect(result.jobId).toBe('test-job');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('lock unavailable -> job skipped/tracked', async () => {
    handler.mockResolvedValue(undefined);
    mockJobRunCreate.mockResolvedValue({ id: 'run-2', ...baseConfig, status: 'pending' } as any);
    mockQueryRaw.mockResolvedValueOnce([{ acquired: false }]); // lock not available

    const result = await executeTrackedJob(baseConfig);

    expect(result.status).toBe('skipped');
    expect(handler).not.toHaveBeenCalled();
    const skippedCalls = (mockJobRunUpdate.mock.calls as any[][]).filter(
      (c: any[]) => c[0]?.data?.status === 'skipped',
    );
    expect(skippedCalls.length).toBeGreaterThan(0);
  });

  test('lock released on success in finally block', async () => {
    handler.mockResolvedValue(undefined);
    mockJobRunCreate.mockResolvedValue({ id: 'run-3', ...baseConfig, status: 'pending' } as any);
    mockQueryRaw
      .mockResolvedValueOnce([{ acquired: true }]) // tryAcquireAdvisoryLock
      .mockResolvedValueOnce([{ released: true }]); // releaseAdvisoryLock

    await executeTrackedJob(baseConfig);

    expect(mockQueryRaw).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1)) AS released',
      'phase10_lock_test-job',
    );
  });

  test('lock released on failure (handler throws)', async () => {
    handler.mockRejectedValue(new Error('handler error'));
    mockJobRunCreate.mockResolvedValue({ id: 'run-4', ...baseConfig, status: 'pending' } as any);
    mockQueryRaw
      .mockResolvedValueOnce([{ acquired: true }]) // tryAcquireAdvisoryLock
      .mockResolvedValueOnce([{ released: true }]); // releaseAdvisoryLock

    await expect(executeTrackedJob(baseConfig)).rejects.toThrow('handler error');

    const failedCalls = (mockJobRunUpdate.mock.calls as any[][]).filter(
      (c: any[]) => c[0]?.data?.status === 'failed',
    );
    expect(failedCalls.length).toBeGreaterThan(0);

    expect(mockQueryRaw).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock(hashtext($1)) AS released',
      'phase10_lock_test-job',
    );
  });

  test('job status/attempt/error recorded on failure', async () => {
    handler.mockRejectedValue(new Error('something went wrong'));
    mockJobRunCreate.mockResolvedValue({ id: 'run-5', ...baseConfig, status: 'pending' } as any);
    mockQueryRaw
      .mockResolvedValueOnce([{ acquired: true }]) // tryAcquireAdvisoryLock
      .mockResolvedValueOnce([{ released: false }]); // releaseAdvisoryLock

    await expect(executeTrackedJob(baseConfig)).rejects.toThrow('something went wrong');

    const failedCalls = (mockJobRunUpdate.mock.calls as any[][]).filter(
      (c: any[]) => c[0]?.data?.status === 'failed',
    );
    expect(failedCalls.length).toBeGreaterThan(0);

    const updateData = failedCalls[0][0]?.data as any;
    expect(updateData.error).toBe('something went wrong');
  });

  test('two simulated workers — only one executes logic', async () => {
    mockJobRunCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `run-${data.jobId}-${Date.now()}`, ...data }),
    );

    const handlerA = jest.fn().mockResolvedValue(undefined);
    const handlerB = jest.fn().mockResolvedValue(undefined);

    // Worker 1: lock acquired
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }]);

    const resultA = await executeTrackedJob({ ...baseConfig, jobId: 'shared-job', handler: handlerA });
    expect(resultA.status).toBe('completed');
    expect(handlerA).toHaveBeenCalledTimes(1);

    // Worker 2: lock not available (already held by worker 1)
    mockQueryRaw.mockResolvedValueOnce([{ acquired: false }]);

    const resultB = await executeTrackedJob({ ...baseConfig, jobId: 'shared-job', handler: handlerB });
    expect(resultB.status).toBe('skipped');
    expect(handlerB).not.toHaveBeenCalled();
  });
});
