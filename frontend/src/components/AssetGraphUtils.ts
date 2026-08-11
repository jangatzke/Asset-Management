
export interface GraphNode {
  id: string;
  name: string;
  nodeType?: string;
  type?: string;
  criticality?: string;
  displayId?: string;
  category?: string;
  status?: string;
  lifecycleStatus?: string;
  lifecycle?: string;
  owner?: string;
  ownerName?: string;
  businessOwner?: string;
  technicalOwner?: string;
  technicalOperator?: string;
  organizationUnit?: string;
  organizationUnitName?: string;
  description?: string;
  metadata?: Record<string, unknown> | string | null;
  [key: string]: unknown;
}

export interface GraphEdge {
  source?: string;
  target?: string;
  sourceId?: string;
  targetId?: string;
  sourceAssetId?: string;
  targetAssetId?: string;
  sourceName?: string;
  targetName?: string;
  relationType?: string;
}

export interface DirectDependency {
  id: string;
  name?: string;
  type?: string;
  criticality?: string;
  displayId?: string;
  relationType?: string;
}

export interface AssetGraphProps {
  assetId?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  fallbackNode?: GraphNode;
  focusAssetId?: string;
  heightClassName?: string;
  height?: string;
}

export interface SelectedAssetField {
  key: string;
  labelKey: string;
  value: string;
}

export interface SelectedAssetConnection {
  key: string;
  relationType: string;
  connectedNode?: GraphNode;
  connectedId?: string;
  connectedName: string;
}

export interface SelectedAssetConnections {
  incoming: SelectedAssetConnection[];
  outgoing: SelectedAssetConnection[];
  other: SelectedAssetConnection[];
}

export const DEPENDENCY_NODE_WIDTH = 172;
export const DEPENDENCY_NODE_HEIGHT = 82;
export const FOCUS_NODE_WIDTH = 224;
export const FOCUS_NODE_HEIGHT = 112;
export const MAX_DEPENDENCY_NODE_WIDTH = 236;
export const MAX_FOCUS_NODE_WIDTH = 344;
export const NODE_TEXT_START_OFFSET = 64;
export const NODE_RIGHT_PADDING = 18;
export const ARROW_CLEARANCE = 12;
export const NODE_COLLISION_GAP = 24;
export const VIEWBOX_CARD_PADDING = 24;
export const COLLISION_RESOLUTION_ITERATIONS = 96;
export const CONNECTOR_HANDLE_LENGTH = 64;
// Keep an explicit connector corridor between every hierarchy rank. This
// prevents direct and indirect cards from merging visually.
export const HIERARCHICAL_FOCUS_CLEARANCE = 72;
export const HIERARCHICAL_RANK_CLEARANCE = 56;
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4;
export const GRAPH_VIEWBOX_WIDTH = 1600;
export const GRAPH_VIEWBOX_HEIGHT = 900;
export const GRAPH_CENTER = { x: GRAPH_VIEWBOX_WIDTH / 2, y: GRAPH_VIEWBOX_HEIGHT / 2 };
export const SIDE_LANE_GAP = 228;
export const SIDE_LANE_MIN_X = 140;
export const SIDE_LANE_MAX_X = GRAPH_VIEWBOX_WIDTH - SIDE_LANE_MIN_X;
export const SIDE_LANE_VERTICAL_GAP = 74;
export const BOTTOM_LANE_TOP = GRAPH_CENTER.y + FOCUS_NODE_HEIGHT / 2 + 116;
export const BOTTOM_LANE_HORIZONTAL_GAP = 56;
export const BOTTOM_LANE_VERTICAL_GAP = 38;
export const NEUTRAL_EDGE_COLOR = '#6B7280';
export const EDGE_LABEL_WIDTH = 86;
export const EDGE_LABEL_HEIGHT = 18;

export const CRITICALITY_COLORS: Record<string, { fill: string; stroke: string }> = {
  critical: { fill: '#EF4444', stroke: '#B91C1C' },
  high: { fill: '#F97316', stroke: '#EA580C' },
  medium: { fill: '#EAB308', stroke: '#CA8A04' },
  low: { fill: '#22C55E', stroke: '#16A34A' },
};

export const TYPE_COLORS: Record<string, string> = {
  server: '#3B82F6',
  network: '#8B5CF6',
  application: '#06B6D4',
  database: '#EC4899',
  infrastructure: '#6366F1',
  service: '#14B8A6',
};

export const ensureFocusAssetNode = (nodes: GraphNode[], rootAssetId?: string, fallbackNode?: GraphNode): GraphNode[] => {
  if (!rootAssetId || nodes.some((node) => node.id === rootAssetId)) {
    return nodes;
  }

  return [
    fallbackNode ? { ...fallbackNode, id: rootAssetId, name: fallbackNode.name || rootAssetId } : {
      id: rootAssetId,
      name: rootAssetId,
      nodeType: 'Asset',
      type: 'asset',
    },
    ...nodes,
  ];
};

export type GraphPayload = { nodes?: GraphNode[]; edges?: GraphEdge[] };
export type GraphResponsePayload = GraphPayload | { data?: GraphResponsePayload | null } | null | undefined;

export type GraphDirectionFilter = 'both' | 'upstream' | 'downstream';
export type CriticalityThreshold = 'all' | 'critical' | 'high' | 'medium';

export const CRITICALITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const CRITICALITY_THRESHOLDS: CriticalityThreshold[] = ['all', 'critical', 'high', 'medium'];

export const getCriticalityRank = (criticality?: string): number | undefined => (criticality ? CRITICALITY_RANK[criticality.toLowerCase()] : undefined);

export const nodeMatchesCriticalityThreshold = (node: GraphNode, rootAssetId: string | undefined, threshold: CriticalityThreshold): boolean => {
  if (rootAssetId && node.id === rootAssetId) return true;
  if (threshold === 'all') return true;
  const nodeRank = getCriticalityRank(node.criticality);
  const thresholdRank = CRITICALITY_RANK[threshold];
  return nodeRank !== undefined && nodeRank >= thresholdRank;
};

export const extractGraphPayload = (payload: GraphResponsePayload): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  let maybeWrappedPayload = payload as GraphPayload | { data?: unknown } | null | undefined;
  for (let depth = 0; depth < 3; depth += 1) {
    if (maybeWrappedPayload && !Array.isArray((maybeWrappedPayload as GraphPayload).nodes) && !Array.isArray((maybeWrappedPayload as GraphPayload).edges) && 'data' in maybeWrappedPayload) {
      maybeWrappedPayload = (maybeWrappedPayload as { data?: GraphPayload | null }).data ?? null;
      continue;
    }
    break;
  }

  return {
    nodes: Array.isArray((maybeWrappedPayload as GraphPayload | null | undefined)?.nodes) ? (maybeWrappedPayload as GraphPayload).nodes! : [],
    edges: Array.isArray((maybeWrappedPayload as GraphPayload | null | undefined)?.edges) ? (maybeWrappedPayload as GraphPayload).edges! : [],
  };
};

