// Graph types for asset dependency visualization (AST-011, AST-012)
// Unified DTO shared between frontend and backend

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

export interface AssetGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ImpactAnalysisResult {
  rootAssetId: string;
  rootAssetName: string;
  affectedAssets: Array<{
    id: string;
    name: string;
    type: string;
    criticality: string;
    distance: number;
    path: string[];
    relationTypes: string[];
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
