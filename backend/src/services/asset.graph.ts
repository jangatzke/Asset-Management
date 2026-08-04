import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export type GraphNodeType = 'Asset' | 'BusinessProcess' | 'BusinessService' | 'Risk' | 'Control' | 'Incident' | 'Vulnerability';
export type GraphRelationDirection = 'directed' | 'bidirectional';

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
  relationType: string;
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
  affectedAssets: Array<{ id: string; name: string; type: string; criticality: string; distance: number; path: string[]; relationTypes: string[] }>;
  affectedBusinessProcesses: AffectedBusinessEntity[];
  affectedBusinessServices: AffectedBusinessEntity[];
  totalAffected: number;
  criticalPaths: Array<{ path: string[]; maxCriticality: string }>;
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
  upstream: Array<{ id: string; name: string; type: string; relationType: string }>;
  downstream: Array<{ id: string; name: string; type: string; relationType: string }>;
}

type AssetRecord = {
  id: string;
  displayId?: string;
  name: string;
  assetTypeId: string;
  criticality?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  isArchived?: boolean;
  assetType?: { id?: string; name: string; category?: string };
};

type AssetRelationRecord = {
  id?: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: string;
  description?: string | null;
};

type BusinessEntityRecord = {
  id: string;
  displayId?: string;
  name?: string;
  criticality?: string | null;
  status?: string | null;
  isArchived?: boolean;
};

type EntityEdgeRecord = {
  id?: string;
  assetId?: string;
  processId?: string;
  serviceId?: string;
  riskId?: string;
  controlId?: string;
  incidentId?: string;
  vulnerabilityId?: string;
};

type GraphData = {
  assets: AssetRecord[];
  relations: AssetRelationRecord[];
  assetProcesses: EntityEdgeRecord[];
  assetServices: EntityEdgeRecord[];
  riskAssets: EntityEdgeRecord[];
  riskProcesses: EntityEdgeRecord[];
  riskServices: EntityEdgeRecord[];
  controlAssets: EntityEdgeRecord[];
  controlProcesses: EntityEdgeRecord[];
  incidentAssets: EntityEdgeRecord[];
  incidentProcesses: EntityEdgeRecord[];
  incidentServices: EntityEdgeRecord[];
  vulnerabilityAssets: EntityEdgeRecord[];
  processes: BusinessEntityRecord[];
  services: BusinessEntityRecord[];
  risks: Array<BusinessEntityRecord & { title?: string; residualRisk?: string }>;
  controls: Array<BusinessEntityRecord & { title?: string; implementationStatus?: string }>;
  incidents: Array<BusinessEntityRecord & { title?: string; severity?: string }>;
  vulnerabilities: Array<BusinessEntityRecord & { severity?: string }>;
};

type TraversalEdge = {
  from: string;
  to: string;
  relationType: string;
};

const CRITICALITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const GRAPH_CACHE_TTL_MS = 30_000;
const graphCache = new Map<string, { expiresAt: number; value: AssetGraph }>();

const normalizeRelationType = (type: string): string => type.trim().toLowerCase().replace(/[\s-]+/g, '_');

const relationDirection = (type: string): GraphRelationDirection => {
  const normalized = normalizeRelationType(type);
  if (['connected_to', 'connection', 'connected', 'peer', 'related_to'].includes(normalized)) return 'bidirectional';
  return 'directed';
};

const isDependencyRelation = (type: string): boolean => {
  const normalized = normalizeRelationType(type);
  return ['depends_on', 'dependency', 'requires', 'uses', 'runs_on', 'hosted_on'].includes(normalized);
};

const isOwnershipRelation = (type: string): boolean => {
  const normalized = normalizeRelationType(type);
  return ['owns', 'ownership', 'parent_child', 'parent', 'contains', 'part_of'].includes(normalized);
};

const edgeKey = (sourceId: string, targetId: string, relationType: string): string => `${sourceId}->${targetId}:${relationType}`;

const businessProcessNodeId = (id: string): string => `BusinessProcess:${id}`;
const businessServiceNodeId = (id: string): string => `BusinessService:${id}`;
const riskNodeId = (id: string): string => `Risk:${id}`;
const controlNodeId = (id: string): string => `Control:${id}`;
const incidentNodeId = (id: string): string => `Incident:${id}`;
const vulnerabilityNodeId = (id: string): string => `Vulnerability:${id}`;