export const getEdgeSource = (edge: GraphEdge): string | undefined => edge.sourceId ?? edge.sourceAssetId ?? edge.source;
export const getEdgeTarget = (edge: GraphEdge): string | undefined => edge.targetId ?? edge.targetAssetId ?? edge.target;

export const normalizeEndpointLabel = (value?: string): string => (value ?? '').trim().toLowerCase();

export const addLookupAlias = (lookup: Map<string, string>, alias: string | undefined, id: string): void => {
  const normalized = normalizeEndpointLabel(alias);
  if (normalized && !lookup.has(normalized)) lookup.set(normalized, id);
};

export const createNodeEndpointLookup = (nodes: GraphNode[]): Map<string, string> => {
  const lookup = new Map<string, string>();
  nodes.forEach((node) => {
    addLookupAlias(lookup, node.id, node.id);
    addLookupAlias(lookup, node.name, node.id);
    addLookupAlias(lookup, node.displayId, node.id);
  });
  return lookup;
};

export const resolveEdgeEndpoint = (edge: GraphEdge, side: 'source' | 'target', lookup: Map<string, string>): string | undefined => {
  const candidates = side === 'source'
    ? [edge.sourceId, edge.sourceAssetId, edge.source, edge.sourceName]
    : [edge.targetId, edge.targetAssetId, edge.target, edge.targetName];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = lookup.get(normalizeEndpointLabel(candidate));
    if (resolved) return resolved;
  }

  return candidates.find(Boolean);
};

export const buildDrawableEdges = (nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] => {
  const drawableNodeIds = new Set(nodes.map((node) => node.id));
  return edges.filter((edge) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    return !!source && !!target && drawableNodeIds.has(source) && drawableNodeIds.has(target);
  });
};

export const buildVisualEdges = (nodes: GraphNode[], edges: GraphEdge[], rootAssetId?: string): GraphEdge[] => {
  const drawableEdges = buildDrawableEdges(nodes, edges);
  if (drawableEdges.length > 0) return drawableEdges;

  const dependencyNodes = rootAssetId ? nodes.filter((node) => node.id !== rootAssetId) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!rootAssetId || !nodeIds.has(rootAssetId) || dependencyNodes.length === 0) return drawableEdges;

  return dependencyNodes.map((node) => ({
    sourceId: rootAssetId,
    targetId: node.id,
    source: rootAssetId,
    target: node.id,
    targetName: node.name,
    relationType: 'related',
  }));
};

export const filterGraphForVisibleNodes = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootAssetId: string | undefined,
  maxDepth: number,
  direction: GraphDirectionFilter,
  criticalityThreshold: CriticalityThreshold,
): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const requestedDepth = Math.max(0, Math.floor(Number.isFinite(maxDepth) ? maxDepth : 0));
  const directionFilteredEdges = edges.filter((edge) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return false;
    return true;
  });

  if (!rootAssetId || !nodeIds.has(rootAssetId)) {
    const criticalityFilteredNodes = nodes.filter((node) => nodeMatchesCriticalityThreshold(node, rootAssetId, criticalityThreshold));
    return { nodes: criticalityFilteredNodes, edges: buildDrawableEdges(criticalityFilteredNodes, directionFilteredEdges) };
  }

  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  directionFilteredEdges.forEach((edge) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    if (!source || !target) return;
    if (direction === 'upstream') {
      // `source depends on target`: follow the dependency chain away from the
      // focus asset towards the assets it needs.
      adjacency.get(source)?.add(target);
    } else if (direction === 'downstream') {
      // Reverse the dependency chain to find assets that need the focus asset.
      adjacency.get(target)?.add(source);
    } else {
      adjacency.get(source)?.add(target);
      adjacency.get(target)?.add(source);
    }
  });

  const depths = new Map<string, number>([[rootAssetId, 0]]);
  const queue = [rootAssetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) ?? 0;
    if (currentDepth >= requestedDepth) continue;
    adjacency.get(current)?.forEach((next) => {
      if (depths.has(next)) return;
      depths.set(next, currentDepth + 1);
      queue.push(next);
    });
  }

  const visibleNodes = nodes.filter((node) => depths.has(node.id) && nodeMatchesCriticalityThreshold(node, rootAssetId, criticalityThreshold));
  return { nodes: visibleNodes, edges: buildDrawableEdges(visibleNodes, directionFilteredEdges) };
};

export const estimateTextWidth = (text: string, averageCharacterWidth: number): number => text.length * averageCharacterWidth;

export const getNodeLabel = (node: GraphNode): string => node.name || node.displayId || node.id;

export const getNodeMetadata = (node: GraphNode): string => [node.displayId, node.type, node.criticality].filter(Boolean).join(' · ');

export const formatDetailValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatDetailValue).filter(Boolean).join(', ') || undefined;
  if (typeof value === 'object') {
    const namedValue = (value as { name?: unknown; displayName?: unknown; title?: unknown; id?: unknown }).name
      ?? (value as { displayName?: unknown }).displayName
      ?? (value as { title?: unknown }).title
      ?? (value as { id?: unknown }).id;
    if (namedValue) return formatDetailValue(namedValue);
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const normalizeRelationLabel = (relationType?: string): string => relationType || 'related';

export const NEUTRAL_RELATION_TYPES = new Set(['related', 'connects_to', 'integrates_with', 'associated_with', 'linked_to']);

export const isNeutralRelation = (relationType?: string): boolean => NEUTRAL_RELATION_TYPES.has((relationType || '').toLowerCase());

export const buildSelectedAssetFields = (node: GraphNode): SelectedAssetField[] => {
  const fields: Array<[string, string, unknown]> = [
    ['displayId', 'graph.details.displayId', node.displayId],
    ['type', 'graph.details.type', node.type],
    ['category', 'graph.details.category', node.category ?? node.nodeType],
    ['criticality', 'graph.details.criticality', node.criticality],
    ['status', 'graph.details.status', node.status],
    ['lifecycleStatus', 'graph.details.lifecycleStatus', node.lifecycleStatus ?? node.lifecycle],
    ['owner', 'graph.details.owner', node.ownerName ?? node.owner ?? node.businessOwner],
    ['technicalOwner', 'graph.details.technicalOwner', node.technicalOwner ?? node.technicalOperator],
    ['organizationUnit', 'graph.details.organizationUnit', node.organizationUnitName ?? node.organizationUnit],
  ];

  return fields.reduce<SelectedAssetField[]>((result, [key, labelKey, value]) => {
    const formattedValue = formatDetailValue(value);
    if (formattedValue) result.push({ key, labelKey, value: formattedValue });
    return result;
  }, []);
};

export const buildSelectedAssetMetadataFields = (node: GraphNode): SelectedAssetField[] => {
  if (!node.metadata || typeof node.metadata !== 'object' || Array.isArray(node.metadata)) return [];
  return Object.entries(node.metadata).reduce<SelectedAssetField[]>((result, [key, value]) => {
    const formattedValue = formatDetailValue(value);
    if (formattedValue) result.push({ key: `metadata-${key}`, labelKey: key, value: formattedValue });
    return result;
  }, []);
};

export const buildSelectedAssetConnections = (selectedNode: GraphNode, nodes: GraphNode[], edges: GraphEdge[]): SelectedAssetConnections => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const connections: SelectedAssetConnections = { incoming: [], outgoing: [], other: [] };

  edges.forEach((edge, index) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    const selectedIsSource = source === selectedNode.id;
    const selectedIsTarget = target === selectedNode.id;
    if (!selectedIsSource && !selectedIsTarget) return;

    const connectedId = selectedIsSource ? target : source;
    const connectedNode = connectedId ? nodesById.get(connectedId) : undefined;
    const fallbackName = selectedIsSource ? edge.targetName : edge.sourceName;
    const connectedName = connectedNode ? getNodeLabel(connectedNode) : (fallbackName || connectedId || 'Unknown asset');
    const relationType = normalizeRelationLabel(edge.relationType);
    const connection = {
      key: `${selectedNode.id}-${connectedId || 'unknown'}-${relationType}-${index}`,
      relationType,
      connectedNode,
      connectedId,
      connectedName,
    };

    if (isNeutralRelation(edge.relationType) || source === target) {
      connections.other.push(connection);
    } else if (selectedIsTarget) {
      connections.incoming.push(connection);
    } else {
      connections.outgoing.push(connection);
    }
  });

  return connections;
};

