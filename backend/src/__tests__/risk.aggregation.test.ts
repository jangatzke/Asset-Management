/**
 * Tests for RiskAggregationService
 *
 * Tests all 5 aggregation methods and dashboard summary.
 */

const mockPrismaClient: any = {
  risk: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  ismsScope: {
    findMany: jest.fn(),
  },
  businessProcess: {
    findMany: jest.fn(),
  },
  businessService: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { riskAggregationService } from '../services/risk.aggregation';

// Test fixture for risks
const createRisk = (overrides = {}) => ({
  id: 'risk-1',
  title: 'Test Risk',
  description: 'A test risk',
  inherentRisk: 'high',
  residualRisk: 'medium',
  likelihood: 4,
  impact: 4,
  residualLikelihood: 2,
  residualImpact: 3,
  status: 'open',
  riskAssets: [{ assetId: 'asset-1' }],
  processLinks: [],
  serviceLinks: [],
  organizationUnitId: 'ou-1',
  isArchived: false,
  ...overrides,
});

describe('RiskAggregationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateByOrganizationUnit', () => {
    it('should group risks by organization unit', async () => {
      const risk1 = createRisk({ id: 'risk-1' });
      const risk2 = createRisk({ id: 'risk-2', organizationUnitId: 'ou-2' });
      mockPrismaClient.risk.findMany.mockResolvedValue([
        { ...risk1, organizationUnit: { id: 'ou-1', name: 'IT Department' } },
        { ...risk2, organizationUnit: { id: 'ou-2', name: 'HR Department' } },
      ]);

      const result = await riskAggregationService.aggregateByOrganizationUnit();

      expect(result).toHaveLength(2);
      expect(result[0].totalRisks).toBe(1);
      expect(result[1].totalRisks).toBe(1);
    });

    it('should group unassigned risks under "unassigned"', async () => {
      const risk = createRisk({ organizationUnitId: null });
      mockPrismaClient.risk.findMany.mockResolvedValue([{ ...risk, organizationUnit: null }]);

      const result = await riskAggregationService.aggregateByOrganizationUnit();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('unassigned');
    });

    it('should return empty array when no risks exist', async () => {
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      const result = await riskAggregationService.aggregateByOrganizationUnit();

      expect(result).toHaveLength(0);
    });
  });

  describe('aggregateByLocation', () => {
    it('should group risks by location via affected assets', async () => {
      const risk = createRisk({ riskAssets: [{ assetId: 'asset-1' }] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);
      mockPrismaClient.asset.findMany.mockResolvedValue([{
        id: 'asset-1',
        locationId: 'loc-1',
        location: { id: 'loc-1', name: 'Main Office', city: 'Berlin', country: 'DE' },
      }]);

      const result = await riskAggregationService.aggregateByLocation();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('loc-1');
    });

    it('should handle risks with no affected assets', async () => {
      const risk = createRisk({ riskAssets: [] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);

      const result = await riskAggregationService.aggregateByLocation();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('no-location');
    });

    it('should handle assets without location', async () => {
      const risk = createRisk({ riskAssets: [{ assetId: 'asset-1' }] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);
      mockPrismaClient.asset.findMany.mockResolvedValue([{ id: 'asset-1', location: null }]);

      const result = await riskAggregationService.aggregateByLocation();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('unlocated');
    });
  });

  describe('aggregateByAssetType', () => {
    it('should group risks by asset type via affected assets', async () => {
      const risk = createRisk({ riskAssets: [{ assetId: 'asset-1' }] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);
      mockPrismaClient.asset.findMany.mockResolvedValue([{
        id: 'asset-1',
        assetTypeId: 'type-server',
        assetType: { name: 'Server' },
      }]);

      const result = await riskAggregationService.aggregateByAssetType();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('type-server');
    });

    it('deduplicates one risk per asset-type group when multiple assets share the same type', async () => {
      const risk = createRisk({ riskAssets: [{ assetId: 'asset-1' }, { assetId: 'asset-2' }] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);
      mockPrismaClient.asset.findMany.mockResolvedValue([
        { id: 'asset-1', assetTypeId: 'type-server', assetType: { name: 'Server' } },
        { id: 'asset-2', assetTypeId: 'type-server', assetType: { name: 'Server' } },
      ]);

      const result = await riskAggregationService.aggregateByAssetType();

      expect(result).toHaveLength(1);
      expect(result[0].totalRisks).toBe(1);
    });

    it('passes methodVersion, assessmentType and assessedAt filters through RiskAssessment relation', async () => {
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      await riskAggregationService.aggregateByAssetType({
        methodVersionId: 'method-v1',
        assessmentType: 'current',
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-01-31T23:59:59.999Z'),
      });

      const where = mockPrismaClient.risk.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where)).toContain('RiskAssessment');
      expect(JSON.stringify(where)).toContain('method-v1');
      expect(JSON.stringify(where)).toContain('current');
      expect(JSON.stringify(where)).toContain('assessedAt');
    });

    it('should handle risks with no affected assets', async () => {
      const risk = createRisk({ riskAssets: [] });
      mockPrismaClient.risk.findMany.mockResolvedValue([risk]);

      const result = await riskAggregationService.aggregateByAssetType();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('no-asset');
    });
  });

  describe('aggregateByBusinessProcess', () => {
    it('should group risks by business process', async () => {
      const risk = createRisk({ processLinks: [{ processId: 'bp-1' }] });
      mockPrismaClient.risk.findMany.mockResolvedValue([{
        ...risk,
      }]);
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([{ id: 'bp-1', name: 'Order Processing' }]);

      const result = await riskAggregationService.aggregateByBusinessProcess();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('bp-1');
    });

    it('should group unassigned risks under "unassigned"', async () => {
      mockPrismaClient.risk.findMany.mockResolvedValue([{
        ...createRisk(),
        businessProcess: null,
      }]);

      const result = await riskAggregationService.aggregateByBusinessProcess();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('No Business Process');
    });
  });

  describe('aggregateByScope', () => {
    it('should return empty array when no scopes exist', async () => {
      mockPrismaClient.ismsScope.findMany.mockResolvedValue([]);

      const result = await riskAggregationService.aggregateByScope();

      expect(result).toHaveLength(0);
    });

    it('should group risks within scope by org unit membership', async () => {
      mockPrismaClient.ismsScope.findMany.mockResolvedValue([{
        id: 'scope-1',
        name: 'ISMS Scope 2024',
        includedCompanies: ['ou-1'],
        includedBusinessProcesses: [],
      }]);
      mockPrismaClient.risk.findMany.mockResolvedValue([{
        ...createRisk(),
        organizationUnitId: 'ou-1',
        organizationUnit: { id: 'ou-1', name: 'IT' },
      }]);

      const result = await riskAggregationService.aggregateByScope();

      expect(result).toHaveLength(1);
      expect(result[0].totalRisks).toBe(1);
    });

    it('should include all risks when scope has no filters', async () => {
      mockPrismaClient.ismsScope.findMany.mockResolvedValue([{
        id: 'scope-1',
        name: 'Full Scope',
        includedCompanies: [],
        includedBusinessProcesses: [],
      }]);
      mockPrismaClient.risk.findMany.mockResolvedValue([createRisk()]);

      const result = await riskAggregationService.aggregateByScope();

      expect(result).toHaveLength(1);
      expect(result[0].totalRisks).toBe(1);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary with all counts', async () => {
      const risk = createRisk();
      mockPrismaClient.risk.count.mockResolvedValue(1);
      mockPrismaClient.risk.groupBy
        .mockResolvedValueOnce([{ status: 'open', _count: { status: 1 } }])
        .mockResolvedValueOnce([{ likelihood: 4, _count: { likelihood: 1 } }])
        .mockResolvedValueOnce([{ impact: 4, _count: { impact: 1 } }]);
      mockPrismaClient.risk.findMany.mockResolvedValue([{ ...risk, riskAssets: [] }]);

      const result = await riskAggregationService.getDashboardSummary();

      expect(result.totalRisks).toBe(1);
      expect(result.byStatus['open']).toBe(1);
      expect(result.byProbability['Level 4']).toBe(1);
      expect(result.bySeverity['Level 4']).toBe(1);
    });

    it('should return empty summary when no risks exist', async () => {
      mockPrismaClient.risk.count.mockResolvedValue(0);
      mockPrismaClient.risk.groupBy.mockResolvedValue([]);
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      const result = await riskAggregationService.getDashboardSummary();

      expect(result.totalRisks).toBe(0);
      expect(Object.keys(result.byStatus)).toHaveLength(0);
    });

    it('should identify high-risk assets', async () => {
      mockPrismaClient.risk.count.mockResolvedValue(1);
      mockPrismaClient.risk.groupBy
        .mockResolvedValueOnce([{ status: 'open', _count: { status: 1 } }])
        .mockResolvedValueOnce([{ likelihood: 4, _count: { likelihood: 1 } }])
        .mockResolvedValueOnce([{ impact: 4, _count: { impact: 1 } }]);
      mockPrismaClient.risk.findMany.mockResolvedValue([{ ...createRisk(), riskAssets: [{ assetId: 'asset-1' }] }]);
      mockPrismaClient.asset.findMany.mockResolvedValue([{ id: 'asset-1', name: 'Web Server' }]);

      const result = await riskAggregationService.getDashboardSummary();

      expect(result.highRiskAssets).toHaveLength(1);
      expect(result.highRiskAssets[0].assetName).toBe('Web Server');
    });
  });
});