export class AssetGraphService {
  async getDependencyGraph(assetId: string, options?: GraphOptions): Promise<AssetGraph> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Asset not found', 404);

    const data = await this.loadGraphData(options);
    const graph = this.buildAssetGraph(data, options);
    const maxDepth = options?.maxDepth ?? Number.MAX_SAFE_INTEGER;
    const direction = options?.direction ?? 'both';
    const allowedAssetIds = this.traverseAssetIds(assetId, data.relations, maxDepth, direction, options?.relationTypes);
    const allowedNodeIds = new Set<string>(allowedAssetIds);

    for (const link of data.assetProcesses) if (link.assetId && link.processId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(businessProcessNodeId(link.processId));
    for (const link of data.assetServices) if (link.assetId && link.serviceId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(businessServiceNodeId(link.serviceId));
    if (options?.includeRisksAndControls) {
      for (const link of data.riskAssets) if (link.assetId && link.riskId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(riskNodeId(link.riskId));
      for (const link of data.controlAssets) if (link.assetId && link.controlId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(controlNodeId(link.controlId));
      for (const link of data.incidentAssets) if (link.assetId && link.incidentId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(incidentNodeId(link.incidentId));
      for (const link of data.vulnerabilityAssets) if (link.assetId && link.vulnerabilityId && allowedAssetIds.has(link.assetId)) allowedNodeIds.add(vulnerabilityNodeId(link.vulnerabilityId));
    }

    const nodes = graph.nodes.filter(node => allowedNodeIds.has(node.id));

    // Ensure the root asset is always present even when it has no relations or was filtered out
    const rootAssetId = assetId;
    const rootAssetAlreadyInNodes = nodes.some((node) => node.id === rootAssetId);
    if (!rootAssetAlreadyInNodes) {
      const rootAssetNode: GraphNode = {
        id: asset.id,
        displayId: asset.displayId ?? undefined,
        name: asset.name,
        nodeType: 'Asset',
        type: (asset as any).assetType?.category ?? (asset as any).assetType?.name ?? asset.lifecycleStatus ?? 'asset',
        assetType: (asset as any).assetType?.name ?? 'unknown',
        assetTypeId: asset.assetTypeId,
        criticality: asset.criticality ?? 'low',
        status: asset.status ?? 'active',
        lifecycleStatus: asset.lifecycleStatus ?? 'unknown',
      };
      nodes.unshift(rootAssetNode);
      allowedNodeIds.add(rootAssetId);
    }

    const nodeIds = new Set(nodes.map(node => node.id));
    const edges = graph.edges.filter(edge => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId));
    const warnings = this.buildWarnings(nodes, edges);
    return {
      ...graph,
      nodes,
      edges,
      warnings,
      isolatedAssets: nodes.filter(node => node.nodeType === 'Asset' && node.isolated),
      components: this.connectedComponents(nodes.map(node => node.id), edges),
      articulationPoints: this.findArticulationPoints(nodes, edges),
    };
  }

  async getAssetGraph(assetId?: string): Promise<AssetGraph> {
    if (assetId) return this.getDependencyGraph(assetId);

    const cacheKey = 'full:default';
    const cached = graphCache.get(cacheKey);
    if (process.env.NODE_ENV !== 'test' && cached && cached.expiresAt > Date.now()) return cached.value;

    const data = await this.loadGraphData();
    const graph = this.buildAssetGraph(data);
    if (process.env.NODE_ENV !== 'test') graphCache.set(cacheKey, { expiresAt: Date.now() + GRAPH_CACHE_TTL_MS, value: graph });
    return graph;
  }

  async analyzeImpact(assetId: string, options?: { maxDepth?: number }): Promise<ImpactAnalysisResult> {
    const root = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!root) throw new AppError('Asset not found', 404);

    const maxDepth = options?.maxDepth ?? 10;
    const data = await this.loadGraphData();
    const assetById = new Map(data.assets.map(asset => [asset.id, asset]));
    const graph = this.buildAssetGraph(data);
    const adjacency = this.buildFailureAdjacency(data.relations);
    const visited = new Set<string>([assetId]);
    const queue: Array<{ id: string; distance: number; path: string[]; relationTypes: string[] }> = [
      { id: assetId, distance: 0, path: [assetId], relationTypes: [] },
    ];
    const affectedAssets: ImpactAnalysisResult['affectedAssets'] = [];
    const allPaths: Array<{ path: string[]; maxCriticality: string }> = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.distance >= maxDepth) continue;
      for (const next of adjacency.get(current.id) ?? []) {
        if (visited.has(next.to)) continue;
        visited.add(next.to);
        const target = assetById.get(next.to);
        if (!target) continue;
        const path = [...current.path, next.to];
        const relationTypes = [...current.relationTypes, next.relationType];
        const criticality = target.criticality ?? 'low';
        affectedAssets.push({
          id: target.id,
          name: target.name,
          type: target.assetType?.name ?? 'unknown',
          criticality,
          distance: current.distance + 1,
          path,
          relationTypes,
        });
        allPaths.push({ path, maxCriticality: this.maxCriticalityForPath(path, assetById) });
        queue.push({ id: next.to, distance: current.distance + 1, path, relationTypes });
      }
    }

    affectedAssets.sort((a, b) => ((CRITICALITY_WEIGHT[b.criticality] ?? 0) - (CRITICALITY_WEIGHT[a.criticality] ?? 0)) || a.distance - b.distance);
    const affectedAssetIds = new Set([assetId, ...affectedAssets.map(asset => asset.id)]);
    const affectedBusinessProcesses = this.affectedBusinessProcesses(data, affectedAssetIds, affectedAssets, assetId);
    const affectedBusinessServices = this.affectedBusinessServices(data, affectedAssetIds, affectedAssets, assetId);
    const criticalPaths = allPaths
      .filter(path => (CRITICALITY_WEIGHT[path.maxCriticality] ?? 0) >= 3)
      .sort((a, b) => (CRITICALITY_WEIGHT[b.maxCriticality] ?? 0) - (CRITICALITY_WEIGHT[a.maxCriticality] ?? 0));
    const groupsByType: Record<string, string[]> = {};
    for (const affected of affectedAssets) {
      groupsByType[affected.type] = groupsByType[affected.type] ?? [];
      groupsByType[affected.type].push(affected.id);
    }
    groupsByType.BusinessProcess = affectedBusinessProcesses.map(process => process.id);
    groupsByType.BusinessService = affectedBusinessServices.map(service => service.id);

    const articulationPoints = this.findArticulationPoints(graph.nodes, graph.edges).filter(point => point.assetId === assetId || affectedAssetIds.has(point.assetId));
    const redundantPaths = affectedAssets.slice(0, 25).map(asset => this.calculateRedundantPaths(assetId, asset.id, graph.edges)).filter(result => result.redundancyDegree > 0);
    const warnings: GraphWarning[] = [];
    if (articulationPoints.some(point => point.assetId === assetId && point.score >= 10)) {
      warnings.push({ code: 'CRITICAL_ARTICULATION_POINT', severity: 'critical', nodeId: assetId, message: 'Root asset is a critical articulation point for the asset graph.' });
    }
    for (const result of redundantPaths) {
      if (result.redundancyDegree <= 1) warnings.push({ code: 'LOW_REDUNDANCY', severity: 'warning', nodeId: result.targetId, message: `Only ${result.redundancyDegree} independent path(s) from failed asset to ${result.targetId}.` });
    }

    return {
      rootAssetId: assetId,
      rootAssetName: root.name,
      affectedAssets,
      affectedBusinessProcesses,
      affectedBusinessServices,
      totalAffected: affectedAssets.length + affectedBusinessProcesses.length + affectedBusinessServices.length,
      criticalPaths,
      singlePointsOfFailure: articulationPoints.map(point => point.assetId),
      articulationPoints,
      redundantPaths,
      groupsByType,
      componentCount: graph.components?.length ?? 0,
      cascadeDepth: affectedAssets.reduce((max, asset) => Math.max(max, asset.distance), 0),
      warnings,
    };
  }

