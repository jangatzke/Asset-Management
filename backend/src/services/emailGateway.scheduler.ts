import { emailGatewayService } from './emailGateway.service';
import { executeTrackedJob } from './jobRunner.service';

/** Periodically polls the configured ticket mailbox with a cluster-safe lease. */
export class EmailGatewayScheduler {
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
    const config = await emailGatewayService.getConfig() as any;
    if (!config?.enabled) {
      console.log('[EmailGatewayScheduler] E-mail-to-ticket gateway is disabled.');
      return;
    }
    const delayMs = Math.max(60_000, (config.pollIntervalMinutes ?? 5) * 60_000);
    console.log(`[EmailGatewayScheduler] Next mailbox poll in ${Math.round(delayMs / 60_000)} minutes`);
    this.timer = setTimeout(() => {
      this.runOnce().catch((error) => console.error('[EmailGatewayScheduler] Unexpected error in runOnce:', error));
    }, delayMs);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await executeTrackedJob({
        jobId: 'ticket-email-gateway',
        jobType: 'email-gateway',
        handler: async () => {
          const result = await emailGatewayService.pollInbound('email-gateway');
          console.log('[EmailGatewayScheduler] Mailbox poll completed:', result);
        },
      });
    } catch (error) {
      console.error('[EmailGatewayScheduler] Mailbox poll failed:', error);
    } finally {
      this.running = false;
      this.timer = null;
      await this.scheduleNext();
    }
  }
}

let emailGatewayScheduler: EmailGatewayScheduler | null = null;

export function initializeEmailGatewayScheduler(): EmailGatewayScheduler {
  emailGatewayScheduler = new EmailGatewayScheduler();
  return emailGatewayScheduler;
}

export function getEmailGatewayScheduler(): EmailGatewayScheduler | null {
  return emailGatewayScheduler;
}
