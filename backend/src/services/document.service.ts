import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface CreatePolicyDocumentData {
  title: string;
  description?: string;
  documentType: string;
  ownerId: string;
  reviewerId?: string;
  approverId?: string;
  validFrom?: Date;
  validUntil?: Date;
  nextReviewDate?: Date;
  reviewIntervalDays?: number;
  content: string;
  changeLog?: string;
}

const transitions: Record<string, string[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['published'],
  published: ['withdrawn'],
  withdrawn: [],
};

export class DocumentControlService {
  async listDocuments(query: Record<string, unknown> = {}) {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (query.documentType) where.documentType = String(query.documentType);
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.policyDocument.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
      prisma.policyDocument.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(data: CreatePolicyDocumentData, userId?: string) {
    const document = await prisma.policyDocument.create({
      data: {
        title: data.title,
        description: data.description,
        documentType: data.documentType,
        ownerId: data.ownerId,
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        nextReviewDate: data.nextReviewDate,
        reviewIntervalDays: data.reviewIntervalDays,
        createdBy: userId,
        versions: { create: { versionNumber: '1.0.0', authorId: userId ?? data.ownerId, content: data.content, changeLog: data.changeLog } },
      },
      include: { versions: true },
    });

    if (userId) await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_CREATE', entityType: 'PolicyDocument', entityId: document.id, details: `Created document: ${document.title}` });
    return document;
  }

  async updateVersion(versionId: string, data: { content?: string; changeLog?: string }, _userId?: string) {
    const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, include: { document: true } });
    if (!version) throw new AppError('Document version not found', 404);
    if (version.isImmutable || version.status === 'approved' || version.document.isImmutable) throw new AppError('Approved document versions are immutable', 409);
    return prisma.documentVersion.update({ where: { id: versionId }, data: { content: data.content, changeLog: data.changeLog } });
  }

  async transition(documentId: string, nextStatus: 'review' | 'approved' | 'published' | 'withdrawn' | 'draft', userId: string, comment?: string) {
    const document = await prisma.policyDocument.findUnique({ where: { id: documentId }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!document) throw new AppError('Policy document not found', 404);
    if (document.isImmutable && document.workflowStatus === 'approved') throw new AppError('Approved document version is immutable', 409);
    if (!transitions[document.workflowStatus]?.includes(nextStatus)) throw new AppError(`Invalid document workflow transition from ${document.workflowStatus} to ${nextStatus}`, 400);

    const latestVersion = document.versions[0];
    const update: any = { workflowStatus: nextStatus, updatedBy: userId };
    if (nextStatus === 'approved') {
      update.approverId = userId;
      update.isImmutable = true;
      if (latestVersion) await prisma.documentVersion.update({ where: { id: latestVersion.id }, data: { status: 'approved', isImmutable: true, approverId: userId, approvedAt: new Date() } });
    }
    if (nextStatus === 'published') update.publishedAt = new Date();
    if (nextStatus === 'withdrawn') update.withdrawnAt = new Date();

    const updated = await prisma.policyDocument.update({ where: { id: documentId }, data: update, include: { versions: true } });
    await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_WORKFLOW_TRANSITION', entityType: 'PolicyDocument', entityId: documentId, details: `Document transitioned to ${nextStatus}`, newValue: { status: nextStatus, comment: comment ?? null } });
    return updated;
  }

  async acknowledge(documentId: string, userId: string, versionId?: string, comment?: string) {
    const document = await prisma.policyDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new AppError('Policy document not found', 404);
    if (!['published', 'approved'].includes(document.workflowStatus)) throw new AppError('Only approved or published documents can be acknowledged', 400);
    const acknowledgement = await prisma.documentAcknowledgement.create({ data: { documentId, versionId, userId, comment } });
    await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_ACKNOWLEDGE', entityType: 'PolicyDocument', entityId: documentId, details: 'Document acknowledged' });
    return acknowledgement;
  }

  async scheduleReview(documentId: string, reviewerId: string, dueDate: Date) {
    const document = await prisma.policyDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new AppError('Policy document not found', 404);
    return prisma.documentReview.create({ data: { documentId, reviewerId, dueDate } });
  }

  async completeReview(reviewId: string, reviewerId: string, result: string) {
    const review = await prisma.documentReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError('Document review not found', 404);
    if (review.reviewerId !== reviewerId) throw new AppError('Only assigned reviewer can complete review', 403);
    return prisma.documentReview.update({ where: { id: reviewId }, data: { status: 'completed', completedAt: new Date(), result } });
  }

  async escalateOverdueReviews(now = new Date()) {
    const overdue = await prisma.documentReview.findMany({ where: { status: { in: ['pending', 'overdue'] }, dueDate: { lt: now } } });
    const updates = await Promise.all(overdue.map((review) => prisma.documentReview.update({ where: { id: review.id }, data: { status: 'overdue', escalationLevel: review.escalationLevel + 1, escalatedAt: now } })));
    return { escalated: updates.length, reviews: updates };
  }
}

export const documentControlService = new DocumentControlService();