export const getCardSize = (nodeId: string, rootAssetId?: string, node?: GraphNode): { width: number; height: number } => {
  const focused = !!rootAssetId && nodeId === rootAssetId;
  const minWidth = focused ? FOCUS_NODE_WIDTH : DEPENDENCY_NODE_WIDTH;
  const maxWidth = focused ? MAX_FOCUS_NODE_WIDTH : MAX_DEPENDENCY_NODE_WIDTH;
  const labelWidth = node ? estimateTextWidth(getNodeLabel(node), 7.2) : 0;
  const metadataWidth = node ? estimateTextWidth(getNodeMetadata(node), 5.8) : 0;
  const requiredTextWidth = Math.max(labelWidth, metadataWidth);
  const width = Math.min(maxWidth, Math.max(minWidth, Math.ceil(NODE_TEXT_START_OFFSET + requiredTextWidth + NODE_RIGHT_PADDING)));
  return {
    width,
    height: focused ? FOCUS_NODE_HEIGHT : DEPENDENCY_NODE_HEIGHT,
  };
};

export const getNodeCardBounds = (nodeId: string, position: { x: number; y: number }, rootAssetId?: string, node?: GraphNode): { x: number; y: number; width: number; height: number } => {
  const size = getCardSize(nodeId, rootAssetId, node);
  return {
    x: position.x - size.width / 2,
    y: position.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const distributeCardAwareYPositions = (nodesToPosition: GraphNode[], rootAssetId?: string): number[] => {
  if (nodesToPosition.length === 0) return [];
  const heights = nodesToPosition.map((node) => getCardSize(node.id, rootAssetId, node).height);
  if (nodesToPosition.length <= 2) {
    const focusTop = GRAPH_CENTER.y - FOCUS_NODE_HEIGHT / 2;
    const focusBottom = GRAPH_CENTER.y + FOCUS_NODE_HEIGHT / 2;
    return nodesToPosition.map((_, index) => {
      const height = heights[index];
      const preferredY = nodesToPosition.length === 1
        ? GRAPH_CENTER.y
        : index === 0
          ? focusTop - SIDE_LANE_VERTICAL_GAP * 1.2 - height / 2
          : focusBottom + SIDE_LANE_VERTICAL_GAP * 1.2 + height / 2;
      return clamp(preferredY, height / 2 + VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_HEIGHT - height / 2 - VIEWBOX_CARD_PADDING);
    });
  }
  const totalHeight = heights.reduce((sum, height) => sum + height, 0) + SIDE_LANE_VERTICAL_GAP * Math.max(0, nodesToPosition.length - 1);
  const availableTop = VIEWBOX_CARD_PADDING;
  const availableBottom = GRAPH_VIEWBOX_HEIGHT - VIEWBOX_CARD_PADDING;
  let cursorY = clamp(GRAPH_CENTER.y - totalHeight / 2, availableTop, Math.max(availableTop, availableBottom - totalHeight));

  return nodesToPosition.map((_, index) => {
    const height = heights[index];
    const y = cursorY + height / 2;
    cursorY += height + SIDE_LANE_VERTICAL_GAP;
    return clamp(y, height / 2 + VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_HEIGHT - height / 2 - VIEWBOX_CARD_PADDING);
  });
};

export const getSideLaneX = (nodesToPosition: GraphNode[], rootAssetId: string | undefined, side: 'left' | 'right'): number => {
  const maxWidth = Math.max(DEPENDENCY_NODE_WIDTH, ...nodesToPosition.map((node) => getCardSize(node.id, rootAssetId, node).width));
  const focusWidth = rootAssetId ? getCardSize(rootAssetId, rootAssetId).width : FOCUS_NODE_WIDTH;
  const preferredX = side === 'left'
    ? GRAPH_CENTER.x - focusWidth / 2 - SIDE_LANE_GAP - maxWidth / 2
    : GRAPH_CENTER.x + focusWidth / 2 + SIDE_LANE_GAP + maxWidth / 2;
  const minX = Math.max(maxWidth / 2 + VIEWBOX_CARD_PADDING, SIDE_LANE_MIN_X);
  const maxX = Math.min(GRAPH_VIEWBOX_WIDTH - maxWidth / 2 - VIEWBOX_CARD_PADDING, SIDE_LANE_MAX_X);
  return clamp(preferredX, minX, maxX);
};

export const positionSideLaneGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], side: 'left' | 'right', rootAssetId?: string): void => {
  if (nodesToPosition.length === 0) return;
  const x = getSideLaneX(nodesToPosition, rootAssetId, side);
  const yPositions = distributeCardAwareYPositions(nodesToPosition, rootAssetId);
  nodesToPosition.forEach((node, index) => {
    positions.set(node.id, { x, y: yPositions[index] });
  });
};

