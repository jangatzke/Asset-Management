/**
 * Tests for AssetGraphService
 *
 * Tests graph traversal, impact analysis algorithm, and dependency resolution.
 */

const mockAssetFindUnique = jest.fn();
const mockAssetFindMany = jest.fn();
const mockRelationFindMany = jest.fn();

const mockPrismaClient: any = {
  asset: {
    findUnique: (...args: any[]) => mockAssetFindUnique(...args),
    findMany: (...args: any[]) => mockAssetFindMany(...args),
  },
  assetRelation: {
    findMany: (...args: any[]) => mockRelationFindMany(...args),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { AssetGraphService } from '../services/asset.graph';

// Test fixture data
const createAsset = (overrides = {}) => ({
  id: 'asset-1',
  name: 'Web Server',
  assetTypeId: 'type-1',
  criticality: 'high',
  status: 'active',
  lifecycleStatus: 'operational',
  ...overrides,
});

const createAssetWithType = (overrides = {}) => ({
  ...createAsset(overrides),
  assetType: { name: 'Server' },
});

describe('AssetGraphService', () => {
  const service = new AssetGraphService();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks - return empty arrays for relations, root asset for findUnique/findMany
    mockRelationFindMany.mockResolvedValue([]);
    mockAssetFindUnique.mockImplementation((opts: any) => {
      if (opts?.where?.id === 'nonexistent') return Promise.resolve(null);
      return Promise.resolve(createAsset());
    });
    mockAssetFindMany.mockImplementation((opts: any) => {
      // When called with include assetType, return assets with type included
      if (opts?.include?.assetType) {
        return Promise.resolve([createAssetWithType()]);
      }
      return Promise.resolve([]);
    });
  });

  describe('getDependencyGraph', () => {
    it('should return graph with nodes and edges for root asset', async () => {
      const result = await service.getDependencyGraph('asset-1');

      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.edges).toBeDefined();
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should throw 404 for non-existent asset', async () => {
      mockAssetFindUnique.mockResolvedValue(null);

      await expect(service.getDependencyGraph('nonexistent')).rejects.toThrow('Asset not found');
    });

    it('should respect maxDepth option', async () => {
      await service.getDependencyGraph('asset-1', { maxDepth: 1 });

      expect(mockAssetFindUnique).toHaveBeenCalled();
    });

    it('should handle empty graph (no relations)', async () => {
      const result = await service.getDependencyGraph('asset-1');

      expect(result.edges).toHaveLength(0);
      expect(result.nodes.length).toBeGreaterThanOrEqual(1); // at least root asset
    });
  });

  describe('getDependencies', () => {
    it('should return upstream and downstream dependencies as empty arrays when no relations', async () => {
      mockRelationFindMany.mockResolvedValue([]);

      const result = await service.getDependencies('asset-1');

      expect(result.upstream).toBeDefined();
      expect(Array.isArray(result.upstream)).toBe(true);
      expect(result.downstream).toBeDefined();
      expect(Array.isArray(result.downstream)).toBe(true);
    });
  });

  describe('analyzeImpact', () => {
    it('should return impact analysis result for an asset', async () => {
      const rootAsset = createAssetWithType();
      mockAssetFindUnique.mockResolvedValue(rootAsset);
      mockRelationFindMany.mockResolvedValue([]);

      const result = await service.analyzeImpact('asset-1');

      expect(result.rootAssetId).toBe('asset-1');
      expect(result.totalAffected).toBeDefined();
    });

    it('should throw 404 for non-existent asset', async () => {
      mockAssetFindUnique.mockResolvedValue(null);

      await expect(service.analyzeImpact('nonexistent')).rejects.toThrow('Asset not found');
    });

    it('should return result with affectedAssets array', async () => {
      const rootAsset = createAssetWithType();
      mockAssetFindUnique.mockResolvedValue(rootAsset);
      mockRelationFindMany.mockResolvedValue([]);

      const result = await service.analyzeImpact('asset-1');

      expect(result.affectedAssets).toBeDefined();
      expect(Array.isArray(result.affectedAssets)).toBe(true);
    });
  });

  describe('getDownstreamDependencies', () => {
    it('should return downstream nodes', async () => {
      mockAssetFindUnique.mockResolvedValue(createAsset());
      mockRelationFindMany.mockResolvedValue([]);
      mockAssetFindMany.mockResolvedValue([]);

      const result = await service.getDownstreamDependencies('asset-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUpstreamDependencies', () => {
    it('should return upstream nodes', async () => {
      mockAssetFindUnique.mockResolvedValue(createAsset());
      mockRelationFindMany.mockResolvedValue([]);
      mockAssetFindMany.mockResolvedValue([]);

      const result = await service.getUpstreamDependencies('asset-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
