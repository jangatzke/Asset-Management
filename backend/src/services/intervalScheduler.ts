/**
 * Shared interval-scheduler primitive.
 *
 * Several background schedulers (reminders, SLA scans, e-mail gateway polling)
 * followed the same pattern: read a live config, arm a self-rescheduling
 * setTimeout, run one tracked job with error isolation, then re-arm. This class
 * centralises that loop so each concrete scheduler is just a job definition.
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

/** Never re-arm faster than one minute, regardless of config. */
const MIN_INTERVAL_MS = 60_000;

export class IntervalScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly job: IntervalJobDefinition) {}

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

  /**
   * Run a single tracked execution with error isolation, then re-arm the timer.
   * Concurrent invocations are collapsed: if a run is already in flight, this
   * call returns immediately.
   */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await executeTrackedJob({
        jobId: this.job.jobId,
        jobType: this.job.jobType,
        handler: async () => {
          const result = await this.job.handler();
          console.log(`[${this.job.name}] Job completed:`, result);
        },
      });
    } catch (error) {
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
    const delayMs = Math.max(
      MIN_INTERVAL_MS,
      (Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : this.job.defaultIntervalMinutes) * 60_000,
    );
    console.log(`[${this.job.name}] Next run in ${Math.round(delayMs / 60000)} minutes`);
    this.timer = setTimeout(() => {
      // runOnce is async; attach a catch so a failure inside the timer callback
      // does not become an unhandled promise rejection.
      this.runOnce().catch((error) => {
        console.error(`[${this.job.name}] Unexpected error in runOnce:`, error);
      });
    }, delayMs);
  }
}
