/**
 * Focused tests for user-reference integrity (F-01/F-14).
 *
 * Covers the centralized validateUserReferences helper semantics
 * (existing + active, nonexistent -> 400, inactive -> 409, null/undefined
 * allowed, early return without a query) and the wiring into the ISMS
 * service create/approve/review paths.
 */

import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({
  auditService: {
    logEvent: jest.fn().mockResolvedValue({}),
    logEventStandalone: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('../services/displayId.service', () => ({
  displayIdService: {
    nextDisplayIdStandalone: jest.fn().mockResolvedValue('ID-0001'),
    nextDisplayId: jest.fn().mockResolvedValue('ID-0001'),
  },
  nextDisplayId: jest.fn().mockResolvedValue('ID-0001'),
}));
jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    requireEntityPermission: jest.fn().mockResolvedValue(undefined),
    requireForEntity: jest.fn().mockResolvedValue(undefined),
    requireForScope: jest.fn().mockResolvedValue(undefined),
    requireAdminAccess: jest.fn().mockResolvedValue(undefined),
  },
}));

const {
  validateUserReferences,
  validateUserReference,
  pickUserReferences,
} = require('../services/userReference.service');
const { riskTreatmentService } = require('../services/risktreatment.service');
const { controlService } = require('../services/control.service');
const { documentControlService } = require('../services/document.service');
const { phase6Service } = require('../services/phase6.service');
const { bcmService } = require('../services/bcm.service');

/**
 * Seed the user table used by validateUserReferences.
 * ids present in `rows` are returned with their isActive flag; ids not present
 * are reported as nonexistent (the helper compares against the returned set).
 */
function seedUsers(rows: Array<{ id: string; isActive?: boolean }>) {
  mockPrisma.user.findMany.mockImplementation(async ({ where }: any) => {
    const requested: string[] = where?.id?.in ?? [];
    const byId = new Map(rows.map((row) => [row.id, row.isActive ?? true]));
    return requested
      .filter((id) => byId.has(id))
      .map((id) => ({ id, isActive: byId.get(id) as boolean }));
  });
}

