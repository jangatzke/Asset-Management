export type GraphNodeType = 'Asset' | 'AssetType' | 'BusinessProcess' | 'BusinessService' | 'Risk' | 'Control' | 'Incident' | 'Vulnerability' | 'OrganizationUnit' | 'Site' | 'Contract' | 'License' | 'Document';
export type GraphRelationDirection = 'directed' | 'bidirectional';
export type GraphRelationType = 'depends_on' | 'dependency' | 'connected_to' | 'connection' | 'owns' | 'ownership' | 'parent_child' | 'asset_process' | 'asset_service' | 'risk_asset' | 'risk_process' | 'risk_service' | 'control_asset' | 'control_process' | 'incident_asset' | 'incident_process' | 'incident_service' | 'vulnerability_asset' | string;
export interface GraphWarning {
    code: 'ISOLATED_ASSET' | 'CRITICAL_ARTICULATION_POINT' | 'LOW_REDUNDANCY' | string;
    severity: 'info' | 'warning' | 'critical';
    nodeId?: string;
    message: string;
}
export interface GraphNode {
    id: string;
    name: string;
    nodeType: GraphNodeType;
    type: string;
    displayId?: string;
    assetType?: string;
    assetTypeId?: string;
    criticality?: string;
    status?: string;
    lifecycleStatus?: string;
    isolated?: boolean;
    warning?: string;
    metadata?: Record<string, unknown>;
}
export interface GraphEdge {
    id: string;
    sourceId: string;
    targetId: string;
    source: string;
    target: string;
    relationType: GraphRelationType;
    direction: GraphRelationDirection;
    label?: string;
    metadata?: Record<string, unknown>;
}
export interface GraphComponent {
    id: string;
    nodeIds: string[];
    size: number;
}
export interface ArticulationPointImpact {
    assetId: string;
    assetName: string;
    affectedAssetCount: number;
    affectedNodeCount: number;
    componentCountAfterRemoval: number;
    largestDisconnectedComponentSize: number;
    criticality: string;
    score: number;
}
export interface RedundantPathResult {
    sourceId: string;
    targetId: string;
    redundancyDegree: number;
    independentPaths: string[][];
    hasRedundancy: boolean;
}
export interface AssetGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    warnings?: GraphWarning[];
    isolatedAssets?: GraphNode[];
    components?: GraphComponent[];
    articulationPoints?: ArticulationPointImpact[];
    generatedAt?: string;
}
export interface AffectedBusinessEntity {
    id: string;
    name: string;
    type: 'BusinessProcess' | 'BusinessService';
    criticality: string;
    distance: number;
    path: string[];
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
    affectedBusinessProcesses: AffectedBusinessEntity[];
    affectedBusinessServices: AffectedBusinessEntity[];
    totalAffected: number;
    criticalPaths: Array<{
        path: string[];
        maxCriticality: string;
    }>;
    singlePointsOfFailure: string[];
    articulationPoints: ArticulationPointImpact[];
    redundantPaths: RedundantPathResult[];
    groupsByType: Record<string, string[]>;
    componentCount: number;
    cascadeDepth: number;
    warnings: GraphWarning[];
}
export interface GraphOptions {
    relationTypes?: string[];
    assetTypes?: string[];
    maxDepth?: number;
    direction?: 'both' | 'upstream' | 'downstream';
    includeBusinessEntities?: boolean;
    includeRisksAndControls?: boolean;
    includeArchived?: boolean;
}
export interface DependencyResult {
    upstream: Array<{
        id: string;
        name: string;
        type: string;
        relationType: string;
    }>;
    downstream: Array<{
        id: string;
        name: string;
        type: string;
        relationType: string;
    }>;
}
//# sourceMappingURL=graph.d.ts.map