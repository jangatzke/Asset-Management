const mockPrismaClient: any = {
  ismsScope: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockTransaction: any = {
  framework: { upsert: jest.fn() },
  frameworkVersion: { upsert: jest.fn() },
  control: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  statementOfApplicability: { aggregate: jest.fn(), create: jest.fn() },
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));
jest.mock('../services/authorization.service', () => ({
  authorizationService: { requireForScope: jest.fn() },
}));
jest.mock('../services/catalog.service', () => ({
  catalogService: { ensureIso27001AnnexA2022Catalog: jest.fn() },
}));
jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn() },
}));

import { ISO27001_ANNEX_A_2022_CONTROLS } from '../data/iso27001AnnexA2022';
import { catalogService } from '../services/catalog.service';
import { controlService } from '../services/control.service';

describe('ISO/IEC 27001:2022 SoA generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.ismsScope.findUnique.mockResolvedValue({ id: 'scope-1' });
    mockPrismaClient.$transaction.mockImplementation(async (callback: (tx: typeof mockTransaction) => unknown) => callback(mockTransaction));
    (catalogService.ensureIso27001AnnexA2022Catalog as jest.Mock).mockResolvedValue({
      items: ISO27001_ANNEX_A_2022_CONTROLS.map((control, index) => ({
        controlId: control.controlId,
        title: control.title,
        description: control.objective,
        sortOrder: index + 1,
      })),
    });
    mockTransaction.framework.upsert.mockResolvedValue({ id: 'framework-1' });
    mockTransaction.frameworkVersion.upsert.mockResolvedValue({ id: 'framework-version-1' });
    mockTransaction.control.findFirst.mockResolvedValue(null);
    mockTransaction.control.create.mockImplementation(({ data }: { data: { title: string } }) => Promise.resolve({ id: `control-${data.title}` }));
    mockTransaction.statementOfApplicability.aggregate.mockResolvedValue({ _max: { version: 4 } });
    mockTransaction.statementOfApplicability.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'soa-1', items: data.items.create }));
  });

  it('creates the next complete draft with every control under review', async () => {
    const soa = await controlService.generateIso27001AnnexASOA('scope-1', 'user-1');

    expect(soa.items).toHaveLength(93);
    expect(mockTransaction.statementOfApplicability.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 5, scopeId: 'scope-1' }),
      include: expect.any(Object),
    }));
    expect(soa.items.every((item: { applicability: string; implementationStatus: string; justification: string }) => (
      item.applicability === 'under_review'
      && item.implementationStatus === 'planned'
      && item.justification.includes('Scope-specific applicability decision pending')
    ))).toBe(true);
  });
});
