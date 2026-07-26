import { reminderService } from './reminder.service';
import { executeTrackedJob } from './jobRunner.service';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

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

  private async scheduleNext(): Promise<void> {
    const config = await reminderService.getConfig() as any;
    if (!config?.enabled) {
      console.log('[ReminderScheduler] Reminder automation is disabled.');
      return;
    }
    const delayMs = Math.max(60_000, (config.intervalMinutes ?? 1440) * 60_000);
    console.log(`[ReminderScheduler] Next reminder run in ${Math.round(delayMs / 60000)} minutes`);
    this.timer = setTimeout(() => this.runOnce(), delayMs);
  }

  private async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Wrap reminder execution with tracked job runner for cluster-safety.
      await executeTrackedJob({
        jobId: 'reminder-scheduler',
        jobType: 'reminder',
        handler: async () => {
          const result = await reminderService.runAllDue('system');
          console.log('[ReminderScheduler] Reminder run completed:', result);
        },
      });
    } catch (error) {
      console.error('[ReminderScheduler] Reminder run failed:', error);
    } finally {
      this.running = false;
      this.timer = null;
      await this.scheduleNext();
    }
  }
}

let reminderScheduler: ReminderScheduler | null = null;

export function initializeReminderScheduler(): ReminderScheduler {
  reminderScheduler = new ReminderScheduler();
  return reminderScheduler;
}

export function getReminderScheduler(): ReminderScheduler | null {
  return reminderScheduler;
}
