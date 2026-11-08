/**
 * Shared interval-scheduler primitive.
 *
 * Several background schedulers (reminders, SLA scans, e-mail gateway polling)
 * followed the same pattern: read a live config, arm a self-rescheduling
 * setTimeout, run one tracked job with error isolation, then re-arm. This class
 * centralises that loop so each concrete scheduler is just a job definition.
 *
 * Item 4 resilience additions:
 *  - Exponential backoff per job on consecutive failures (bounded), reset on
 *    success. A `skipped` outcome (another cluster worker holds the lease) is
 *    neither a success nor a failure and does not change the counter.
 *  - Per-worker jitter on the armed timer so cluster workers do not fire the
 *    same schedule simultaneously. Jitter only shifts the actual timer; the
 *    semantic interval shown in logs / config stays authoritative.
 */

import { executeTrackedJob } from './jobRunner.service';

export interface IntervalJobDefinition {
  /** Prefix used in log lines, e.g. 'ReminderScheduler'. */
  name: string;
  /** Stable id passed to executeTrackedJob (cluster-safe lease key). */
  jobId: string;
  /** Job type recorded by the job runner. */
  jobType: string;
  /** Fallback interval when the config omits or invalidates the interval field. */
  defaultIntervalMinutes: number;
  /** Reads the live configuration; a falsy/missing `enabled` keeps the scheduler idle. */
  getConfig: () => Promise<{ enabled?: unknown; [key: string]: unknown } | null>;
  /** Config field holding the interval in minutes (default: 'intervalMinutes'). */
  intervalField?: string;
  /** The actual work performed on each tick; errors are caught and logged. */
  handler: () => Promise<unknown>;
}

export interface IntervalSchedulerOptions {
  /** Injectable PRNG for tests (defaults to Math.random). */
  random?: () => number;
  /** Max consecutive-failure multiplier applied to the base interval. */
  maxBackoffMultiplier?: number;
}

/** Never re-arm faster than one minute, regardless of config. */
const MIN_INTERVAL_MS = 60_000;

/** Upper bound for failure backoff so a broken job never stalls forever. */
export const SCHEDULER_MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;

/** Default cap on the exponential multiplier applied to a failing schedule. */
export const SCHEDULER_MAX_BACKOFF_MULTIPLIER = 8;

/** Largest jitter offset added per tick (also bounded to 10% of the interval). */
export const SCHEDULER_MAX_JITTER_MS = 60_000;

/**
 * Compute the delay for the next tick.
 *
 * `intervalMs` is the semantic interval (what admins configure and what logs
 * report). `consecutiveFailures` drives exponential backoff. When failures are
 * 0 the delay is the interval plus jitter only; when failures are >0 the delay
 * grows as `intervalMs * 2^failures`, bounded by `maxBackoffMultiplier` and
 * `SCHEDULER_MAX_BACKOFF_MS`.
 *
 * Jitter is a random offset in [0, min(intervalMs*0.1, SCHEDULER_MAX_JITTER_MS)]
 * added to the backoff delay. It spreads cluster workers out without changing
 * the documented interval semantics (average delay stays close, upper bound is
 * bounded).
 */
export function computeSchedulerDelayMs(
  intervalMs: number,
  consecutiveFailures: number,
  rand: () => number = Math.random,
  maxBackoffMultiplier: number = SCHEDULER_MAX_BACKOFF_MULTIPLIER,
): number {
  const failures = Math.max(0, Math.min(consecutiveFailures, 32));
  const multiplier = failures === 0 ? 1 : Math.min(2 ** failures, maxBackoffMultiplier);
  const backoffDelay = Math.min(SCHEDULER_MAX_BACKOFF_MS, intervalMs * multiplier);
  const jitterWindow = Math.min(Math.floor(intervalMs * 0.1), SCHEDULER_MAX_JITTER_MS);
  const jitter = Math.floor(Math.max(0, Math.min(1, rand())) * jitterWindow);
  return backoffDelay + jitter;
}

export class IntervalScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private readonly random: () => number;
  private readonly maxBackoffMultiplier: number;

  constructor(
    private readonly job: IntervalJobDefinition,
    options: IntervalSchedulerOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.maxBackoffMultiplier = options.maxBackoffMultiplier ?? SCHEDULER_MAX_BACKOFF_MULTIPLIER;
  }

  async start(): Promise<void> {
    if (this.timer) return;
    await this.scheduleNext();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /** Current consecutive-failure count (0 after a successful run). */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Run a single tracked execution with error isolation, then re-arm the timer.
   * Concurrent invocations are collapsed: if a run is already in flight, this
   * call returns immediately.
   */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await executeTrackedJob({
        jobId: this.job.jobId,
        jobType: this.job.jobType,
        handler: async () => {
          const result = await this.job.handler();
          console.log(`[${this.job.name}] Job completed:`, result);
        },
      });

      // Lease-loss (`skipped`) is not a failure and not a success: another
      // worker owns this schedule. Leave the failure counter unchanged so a
      // winning worker's backoff state is not corrupted by peers.
      if (result.status === 'completed') {
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      // A failed tracked run (deterministic error or exhausted retries) drives
      // exponential backoff for this schedule.
      this.consecutiveFailures += 1;
      console.error(`[${this.job.name}] Job failed:`, error);
    } finally {
      this.running = false;
      this.timer = null;
      await this.scheduleNext();
    }
  }

  private async scheduleNext(): Promise<void> {
    const config = await this.job.getConfig();
    if (!config || !config.enabled) {
      console.log(`[${this.job.name}] Automation is disabled.`);
      return;
    }
    const field = this.job.intervalField ?? 'intervalMinutes';
    const intervalMinutes = Number(config[field]);
    const intervalMs = Math.max(
      MIN_INTERVAL_MS,
      (Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : this.job.defaultIntervalMinutes) * 60_000,
    );
    // Log the semantic interval (what admins configure), not the jittered timer.
    const semanticMinutes = Math.round(intervalMs / 60000);
    const failures = this.consecutiveFailures;
    const delayMs = computeSchedulerDelayMs(intervalMs, failures, this.random, this.maxBackoffMultiplier);
    if (failures > 0) {
      console.log(
        `[${this.job.name}] Next run in ${semanticMinutes} minutes after ${failures} consecutive failure(s); backoff timer in ${Math.round(delayMs / 60000)} minutes`,
      );
    } else {
      console.log(`[${this.job.name}] Next run in ${semanticMinutes} minutes`);
    }
    this.timer = setTimeout(() => {
      // runOnce is async; attach a catch so a failure inside the timer callback
      // does not become an unhandled promise rejection.
      this.runOnce().catch((error) => {
        console.error(`[${this.job.name}] Unexpected error in runOnce:`, error);
      });
    }, delayMs);
  }
}
