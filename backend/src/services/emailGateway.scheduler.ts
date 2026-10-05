import { emailGatewayService } from './emailGateway.service';
import { IntervalScheduler } from './intervalScheduler';

/** Periodically polls the configured ticket mailbox with a cluster-safe lease. */
export function createEmailGatewayScheduler(): IntervalScheduler {
  return new IntervalScheduler({
    name: 'EmailGatewayScheduler',
    jobId: 'ticket-email-gateway',
    jobType: 'email-gateway',
    defaultIntervalMinutes: 5,
    intervalField: 'pollIntervalMinutes',
    getConfig: () => emailGatewayService.getConfig() as any,
    handler: async () => emailGatewayService.pollInbound('email-gateway'),
  });
}

let emailGatewayScheduler: IntervalScheduler | null = null;

export function initializeEmailGatewayScheduler(): IntervalScheduler {
  emailGatewayScheduler = createEmailGatewayScheduler();
  return emailGatewayScheduler;
}

export function getEmailGatewayScheduler(): IntervalScheduler | null {
  return emailGatewayScheduler;
}