export const positionBottomGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId?: string): void => {
  if (nodesToPosition.length === 0) return;
  const rows: GraphNode[][] = [];
  let currentRow: GraphNode[] = [];
  let currentWidth = 0;

  nodesToPosition.forEach((node) => {
    const size = getCardSize(node.id, rootAssetId, node);
    const nextWidth = currentWidth + (currentRow.length > 0 ? BOTTOM_LANE_HORIZONTAL_GAP : 0) + size.width;
    if (currentRow.length > 0 && nextWidth > GRAPH_VIEWBOX_WIDTH - VIEWBOX_CARD_PADDING * 2) {
      rows.push(currentRow);
      currentRow = [node];
      currentWidth = size.width;
    } else {
      currentRow.push(node);
      currentWidth = nextWidth;
    }
  });
  if (currentRow.length > 0) rows.push(currentRow);

  const rowHeights = rows.map((row) => Math.max(...row.map((node) => getCardSize(node.id, rootAssetId, node).height)));
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + BOTTOM_LANE_VERTICAL_GAP * Math.max(0, rows.length - 1);
  let cursorY = clamp(BOTTOM_LANE_TOP, VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_HEIGHT - VIEWBOX_CARD_PADDING - totalHeight);

  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((sum, node) => sum + getCardSize(node.id, rootAssetId, node).width, 0) + BOTTOM_LANE_HORIZONTAL_GAP * Math.max(0, row.length - 1);
    let cursorX = (GRAPH_VIEWBOX_WIDTH - rowWidth) / 2;
    const rowY = cursorY + rowHeights[rowIndex] / 2;
    row.forEach((node) => {
      const size = getCardSize(node.id, rootAssetId, node);
      positions.set(node.id, {
        x: cursorX + size.width / 2,
        y: rowY,
      });
      cursorX += size.width + BOTTOM_LANE_HORIZONTAL_GAP;
    });
    cursorY += rowHeights[rowIndex] + BOTTOM_LANE_VERTICAL_GAP;
  });
};

export type GraphLayoutLane = 'left' | 'right' | 'bottom';

export interface GraphLayoutMetadata {
  depths: Map<string, number>;
  lanes: Map<string, GraphLayoutLane>;
  parents: Map<string, string>;
}

export const getLaneForRelation = (source: string, target: string, relationType: string | undefined, rootAssetId: string): GraphLayoutLane | undefined => {
  // Asset relations use the semantic `source depends on target`.  Therefore
  // targets of the focus asset belong to its dependency hierarchy on the left,
  // while sources pointing at the focus asset belong to the dependent-assets
  // hierarchy on the right.  Endpoint direction takes priority over a generic
  // relation label so every direct relationship has a deterministic side.
  if (source === rootAssetId) return 'left';
  if (target === rootAssetId) return 'right';
  if (isNeutralRelation(relationType)) return 'bottom';
  return undefined;
};

export const calculateGraphLayoutMetadata = (nodes: GraphNode[], edges: GraphEdge[], rootAssetId?: string): GraphLayoutMetadata => {
  const depths = new Map<string, number>();
  const lanes = new Map<string, GraphLayoutLane>();
  const parents = new Map<string, string>();
  if (!rootAssetId || !nodes.some((node) => node.id === rootAssetId)) return { depths, lanes, parents };

  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Array<{ next: string; lane?: GraphLayoutLane }>>();
  nodes.forEach((node) => adjacency.set(node.id, []));
  edges.forEach((edge) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return;
    const relationLane = getLaneForRelation(source, target, edge.relationType, rootAssetId);
    adjacency.get(source)?.push({ next: target, lane: relationLane });
    // Keep the lane bound to the relation semantics while traversing in either
    // direction.  Traversing a dependent relation backwards from the focus
    // must retain its right-side lane rather than recomputing it as a left-side
    // dependency relation.
    adjacency.get(target)?.push({ next: source, lane: relationLane });
  });

  depths.set(rootAssetId, 0);
  const queue = [rootAssetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) ?? 0;
    const inheritedLane = lanes.get(current);
    adjacency.get(current)?.forEach(({ next, lane }) => {
      if (depths.has(next)) return;
      depths.set(next, currentDepth + 1);
      lanes.set(next, lane ?? inheritedLane ?? 'bottom');
      parents.set(next, current);
      queue.push(next);
    });
  }

  return { depths, lanes, parents };
};

export const sortNodesByParentRank = (nodesToPosition: GraphNode[], depths: Map<string, number>, parents: Map<string, string>, positions: Map<string, { x: number; y: number }>): GraphNode[] => (
  [...nodesToPosition].sort((first, second) => {
    const firstDepth = depths.get(first.id) ?? 1;
    const secondDepth = depths.get(second.id) ?? 1;
    if (firstDepth !== secondDepth) return firstDepth - secondDepth;

    const firstParentY = positions.get(parents.get(first.id) ?? '')?.y ?? GRAPH_CENTER.y;
    const secondParentY = positions.get(parents.get(second.id) ?? '')?.y ?? GRAPH_CENTER.y;
    if (firstParentY !== secondParentY) return firstParentY - secondParentY;

    return getNodeLabel(first).localeCompare(getNodeLabel(second));
  })
);

export const spreadYPositionsAroundTargets = (nodesToPosition: GraphNode[], targetYById: Map<string, number>, rootAssetId?: string): number[] => {
  if (nodesToPosition.length === 0) return [];
  const orderedNodes = [...nodesToPosition].sort((first, second) => (targetYById.get(first.id) ?? GRAPH_CENTER.y) - (targetYById.get(second.id) ?? GRAPH_CENTER.y));
  const yById = new Map<string, number>();
  let previousBottom = VIEWBOX_CARD_PADDING;

  orderedNodes.forEach((node) => {
    const size = getCardSize(node.id, rootAssetId, node);
    const minY = size.height / 2 + VIEWBOX_CARD_PADDING;
    const maxY = GRAPH_VIEWBOX_HEIGHT - size.height / 2 - VIEWBOX_CARD_PADDING;
    const desiredY = clamp(targetYById.get(node.id) ?? GRAPH_CENTER.y, minY, maxY);
    const y = clamp(Math.max(desiredY, previousBottom + NODE_COLLISION_GAP + size.height / 2), minY, maxY);
    yById.set(node.id, y);
    previousBottom = y + size.height / 2;
  });

  return nodesToPosition.map((node) => yById.get(node.id) ?? GRAPH_CENTER.y);
};

export const distributeHierarchicalYPositions = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId: string | undefined, depths: Map<string, number>, parents: Map<string, string>): number[] => {
  if (nodesToPosition.length === 0) return [];
  const sortedNodes = sortNodesByParentRank(nodesToPosition, depths, parents, positions);
  const positionsById = new Map<string, number>();
  const depthGroups = new Map<number, GraphNode[]>();
  sortedNodes.forEach((node) => {
    const depth = Math.max(1, depths.get(node.id) ?? 1);
    depthGroups.set(depth, [...(depthGroups.get(depth) ?? []), node]);
  });
  Array.from(depthGroups.entries()).sort(([firstDepth], [secondDepth]) => firstDepth - secondDepth).forEach(([depth, group]) => {
    const targetYById = new Map<string, number>();
    group.forEach((node, index) => {
      if (depth <= 1) {
        targetYById.set(node.id, distributeCardAwareYPositions(group, rootAssetId)[index]);
        return;
      }

      const parentY = positions.get(parents.get(node.id) ?? '')?.y ?? positionsById.get(parents.get(node.id) ?? '') ?? GRAPH_CENTER.y;
      const childOffset = group.length === 1 ? SIDE_LANE_VERTICAL_GAP * 1.55 : (index - (group.length - 1) / 2) * SIDE_LANE_VERTICAL_GAP * 1.25;
      targetYById.set(node.id, parentY + childOffset);
    });
    const yPositions = spreadYPositionsAroundTargets(group, targetYById, rootAssetId);
    group.forEach((node, index) => positionsById.set(node.id, yPositions[index]));
  });

  return nodesToPosition.map((node) => positionsById.get(node.id) ?? GRAPH_CENTER.y);
};

export const positionHierarchicalSideLaneGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], side: 'left' | 'right', rootAssetId: string | undefined, focusNode: GraphNode, depths: Map<string, number>, parents: Map<string, string>): void => {
  if (nodesToPosition.length === 0) return;
  const yPositions = distributeHierarchicalYPositions(positions, nodesToPosition, rootAssetId, depths, parents);
  nodesToPosition.forEach((node, index) => {
    const depth = Math.max(1, depths.get(node.id) ?? 1);
    const cardSize = getCardSize(node.id, rootAssetId, node);
    const focusSize = getCardSize(focusNode.id, rootAssetId, focusNode);
    const verticalOffset = yPositions[index] - GRAPH_CENTER.y;
    // Use concentric half-rings instead of forcing every rank into a rigid
    // column. This keeps the direct parent nearer to the focus, while a child
    // is always on a larger radius even when a third or fourth rank would no
    // longer fit horizontally inside the viewbox.
    const baseRadius = focusSize.width / 2 + cardSize.width / 2 + HIERARCHICAL_FOCUS_CLEARANCE;
    const intendedRadius = baseRadius + (depth - 1) * (cardSize.width + HIERARCHICAL_RANK_CLEARANCE);
    const minimumRadiusForOffset = Math.abs(verticalOffset) + cardSize.width / 2 + VIEWBOX_CARD_PADDING;
    const radius = Math.max(intendedRadius, minimumRadiusForOffset);
    const horizontalOffset = Math.sqrt(Math.max(0, radius ** 2 - verticalOffset ** 2));
    const x = GRAPH_CENTER.x + (side === 'left' ? -1 : 1) * horizontalOffset;
    positions.set(node.id, clampNodePositionToViewbox(node, { x, y: yPositions[index] }, rootAssetId));
  });
};

export const resolveHierarchicalNodePositionCollisions = (
  nodes: GraphNode[],
  positions: Map<string, { x: number; y: number }>,
  rootAssetId: string | undefined,
): Map<string, { x: number; y: number }> => {
  const resolved = new Map(positions);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Hierarchical rank columns are semantic positions.  Resolve collisions
  // vertically only, so the safety pass can never pull a level-2 card into a
  // level-1 ring or across the focus asset.
  for (let iteration = 0; iteration < COLLISION_RESOLUTION_ITERATIONS; iteration += 1) {
    let moved = false;
    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const first = nodes[firstIndex];
        const second = nodes[secondIndex];
        const firstPosition = resolved.get(first.id);
        const secondPosition = resolved.get(second.id);
        if (!firstPosition || !secondPosition) continue;
        const firstBounds = getNodeCardBounds(first.id, firstPosition, rootAssetId, nodesById.get(first.id));
        const secondBounds = getNodeCardBounds(second.id, secondPosition, rootAssetId, nodesById.get(second.id));
        if (!doNodeCardBoundsOverlap(firstBounds, secondBounds, NODE_COLLISION_GAP)) continue;

        const overlapY = Math.min(
          firstBounds.y + firstBounds.height + NODE_COLLISION_GAP - secondBounds.y,
          secondBounds.y + secondBounds.height + NODE_COLLISION_GAP - firstBounds.y,
        ) + 1;
        const moveSecondDown = secondPosition.y >= firstPosition.y;
        const firstLocked = first.id === rootAssetId;
        const secondLocked = second.id === rootAssetId;
        const firstShare = firstLocked ? 0 : secondLocked ? 1 : 0.5;
        const secondShare = secondLocked ? 0 : firstLocked ? 1 : 0.5;
        const nextFirst = { ...firstPosition, y: firstPosition.y + (moveSecondDown ? -1 : 1) * overlapY * firstShare };
        const nextSecond = { ...secondPosition, y: secondPosition.y + (moveSecondDown ? 1 : -1) * overlapY * secondShare };
        resolved.set(first.id, clampNodePositionToViewbox(first, nextFirst, rootAssetId));
        resolved.set(second.id, clampNodePositionToViewbox(second, nextSecond, rootAssetId));
        moved = true;
      }
    }
    if (!moved) break;
  }
  return resolved;
};

export const positionHierarchicalBottomGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId: string | undefined, depths: Map<string, number>): void => {
  if (nodesToPosition.length === 0) return;
  const depthGroups = new Map<number, GraphNode[]>();
  nodesToPosition.forEach((node) => {
    const depth = Math.max(1, depths.get(node.id) ?? 1);
    depthGroups.set(depth, [...(depthGroups.get(depth) ?? []), node]);
  });
  Array.from(depthGroups.entries()).sort(([firstDepth], [secondDepth]) => firstDepth - secondDepth).forEach(([depth, group]) => {
    const rowWidth = group.reduce((sum, node) => sum + getCardSize(node.id, rootAssetId, node).width, 0) + BOTTOM_LANE_HORIZONTAL_GAP * Math.max(0, group.length - 1);
    let cursorX = (GRAPH_VIEWBOX_WIDTH - rowWidth) / 2;
    const maxHeight = Math.max(...group.map((node) => getCardSize(node.id, rootAssetId, node).height));
    const y = clamp(BOTTOM_LANE_TOP + (depth - 1) * (maxHeight + BOTTOM_LANE_VERTICAL_GAP + 24), maxHeight / 2 + VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_HEIGHT - maxHeight / 2 - VIEWBOX_CARD_PADDING);
    group.forEach((node) => {
      const size = getCardSize(node.id, rootAssetId, node);
      positions.set(node.id, clampNodePositionToViewbox(node, { x: cursorX + size.width / 2, y }, rootAssetId));
      cursorX += size.width + BOTTOM_LANE_HORIZONTAL_GAP;
    });
  });
};

export const clampNodePositionToViewbox = (node: GraphNode, position: { x: number; y: number }, rootAssetId?: string): { x: number; y: number } => {
  const size = getCardSize(node.id, rootAssetId, node);
  const minX = size.width / 2 + VIEWBOX_CARD_PADDING;
  const maxX = GRAPH_VIEWBOX_WIDTH - size.width / 2 - VIEWBOX_CARD_PADDING;
  const minY = size.height / 2 + VIEWBOX_CARD_PADDING;
  const maxY = GRAPH_VIEWBOX_HEIGHT - size.height / 2 - VIEWBOX_CARD_PADDING;
  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y)),
  };
};

