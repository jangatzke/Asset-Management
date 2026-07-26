const mockPrisma: any = {
  costPlan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  asset: { findMany: jest.fn() },
  license: { findMany: jest.fn() },
  contract: { findMany: jest.fn() },
  auditLog: { create: jest.fn() },
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
});