  async getDependencies(assetId: string): Promise<DependencyResult> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Asset not found', 404);

    const [incoming, outgoing] = await Promise.all([
      prisma.assetRelation.findMany({ where: { targetAssetId: assetId }, include: { sourceAsset: { include: { assetType: true } } } }),
      prisma.assetRelation.findMany({ where: { sourceAssetId: assetId }, include: { targetAsset: { include: { assetType: true } } } }),
    ]);

    return {
      upstream: incoming.map((rel: any) => ({ id: rel.sourceAsset.id, name: rel.sourceAsset.name, type: rel.sourceAsset.assetType.name, relationType: rel.relationshipType })),
      downstream: outgoing.map((rel: any) => ({ id: rel.targetAsset.id, name: rel.targetAsset.name, type: rel.targetAsset.assetType.name, relationType: rel.relationshipType })),
    };
  }

  async getDownstreamDependencies(assetId: string): Promise<GraphNode[]> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Asset not found', 404);
    const data = await this.loadGraphData();
    const ids = this.traverseFailureImpact(assetId, data.relations, Number.MAX_SAFE_INTEGER);
    const assetById = new Map(data.assets.map(record => [record.id, record]));
    return [...ids].filter(id => id !== assetId).map(id => this.assetToNode(assetById.get(id)!));
  }

  async getUpstreamDependencies(assetId: string): Promise<GraphNode[]> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Asset not found', 404);
    const data = await this.loadGraphData();
    const ids = this.traverseAssetIds(assetId, data.relations, Number.MAX_SAFE_INTEGER, 'upstream');
    const assetById = new Map(data.assets.map(record => [record.id, record]));
    return [...ids].filter(id => id !== assetId).map(id => this.assetToNode(assetById.get(id)!));
  }

  private async loadGraphData(options?: GraphOptions): Promise<GraphData> {
    const assetWhere = options?.includeArchived ? {} : { isArchived: false };
    const activeWhere = options?.includeArchived ? {} : { isArchived: false };
    const [
      assets,
      relations,
      assetProcesses,
      assetServices,
      riskAssets,
      riskProcesses,
      riskServices,
      controlAssets,
      controlProcesses,
      incidentAssets,
      incidentProcesses,
      incidentServices,
      vulnerabilityAssets,
      processes,
      services,
      risks,
      controls,
      incidents,
      vulnerabilities,
    ] = await Promise.all([
      prisma.asset.findMany({ where: assetWhere, include: { assetType: true } }),
      options?.relationTypes ? prisma.assetRelation.findMany({ where: { relationshipType: { in: options.relationTypes } } }) : prisma.assetRelation.findMany(),
      prisma.assetProcess?.findMany?.() ?? Promise.resolve([]),
      prisma.assetService?.findMany?.() ?? Promise.resolve([]),
      prisma.riskAsset?.findMany?.() ?? Promise.resolve([]),
      prisma.riskProcess?.findMany?.() ?? Promise.resolve([]),
      prisma.riskService?.findMany?.() ?? Promise.resolve([]),
      prisma.controlAsset?.findMany?.() ?? Promise.resolve([]),
      prisma.controlProcess?.findMany?.() ?? Promise.resolve([]),
      prisma.incidentAsset?.findMany?.() ?? Promise.resolve([]),
      prisma.incidentProcess?.findMany?.() ?? Promise.resolve([]),
      prisma.incidentService?.findMany?.() ?? Promise.resolve([]),
      prisma.vulnerabilityAsset?.findMany?.() ?? Promise.resolve([]),
      prisma.businessProcess?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
      prisma.businessService?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
      prisma.risk?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
      prisma.control?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
      prisma.incident?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
      prisma.vulnerability?.findMany?.({ where: activeWhere }) ?? Promise.resolve([]),
    ]);
    return { assets: assets as AssetRecord[], relations: relations as AssetRelationRecord[], assetProcesses, assetServices, riskAssets, riskProcesses, riskServices, controlAssets, controlProcesses, incidentAssets, incidentProcesses, incidentServices, vulnerabilityAssets, processes, services, risks, controls, incidents, vulnerabilities } as GraphData;
  }

  private buildAssetGraph(data: GraphData, options?: GraphOptions): AssetGraph {
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();
    const addEdge = (sourceId: string, targetId: string, relationType: string, id?: string): void => {
      const direction = relationDirection(relationType);
      const key = id ?? edgeKey(sourceId, targetId, relationType);
      if (!edges.has(key)) edges.set(key, { id: key, sourceId, targetId, source: sourceId, target: targetId, relationType, direction });
    };

    const allowedAssetTypes = options?.assetTypes ? new Set(options.assetTypes) : undefined;
    for (const asset of data.assets) {
      if (allowedAssetTypes && !allowedAssetTypes.has(asset.assetTypeId) && !allowedAssetTypes.has(asset.assetType?.name ?? '')) continue;
      nodes.set(asset.id, this.assetToNode(asset));
    }
    const assetIds = new Set(nodes.keys());

    for (const rel of data.relations) {
      if (!assetIds.has(rel.sourceAssetId) || !assetIds.has(rel.targetAssetId)) continue;
      addEdge(rel.sourceAssetId, rel.targetAssetId, rel.relationshipType, rel.id);
      if (relationDirection(rel.relationshipType) === 'bidirectional') addEdge(rel.targetAssetId, rel.sourceAssetId, rel.relationshipType, `${rel.id ?? edgeKey(rel.sourceAssetId, rel.targetAssetId, rel.relationshipType)}:reverse`);
    }

    if (options?.includeBusinessEntities !== false) {
      for (const process of data.processes) nodes.set(businessProcessNodeId(process.id), this.businessEntityToNode(process, 'BusinessProcess'));
      for (const service of data.services) nodes.set(businessServiceNodeId(service.id), this.businessEntityToNode(service, 'BusinessService'));
      for (const link of data.assetProcesses) if (link.assetId && link.processId && assetIds.has(link.assetId)) addEdge(link.assetId, businessProcessNodeId(link.processId), 'asset_process', link.id);
      for (const link of data.assetServices) if (link.assetId && link.serviceId && assetIds.has(link.assetId)) addEdge(link.assetId, businessServiceNodeId(link.serviceId), 'asset_service', link.id);
      for (const link of data.riskProcesses) if (link.riskId && link.processId) addEdge(riskNodeId(link.riskId), businessProcessNodeId(link.processId), 'risk_process', link.id);
      for (const link of data.riskServices) if (link.riskId && link.serviceId) addEdge(riskNodeId(link.riskId), businessServiceNodeId(link.serviceId), 'risk_service', link.id);
      for (const link of data.controlProcesses) if (link.controlId && link.processId) addEdge(controlNodeId(link.controlId), businessProcessNodeId(link.processId), 'control_process', link.id);
      for (const link of data.incidentProcesses) if (link.incidentId && link.processId) addEdge(incidentNodeId(link.incidentId), businessProcessNodeId(link.processId), 'incident_process', link.id);
      for (const link of data.incidentServices) if (link.incidentId && link.serviceId) addEdge(incidentNodeId(link.incidentId), businessServiceNodeId(link.serviceId), 'incident_service', link.id);
    }

    if (options?.includeRisksAndControls !== false) {
      for (const risk of data.risks) nodes.set(riskNodeId(risk.id), this.businessEntityToNode({ ...risk, name: risk.title ?? risk.name }, 'Risk'));
      for (const control of data.controls) nodes.set(controlNodeId(control.id), this.businessEntityToNode({ ...control, name: control.title ?? control.name }, 'Control'));
      for (const incident of data.incidents) nodes.set(incidentNodeId(incident.id), this.businessEntityToNode({ ...incident, name: incident.title ?? incident.name, criticality: incident.severity ?? incident.criticality }, 'Incident'));
      for (const vulnerability of data.vulnerabilities) nodes.set(vulnerabilityNodeId(vulnerability.id), this.businessEntityToNode({ ...vulnerability, criticality: vulnerability.severity ?? vulnerability.criticality }, 'Vulnerability'));
      for (const link of data.riskAssets) if (link.assetId && link.riskId && assetIds.has(link.assetId)) addEdge(riskNodeId(link.riskId), link.assetId, 'risk_asset', link.id);
      for (const link of data.controlAssets) if (link.assetId && link.controlId && assetIds.has(link.assetId)) addEdge(controlNodeId(link.controlId), link.assetId, 'control_asset', link.id);
      for (const link of data.incidentAssets) if (link.assetId && link.incidentId && assetIds.has(link.assetId)) addEdge(incidentNodeId(link.incidentId), link.assetId, 'incident_asset', link.id);
      for (const link of data.vulnerabilityAssets) if (link.assetId && link.vulnerabilityId && assetIds.has(link.assetId)) addEdge(vulnerabilityNodeId(link.vulnerabilityId), link.assetId, 'vulnerability_asset', link.id);
    }

    const nodeList = [...nodes.values()];
    const edgeList = [...edges.values()].filter(edge => nodes.has(edge.sourceId) && nodes.has(edge.targetId));
    const warnings = this.buildWarnings(nodeList, edgeList);
    const isolatedIds = new Set(warnings.filter(warning => warning.code === 'ISOLATED_ASSET' && warning.nodeId).map(warning => warning.nodeId!));
    for (const node of nodeList) {
      if (isolatedIds.has(node.id)) {
        node.isolated = true;
        node.warning = 'Isolated asset: possible documentation gap.';
      }
    }
    const components = this.connectedComponents(nodeList.map(node => node.id), edgeList);
    return {
      nodes: nodeList,
      edges: edgeList,
      warnings,
      isolatedAssets: nodeList.filter(node => node.nodeType === 'Asset' && node.isolated),
      components,
      articulationPoints: this.findArticulationPoints(nodeList, edgeList),
      generatedAt: new Date().toISOString(),
    };
  }

  private assetToNode(asset: AssetRecord): GraphNode {
    return {
      id: asset.id,
      displayId: asset.displayId,
      name: asset.name,
      nodeType: 'Asset',
      type: asset.assetType?.category ?? asset.assetType?.name ?? asset.lifecycleStatus ?? 'asset',
      assetType: asset.assetType?.name ?? 'unknown',
      assetTypeId: asset.assetTypeId,
      criticality: asset.criticality ?? 'low',
      status: asset.status ?? 'active',
      lifecycleStatus: asset.lifecycleStatus ?? 'unknown',
    };
  }

  private businessEntityToNode(entity: BusinessEntityRecord, nodeType: GraphNode['nodeType']): GraphNode {
    return { id: `${nodeType}:${entity.id}`, displayId: entity.displayId, name: entity.name ?? entity.id, nodeType, type: nodeType, criticality: entity.criticality ?? 'low', status: entity.status ?? 'active' };
  }

  private traverseAssetIds(rootId: string, relations: AssetRelationRecord[], maxDepth: number, direction: GraphOptions['direction'], relationTypes?: string[]): Set<string> {
    const allowed = relationTypes ? new Set(relationTypes) : undefined;
    const adjacency = new Map<string, string[]>();
    const add = (from: string, to: string): void => { adjacency.set(from, [...(adjacency.get(from) ?? []), to]); };
    for (const rel of relations) {
      if (allowed && !allowed.has(rel.relationshipType)) continue;
      if (isDependencyRelation(rel.relationshipType)) {
        // sourceAsset depends on targetAsset. For graph traversal, upstream means the
        // dependencies required by the selected asset; downstream means dependents
        // that would be affected by the selected asset.
        if (direction !== 'downstream') add(rel.sourceAssetId, rel.targetAssetId);
        if (direction !== 'upstream') add(rel.targetAssetId, rel.sourceAssetId);
        continue;
      }
      if (direction !== 'upstream') add(rel.sourceAssetId, rel.targetAssetId);
      if (direction !== 'downstream') add(rel.targetAssetId, rel.sourceAssetId);
      if (relationDirection(rel.relationshipType) === 'bidirectional') {
        if (direction !== 'upstream') add(rel.targetAssetId, rel.sourceAssetId);
        if (direction !== 'downstream') add(rel.sourceAssetId, rel.targetAssetId);
      }
    }
    const visited = new Set<string>([rootId]);
    const queue = [{ id: rootId, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;
      for (const next of adjacency.get(current.id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
    return visited;
  }

  private buildFailureAdjacency(relations: AssetRelationRecord[]): Map<string, TraversalEdge[]> {
    const adjacency = new Map<string, TraversalEdge[]>();
    const add = (from: string, to: string, relationType: string): void => { adjacency.set(from, [...(adjacency.get(from) ?? []), { from, to, relationType }]); };
    for (const rel of relations) {
      if (isDependencyRelation(rel.relationshipType)) add(rel.targetAssetId, rel.sourceAssetId, rel.relationshipType);
      else if (isOwnershipRelation(rel.relationshipType)) add(rel.sourceAssetId, rel.targetAssetId, rel.relationshipType);
      else {
        add(rel.sourceAssetId, rel.targetAssetId, rel.relationshipType);
        if (relationDirection(rel.relationshipType) === 'bidirectional') add(rel.targetAssetId, rel.sourceAssetId, rel.relationshipType);
      }
    }
    return adjacency;
  }

  private traverseFailureImpact(rootId: string, relations: AssetRelationRecord[], maxDepth: number): Set<string> {
    const adjacency = this.buildFailureAdjacency(relations);
    const visited = new Set<string>([rootId]);
    const queue = [{ id: rootId, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;
      for (const edge of adjacency.get(current.id) ?? []) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push({ id: edge.to, depth: current.depth + 1 });
      }
    }
    return visited;
  }

  private affectedBusinessProcesses(data: GraphData, affectedAssetIds: Set<string>, affectedAssets: ImpactAnalysisResult['affectedAssets'], rootId: string): AffectedBusinessEntity[] {
    const processById = new Map(data.processes.map(process => [process.id, process]));
    return this.affectedBusinessEntities(data.assetProcesses, processById, affectedAssetIds, affectedAssets, rootId, 'BusinessProcess');
  }

  private affectedBusinessServices(data: GraphData, affectedAssetIds: Set<string>, affectedAssets: ImpactAnalysisResult['affectedAssets'], rootId: string): AffectedBusinessEntity[] {
    const serviceById = new Map(data.services.map(service => [service.id, service]));
    return this.affectedBusinessEntities(data.assetServices, serviceById, affectedAssetIds, affectedAssets, rootId, 'BusinessService');
  }

  private affectedBusinessEntities(links: EntityEdgeRecord[], entityById: Map<string, BusinessEntityRecord>, affectedAssetIds: Set<string>, affectedAssets: ImpactAnalysisResult['affectedAssets'], rootId: string, type: 'BusinessProcess' | 'BusinessService'): AffectedBusinessEntity[] {
    const affectedByAsset = new Map(affectedAssets.map(asset => [asset.id, asset]));
    const result = new Map<string, AffectedBusinessEntity>();
    for (const link of links) {
      const entityId = type === 'BusinessProcess' ? link.processId : link.serviceId;
      if (!link.assetId || !entityId || !affectedAssetIds.has(link.assetId)) continue;
      const entity = entityById.get(entityId);
      if (!entity) continue;
      const sourceAsset = affectedByAsset.get(link.assetId);
      const distance = link.assetId === rootId ? 1 : (sourceAsset?.distance ?? 0) + 1;
      const path = link.assetId === rootId ? [rootId, `${type}:${entityId}`] : [...(sourceAsset?.path ?? [rootId, link.assetId]), `${type}:${entityId}`];
      const existing = result.get(entityId);
      if (!existing || distance < existing.distance) result.set(entityId, { id: entityId, name: entity.name ?? entityId, type, criticality: entity.criticality ?? 'low', distance, path });
    }
    return [...result.values()].sort((a, b) => ((CRITICALITY_WEIGHT[b.criticality] ?? 0) - (CRITICALITY_WEIGHT[a.criticality] ?? 0)) || a.distance - b.distance);
  }

  private maxCriticalityForPath(path: string[], assetById: Map<string, AssetRecord>): string {
    return path.reduce((max, id) => {
      const criticality = assetById.get(id)?.criticality ?? 'low';
      return (CRITICALITY_WEIGHT[criticality] ?? 0) > (CRITICALITY_WEIGHT[max] ?? 0) ? criticality : max;
    }, 'low');
  }

  private buildWarnings(nodes: GraphNode[], edges: GraphEdge[]): GraphWarning[] {
    const degree = new Map(nodes.map(node => [node.id, 0]));
    for (const edge of edges) {
      degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
      degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
    }
    return nodes
      .filter(node => node.nodeType === 'Asset' && (degree.get(node.id) ?? 0) === 0)
      .map(node => ({ code: 'ISOLATED_ASSET', severity: 'warning', nodeId: node.id, message: `Asset "${node.name}" has no graph relations; this may indicate a documentation gap.` }));
  }

  private connectedComponents(nodeIds: string[], edges: GraphEdge[]): GraphComponent[] {
    const adjacency = new Map<string, Set<string>>(nodeIds.map(id => [id, new Set<string>()]));
    for (const edge of edges) {
      adjacency.get(edge.sourceId)?.add(edge.targetId);
      adjacency.get(edge.targetId)?.add(edge.sourceId);
    }
    const visited = new Set<string>();
    const components: GraphComponent[] = [];
    for (const id of nodeIds) {
      if (visited.has(id)) continue;
      const queue = [id];
      const component: string[] = [];
      visited.add(id);
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        for (const next of adjacency.get(current) ?? []) {
          if (visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      components.push({ id: `component-${components.length + 1}`, nodeIds: component, size: component.length });
    }
    return components.sort((a, b) => b.size - a.size);
  }

  private findArticulationPoints(nodes: GraphNode[], edges: GraphEdge[]): ArticulationPointImpact[] {
    const assetIds = new Set(nodes.filter(node => node.nodeType === 'Asset').map(node => node.id));
    const adjacency = new Map<string, Set<string>>(nodes.map(node => [node.id, new Set<string>()]));
    for (const edge of edges) {
      adjacency.get(edge.sourceId)?.add(edge.targetId);
      adjacency.get(edge.targetId)?.add(edge.sourceId);
    }
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const baseline = this.connectedComponents(nodes.map(node => node.id), edges).length;
    const results: ArticulationPointImpact[] = [];
    for (const candidate of assetIds) {
      const remaining = nodes.map(node => node.id).filter(id => id !== candidate);
      const reducedEdges = edges.filter(edge => edge.sourceId !== candidate && edge.targetId !== candidate);
      const components = this.connectedComponents(remaining, reducedEdges);
      if (components.length <= baseline) continue;
      const affectedNodeCount = components.filter(component => component.size < remaining.length).reduce((sum, component) => sum + component.size, 0);
      const affectedAssetCount = components.flatMap(component => component.nodeIds).filter(id => assetIds.has(id)).length;
      const largestDisconnectedComponentSize = components.reduce((max, component) => Math.max(max, component.size), 0);
      const node = nodeById.get(candidate)!;
      const score = affectedAssetCount * 2 + affectedNodeCount + (CRITICALITY_WEIGHT[node.criticality ?? 'low'] ?? 0) * 5;
      results.push({ assetId: candidate, assetName: node.name, affectedAssetCount, affectedNodeCount, componentCountAfterRemoval: components.length, largestDisconnectedComponentSize, criticality: node.criticality ?? 'low', score });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  private calculateRedundantPaths(sourceId: string, targetId: string, edges: GraphEdge[], maxPaths = 4): RedundantPathResult {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      adjacency.set(edge.sourceId, [...(adjacency.get(edge.sourceId) ?? []), edge.targetId]);
      if (edge.direction === 'bidirectional' || isDependencyRelation(edge.relationType)) adjacency.set(edge.targetId, [...(adjacency.get(edge.targetId) ?? []), edge.sourceId]);
    }
    const paths: string[][] = [];
    const usedIntermediate = new Set<string>();
    const queue: string[][] = [[sourceId]];
    while (queue.length > 0 && paths.length < maxPaths) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (path.length > 8) continue;
      if (current === targetId) {
        const intermediate = path.slice(1, -1);
        if (intermediate.every(id => !usedIntermediate.has(id))) {
          paths.push(path);
          intermediate.forEach(id => usedIntermediate.add(id));
        }
        continue;
      }
      for (const next of adjacency.get(current) ?? []) {
        if (path.includes(next)) continue;
        queue.push([...path, next]);
      }
    }
    return { sourceId, targetId, redundancyDegree: paths.length, independentPaths: paths, hasRedundancy: paths.length > 1 };
  }
}

export const assetGraphService = new AssetGraphService();