export const getNodeById = (nodesById: Map<string, GraphNode>, nodeId: string): GraphNode | undefined => nodesById.get(nodeId);

export const resolveNodePositionCollisions = (nodes: GraphNode[], positions: Map<string, { x: number; y: number }>, rootAssetId?: string): Map<string, { x: number; y: number }> => {
  const resolved = new Map(positions);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  nodes.forEach((node) => {
    const position = resolved.get(node.id);
    if (position) resolved.set(node.id, clampNodePositionToViewbox(node, position, rootAssetId));
  });

  for (let iteration = 0; iteration < COLLISION_RESOLUTION_ITERATIONS; iteration += 1) {
    let moved = false;

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const first = nodes[firstIndex];
        const second = nodes[secondIndex];
        const firstPosition = resolved.get(first.id);
        const secondPosition = resolved.get(second.id);
        if (!firstPosition || !secondPosition) continue;

        const firstBounds = getNodeCardBounds(first.id, firstPosition, rootAssetId, getNodeById(nodesById, first.id));
        const secondBounds = getNodeCardBounds(second.id, secondPosition, rootAssetId, getNodeById(nodesById, second.id));
        if (!doNodeCardBoundsOverlap(firstBounds, secondBounds, NODE_COLLISION_GAP)) continue;

        const firstCenter = { x: firstBounds.x + firstBounds.width / 2, y: firstBounds.y + firstBounds.height / 2 };
        const secondCenter = { x: secondBounds.x + secondBounds.width / 2, y: secondBounds.y + secondBounds.height / 2 };
        const overlapX = Math.min(
          firstBounds.x + firstBounds.width + NODE_COLLISION_GAP - secondBounds.x,
          secondBounds.x + secondBounds.width + NODE_COLLISION_GAP - firstBounds.x,
        );
        const overlapY = Math.min(
          firstBounds.y + firstBounds.height + NODE_COLLISION_GAP - secondBounds.y,
          secondBounds.y + secondBounds.height + NODE_COLLISION_GAP - firstBounds.y,
        );
        const separateHorizontally = overlapX <= overlapY;
        const direction = separateHorizontally
          ? (secondCenter.x >= firstCenter.x ? 1 : -1)
          : (secondCenter.y >= firstCenter.y ? 1 : -1);
        const distance = (separateHorizontally ? overlapX : overlapY) + 1;
        const firstLocked = first.id === rootAssetId;
        const secondLocked = second.id === rootAssetId;
        const firstShare = firstLocked ? 0 : secondLocked ? 1 : 0.5;
        const secondShare = secondLocked ? 0 : firstLocked ? 1 : 0.5;

        const nextFirst = { ...firstPosition };
        const nextSecond = { ...secondPosition };
        if (separateHorizontally) {
          nextFirst.x -= direction * distance * firstShare;
          nextSecond.x += direction * distance * secondShare;
        } else {
          nextFirst.y -= direction * distance * firstShare;
          nextSecond.y += direction * distance * secondShare;
        }

        resolved.set(first.id, clampNodePositionToViewbox(first, nextFirst, rootAssetId));
        resolved.set(second.id, clampNodePositionToViewbox(second, nextSecond, rootAssetId));
        moved = true;
      }
    }

    if (!moved) break;
  }

  return resolved;
};

export const doNodeCardBoundsOverlap = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }, gap = 8): boolean => (
  first.x < second.x + second.width + gap
  && first.x + first.width + gap > second.x
  && first.y < second.y + second.height + gap
  && first.y + first.height + gap > second.y
);

export const calculateNodePositions = (nodes: GraphNode[], edges: GraphEdge[], rootAssetId?: string): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const focusNode = rootAssetId ? nodes.find((node) => node.id === rootAssetId) : undefined;
  if (!focusNode) {
    const radius = Math.min(220, Math.max(130, nodes.length * 28));
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, nodes.length) - Math.PI / 2;
      positions.set(node.id, {
        x: GRAPH_CENTER.x + radius * Math.cos(angle),
        y: GRAPH_CENTER.y + radius * Math.sin(angle),
      });
    });
    return resolveNodePositionCollisions(nodes, positions, rootAssetId);
  }

  positions.set(focusNode.id, GRAPH_CENTER);
  const dependencies = nodes.filter((node) => node.id !== focusNode.id);
  const dependencyIds = new Set<string>();
  const dependentIds = new Set<string>();

  edges.forEach((edge) => {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    if (source === focusNode.id && target) dependencyIds.add(target);
    if (target === focusNode.id && source) dependentIds.add(source);
  });

  const dependenciesOnLeft = dependencies.filter((node) => dependencyIds.has(node.id));
  const dependentsOnRight = dependencies.filter((node) => dependentIds.has(node.id) && !dependencyIds.has(node.id));
  const unclassified = dependencies.filter((node) => !dependencyIds.has(node.id) && !dependentIds.has(node.id));

  const layoutMetadata = calculateGraphLayoutMetadata(nodes, edges, rootAssetId);
  const hasIndirectVisibleNodes = dependencies.some((node) => (layoutMetadata.depths.get(node.id) ?? 1) > 1);
  if (hasIndirectVisibleNodes) {
    const hierarchicalUpstream = dependencies.filter((node) => layoutMetadata.lanes.get(node.id) === 'left');
    const hierarchicalDownstream = dependencies.filter((node) => layoutMetadata.lanes.get(node.id) === 'right');
    const hierarchicalUnclassified = dependencies.filter((node) => !hierarchicalUpstream.includes(node) && !hierarchicalDownstream.includes(node));
    positionHierarchicalSideLaneGroup(positions, hierarchicalUpstream, 'left', rootAssetId, focusNode, layoutMetadata.depths, layoutMetadata.parents);
    positionHierarchicalSideLaneGroup(positions, hierarchicalDownstream, 'right', rootAssetId, focusNode, layoutMetadata.depths, layoutMetadata.parents);
    positionHierarchicalBottomGroup(positions, hierarchicalUnclassified, rootAssetId, layoutMetadata.depths);
    return resolveHierarchicalNodePositionCollisions(nodes, positions, rootAssetId);
  }

  positionSideLaneGroup(positions, dependenciesOnLeft, 'left', rootAssetId);
  positionSideLaneGroup(positions, dependentsOnRight, 'right', rootAssetId);
  positionBottomGroup(positions, unclassified, rootAssetId);

  return resolveNodePositionCollisions(nodes, positions, rootAssetId);
};

export const extractDependencyPayload = (payload: unknown): { upstream: DirectDependency[]; downstream: DirectDependency[] } => {
  let current = payload as any;
  for (let depth = 0; depth < 3; depth += 1) {
    if (current && !Array.isArray(current.upstream) && !Array.isArray(current.downstream) && 'data' in current) {
      current = current.data;
      continue;
    }
    break;
  }

  return {
    upstream: Array.isArray(current?.upstream) ? current.upstream : [],
    downstream: Array.isArray(current?.downstream) ? current.downstream : [],
  };
};

