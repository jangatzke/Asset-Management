import { reminderService } from './reminder.service';
import { IntervalScheduler } from './intervalScheduler';

/** Periodically runs due reminder automations with a cluster-safe lease. */
export function createReminderScheduler(): IntervalScheduler {
  return new IntervalScheduler({
    name: 'ReminderScheduler',
    jobId: 'reminder-scheduler',
    jobType: 'reminder',
    defaultIntervalMinutes: 1440,
    getConfig: () => reminderService.getConfig() as any,
    handler: async () => reminderService.runAllDue('system'),
  });
}

let reminderScheduler: IntervalScheduler | null = null;

export function initializeReminderScheduler(): IntervalScheduler {
  reminderScheduler = createReminderScheduler();
  return reminderScheduler;
}

export function getReminderScheduler(): IntervalScheduler | null {
  return reminderScheduler;
}
