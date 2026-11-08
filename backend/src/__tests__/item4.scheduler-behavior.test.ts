/**
 * Item 4: IntervalScheduler failure-backoff behaviour and skip neutrality.
 *
 * executeTrackedJob is mocked so these tests isolate scheduler state
 * transitions (failure counter, reset on success, unchanged on lease-skip).
 */

jest.mock('../services/jobRunner.service', () => {
  const actual = jest.requireActual('../services/jobRunner.service');
  return { ...actual, executeTrackedJob: jest.fn() };
});

import { executeTrackedJob } from '../services/jobRunner.service';
import {
  IntervalScheduler,
  SCHEDULER_MAX_BACKOFF_MS,
  computeSchedulerDelayMs,
} from '../services/intervalScheduler';

const mockedExecute = executeTrackedJob as unknown as jest.Mock;

const job = {
  name: 'TestScheduler',
  jobId: 'test-scheduler-job',
  jobType: 'maintenance',
  defaultIntervalMinutes: 10,
  getConfig: jest.fn(async () => ({ enabled: true, intervalMinutes: 10 })),
  handler: jest.fn(async () => undefined),
};

/** Delay (ms) passed to the most recent setTimeout call. */
function lastTimerDelay(spy: jest.SpyInstance): number {
  const calls = spy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return Number(calls[calls.length - 1][1]);
}

let timerSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  job.getConfig.mockResolvedValue({ enabled: true, intervalMinutes: 10 });
  // Record timer arming without scheduling real timers.
  timerSpy = jest.spyOn(global, 'setTimeout').mockImplementation((() => 0 as unknown as NodeJS.Timeout) as typeof setTimeout);
});

afterEach(() => {
  timerSpy.mockRestore();
});

describe('Item 4: IntervalScheduler consecutive-failure backoff', () => {
  it('increments the failure counter and backs off after a failed run', async () => {
    mockedExecute.mockRejectedValueOnce(new Error('handler blew up'));
    const scheduler = new IntervalScheduler(job, { random: () => 0 });

    await scheduler.runOnce();

    expect(scheduler.getConsecutiveFailures()).toBe(1);
    // One failure doubles the 10-minute semantic interval (600_000 ms).
    expect(lastTimerDelay(timerSpy)).toBeGreaterThanOrEqual(600_000);
  });

  it('resets the failure counter after a successful run', async () => {
    mockedExecute.mockRejectedValueOnce(new Error('boom'));
    const scheduler = new IntervalScheduler(job, { random: () => 0 });

    await scheduler.runOnce();
    expect(scheduler.getConsecutiveFailures()).toBe(1);

    mockedExecute.mockResolvedValueOnce({ status: 'completed', jobId: job.jobId, jobRunId: 'run-1' });
    await scheduler.runOnce();
    expect(scheduler.getConsecutiveFailures()).toBe(0);
  });

  it('treats lease-loss skips as neutral (counter unchanged, no backoff growth)', async () => {
    mockedExecute.mockRejectedValueOnce(new Error('boom'));
    const scheduler = new IntervalScheduler(job, { random: () => 0 });

    await scheduler.runOnce();
    expect(scheduler.getConsecutiveFailures()).toBe(1);

    mockedExecute.mockResolvedValueOnce({ status: 'skipped', jobId: job.jobId, jobRunId: '' });
    await scheduler.runOnce();
    // Skip neither resets nor increments: peers must not corrupt the winner's
    // backoff state.
    expect(scheduler.getConsecutiveFailures()).toBe(1);
  });

  it('caps failure backoff at the 24h ceiling', () => {
    // A 6h interval hit with 32 failures: 6h * 8 (multiplier cap) = 48h, which
    // must be clamped to the absolute 24h ceiling.
    const delay = computeSchedulerDelayMs(6 * 60 * 60_000, 32, () => 0);
    expect(delay).toBe(SCHEDULER_MAX_BACKOFF_MS);
  });

  it('arms no timer and does not run when the schedule is disabled', async () => {
    job.getConfig.mockResolvedValue({ enabled: false });
    const scheduler = new IntervalScheduler(job, { random: () => 0 });

    await scheduler.start();

    expect(timerSpy).not.toHaveBeenCalled();
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});