export const buildDependencyFallbackGraph = (rootAssetId: string, fallbackNode: GraphNode | undefined, payload: unknown): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const dependencies = extractDependencyPayload(payload);
  const nodesById = new Map<string, GraphNode>();
  ensureFocusAssetNode([], rootAssetId, fallbackNode).forEach((node) => nodesById.set(node.id, node));

  const edges: GraphEdge[] = [];
  const addDependency = (dependency: DirectDependency, direction: 'upstream' | 'downstream') => {
    if (!dependency.id || dependency.id === rootAssetId) return;
    nodesById.set(dependency.id, {
      id: dependency.id,
      name: dependency.name || dependency.displayId || dependency.id,
      displayId: dependency.displayId,
      type: dependency.type || 'asset',
      criticality: dependency.criticality,
      nodeType: 'Asset',
    });
    const relationType = dependency.relationType || 'depends_on';
    edges.push(direction === 'upstream'
      ? { sourceId: dependency.id, targetId: rootAssetId, source: dependency.id, target: rootAssetId, relationType, sourceName: dependency.name }
      : { sourceId: rootAssetId, targetId: dependency.id, source: rootAssetId, target: dependency.id, relationType, targetName: dependency.name });
  };

  dependencies.upstream.forEach((dependency) => addDependency(dependency, 'upstream'));
  dependencies.downstream.forEach((dependency) => addDependency(dependency, 'downstream'));

  return { nodes: [...nodesById.values()], edges };
};

export const getFillColor = (node: GraphNode): string => {
  if (node.criticality && CRITICALITY_COLORS[node.criticality]) {
    return CRITICALITY_COLORS[node.criticality].fill;
  }
  if (node.type && TYPE_COLORS[node.type]) {
    return TYPE_COLORS[node.type];
  }
  return '#6B7280';
};

export const getStrokeColor = (node: GraphNode): string => {
  if (node.criticality && CRITICALITY_COLORS[node.criticality]) {
    return CRITICALITY_COLORS[node.criticality].stroke;
  }
  return '#4B5563';
};

export const getNodeInitials = (node: GraphNode): string => getNodeLabel(node).slice(0, 2).toUpperCase();

export const truncateTextToWidth = (text: string, availableWidth: number, averageCharacterWidth: number): string => {
  const maxCharacters = Math.max(8, Math.floor(availableWidth / averageCharacterWidth));
  return text.length > maxCharacters ? `${text.substring(0, maxCharacters - 1)}…` : text;
};

export const truncateNodeLabel = (node: GraphNode, cardWidth: number): string => {
  const displayName = getNodeLabel(node);
  return truncateTextToWidth(displayName, cardWidth - NODE_TEXT_START_OFFSET - NODE_RIGHT_PADDING, 7.2);
};

export type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';

export const getPortPoint = (bounds: { x: number; y: number; width: number; height: number }, center: { x: number; y: number }, side: ConnectorSide, clearance: number): { x: number; y: number } => {
  if (side === 'left') return { x: bounds.x - clearance, y: center.y };
  if (side === 'right') return { x: bounds.x + bounds.width + clearance, y: center.y };
  if (side === 'top') return { x: center.x, y: bounds.y - clearance };
  return { x: center.x, y: bounds.y + bounds.height + clearance };
};

export const getOppositeConnectorSide = (side: ConnectorSide): ConnectorSide => {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  if (side === 'top') return 'bottom';
  return 'top';
};

export const getLaneAwareFocusSide = (focusPos: { x: number; y: number }, relatedPos: { x: number; y: number }): ConnectorSide => {
  if (relatedPos.y >= BOTTOM_LANE_TOP + 8 && Math.abs(relatedPos.x - focusPos.x) <= FOCUS_NODE_WIDTH * 1.8) return 'bottom';
  return relatedPos.x < focusPos.x ? 'left' : 'right';
};

export const getConnectorPoints = (sourceId: string, targetId: string, sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }, rootAssetId?: string, sourceNode?: GraphNode, targetNode?: GraphNode): { start: { x: number; y: number }; end: { x: number; y: number }; startSide: ConnectorSide; endSide: ConnectorSide } => {
  const sourceBounds = getNodeCardBounds(sourceId, sourcePos, rootAssetId, sourceNode);
  const targetBounds = getNodeCardBounds(targetId, targetPos, rootAssetId, targetNode);
  if (rootAssetId && sourceId === rootAssetId && targetId !== rootAssetId) {
    const startSide = getLaneAwareFocusSide(sourcePos, targetPos);
    const endSide = getOppositeConnectorSide(startSide);
    return {
      start: getPortPoint(sourceBounds, sourcePos, startSide, 2),
      end: getPortPoint(targetBounds, targetPos, endSide, ARROW_CLEARANCE),
      startSide,
      endSide,
    };
  }
  if (rootAssetId && targetId === rootAssetId && sourceId !== rootAssetId) {
    const endSide = getLaneAwareFocusSide(targetPos, sourcePos);
    const startSide = getOppositeConnectorSide(endSide);
    return {
      start: getPortPoint(sourceBounds, sourcePos, startSide, 2),
      end: getPortPoint(targetBounds, targetPos, endSide, ARROW_CLEARANCE),
      startSide,
      endSide,
    };
  }
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sourceSign = dx >= 0 ? 1 : -1;
    const targetSign = dx >= 0 ? -1 : 1;
    return {
      start: { x: (dx >= 0 ? sourceBounds.x + sourceBounds.width : sourceBounds.x) + sourceSign * 2, y: sourcePos.y },
      end: { x: (dx >= 0 ? targetBounds.x : targetBounds.x + targetBounds.width) + targetSign * ARROW_CLEARANCE, y: targetPos.y },
      startSide: dx >= 0 ? 'right' : 'left',
      endSide: dx >= 0 ? 'left' : 'right',
    };
  }
  const sourceSign = dy >= 0 ? 1 : -1;
  const targetSign = dy >= 0 ? -1 : 1;
  return {
    start: { x: sourcePos.x, y: (dy >= 0 ? sourceBounds.y + sourceBounds.height : sourceBounds.y) + sourceSign * 2 },
    end: { x: targetPos.x, y: (dy >= 0 ? targetBounds.y : targetBounds.y + targetBounds.height) + targetSign * ARROW_CLEARANCE },
    startSide: dy >= 0 ? 'bottom' : 'top',
    endSide: dy >= 0 ? 'top' : 'bottom',
  };
};

