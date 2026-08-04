const mockPrisma: any = {
  costPlan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  asset: { findMany: jest.fn() },
  license: { findMany: jest.fn() },
  contract: { findMany: jest.fn() },
  supplier: { findFirst: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }, // Phase 9: hash-chain lookup
  $transaction: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn(() => Promise.resolve('CP-0001')) }));
jest.mock('../services/fiscalYear.service', () => ({
  fiscalYearService: {
    getFiscalYearByLabel: jest.fn(() => Promise.resolve({
      label: '2026',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2027-01-01T00:00:00.000Z'),
    })),
    listSelectableYears: jest.fn(),
  },
}));

import { CostPlanningService } from '../services/costPlanning.service';

describe('CostPlanningService', () => {
  const service = new CostPlanningService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds summary and excludes cancelled/rejected items', async () => {
    mockPrisma.costPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      items: [
        { status: 'planned', plannedAmount: '100.00', knownAmount: null },
        { status: 'acquired', plannedAmount: '200.00', knownAmount: '150.00' },
        { status: 'cancelled', plannedAmount: '999.00', knownAmount: null },
      ],
    });

    const plan = await service.getPlan('plan-1') as any;

    expect(plan.summary).toEqual({ plannedAmount: '300.00', knownAmount: '150.00', acquiredAmount: '150.00', openAmount: '150.00', itemCount: 2 });
  });

  it('builds candidates from assets, licenses and contracts in fiscal period', async () => {
    mockPrisma.costPlan.findUnique.mockResolvedValue({ items: [{ sourceKey: 'asset:a-existing' }] });
    mockPrisma.asset.findMany.mockResolvedValue([{ id: 'a-existing', displayId: 'AST-1', name: 'Notebook', lifecycleStatus: 'planned', endOfLifeDate: null, endOfSupportDate: null }]);
    mockPrisma.license.findMany.mockResolvedValue([{ id: 'l-1', displayId: 'LIC-1', title: 'Suite', cost: { toString: () => '42.00' }, currency: 'EUR', renewalDate: new Date('2026-06-01T00:00:00.000Z'), endDate: null }]);
    mockPrisma.contract.findMany.mockResolvedValue([{ id: 'c-1', displayId: 'CON-1', title: 'Support', value: { toString: () => '500.00' }, currency: 'EUR', renewalDate: null, endDate: new Date('2026-10-01T00:00:00.000Z') }]);

    const candidates = await service.candidates('2026');

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ candidateKey: 'asset:a-existing', alreadyInPlan: true });
    expect(candidates[1]).toMatchObject({ candidateKey: 'license:l-1', plannedAmount: '42.00' });
    expect(candidates[2]).toMatchObject({ candidateKey: 'contract:c-1', plannedAmount: '500.00' });
  });

  it('returns 404 for unknown plans', async () => {
    mockPrisma.costPlan.findUnique.mockResolvedValue(null);

    await expect(service.getPlan('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates a manual procurement item linked to the existing supplier and snapshots its name', async () => {
    const tx: any = {
      costPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier-1', legalName: 'Example Supplier' }) },
      costPlanItem: { create: jest.fn().mockResolvedValue({ id: 'item-1', title: 'New laptop' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await service.createManualItem('plan-1', { title: 'New laptop', category: 'hardware', investmentType: 'new_acquisition', plannedAmount: 1200, currency: 'EUR', supplierId: 'supplier-1' }, 'user-1');

    expect(tx.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'supplier-1', isArchived: false } });
    expect(tx.costPlanItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ costPlanId: 'plan-1', supplierId: 'supplier-1', supplierName: 'Example Supplier', sourceType: 'manual' }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'COST_PLAN_ITEM_CREATE',
        sequence: 1,
        previousHash: null,
        entryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });

  it('routes cost-plan creation through shared sequenced audit logging', async () => {
    const tx: any = {
      costPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1', displayId: 'CP-0001', items: [] }) },
      auditLog: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockPrisma.costPlan.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await service.createOrGetPlan('2026', 'user-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'COST_PLAN_CREATE',
        entityType: 'CostPlan',
        entityId: 'plan-1',
        sequence: 1,
        previousHash: null,
        entryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });

  it('rejects a manual procurement item when the selected supplier is not active', async () => {
    const tx: any = {
      costPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      costPlanItem: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(service.createManualItem('plan-1', { title: 'New laptop', plannedAmount: 1200, supplierId: 'supplier-missing' }, 'user-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.costPlanItem.create).not.toHaveBeenCalled();
  });
});
