/**
 * Focused tests for the supplier NIS2 review subtask:
 * - Soft mandatory risk-assessment enforcement for nis2Relevant suppliers
 *   (warning field instead of a hard 400/409 — documented variant, see
 *   plans/iso27001-nis2-gap-analysis.md §2.4; the create-then-link workflow
 *   in SupplierDetail.tsx forbids hard validation at create time).
 * - Data-driven review reminders: suppliers are registered in PHASE6_MODEL_MAP
 *   with dueField nextReviewDate, so due reviews surface via the reminder
 *   subsystem without per-supplier reminder records or a scheduler.
 * - reviews-due listing with pagination envelope.
 * Route-level validation is covered in phase6.routes.test.ts.
 */
jest.mock('../config/database', () => {
  const prisma: any = {
    supplier: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'sup-1', displayId: 'SUP-1', legalName: data.legalName, nis2Relevant: data.nis2Relevant ?? false, isArchived: false })),
      update: jest.fn().mockImplementation(async ({ where: _w, data }: any) => ({ id: 'sup-1', displayId: 'SUP-1', nis2Relevant: data.nis2Relevant ?? true, isArchived: false })),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    supplierRiskRelation: { findMany: jest.fn().mockResolvedValue([]) },
    risk: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma };
});
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../services/statusTransition', () => ({ validateTransition: () => ({ allowed: true }) }));

import { prisma } from '../config/database';
import { supplierService } from '../services/supplier.service';
import { reminderService } from '../services/reminder.service';
import { PHASE6_MODEL_MAP } from '../services/phase6.resources';

const mockPrisma = prisma as any;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('NIS2 mandatory risk assessment for suppliers (soft variant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.supplierRiskRelation.findMany.mockResolvedValue([]);
    mockPrisma.risk.findMany.mockResolvedValue([]);
  });

  it('returns a warning when a nis2Relevant supplier is created without any risk relation', async () => {
    const created = await supplierService.create({ legalName: 'Provider', nis2Relevant: true }, 'user-1');

    expect(created.nis2RiskAssessmentWarning).toBeTruthy();
    expect(created.nis2RiskAssessmentWarning).toContain('link at least one non-archived risk');
    expect(mockPrisma.supplierRiskRelation.findMany).toHaveBeenCalledWith({ where: { supplierId: 'sup-1' } });
  });

  it('returns no warning when a nis2Relevant supplier has a relation to a non-archived risk', async () => {
    mockPrisma.supplierRiskRelation.findMany.mockResolvedValue([{ supplierId: 'sup-1', riskId: 'risk-1' }]);
    mockPrisma.risk.findMany.mockResolvedValue([{ id: 'risk-1' }]);

    const created = await supplierService.create({ legalName: 'Provider', nis2Relevant: true }, 'user-1');

    expect(created.nis2RiskAssessmentWarning).toBeUndefined();
    expect(mockPrisma.risk.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['risk-1'] }, isArchived: false },
      select: { id: true },
    });
  });

  it('warns about archived risks when every linked risk is archived', async () => {
    mockPrisma.supplierRiskRelation.findMany.mockResolvedValue([{ supplierId: 'sup-1', riskId: 'risk-1' }]);
    mockPrisma.risk.findMany.mockResolvedValue([]);

    const created = await supplierService.create({ legalName: 'Provider', nis2Relevant: true }, 'user-1');

    expect(created.nis2RiskAssessmentWarning).toContain('all linked risks are archived');
  });

  it('does not warn for suppliers without nis2Relevant', async () => {
    const created = await supplierService.create({ legalName: 'Provider', nis2Relevant: false }, 'user-1');

    expect(created.nis2RiskAssessmentWarning).toBeUndefined();
    expect(mockPrisma.supplierRiskRelation.findMany).not.toHaveBeenCalled();
  });

  it('re-evaluates the warning when updating nis2Relevant to true without risk relations', async () => {
    mockPrisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', status: 'active', nis2Relevant: false, isArchived: false });

    const updated = await supplierService.update('sup-1', { nis2Relevant: true }, 'user-1');

    expect(updated.nis2RiskAssessmentWarning).toBeTruthy();
  });
});

describe('Data-driven supplier review reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.supplier.findMany.mockReset().mockResolvedValue([]);
  });

  it('registers suppliers with dueField nextReviewDate so the reminder subsystem surfaces due reviews', () => {
    expect(PHASE6_MODEL_MAP.suppliers).toMatchObject({ delegate: 'supplier', dueField: 'nextReviewDate' });
  });

  it('collects due supplier reviews through the reminder subsystem without creating per-supplier records', async () => {
    const now = Date.now();
    mockPrisma.supplier.findMany.mockResolvedValue([
      { id: 'sup-due', legalName: 'Due Soon', nextReviewDate: new Date(now + 3 * DAY_MS), status: 'active' },
      { id: 'sup-overdue', legalName: 'Overdue', nextReviewDate: new Date(now - 10 * DAY_MS), status: 'active' },
    ]);
    mockPrisma.user = { findUnique: jest.fn().mockResolvedValue(null) };
    mockPrisma.reminderDeliveryLog = { create: jest.fn().mockResolvedValue({}) };
    mockPrisma.reminderConfig = { findFirst: jest.fn().mockResolvedValue({ id: 'cfg-1', enabled: true, intervalMinutes: 1440, lookAheadDays: 0, reminderSubjectPrefix: '[ISMS Reminder]' }) };

    const items = await reminderService.collectDueItems('suppliers', 0);

    expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith({
      where: { nextReviewDate: { lte: expect.any(Date) }, status: { notIn: ['completed', 'closed', 'cancelled', 'approved'] } },
      orderBy: { nextReviewDate: 'asc' },
    });
    expect(items.map((item: any) => item.id).sort()).toEqual(['sup-due', 'sup-overdue']);
    const byId = new Map(items.map((item: any) => [item.id, item]));
    expect(byId.get('sup-overdue').escalation).toBe(true);
    expect(byId.get('sup-due').escalation).toBe(false);
  });
});

describe('Supplier reviews-due listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.supplier.findMany.mockReset().mockResolvedValue([]);
  });

  it('lists overdue and upcoming reviews inside the look-ahead window with the pagination envelope', async () => {
    const now = new Date();
    mockPrisma.supplier.findMany.mockResolvedValue([
      { id: 'sup-overdue', displayId: 'SUP-1', nextReviewDate: new Date(now.getTime() - 2 * DAY_MS) },
    ]);
    mockPrisma.supplier.count.mockResolvedValue(1);

    const result = await supplierService.listReviewsDue({ page: 1, limit: 20, days: 30 });

    expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith({
      where: { isArchived: false, status: { not: 'archived' }, nextReviewDate: { lte: expect.any(Date) } },
      skip: 0,
      take: 20,
      orderBy: { nextReviewDate: 'asc' },
    });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.days).toBe(30);
    expect(result.data[0]).toMatchObject({ id: 'sup-overdue', reviewOverdue: true });
    expect(typeof result.asOf).toBe('string');
  });

  it('applies page/limit skip correctly', async () => {
    mockPrisma.supplier.count.mockResolvedValue(0);

    const result = await supplierService.listReviewsDue({ page: 2, limit: 10, days: 7 });

    expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 0, totalPages: 0 });
    expect(result.days).toBe(7);
  });
});
