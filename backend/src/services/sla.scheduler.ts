import { slaService } from './sla.service';
import { IntervalScheduler } from './intervalScheduler';

/** Periodically scans open tickets for SLA breaches with a cluster-safe lease. */
export function createSlaScheduler(): IntervalScheduler {
  return new IntervalScheduler({
    name: 'SlaScheduler',
    jobId: 'sla-breach-scan',
    jobType: 'sla-breach',
    defaultIntervalMinutes: 60,
    getConfig: () => slaService.getConfig() as any,
    handler: async () => slaService.scanBreach('system'),
  });
}

let slaScheduler: IntervalScheduler | null = null;

export function initializeSlaScheduler(): IntervalScheduler {
  slaScheduler = createSlaScheduler();
  return slaScheduler;
}

export function getSlaScheduler(): IntervalScheduler | null {
  return slaScheduler;
}
