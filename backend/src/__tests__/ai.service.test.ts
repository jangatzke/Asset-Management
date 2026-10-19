/**
 * AI assistant service tests: configuration handling (encrypted API key, never
 * returned), the two routine tasks (internal triage comment on tickets, draft
 * KB article from resolved incidents) and the activity protocol entries.
 */

jest.mock('../config/database', () => {
  const prisma: any = {
    aiConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: any) => ({ id: 'ai-config-1', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    aiActivityLog: { create: jest.fn().mockResolvedValue({}) },
    ticket: { findMany: jest.fn().mockResolvedValue([]) },
    knowledgeArticle: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }: any) => ({ id: 'kb-1', ...data })) },
    ticketComment: { create: jest.fn(async ({ data }: any) => ({ id: 'comment-1', ...data })) },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  return { prisma };
});
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../services/displayId.service', () => ({
  nextDisplayId: jest.fn().mockResolvedValue('KB-0001'),
}));
// Deterministic passthrough so the test does not depend on CREDENTIAL_ENCRYPTION_KEY.
jest.mock('../services/credentialEncryption.service', () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value.replace(/^enc:/, ''),
  isEncrypted: (value: string) => value.startsWith('enc:'),
}));

import { prisma } from '../config/database';
import { AiService } from '../services/ai.service';

const mockPrisma = prisma as any;

const baseConfig = {
  id: 'ai-config-1',
  enabled: true,
  baseUrl: 'https://llm.example.com/v1',
  model: 'test-model',
  apiKey: 'enc:secret-key',
  temperature: 0.2,
  maxTokens: 800,
  requestTimeoutSeconds: 30,
  intervalMinutes: 1440,
  summarizeTickets: true,
  knowledgeDrafts: true,
};

const makeService = (completion: () => string) => {
  const post = jest.fn(async (_url: string, body: any) => {
    const system = body.messages[0]?.content ?? '';
    if (system.includes('knowledge manager')) {
      return { data: { choices: [{ message: { content: '```json\n{"title": "VPN outage runbook", "summary": "How to handle VPN outages", "content": "## Problem\\nVPN drops"}\n```' } }] } };
    }
    return { data: { choices: [{ message: { content: completion() } }] } };
  });
  return { service: new AiService({ post } as any), post };
};

describe('AiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.aiConfig.findUnique.mockResolvedValue({ ...baseConfig });
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue(null);
  });

  it('never returns the API key and reports only whether one is configured', async () => {
    const service = new AiService({ post: jest.fn() } as any);
    const config = await service.getConfig();
    expect(config).not.toHaveProperty('apiKey');
    expect(config.apiKeyConfigured).toBe(true);
  });

  it('encrypts a new API key and keeps the existing one on placeholder values', async () => {
    const service = new AiService({ post: jest.fn() } as any);
    await service.updateConfig({ apiKey: 'sk-new' }, 'admin-1');
    let updateData = mockPrisma.aiConfig.update.mock.calls[0][0].data;
    expect(updateData.apiKey).toBe('enc:sk-new');

    mockPrisma.aiConfig.update.mockClear();
    await service.updateConfig({ apiKey: '********' }, 'admin-1');
    updateData = mockPrisma.aiConfig.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('apiKey');
  });

  it('rejects an invalid base URL', async () => {
    const service = new AiService({ post: jest.fn() } as any);
    await expect(service.updateConfig({ baseUrl: 'ftp://nope' }, 'admin-1')).rejects.toThrow(/http:\/\/ or https:\/\//);
  });

  it('adds an internal triage comment per open ticket and logs success', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([
      { id: 't1', displayId: 'TCKT-0001', type: 'incident', title: 'VPN down', description: 'cannot connect', priority: 'high', impact: 'medium', urgency: 'high', assets: [] },
    ]);
    const { service, post } = makeService(() => '- likely VPN cert expiry\n- check gateway logs');
    const result = await service.runAssistedTasks('system');

    expect(result.triageNotes).toBe(1);
    const comment = mockPrisma.ticketComment.create.mock.calls[0][0].data;
    expect(comment.ticketId).toBe('t1');
    expect(comment.isInternal).toBe(true);
    expect(comment.body).toContain('likely VPN cert expiry');
    const activity = mockPrisma.aiActivityLog.create.mock.calls.find((c: any[]) => c[0].data.taskType === 'ticket_triage_note');
    expect(activity[0].data.status).toBe('success');
    expect(activity[0].data.entityLabel).toContain('TCKT-0001');
    // Authorization header must carry the decrypted key.
    expect(post.mock.calls[0][2].headers.Authorization).toBe('Bearer secret-key');
  });

  it('creates a draft KB article from a resolved incident and links it to the ticket', async () => {
    mockPrisma.ticket.findMany.mockImplementation(async (args: any) => {
      // first call = triage scan (none), second = resolved incidents
      if (args.include?.incident) {
        return [{ id: 't9', displayId: 'TCKT-0009', type: 'incident', title: 'VPN outage', description: 'users disconnected', priority: 'high', comments: [] }];
      }
      return [];
    });
    const { service } = makeService(() => 'unused');
    const result = await service.runAssistedTasks('system');

    expect(result.knowledgeDrafts).toBe(1);
    const article = mockPrisma.knowledgeArticle.create.mock.calls[0][0].data;
    expect(article.status).toBe('draft');
    expect(article.category).toBe('incident');
    expect(article.relatedEntityType).toBe('ticket');
    expect(article.relatedEntityId).toBe('t9');
    expect(article.displayId).toBe('KB-0001');
  });

  it('skips incidents that already have a knowledge draft', async () => {
    mockPrisma.ticket.findMany.mockImplementation(async (args: any) => {
      if (args.include?.incident) {
        return [{ id: 't9', displayId: 'TCKT-0009', type: 'incident', title: 'VPN outage', description: '', priority: 'low', comments: [] }];
      }
      return [];
    });
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue({ id: 'kb-existing' });
    const { service } = makeService(() => 'note');
    const result = await service.runAssistedTasks('system');

    expect(result.knowledgeDrafts).toBe(0);
    expect(mockPrisma.knowledgeArticle.create).not.toHaveBeenCalled();
    const skip = mockPrisma.aiActivityLog.create.mock.calls.find((c: any[]) => c[0].data.status === 'skipped');
    expect(skip).toBeTruthy();
  });

  it('logs an error entry when the model call fails but keeps processing', async () => {
    mockPrisma.aiConfig.findUnique.mockResolvedValue({ ...baseConfig, knowledgeDrafts: false });
    mockPrisma.ticket.findMany.mockResolvedValue([
      { id: 't1', displayId: 'TCKT-0001', type: 'incident', title: 'A', description: '', priority: 'low', impact: 'low', urgency: 'low', assets: [] },
    ]);
    const failingPost = jest.fn().mockRejectedValue({ response: { status: 429, data: { error: { message: 'rate limited' } } } });
    const service = new AiService({ post: failingPost } as any);
    const result = await service.runAssistedTasks('system');

    expect(result.triageNotes).toBe(0);
    expect(result.failed).toBe(1);
    const errorEntry = mockPrisma.aiActivityLog.create.mock.calls.find((c: any[]) => c[0].data.status === 'error');
    expect(errorEntry[0].data.errorMessage).toContain('HTTP 429');
  });

  it('refuses to run while disabled', async () => {
    mockPrisma.aiConfig.findUnique.mockResolvedValue({ ...baseConfig, enabled: false });
    const { service } = makeService(() => 'x');
    await expect(service.runAssistedTasks('system')).rejects.toThrow(/disabled/);
  });
});
