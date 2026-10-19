jest.mock('../config/database', () => {
  const prisma: any = {};
  for (const model of ['auditPlan', 'auditProgram', 'auditFinding', 'auditEvidenceRelation', 'correctiveAction', 'evidence']) {
    prisma[model] = { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) };
  }
  return { prisma };
});
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));

import crypto from 'crypto';
import { prisma } from '../config/database';
import { auditService } from '../services/audit.service';
import { AuditWorkflowService } from '../services/auditWorkflow.service';

const mockPrisma = prisma as any;

describe('AuditWorkflowService.exportAuditKit', () => {
  beforeEach(() => jest.clearAllMocks());

  const audit = {
    id: 'audit-1', displayId: 'AUD-0001', title: 'Internal ISMS audit', auditType: 'internal',
    scope: 'All departments', criteria: ['ISO 27001:2022'], auditorIds: ['user-a'], auditeeIds: [],
    plannedStart: new Date('2026-02-01T00:00:00Z'), plannedEnd: new Date('2026-02-03T00:00:00Z'),
    status: 'completed', programId: 'program-1',
  };

  it('aggregates findings, evidence hashes and CAPAs with a verifiable manifest hash', async () => {
    mockPrisma.auditPlan.findUnique.mockResolvedValue(audit);
    mockPrisma.auditProgram.findUnique.mockResolvedValue({ id: 'program-1', displayId: 'AP-0001', title: 'ISMS 2026', year: 2026, scope: 'Company-wide' });
    mockPrisma.auditFinding.findMany.mockResolvedValue([
      { id: 'finding-1', displayId: 'AF-0001', findingType: 'nonconformity', severity: 'high', title: 'Missing access review', description: 'No quarterly review', status: 'open', controlIds: ['ctrl-1'], riskIds: [], assetIds: [], requirementIds: [], correctiveActionId: 'capa-1' },
    ]);
    mockPrisma.auditEvidenceRelation.findMany.mockResolvedValue([
      { id: 'rel-1', auditFindingId: 'finding-1', evidenceId: 'ev-1', relationType: 'supports' },
    ]);
    mockPrisma.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', title: 'Access policy v2', classification: 'internal', hashAlgorithm: 'sha256', fileHash: 'deadbeef', retentionUntil: new Date('2027-01-01T00:00:00Z'), expiresAt: null },
    ]);
    mockPrisma.correctiveAction.findMany.mockResolvedValue([
      { id: 'capa-1', displayId: 'CA-0001', title: 'Introduce access review', status: 'closed', dueDate: new Date('2026-03-01T00:00:00Z'), ownerId: 'user-b', effectivenessStatus: 'effective' },
    ]);

    const result = await new AuditWorkflowService().exportAuditKit('audit-1', 'user-1');

    expect(result.manifestVersion).toBe('1.0');
    expect(result.exportedBy).toBe('user-1');
    expect(result.audit.displayId).toBe('AUD-0001');
    expect(result.program.displayId).toBe('AP-0001');
    expect(result.summary).toEqual({ findingCount: 1, evidenceCount: 1, correctiveActionCount: 1, openFindings: 1 });

    const finding = result.findings[0];
    expect(finding.evidence).toEqual([expect.objectContaining({ id: 'ev-1', fileHash: 'deadbeef', hashAlgorithm: 'sha256', relationType: 'supports' })]);
    expect(finding.correctiveAction).toEqual(expect.objectContaining({ id: 'capa-1', effectivenessStatus: 'effective' }));

    // The manifest hash must be recomputable from the document minus the hash itself.
    const { manifestHash, ...withoutHash } = result;
    expect(manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.createHash('sha256').update(JSON.stringify(withoutHash)).digest('hex')).toBe(manifestHash);

    expect(auditService.logEventStandalone).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ action: 'AUDIT_KIT_EXPORT', entityType: 'AuditPlan', entityId: 'audit-1' }),
    );
  });

  it('produces an empty kit for an audit without findings and skips evidence queries', async () => {
    mockPrisma.auditPlan.findUnique.mockResolvedValue({ ...audit, programId: null });
    mockPrisma.auditFinding.findMany.mockResolvedValue([]);

    const result = await new AuditWorkflowService().exportAuditKit('audit-1', 'user-1');

    expect(result.program).toBeNull();
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ findingCount: 0, evidenceCount: 0, correctiveActionCount: 0, openFindings: 0 });
    expect(mockPrisma.auditEvidenceRelation.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.evidence.findMany).not.toHaveBeenCalled();
    expect(result.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects when the audit does not exist', async () => {
    mockPrisma.auditPlan.findUnique.mockResolvedValue(null);
    await expect(new AuditWorkflowService().exportAuditKit('missing', 'user-1')).rejects.toThrow('Audit not found');
  });
});
