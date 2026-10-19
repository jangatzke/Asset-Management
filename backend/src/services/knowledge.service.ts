import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { nextDisplayId } from './displayId.service';

type AnyObject = Record<string, any>;

export interface KnowledgeArticleListQuery {
  search?: string;
  category?: string;
  status?: string;
  tag?: string;
  relatedEntityId?: string;
}

const LIST_SELECT = {
  id: true,
  displayId: true,
  title: true,
  summary: true,
  category: true,
  tags: true,
  status: true,
  authorId: true,
  relatedEntityType: true,
  relatedEntityId: true,
  viewCount: true,
  updatedAt: true,
  createdAt: true,
} as const;

export class KnowledgeService {
  async list(query: KnowledgeArticleListQuery = {}) {
    const where: AnyObject = { isArchived: false };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.relatedEntityId) where.relatedEntityId = query.relatedEntityId;
    if (query.tag) where.tags = { has: query.tag };
    const search = String(query.search ?? '').trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }
    return prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: LIST_SELECT,
    });
  }

  async get(id: string) {
    const article = await prisma.knowledgeArticle.findFirst({ where: { id, isArchived: false } });
    if (!article) throw new AppError('Knowledge article not found', 404);
    return article;
  }

  /** Read a published (or own draft) article and count the view exactly once per access. */
  async getForReader(id: string, userId: string) {
    const article = await prisma.knowledgeArticle.findFirst({ where: { id, isArchived: false } });
    if (!article) throw new AppError('Knowledge article not found', 404);
    if (article.status !== 'published' && article.authorId !== userId && article.createdBy !== userId) {
      throw new AppError('Knowledge article not found', 404);
    }
    await prisma.knowledgeArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return article;
  }

  async create(data: AnyObject, userId: string) {
    const article = await prisma.$transaction(async (tx: any) => {
      const displayId = await nextDisplayId(tx, 'KnowledgeArticle');
      return tx.knowledgeArticle.create({
        data: {
          displayId,
          title: String(data.title).trim(),
          summary: data.summary?.trim() || null,
          content: data.content,
          category: data.category ?? 'general',
          tags: Array.isArray(data.tags) ? data.tags : [],
          status: data.status === 'published' ? 'published' : 'draft',
          authorId: userId,
          relatedEntityType: data.relatedEntityType?.trim() || null,
          relatedEntityId: data.relatedEntityId?.trim() || null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'KNOWLEDGE_ARTICLE_CREATE',
      entityType: 'KnowledgeArticle',
      entityId: article.id,
      details: `Created knowledge article ${article.displayId}: ${article.title}`,
    });
    return article;
  }

  async update(id: string, data: AnyObject, userId: string) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { id, isArchived: false } });
    if (!existing) throw new AppError('Knowledge article not found', 404);
    const updateData: AnyObject = { updatedBy: userId };
    for (const key of ['title', 'summary', 'content', 'category', 'status', 'relatedEntityType', 'relatedEntityId'] as const) {
      if (data[key] !== undefined) updateData[key] = data[key] === null ? null : data[key];
    }
    if (Array.isArray(data.tags)) updateData.tags = data.tags;
    const updated = await prisma.knowledgeArticle.update({ where: { id }, data: updateData });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'KNOWLEDGE_ARTICLE_UPDATE',
      entityType: 'KnowledgeArticle',
      entityId: id,
      details: `Updated knowledge article ${updated.displayId}: ${updated.title}`,
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { id, isArchived: false } });
    if (!existing) throw new AppError('Knowledge article not found', 404);
    await prisma.knowledgeArticle.update({ where: { id }, data: { isArchived: true, updatedBy: userId } });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'KNOWLEDGE_ARTICLE_DELETE',
      entityType: 'KnowledgeArticle',
      entityId: id,
      details: `Archived knowledge article ${existing.displayId}: ${existing.title}`,
    });
    return { ok: true };
  }
}

export const knowledgeService = new KnowledgeService();
