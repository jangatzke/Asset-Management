const mockPrismaClient: any = {
  framework: { upsert: jest.fn(), findMany: jest.fn() },
  frameworkVersion: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
  requirement: { findMany: jest.fn(), count: jest.fn() },
  control: { findUnique: jest.fn() },
  controlRequirementMapping: { createMany: jest.fn() },
  controlImplementation: { create: jest.fn() },
  statementOfApplicability: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  soAItem: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  soAApproval: { create: jest.fn() },
  evidence: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  policyDocument: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  documentVersion: { findUnique: jest.fn(), update: jest.fn() },
  documentAcknowledgement: { create: jest.fn() },
  documentReview: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }, // Phase 9: hash-chain lookup
  $transaction: jest.fn(async (cb: any) => cb(mockPrismaClient)),
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

import { frameworkService } from '../services/framework.service';
import { controlService } from '../services/control.service';
import { evidenceService } from '../services/evidence.service';
import { documentControlService } from '../services/document.service';

describe('Phase 4 compliance services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.auditLog.create.mockResolvedValue({});
  });

  it('imports framework versions with requirements and compares versions', async () => {
    mockPrismaClient.framework.upsert.mockResolvedValue({ id: 'fw-1', code: 'ISO27001' });
    mockPrismaClient.frameworkVersion.create.mockResolvedValue({ id: 'fv-2', version: '2022', framework: { code: 'ISO27001' }, requirements: [{ requirementKey: 'A.5.1' }] });

    const imported = await frameworkService.importFramework({
      framework: { name: 'ISO 27001', code: 'ISO27001' },
      version: '2022',
      licenseInfo: 'Licensed catalogue excerpt',
      requirements: [{ key: 'A.5.1', title: 'Policies', text: 'Policy requirement' }],
    }, 'user-1');

    expect(imported.requirements).toHaveLength(1);

    mockPrismaClient.frameworkVersion.findUnique
      .mockResolvedValueOnce({ id: 'fv-1', version: '2013', framework: { code: 'ISO27001' }, requirements: [{ requirementKey: 'A.5.1', title: 'Old', requirementText: 'Old text', section: null, clauseNumber: null }] })
      .mockResolvedValueOnce({ id: 'fv-2', version: '2022', framework: { code: 'ISO27001' }, requirements: [{ requirementKey: 'A.5.1', title: 'New', requirementText: 'New text', section: null, clauseNumber: null }, { requirementKey: 'A.5.2', title: 'Added', requirementText: 'Text' }] });

    const diff = await frameworkService.compareVersions('fv-1', 'fv-2');
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.changed).toBe(1);
  });

  it('creates control implementation for multiple requirements and scoped organization context', async () => {
    mockPrismaClient.control.findUnique.mockResolvedValue({ id: 'ctrl-1', title: 'Access Control' });
    mockPrismaClient.requirement.count.mockResolvedValue(2);
    mockPrismaClient.controlImplementation.create.mockResolvedValue({ id: 'impl-1', requirements: [{ requirementId: 'req-1' }, { requirementId: 'req-2' }] });

    const implementation = await controlService.createImplementation({ controlId: 'ctrl-1', organizationUnitId: 'org-1', responsibleUserId: 'owner-1', requirementIds: ['req-1', 'req-2'], testMethod: 'sampling', testFrequency: 'quarterly', nextTestDate: new Date('2027-01-01') }, 'user-1');

    expect(implementation.requirements).toHaveLength(2);
    expect(mockPrismaClient.controlImplementation.create).toHaveBeenCalled();
  });

  it('enforces SoA approval workflow and immutable approved versions', async () => {
    mockPrismaClient.statementOfApplicability.findUnique.mockResolvedValue({ id: 'soa-1', approvalStatus: 'under_review', isImmutable: false, items: [{ id: 'item-1', justification: 'Required' }] });
    mockPrismaClient.soAApproval.create.mockResolvedValue({});
    mockPrismaClient.soAItem.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.statementOfApplicability.update.mockResolvedValue({ id: 'soa-1', approvalStatus: 'approved', isImmutable: true });

    const approved = await controlService.approveSOA('soa-1', 'approver-1');
    expect(approved.isImmutable).toBe(true);

    mockPrismaClient.soAItem.findUnique.mockResolvedValue({ id: 'item-1', isImmutable: true, soa: { isImmutable: true, approvalStatus: 'approved' } });
    await expect(controlService.updateSOAItem('item-1', { justification: 'Change' }, 'user-1')).rejects.toThrow('immutable');
  });

  it('blocks protected evidence deletion and exports audit package manifest', async () => {
    const hash = 'a'.repeat(64);
    mockPrismaClient.evidence.create.mockResolvedValue({ id: 'ev-1', title: 'Log', fileHash: hash, classification: 'confidential', links: [] });
    const evidence = await evidenceService.create({ title: 'Log', evidenceType: 'log', classification: 'confidential', responsibleId: 'user-1', fileHash: hash, retentionUntil: new Date('2027-01-01'), expiresAt: new Date('2027-06-01'), deleteProtected: true }, 'user-1');
    expect(evidence.fileHash).toBe(hash);

    mockPrismaClient.evidence.findUnique.mockResolvedValue({ id: 'ev-1', title: 'Log', deleteProtected: true, retentionUntil: new Date('2027-01-01'), links: [] });
    await expect(evidenceService.delete('ev-1', 'user-1')).rejects.toThrow('protected');

    mockPrismaClient.evidence.findMany.mockResolvedValue([{ id: 'ev-1', title: 'Log', classification: 'confidential', hashAlgorithm: 'sha256', fileHash: hash, retentionUntil: null, expiresAt: null, links: [{ entityType: 'Control', entityId: 'ctrl-1' }] }]);
    const manifest = await evidenceService.exportAuditPackage({ controlId: 'ctrl-1' }, 'auditor-1');
    expect(manifest.evidenceCount).toBe(1);
  });

  it('runs document workflow, acknowledgement, review completion and overdue escalation', async () => {
    mockPrismaClient.policyDocument.findUnique.mockResolvedValueOnce({ id: 'doc-1', workflowStatus: 'review', isImmutable: false, versions: [{ id: 'ver-1' }] });
    mockPrismaClient.documentVersion.update.mockResolvedValue({});
    mockPrismaClient.policyDocument.update.mockResolvedValue({ id: 'doc-1', workflowStatus: 'approved', isImmutable: true, versions: [{ id: 'ver-1', isImmutable: true }] });
    const approved = await documentControlService.transition('doc-1', 'approved', 'approver-1');
    expect(approved.isImmutable).toBe(true);

    mockPrismaClient.policyDocument.findUnique.mockResolvedValueOnce({ id: 'doc-1', workflowStatus: 'published' });
    mockPrismaClient.documentAcknowledgement.create.mockResolvedValue({ id: 'ack-1' });
    await expect(documentControlService.acknowledge('doc-1', 'user-1')).resolves.toEqual({ id: 'ack-1' });

    mockPrismaClient.documentReview.findMany.mockResolvedValue([{ id: 'rev-1', escalationLevel: 0 }]);
    mockPrismaClient.documentReview.update.mockResolvedValue({ id: 'rev-1', status: 'overdue', escalationLevel: 1 });
    const escalated = await documentControlService.escalateOverdueReviews(new Date('2027-01-01'));
    expect(escalated.escalated).toBe(1);
  });
});
