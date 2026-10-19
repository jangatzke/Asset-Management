jest.mock('../config/database', () => {
  const prisma: any = {
    knowledgeArticle: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  prisma.knowledgeArticle.create = jest.fn(async ({ data }: any) => ({ id: 'article-1', viewCount: 0, ...data }));
  return { prisma };
});
jest.mock('../services/displayId.service', () => ({
  nextDisplayId: jest.fn().mockResolvedValue('KB-0001'),
}));
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../config/database';
import { nextDisplayId } from '../services/displayId.service';
import { auditService } from '../services/audit.service';
import { KnowledgeService } from '../services/knowledge.service';

const mockPrisma = prisma as any;
const service = new KnowledgeService();

describe('KnowledgeService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filters archived articles out and maps tag search to a scalar-list has filter', async () => {
    await service.list({ search: 'patch', category: 'incident', status: 'published', tag: 'windows' });
    const args = mockPrisma.knowledgeArticle.findMany.mock.calls[0][0];
    expect(args.where).toEqual(expect.objectContaining({
      isArchived: false,
      category: 'incident',
      status: 'published',
      tags: { has: 'windows' },
      OR: [
        { title: { contains: 'patch', mode: 'insensitive' } },
        { summary: { contains: 'patch', mode: 'insensitive' } },
        { content: { contains: 'patch', mode: 'insensitive' } },
        { tags: { has: 'patch' } },
      ],
    }));
  });

  it('creates articles with a KB display id, defaults to draft status and audits the event', async () => {
    const article = await service.create({ title: ' VPN Runbook ', content: 'steps', tags: ['vpn'] }, 'user-1');
    expect(nextDisplayId).toHaveBeenCalledWith(expect.anything(), 'KnowledgeArticle');
    const created = mockPrisma.knowledgeArticle.create.mock.calls[0][0].data;
    expect(created).toEqual(expect.objectContaining({
      displayId: 'KB-0001',
      title: 'VPN Runbook',
      status: 'draft',
      category: 'general',
      tags: ['vpn'],
      authorId: 'user-1',
      createdBy: 'user-1',
    }));
    expect(article.displayId).toBe('KB-0001');
    expect(auditService.logEventStandalone).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ action: 'KNOWLEDGE_ARTICLE_CREATE', entityId: 'article-1' }),
    );
  });

  it('honors an explicit published status on create', async () => {
    await service.create({ title: 'Policy note', content: 'text', status: 'published' }, 'user-1');
    expect(mockPrisma.knowledgeArticle.create.mock.calls[0][0].data.status).toBe('published');
  });

  it('hides drafts of other users from readers and returns 404', async () => {
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue({ id: 'article-1', status: 'draft', authorId: 'user-2', createdBy: 'user-2' });
    await expect(service.getForReader('article-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.knowledgeArticle.update).not.toHaveBeenCalled();
  });

  it('counts a view when the author reads their own draft', async () => {
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue({ id: 'article-1', status: 'draft', authorId: 'user-1', createdBy: null });
    await service.getForReader('article-1', 'user-1');
    expect(mockPrisma.knowledgeArticle.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: { viewCount: { increment: 1 } },
    });
  });

  it('updates whitelisted fields only and audits the change', async () => {
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue({ id: 'article-1', displayId: 'KB-0001', title: 'old' });
    mockPrisma.knowledgeArticle.update.mockResolvedValue({ id: 'article-1', displayId: 'KB-0001', title: 'new' });
    await service.update('article-1', { title: 'new', authorId: 'attacker', viewCount: 99, tags: ['a'] }, 'user-2');
    const data = mockPrisma.knowledgeArticle.update.mock.calls[0][0].data;
    expect(data).toEqual({ updatedBy: 'user-2', title: 'new', tags: ['a'] });
    expect(auditService.logEventStandalone).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ action: 'KNOWLEDGE_ARTICLE_UPDATE', entityId: 'article-1' }),
    );
  });

  it('soft-archives on remove and audits the deletion', async () => {
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue({ id: 'article-1', displayId: 'KB-0001', title: 'gone' });
    const result = await service.remove('article-1', 'user-2');
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.knowledgeArticle.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: { isArchived: true, updatedBy: 'user-2' },
    });
    expect(auditService.logEventStandalone).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ action: 'KNOWLEDGE_ARTICLE_DELETE', entityId: 'article-1' }),
    );
  });

  it('returns 404 when updating or removing an unknown article', async () => {
    mockPrisma.knowledgeArticle.findFirst.mockResolvedValue(null);
    await expect(service.update('missing', { title: 'x' }, 'user-1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove('missing', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