describe('userReference helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    seedUsers([{ id: 'active-user' }, { id: 'inactive-user', isActive: false }]);
  });

  it('accepts a reference to an existing active user', async () => {
    await expect(validateUserReferences(mockPrisma, { ownerId: 'active-user' }))
      .resolves.toEqual({ ownerId: 'active-user' });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['active-user'] } },
      select: { id: true, isActive: true },
    });
  });

  it('rejects a nonexistent user with 400', async () => {
    await expect(validateUserReferences(mockPrisma, { ownerId: 'missing-user' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an inactive user with 409', async () => {
    await expect(validateUserReferences(mockPrisma, { reviewerId: 'inactive-user' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('permits null and undefined references without querying', async () => {
    await expect(validateUserReferences(mockPrisma, { ownerId: null, approverId: undefined }))
      .resolves.toEqual({ ownerId: null, approverId: undefined });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('short-circuits an empty reference set without querying', async () => {
    await expect(validateUserReferences(mockPrisma, {}))
      .resolves.toEqual({});
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('deduplicates ids before querying and names the offending field', async () => {
    await expect(validateUserReferences(mockPrisma, {
      ownerId: 'active-user',
      approverId: 'missing-user',
    })).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('approverId') });
    expect((mockPrisma.user.findMany.mock.calls[0][0].where.id.in)).toEqual(['active-user', 'missing-user']);
  });

  it('validateUserReference passes through null and delegates non-null ids', async () => {
    await expect(validateUserReference(mockPrisma, 'chairId', null)).resolves.toBeNull();
    await expect(validateUserReference(mockPrisma, 'chairId', 'active-user')).resolves.toBe('active-user');
    await expect(validateUserReference(mockPrisma, 'chairId', 'missing-user'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('pickUserReferences projects only the requested fields', () => {
    const projected = pickUserReferences({ ownerId: 'a', unrelated: 'b' }, ['ownerId']);
    expect(projected).toEqual({ ownerId: 'a' });
  });
});

describe('ISMS service user-reference wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    mockPrisma.displayIdCounter.upsert.mockResolvedValue({ sequence: 1 });
  });

  describe('policy documents', () => {
    const documentData = {
      title: 'Acceptable Use Policy',
      documentType: 'policy',
      ownerId: 'owner-1',
      content: 'Policy body',
    };

    it('rejects a nonexistent document owner before writing', async () => {
      seedUsers([{ id: 'active-user' }]);
      await expect(documentControlService.create(documentData))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.policyDocument.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive reviewer before writing', async () => {
      seedUsers([{ id: 'owner-1' }, { id: 'reviewer-1', isActive: false }]);
      await expect(documentControlService.create({ ...documentData, reviewerId: 'reviewer-1' }))
        .rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.policyDocument.create).not.toHaveBeenCalled();
    });

    it('creates the document when every reference is active', async () => {
      seedUsers([{ id: 'owner-1' }, { id: 'reviewer-1' }, { id: 'author-1' }]);
      mockPrisma.policyDocument.create.mockResolvedValue({ id: 'doc-1', title: documentData.title });
      await expect(documentControlService.create({ ...documentData, reviewerId: 'reviewer-1' }, 'author-1'))
        .resolves.toMatchObject({ id: 'doc-1' });
      expect(mockPrisma.policyDocument.create).toHaveBeenCalled();
    });

    it('validates the approver only on the approval transition', async () => {
      seedUsers([{ id: 'approver-1' }]);
      mockPrisma.policyDocument.findUnique.mockResolvedValue({
        id: 'doc-1', workflowStatus: 'review', isImmutable: false, versions: [{ id: 'ver-1' }],
      });
      mockPrisma.documentVersion.update.mockResolvedValue({});
      mockPrisma.policyDocument.update.mockResolvedValue({ id: 'doc-1', workflowStatus: 'approved' });

      await expect(documentControlService.transition('doc-1', 'approved', 'missing-approver'))
        .rejects.toMatchObject({ statusCode: 400 });
      await expect(documentControlService.transition('doc-1', 'approved', 'approver-1'))
        .resolves.toMatchObject({ workflowStatus: 'approved' });
    });

    it('rejects an inactive acknowledger with 409', async () => {
      seedUsers([{ id: 'inactive-user', isActive: false }]);
      await expect(documentControlService.acknowledge('doc-1', 'inactive-user'))
        .rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.documentAcknowledgement.create).not.toHaveBeenCalled();
    });
  });

  describe('statement of applicability', () => {
    it('rejects a nonexistent submitter before writing', async () => {
      seedUsers([{ id: 'active-user' }]);
      await expect(controlService.submitSOA('soa-1', 'missing-user'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.statementOfApplicability.update).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent SoA approver before writing', async () => {
      seedUsers([{ id: 'active-user' }]);
      await expect(controlService.approveSOA('soa-1', 'missing-approver'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.soAApproval.create).not.toHaveBeenCalled();
    });
  });

  describe('risk treatment', () => {
    it('rejects a nonexistent approver before recording approval', async () => {
      seedUsers([{ id: 'active-user' }]);
      mockPrisma.riskTreatment.findUnique.mockResolvedValue({
        id: 'rt-1', riskId: 'risk-1', treatmentOption: 'reduce', displayId: 'RT-001',
      });
      await expect(riskTreatmentService.approve('rt-1', 'missing-approver'))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.riskTreatmentApproval.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive effectiveness reviewer with 409', async () => {
      seedUsers([{ id: 'user-1' }, { id: 'reviewer-1', isActive: false }]);
      mockPrisma.riskTreatment.findUnique.mockResolvedValue({ id: 'rt-1', riskId: 'risk-1' });
      await expect(riskTreatmentService.recordEffectivenessReview(
        'rt-1',
        { result: 'Effective', reviewDate: new Date('2026-02-01'), reviewerId: 'reviewer-1' },
        'user-1',
      )).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.riskTreatmentEffectivenessReview.create).not.toHaveBeenCalled();
    });
  });

  describe('business continuity management', () => {
    it('rejects a nonexistent BIA owner before writing', async () => {
      seedUsers([{ id: 'active-user' }]);
      await expect(bcmService.createBia({
        displayId: 'BIA-1', mtpdMinutes: 60, rtoMinutes: 30, ownerId: 'missing-owner',
      }, 'actor-1')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.businessImpactAnalysis.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive BCP approver with 409', async () => {
      seedUsers([{ id: 'owner-1' }, { id: 'approver-1', isActive: false }]);
      await expect(bcmService.createBcp({
        displayId: 'BCP-1', ownerId: 'owner-1', approvedBy: 'approver-1',
      }, 'actor-1')).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.businessContinuityPlan.create).not.toHaveBeenCalled();
    });
  });

  describe('phase6 generic resources', () => {
    it('rejects a nonexistent corrective-action owner before writing', async () => {
      seedUsers([{ id: 'u1' }]);
      await expect(phase6Service.create('correctiveActions', {
        title: 'Fix finding', description: 'Patch', ownerId: 'missing-owner', dueDate: new Date('2026-05-01'),
      }, 'u1')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.correctiveAction.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive management-review chair with 409', async () => {
      seedUsers([{ id: 'chair-1', isActive: false }]);
      await expect(phase6Service.create('managementReviews', {
        title: 'Annual review', reviewDate: new Date('2026-03-01'), chairId: 'chair-1',
      }, 'u1')).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.managementReview.create).not.toHaveBeenCalled();
    });

    it('leaves resources without user references untouched', async () => {
      mockPrisma.supplier.create.mockResolvedValue({ id: 'sup-1', displayId: 'SUP-1' });
      await expect(phase6Service.create('suppliers', { legalName: 'Provider' }, 'u1'))
        .resolves.toMatchObject({ id: 'sup-1' });
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
