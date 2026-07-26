import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface EvidenceLinkInput {
  entityType: 'Control' | 'Risk' | 'Asset' | 'SoAItem' | 'Document' | 'RiskControlAssessment' | 'ControlTest';
  entityId: string;
  relationType?: string;
}

export interface CreateEvidenceData {
  title: string;
  description?: string;
  evidenceType: string;
  source?: string;
  createdBy?: string;
  validFrom?: Date;
  validUntil?: Date;
  classification: string;
  responsibleId: string;
  fileHash?: string;
  hashAlgorithm?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  retentionPeriod?: string;
  retentionUntil?: Date;
  expiresAt?: Date;
  deleteProtected?: boolean;
  links?: EvidenceLinkInput[];
}

const hashPattern = /^[a-fA-F0-9]{64}$/;

export class EvidenceService {
  calculateHash(content: Buffer | string, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  async create(data: CreateEvidenceData, userId?: string) {
    if (!data.fileHash || !hashPattern.test(data.fileHash)) {
      throw new AppError('Evidence requires a valid SHA-256 file hash', 400);
    }
    if (!data.classification?.trim()) throw new AppError('Evidence classification is required', 400);
    if (!data.retentionUntil && !data.retentionPeriod) throw new AppError('Evidence retention is required', 400);
    if (!data.expiresAt && !data.validUntil) throw new AppError('Evidence expiry or valid-until date is required', 400);

    const links = data.links ?? [];
    const evidence = await prisma.evidence.create({
      data: {
        title: data.title,
        description: data.description,
        evidenceType: data.evidenceType,
        source: data.source,
        createdBy: userId ?? data.createdBy ?? data.responsibleId,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        classification: data.classification,
        responsibleId: data.responsibleId,
        fileHash: data.fileHash.toLowerCase(),
        hashAlgorithm: data.hashAlgorithm ?? 'sha256',
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        retentionPeriod: data.retentionPeriod,
        retentionUntil: data.retentionUntil,
        expiresAt: data.expiresAt,
        deleteProtected: data.deleteProtected ?? false,
        links: links.length ? { create: links.map((link) => ({ entityType: link.entityType, entityId: link.entityId, relationType: link.relationType ?? 'supports', createdBy: userId })) } : undefined,
      },
      include: { links: true },
    });

    if (userId) {
      await auditService.logEventStandalone(prisma, { userId, action: 'EVIDENCE_CREATE', entityType: 'Evidence', entityId: evidence.id, details: `Created evidence: ${evidence.title}`, newValue: { fileHash: evidence.fileHash, classification: evidence.classification } });
    }

    return evidence;
  }

  async list() {
    return prisma.evidence.findMany({ where: { isArchived: false }, orderBy: { createdAt: 'desc' }, include: { links: true } });
  }

  async delete(id: string, userId?: string) {
    const evidence = await prisma.evidence.findUnique({ where: { id }, include: { links: true } });
    if (!evidence) throw new AppError('Evidence not found', 404);
    if (evidence.deleteProtected) throw new AppError('Evidence is protected against deletion', 409);
    if (evidence.retentionUntil && evidence.retentionUntil > new Date()) throw new AppError('Evidence retention period has not expired', 409);

    await prisma.evidence.update({ where: { id }, data: { isArchived: true, updatedBy: userId } });
    if (userId) await auditService.logEventStandalone(prisma, { userId, action: 'EVIDENCE_DELETE', entityType: 'Evidence', entityId: id, details: `Archived evidence: ${evidence.title}` });
    return { success: true };
  }

  async exportAuditPackage(filter: { controlId?: string; riskId?: string; assetId?: string; soaItemId?: string; documentId?: string }, userId?: string) {
    const linkFilters = Object.entries({ Control: filter.controlId, Risk: filter.riskId, Asset: filter.assetId, SoAItem: filter.soaItemId, Document: filter.documentId })
      .filter(([, entityId]) => Boolean(entityId))
      .map(([entityType, entityId]) => ({ entityType, entityId: entityId as string }));

    const evidence = await prisma.evidence.findMany({
      where: linkFilters.length ? { isArchived: false, links: { some: { OR: linkFilters } } } : { isArchived: false },
      include: { links: true },
      orderBy: { createdAt: 'asc' },
    });

    const manifest = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId ?? null,
      filter,
      evidenceCount: evidence.length,
      evidence: evidence.map((item) => ({
        id: item.id,
        title: item.title,
        classification: item.classification,
        hashAlgorithm: item.hashAlgorithm,
        fileHash: item.fileHash,
        retentionUntil: item.retentionUntil?.toISOString() ?? null,
        expiresAt: item.expiresAt?.toISOString() ?? null,
        links: item.links.map((link) => ({ entityType: link.entityType, entityId: link.entityId, relationType: link.relationType })),
      })),
    };

    if (userId) await auditService.logEventStandalone(prisma, { userId, action: 'EVIDENCE_AUDIT_PACKAGE_EXPORT', entityType: 'Evidence', entityId: 'audit-package', details: `Exported evidence audit package with ${evidence.length} items`, newValue: manifest });
    return manifest;
  }
}

export const evidenceService = new EvidenceService();
