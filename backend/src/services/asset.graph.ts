import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

// --- Types ---

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  assetType: string;
  criticality: string;
  status: string;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationType: string;
}

export interface ImpactAnalysisResult {
  rootAssetId: string;
  rootAssetName: string;
  affectedAssets: Array<{
    id: string;
    name: string;
    type: string;
    criticality: string;
    distance: number; // how many hops away
    path: string[]; // chain of asset IDs from root to this asset
    relationTypes: string[]; // types along the path
  }>;
  totalAffected: number;
  criticalPaths: Array<{ path: string[]; maxCriticality: string }>;
  singlePointsOfFailure: string[];
  groupsByType: Record<string, string[]>;
}

export interface GraphOptions {
  relationTypes?: string[];
  assetTypes?: string[];
  maxDepth?: number;
  direction?: 'both' | 'upstream' | 'downstream';
}

export interface DependencyResult {
  upstream: Array<{ id: string; name: string; type: string; relationType: string }>;
  downstream: Array<{ id: string; name: string; type: string; relationType: string }>;
}

// Criticality weighting for impact scoring
const CRITICALITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export class AssetGraphService {
  // AST-011: Get dependency graph with BFS traversal and options
  async getDependencyGraph(assetId: string, options?: GraphOptions): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    const maxDepth = options?.maxDepth ?? 3;
    const direction = options?.direction ?? 'both';

    // BFS traversal
    const visitedEdges = new Map<string, any>();
    const visitedAssetIds = new Set<string>();

    interface QueueItem {
      assetId: string;
      depth: number;
    }

    const queue: QueueItem[] = [{ assetId, depth: 0 }];
    visitedAssetIds.add(assetId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      // Outgoing relations (downstream)
      if (direction !== 'upstream') {
        const where: any = { sourceAssetId: current.assetId };
        if (options?.relationTypes) {
          where.relationshipType = { in: options.relationTypes };
        }
        const outgoing = await prisma.assetRelation.findMany(where);

        for (const rel of outgoing) {
          const edgeKey = `${rel.sourceAssetId}-${rel.targetAssetId}-${rel.relationshipType}`;
          if (!visitedEdges.has(edgeKey)) {
            visitedEdges.set(edgeKey, rel);
          }

          if (!visitedAssetIds.has(rel.targetAssetId)) {
            visitedAssetIds.add(rel.targetAssetId);
            queue.push({ assetId: rel.targetAssetId, depth: current.depth + 1 });
          }
        }
      }

      // Incoming relations (upstream)
      if (direction !== 'downstream') {
        const where: any = { targetAssetId: current.assetId };
        if (options?.relationTypes) {
          where.relationshipType = { in: options.relationTypes };
        }
        const incoming = await prisma.assetRelation.findMany(where);

        for (const rel of incoming) {
          const edgeKey = `${rel.sourceAssetId}-${rel.targetAssetId}-${rel.relationshipType}`;
          if (!visitedEdges.has(edgeKey)) {
            visitedEdges.set(edgeKey, rel);
          }

          if (!visitedAssetIds.has(rel.sourceAssetId)) {
            visitedAssetIds.add(rel.sourceAssetId);
            queue.push({ assetId: rel.sourceAssetId, depth: current.depth + 1 });
          }
        }
      }
    }

    // Fetch all assets in the graph
    const assets = await prisma.asset.findMany({
      where: { id: { in: Array.from(visitedAssetIds) } },
      include: { assetType: true },
    });

    if (options?.assetTypes) {
      const allowedTypeIds = new Set(options.assetTypes);
      // Filter: keep assets of allowed types, plus the root asset
      const filteredAssets = assets.filter(a => a.id === assetId || allowedTypeIds.has(a.assetTypeId));
      const filteredAssetIds = new Set(filteredAssets.map(a => a.id));
      // Remove edges pointing to filtered-out assets
      const filteredEdges = Array.from(visitedEdges.values()).filter(
        e => filteredAssetIds.has(e.sourceAssetId) && filteredAssetIds.has(e.targetAssetId)
      );

      const nodes: GraphNode[] = filteredAssets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.lifecycleStatus ?? 'unknown',
        assetType: a.assetType.name,
        criticality: a.criticality ?? 'low',
        status: a.status ?? 'active',
      }));

      const edges: GraphEdge[] = filteredEdges.map((r) => ({
        sourceId: r.sourceAssetId,
        targetId: r.targetAssetId,
        relationType: r.relationshipType,
      }));

      return { nodes, edges };
    }

    const nodes: GraphNode[] = assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.lifecycleStatus ?? 'unknown',
      assetType: a.assetType.name,
      criticality: a.criticality ?? 'low',
      status: a.status ?? 'active',
    }));

    const edges: GraphEdge[] = Array.from(visitedEdges.values()).map((r) => ({
      sourceId: r.sourceAssetId,
      targetId: r.targetAssetId,
      relationType: r.relationshipType,
    }));

    return { nodes, edges };
  }

  // Legacy alias for backward compatibility
  async getAssetGraph(assetId?: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    if (assetId) {
      return this.getDependencyGraph(assetId);
    }
    // Full graph fallback
    const relations = await prisma.assetRelation.findMany();
    const edgeSet = new Map<string, typeof relations[0]>();
    for (const rel of relations) {
      const key = `${rel.sourceAssetId}-${rel.targetAssetId}-${rel.relationshipType}`;
      if (!edgeSet.has(key)) edgeSet.set(key, rel);
    }
    const assetIds = new Set<string>();
    for (const rel of edgeSet.values()) {
      assetIds.add(rel.sourceAssetId);
      assetIds.add(rel.targetAssetId);
    }
    const assets = await prisma.asset.findMany({
      where: { id: { in: Array.from(assetIds) } },
      include: { assetType: true },
    });
    return {
      nodes: assets.map(a => ({
        id: a.id, name: a.name, type: a.lifecycleStatus ?? 'unknown',
        assetType: a.assetType.name, criticality: a.criticality ?? 'low', status: a.status ?? 'active',
      })),
      edges: Array.from(edgeSet.values()).map(r => ({
        sourceId: r.sourceAssetId, targetId: r.targetAssetId, relationType: r.relationshipType,
      })),
    };
  }

  // AST-012: Impact analysis - DFS blast radius with criticality weighting
  async analyzeImpact(assetId: string, options?: { maxDepth?: number }): Promise<ImpactAnalysisResult> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    const maxDepth = options?.maxDepth ?? 10;
    const visited = new Set<string>();
    visited.add(assetId);

    interface QueueItem {
      currentId: string;
      distance: number;
      path: string[];
      relationTypes: string[];
    }

    const queue: QueueItem[] = [{
      currentId: assetId,
      distance: 0,
      path: [assetId],
      relationTypes: [],
    }];

    const affectedAssets: ImpactAnalysisResult['affectedAssets'] = [];
    const allPaths: Array<{ path: string[]; maxCriticality: string }> = [];
    const assetDependencyCount = new Map<string, number>(); // track how many paths lead to each asset

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.distance >= maxDepth) continue;

      // Find all outgoing relations from the current asset
      const outgoingRelations = await prisma.assetRelation.findMany({
        where: { sourceAssetId: current.currentId },
      });

      for (const rel of outgoingRelations) {
        if (!visited.has(rel.targetAssetId)) {
          visited.add(rel.targetAssetId);

          // Fetch target asset details
          const targetAsset = await prisma.asset.findUnique({
            where: { id: rel.targetAssetId },
            include: { assetType: true },
          });

          if (targetAsset) {
            const newPath = [...current.path, rel.targetAssetId];
            const newRelationTypes = [...current.relationTypes, rel.relationshipType];
            const criticality = targetAsset.criticality ?? 'low';

            affectedAssets.push({
              id: targetAsset.id,
              name: targetAsset.name,
              type: targetAsset.assetType.name,
              criticality,
              distance: current.distance + 1,
              path: newPath,
              relationTypes: newRelationTypes,
            });

            // Track dependency count for single-point-of-failure detection
            assetDependencyCount.set(targetAsset.id, (assetDependencyCount.get(targetAsset.id) || 0) + 1);

            // Find max criticality along this path
            const pathAssets = await prisma.asset.findMany({
              where: { id: { in: newPath } },
              select: { criticality: true },
            });
            const maxCrit = pathAssets.reduce((max, a) => {
              return (CRITICALITY_WEIGHT[a.criticality] || 0) > (CRITICALITY_WEIGHT[max] || 0) ? a.criticality : max;
            }, 'low');
            allPaths.push({ path: newPath, maxCriticality: maxCrit });

            queue.push({
              currentId: rel.targetAssetId,
              distance: current.distance + 1,
              path: newPath,
              relationTypes: newRelationTypes,
            });
          }
        }
      }
    }

    // Sort affected assets by criticality weight (highest first), then by distance
    affectedAssets.sort((a, b) => {
      const weightDiff = (CRITICALITY_WEIGHT[b.criticality] || 0) - (CRITICALITY_WEIGHT[a.criticality] || 0);
      if (weightDiff !== 0) return weightDiff;
      return a.distance - b.distance;
    });

    // Identify critical paths (paths containing at least one Critical/High asset)
    const criticalPaths = allPaths
      .filter(p => CRITICALITY_WEIGHT[p.maxCriticality] >= 3)
      .sort((a, b) => (CRITICALITY_WEIGHT[b.maxCriticality] || 0) - (CRITICALITY_WEIGHT[a.maxCriticality] || 0));

    // Single points of failure: assets with only one dependency path leading to them
    const singlePointsOfFailure = Array.from(assetDependencyCount.entries())
      .filter(([_, count]) => count === 1)
      .map(([id]) => id);

    // Group affected assets by type (services, processes, infrastructure)
    const groupsByType: Record<string, string[]> = {};
    for (const asset of affectedAssets) {
      if (!groupsByType[asset.type]) {
        groupsByType[asset.type] = [];
      }
      groupsByType[asset.type].push(asset.id);
    }

    return {
      rootAssetId: asset.id,
      rootAssetName: asset.name,
      affectedAssets,
      totalAffected: affectedAssets.length,
      criticalPaths,
      singlePointsOfFailure,
      groupsByType,
    };
  }

  // AST-011/AST-012: Get all upstream and downstream dependencies for an asset
  async getDependencies(assetId: string): Promise<DependencyResult> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    // Direct upstream (assets this depends on - incoming relations)
    const incoming = await prisma.assetRelation.findMany({
      where: { targetAssetId: assetId },
      include: { sourceAsset: { include: { assetType: true } } },
    });

    // Direct downstream (assets depending on this - outgoing relations)
    const outgoing = await prisma.assetRelation.findMany({
      where: { sourceAssetId: assetId },
      include: { targetAsset: { include: { assetType: true } } },
    });

    const upstream = incoming.map(r => ({
      id: r.sourceAsset.id,
      name: r.sourceAsset.name,
      type: r.sourceAsset.assetType.name,
      relationType: r.relationshipType,
    }));

    const downstream = outgoing.map(r => ({
      id: r.targetAsset.id,
      name: r.targetAsset.name,
      type: r.targetAsset.assetType.name,
      relationType: r.relationshipType,
    }));

    return { upstream, downstream };
  }

  // Get downstream dependencies - assets that would be affected if this asset fails
  async getDownstreamDependencies(assetId: string): Promise<GraphNode[]> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    // BFS to find all downstream assets (following outgoing relations)
    const visited = new Set<string>();
    visited.add(assetId);

    interface QueueItem {
      assetId: string;
    }

    const queue: QueueItem[] = [{ assetId }];
    const results: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      const outgoingRelations = await prisma.assetRelation.findMany({
        where: { sourceAssetId: current.assetId },
      });

      for (const rel of outgoingRelations) {
        if (!visited.has(rel.targetAssetId)) {
          visited.add(rel.targetAssetId);

          const targetAsset = await prisma.asset.findUnique({
            where: { id: rel.targetAssetId },
            include: { assetType: true },
          });

          if (targetAsset) {
            results.push({
              id: targetAsset.id,
              name: targetAsset.name,
              type: targetAsset.lifecycleStatus ?? 'unknown',
              assetType: targetAsset.assetType.name,
              criticality: targetAsset.criticality ?? 'low',
              status: targetAsset.status ?? 'active',
            });

            queue.push({ assetId: rel.targetAssetId });
          }
        }
      }
    }

    return results;
  }

  // Get upstream dependencies - assets that could cause this asset to fail
  async getUpstreamDependencies(assetId: string): Promise<GraphNode[]> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    // BFS to find all upstream assets (following incoming relations)
    const visited = new Set<string>();
    visited.add(assetId);

    interface QueueItem {
      assetId: string;
    }

    const queue: QueueItem[] = [{ assetId }];
    const results: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Find all relations where this asset is the target (incoming)
      const incomingRelations = await prisma.assetRelation.findMany({
        where: { targetAssetId: current.assetId },
      });

      for (const rel of incomingRelations) {
        if (!visited.has(rel.sourceAssetId)) {
          visited.add(rel.sourceAssetId);

          const sourceAsset = await prisma.asset.findUnique({
            where: { id: rel.sourceAssetId },
            include: { assetType: true },
          });

          if (sourceAsset) {
            results.push({
              id: sourceAsset.id,
              name: sourceAsset.name,
              type: sourceAsset.lifecycleStatus ?? 'unknown',
              assetType: sourceAsset.assetType.name,
              criticality: sourceAsset.criticality ?? 'low',
              status: sourceAsset.status ?? 'active',
            });

            queue.push({ assetId: rel.sourceAssetId });
          }
        }
      }
    }

    return results;
  }
}

export const assetGraphService = new AssetGraphService();
