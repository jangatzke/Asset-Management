import { slaService } from './sla.service';
import { executeTrackedJob } from './jobRunner.service';

/** Periodically scans open tickets for SLA breaches with a cluster-safe lease. */
export class SlaScheduler {
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
    const config = await slaService.getConfig() as any;
    if (!config?.enabled) {
      console.log('[SlaScheduler] SLA escalation is disabled.');
      return;
    }
    const delayMs = Math.max(60_000, (config.intervalMinutes ?? 60) * 60_000);
    console.log(`[SlaScheduler] Next SLA breach scan in ${Math.round(delayMs / 60_000)} minutes`);
    this.timer = setTimeout(() => {
      // runOnce is async; attach a catch so a failure inside the timer callback
      // does not become an unhandled promise rejection.
      this.runOnce().catch((error) => {
        console.error('[SlaScheduler] Unexpected error in runOnce:', error);
      });
    }, delayMs);
  }

  private async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await executeTrackedJob({
        jobId: 'sla-breach-scan',
        jobType: 'sla-breach',
        handler: async () => {
          const result = await slaService.scanBreach('system');
          console.log('[SlaScheduler] SLA breach scan completed:', result);
        },
      });
    } catch (error) {
      console.error('[SlaScheduler] SLA breach scan failed:', error);
    } finally {
      this.running = false;
      this.timer = null;
      await this.scheduleNext();
    }
  }
}

let slaScheduler: SlaScheduler | null = null;

export function initializeSlaScheduler(): SlaScheduler {
  slaScheduler = new SlaScheduler();
  return slaScheduler;
}

export function getSlaScheduler(): SlaScheduler | null {
  return slaScheduler;
}
