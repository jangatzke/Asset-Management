import { aiService } from './ai.service';
import { IntervalScheduler } from './intervalScheduler';

/** Periodically runs the AI-assisted routine tasks with a cluster-safe lease. */
export function createAiAssistantScheduler(): IntervalScheduler {
  return new IntervalScheduler({
    name: 'AiAssistantScheduler',
    jobId: 'ai-assistant',
    jobType: 'ai-assistant',
    defaultIntervalMinutes: 1440,
    getConfig: () => aiService.getConfig() as any,
    handler: async () => aiService.runAssistedTasks('system'),
  });
}

let aiAssistantScheduler: IntervalScheduler | null = null;

export function initializeAiAssistantScheduler(): IntervalScheduler {
  aiAssistantScheduler = createAiAssistantScheduler();
  return aiAssistantScheduler;
}

export function getAiAssistantScheduler(): IntervalScheduler | null {
  return aiAssistantScheduler;
}