export const getConnectorHandlePoint = (point: { x: number; y: number }, side: ConnectorSide, direction: 'away' | 'toward'): { x: number; y: number } => {
  const multiplier = direction === 'away' ? 1 : -1;
  if (side === 'left') return { x: point.x - CONNECTOR_HANDLE_LENGTH * multiplier, y: point.y };
  if (side === 'right') return { x: point.x + CONNECTOR_HANDLE_LENGTH * multiplier, y: point.y };
  if (side === 'top') return { x: point.x, y: point.y - CONNECTOR_HANDLE_LENGTH * multiplier };
  return { x: point.x, y: point.y + CONNECTOR_HANDLE_LENGTH * multiplier };
};

export const getConnectorPath = (sourceId: string, targetId: string, sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }, rootAssetId?: string, sourceNode?: GraphNode, targetNode?: GraphNode): string => {
  const { start, end, startSide, endSide } = getConnectorPoints(sourceId, targetId, sourcePos, targetPos, rootAssetId, sourceNode, targetNode);
  const verticalDelta = Math.abs(end.y - start.y);
  const handleLength = Math.max(CONNECTOR_HANDLE_LENGTH, Math.min(82, verticalDelta * 0.55));
  const startControl = getConnectorHandlePoint(start, startSide, 'away');
  const endControl = getConnectorHandlePoint(end, endSide, 'away');
  if (handleLength !== CONNECTOR_HANDLE_LENGTH) {
    const scaledStartControl = startSide === 'left' || startSide === 'right'
      ? { x: start.x + (startSide === 'right' ? handleLength : -handleLength), y: start.y }
      : { x: start.x, y: start.y + (startSide === 'bottom' ? handleLength : -handleLength) };
    const scaledEndControl = endSide === 'left' || endSide === 'right'
      ? { x: end.x + (endSide === 'right' ? handleLength : -handleLength), y: end.y }
      : { x: end.x, y: end.y + (endSide === 'bottom' ? handleLength : -handleLength) };
    return `M ${start.x} ${start.y} C ${scaledStartControl.x} ${scaledStartControl.y}, ${scaledEndControl.x} ${scaledEndControl.y}, ${end.x} ${end.y}`;
  }
  return `M ${start.x} ${start.y} C ${startControl.x} ${startControl.y}, ${endControl.x} ${endControl.y}, ${end.x} ${end.y}`;
};

export const doBoundsIntersect = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }): boolean => (
  first.x < second.x + second.width
  && first.x + first.width > second.x
  && first.y < second.y + second.height
  && first.y + first.height > second.y
);

export const getEdgeLabelPlacement = (edge: GraphEdge, positions: Map<string, { x: number; y: number }>, nodes: GraphNode[], rootAssetId?: string): { x: number; y: number } | undefined => {
  if (!edge.relationType) return undefined;
  const source = getEdgeSource(edge);
  const target = getEdgeTarget(edge);
  const sourcePos = source ? positions.get(source) : undefined;
  const targetPos = target ? positions.get(target) : undefined;
  if (!source || !target || !sourcePos || !targetPos) return undefined;

  const isFocusRelation = !!rootAssetId && (source === rootAssetId || target === rootAssetId);
  if (!isFocusRelation) return undefined;

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const sourceNode = nodesById.get(source);
  const targetNode = nodesById.get(target);
  const points = getConnectorPoints(source, target, sourcePos, targetPos, rootAssetId, sourceNode, targetNode);
  const horizontalRelation = points.startSide === 'left' || points.startSide === 'right' || points.endSide === 'left' || points.endSide === 'right';
  const cardBounds = nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? getNodeCardBounds(node.id, position, rootAssetId, node) : undefined;
  }).filter(Boolean) as { x: number; y: number; width: number; height: number }[];
  const sourceBounds = getNodeCardBounds(source, sourcePos, rootAssetId, sourceNode);
  const targetBounds = getNodeCardBounds(target, targetPos, rootAssetId, targetNode);
  const labelHalfWidth = EDGE_LABEL_WIDTH / 2;
  const labelHalfHeight = EDGE_LABEL_HEIGHT / 2;
  const focusIsSource = source === rootAssetId;
  const relatedBounds = focusIsSource ? targetBounds : sourceBounds;
  const focusBounds = focusIsSource ? sourceBounds : targetBounds;
  const relatedPos = focusIsSource ? targetPos : sourcePos;
  const focusPos = focusIsSource ? sourcePos : targetPos;
  const connectorMidpoint = { x: (points.start.x + points.end.x) / 2, y: (points.start.y + points.end.y) / 2 };
  const verticalSign = relatedPos.y < focusPos.y ? -1 : 1;
  const horizontalSign = relatedPos.x < focusPos.x ? -1 : 1;
  const sideCorridorX = horizontalSign < 0
    ? (relatedBounds.x + relatedBounds.width + focusBounds.x) / 2
    : (focusBounds.x + focusBounds.width + relatedBounds.x) / 2;
  const bottomCorridorY = (focusBounds.y + focusBounds.height + relatedBounds.y) / 2;
  const basePlacement = horizontalRelation
    ? {
      x: sideCorridorX,
      y: connectorMidpoint.y + verticalSign * 48,
    }
    : {
      x: connectorMidpoint.x + horizontalSign * 72,
      y: bottomCorridorY,
    };
  const clampLabelToViewbox = (placement: { x: number; y: number }): { x: number; y: number } => ({
    x: clamp(placement.x, labelHalfWidth + VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_WIDTH - labelHalfWidth - VIEWBOX_CARD_PADDING),
    y: clamp(placement.y, labelHalfHeight + VIEWBOX_CARD_PADDING, GRAPH_VIEWBOX_HEIGHT - labelHalfHeight - VIEWBOX_CARD_PADDING),
  });
  const corridorCandidates = horizontalRelation
    ? [
      basePlacement,
      { x: sideCorridorX, y: connectorMidpoint.y - verticalSign * 48 },
      { x: sideCorridorX, y: connectorMidpoint.y + verticalSign * 72 },
      { x: sideCorridorX + horizontalSign * 28, y: connectorMidpoint.y + verticalSign * 48 },
      { x: sideCorridorX - horizontalSign * 28, y: connectorMidpoint.y - verticalSign * 48 },
      { x: connectorMidpoint.x, y: connectorMidpoint.y + verticalSign * 82 },
    ]
    : [
      basePlacement,
      { x: connectorMidpoint.x - horizontalSign * 72, y: bottomCorridorY },
      { x: connectorMidpoint.x + horizontalSign * 106, y: bottomCorridorY + 24 },
      { x: connectorMidpoint.x - horizontalSign * 106, y: bottomCorridorY - 24 },
      { x: connectorMidpoint.x + horizontalSign * 72, y: connectorMidpoint.y },
    ];
  const candidates = corridorCandidates.map(clampLabelToViewbox);

  return candidates.find((placement) => {
    const labelBounds = {
      x: placement.x - labelHalfWidth,
      y: placement.y - labelHalfHeight,
      width: EDGE_LABEL_WIDTH,
      height: EDGE_LABEL_HEIGHT,
    };
    return !cardBounds.some((bounds) => doBoundsIntersect(labelBounds, bounds));
  });
};
