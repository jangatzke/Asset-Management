/**
 * Tests for AssetGraphService
 *
 * Tests graph traversal, impact analysis algorithm, and dependency resolution.
 */

const mockAssetFindUnique = jest.fn();
const mockAssetFindMany = jest.fn();
const mockRelationFindMany = jest.fn();
const mockAssetProcessFindMany = jest.fn();
const mockAssetServiceFindMany = jest.fn();

const mockPrismaClient: any = {
  asset: {
    findUnique: (...args: any[]) => mockAssetFindUnique(...args),
    findMany: (...args: any[]) => mockAssetFindMany(...args),
  },
  assetRelation: {
    findMany: (...args: any[]) => mockRelationFindMany(...args),
  },
  assetProcess: { findMany: (...args: any[]) => mockAssetProcessFindMany(...args) },
  assetService: { findMany: (...args: any[]) => mockAssetServiceFindMany(...args) },
  riskAsset: { findMany: jest.fn().mockResolvedValue([]) },
  riskProcess: { findMany: jest.fn().mockResolvedValue([]) },
  riskService: { findMany: jest.fn().mockResolvedValue([]) },
  controlAsset: { findMany: jest.fn().mockResolvedValue([]) },
  controlProcess: { findMany: jest.fn().mockResolvedValue([]) },
  incidentAsset: { findMany: jest.fn().mockResolvedValue([]) },
  incidentProcess: { findMany: jest.fn().mockResolvedValue([]) },
  incidentService: { findMany: jest.fn().mockResolvedValue([]) },
  vulnerabilityAsset: { findMany: jest.fn().mockResolvedValue([]) },
  businessProcess: { findMany: jest.fn().mockResolvedValue([]) },
  businessService: { findMany: jest.fn().mockResolvedValue([]) },
  risk: { findMany: jest.fn().mockResolvedValue([]) },
  control: { findMany: jest.fn().mockResolvedValue([]) },
  incident: { findMany: jest.fn().mockResolvedValue([]) },
  vulnerability: { findMany: jest.fn().mockResolvedValue([]) },
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
    mockAssetProcessFindMany.mockResolvedValue([]);
    mockAssetServiceFindMany.mockResolvedValue([]);
    for (const delegate of ['riskAsset', 'riskProcess', 'riskService', 'controlAsset', 'controlProcess', 'incidentAsset', 'incidentProcess', 'incidentService', 'vulnerabilityAsset', 'businessProcess', 'businessService', 'risk', 'control', 'incident', 'vulnerability']) {
      mockPrismaClient[delegate].findMany.mockResolvedValue([]);
    }
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

    it('should include the complete transitive dependency neighborhood when maxDepth is omitted', async () => {
      const assets = [
        createAssetWithType({ id: 'asset-1', name: 'App' }),
        createAssetWithType({ id: 'asset-2', name: 'Database' }),
        createAssetWithType({ id: 'asset-3', name: 'Storage' }),
        createAssetWithType({ id: 'asset-4', name: 'Portal' }),
      ];
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-1', sourceAssetId: 'asset-1', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-2', sourceAssetId: 'asset-2', targetAssetId: 'asset-3', relationshipType: 'runs_on' },
        { id: 'rel-3', sourceAssetId: 'asset-4', targetAssetId: 'asset-1', relationshipType: 'uses' },
      ]);

      const result = await service.getDependencyGraph('asset-1');

      expect(result.nodes.map((node) => node.id).sort()).toEqual(['asset-1', 'asset-2', 'asset-3', 'asset-4']);
      expect(result.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'asset-1', targetId: 'asset-2', relationType: 'depends_on' }),
        expect.objectContaining({ sourceId: 'asset-2', targetId: 'asset-3', relationType: 'runs_on' }),
        expect.objectContaining({ sourceId: 'asset-4', targetId: 'asset-1', relationType: 'uses' }),
      ]));
    });

    it('should treat outgoing depends_on relations as selected asset upstream dependencies', async () => {
      const assets = [
        createAssetWithType({ id: 'asset-1', name: 'Application' }),
        createAssetWithType({ id: 'asset-2', name: 'Database' }),
        createAssetWithType({ id: 'asset-3', name: 'Storage' }),
        createAssetWithType({ id: 'asset-4', name: 'Consumer Portal' }),
      ];
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-1', sourceAssetId: 'asset-1', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-2', sourceAssetId: 'asset-2', targetAssetId: 'asset-3', relationshipType: 'depends_on' },
        { id: 'rel-3', sourceAssetId: 'asset-4', targetAssetId: 'asset-1', relationshipType: 'depends_on' },
      ]);

      const upstream = await service.getDependencyGraph('asset-1', { direction: 'upstream' });
      const downstream = await service.getDependencyGraph('asset-1', { direction: 'downstream' });

      expect(upstream.nodes.map((node) => node.id).sort()).toEqual(['asset-1', 'asset-2', 'asset-3']);
      expect(upstream.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'asset-1', targetId: 'asset-2', relationType: 'depends_on' }),
        expect.objectContaining({ sourceId: 'asset-2', targetId: 'asset-3', relationType: 'depends_on' }),
      ]));
      expect(downstream.nodes.map((node) => node.id).sort()).toEqual(['asset-1', 'asset-4']);
      expect(downstream.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'asset-4', targetId: 'asset-1', relationType: 'depends_on' }),
      ]));
    });

    it('should render the screenshot scenario with the focus asset and its two outgoing depends_on targets', async () => {
      const assets = [
        createAssetWithType({ id: 'demo-helio-asset-123', name: 'Helio OT System 01' }),
        createAssetWithType({ id: 'demo-helio-asset-142', name: 'Helio Information 06' }),
        createAssetWithType({ id: 'demo-helio-asset-141', name: 'Helio Information 05' }),
      ];
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-helio-06', sourceAssetId: 'demo-helio-asset-123', targetAssetId: 'demo-helio-asset-142', relationshipType: 'depends_on' },
        { id: 'rel-helio-05', sourceAssetId: 'demo-helio-asset-123', targetAssetId: 'demo-helio-asset-141', relationshipType: 'depends_on' },
      ]);

      const result = await service.getDependencyGraph('demo-helio-asset-123', { direction: 'both', maxDepth: 10 });

      expect(result.nodes.map((node) => node.name).sort()).toEqual(['Helio Information 05', 'Helio Information 06', 'Helio OT System 01']);
      expect(result.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'depends_on' }),
        expect.objectContaining({ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-141', relationType: 'depends_on' }),
      ]));
      expect(result.isolatedAssets?.map((node) => node.id)).not.toContain('demo-helio-asset-123');
    });

    it('should handle empty graph (no relations)', async () => {
      const result = await service.getDependencyGraph('asset-1');

      expect(result.edges).toHaveLength(0);
      expect(result.nodes.length).toBeGreaterThanOrEqual(1); // at least root asset
    });

    it('should include isolated asset warning for asset without relations', async () => {
      const result = await service.getDependencyGraph('asset-1');

      expect(result.isolatedAssets?.map((node) => node.id)).toContain('asset-1');
      expect(result.warnings?.some((warning) => warning.code === 'ISOLATED_ASSET')).toBe(true);
    });

    it('should use relation-type-dependent directions for dependency, ownership, and connection edges', async () => {
      const assets = [
        createAssetWithType({ id: 'asset-1', name: 'App' }),
        createAssetWithType({ id: 'asset-2', name: 'DB' }),
        createAssetWithType({ id: 'asset-3', name: 'Cluster' }),
      ];
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-1', sourceAssetId: 'asset-1', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-2', sourceAssetId: 'asset-1', targetAssetId: 'asset-3', relationshipType: 'connected_to' },
        { id: 'rel-3', sourceAssetId: 'asset-3', targetAssetId: 'asset-2', relationshipType: 'ownership' },
      ]);

      const result = await service.getAssetGraph();

      expect(result.edges.find((edge) => edge.id === 'rel-1')).toMatchObject({ sourceId: 'asset-1', targetId: 'asset-2', direction: 'directed' });
      expect(result.edges.find((edge) => edge.id === 'rel-2')).toMatchObject({ direction: 'bidirectional' });
      expect(result.edges.find((edge) => edge.id === 'rel-2:reverse')).toMatchObject({ sourceId: 'asset-3', targetId: 'asset-1' });
      expect(result.edges.find((edge) => edge.id === 'rel-3')).toMatchObject({ sourceId: 'asset-3', targetId: 'asset-2', direction: 'directed' });
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

    it('should calculate multi-level impact through cycles without infinite traversal', async () => {
      const assets = [
        createAssetWithType({ id: 'asset-1', name: 'Database', criticality: 'critical' }),
        createAssetWithType({ id: 'asset-2', name: 'API', criticality: 'high' }),
        createAssetWithType({ id: 'asset-3', name: 'Portal', criticality: 'medium' }),
      ];
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-1', sourceAssetId: 'asset-2', targetAssetId: 'asset-1', relationshipType: 'depends_on' },
        { id: 'rel-2', sourceAssetId: 'asset-3', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-3', sourceAssetId: 'asset-1', targetAssetId: 'asset-3', relationshipType: 'connected_to' },
      ]);

      const result = await service.analyzeImpact('asset-1', { maxDepth: 10 });

      expect(result.affectedAssets.map((asset) => asset.id).sort()).toEqual(['asset-2', 'asset-3']);
      expect(result.cascadeDepth).toBeLessThanOrEqual(2);
    });

    it('should report impacted business processes and services from failed assets', async () => {
      const assets = [createAssetWithType({ id: 'asset-1', name: 'Database' }), createAssetWithType({ id: 'asset-2', name: 'API' })];
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([{ id: 'rel-1', sourceAssetId: 'asset-2', targetAssetId: 'asset-1', relationshipType: 'depends_on' }]);
      mockAssetProcessFindMany.mockResolvedValue([{ id: 'ap-1', assetId: 'asset-2', processId: 'process-1' }]);
      mockAssetServiceFindMany.mockResolvedValue([{ id: 'as-1', assetId: 'asset-2', serviceId: 'service-1' }]);
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([{ id: 'process-1', name: 'Order Processing', criticality: 'high', status: 'active' }]);
      mockPrismaClient.businessService.findMany.mockResolvedValue([{ id: 'service-1', name: 'Customer Portal', criticality: 'critical', status: 'active' }]);

      const result = await service.analyzeImpact('asset-1');

      expect(result.affectedBusinessProcesses).toHaveLength(1);
      expect(result.affectedBusinessServices).toHaveLength(1);
      expect(result.totalAffected).toBe(3);
    });

    it('should identify articulation points and redundant independent paths', async () => {
      const assets = ['asset-1', 'asset-2', 'asset-3', 'asset-4'].map((id) => createAssetWithType({ id, name: id, criticality: id === 'asset-2' ? 'high' : 'low' }));
      mockAssetFindUnique.mockImplementation((opts: any) => Promise.resolve(assets.find((asset) => asset.id === opts.where.id) || null));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue([
        { id: 'rel-1', sourceAssetId: 'asset-2', targetAssetId: 'asset-1', relationshipType: 'depends_on' },
        { id: 'rel-2', sourceAssetId: 'asset-3', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-3', sourceAssetId: 'asset-4', targetAssetId: 'asset-2', relationshipType: 'depends_on' },
        { id: 'rel-4', sourceAssetId: 'asset-3', targetAssetId: 'asset-1', relationshipType: 'depends_on' },
      ]);

      const result = await service.analyzeImpact('asset-1');

      expect(result.articulationPoints.some((point) => point.assetId === 'asset-2')).toBe(true);
      expect(result.redundantPaths.some((path) => path.targetId === 'asset-3' && path.redundancyDegree > 1)).toBe(true);
    });
  });

  describe('performance-sized graph', () => {
    it('should process at least 10,000 assets and 50,000 relations with batched queries', async () => {
      const assets = Array.from({ length: 10_000 }, (_, index) => createAssetWithType({ id: `asset-${index}`, name: `Asset ${index}` }));
      const relations = Array.from({ length: 50_000 }, (_, index) => ({
        id: `rel-${index}`,
        sourceAssetId: `asset-${index % 10_000}`,
        targetAssetId: `asset-${(index + 1) % 10_000}`,
        relationshipType: index % 5 === 0 ? 'connected_to' : 'depends_on',
      }));
      mockAssetFindMany.mockResolvedValue(assets);
      mockRelationFindMany.mockResolvedValue(relations);

      const result = await service.getAssetGraph();

      expect(result.nodes).toHaveLength(10_000);
      expect(result.edges.length).toBeGreaterThanOrEqual(50_000);
      expect(mockAssetFindMany).toHaveBeenCalledTimes(1);
      expect(mockRelationFindMany).toHaveBeenCalledTimes(1);
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
