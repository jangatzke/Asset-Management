import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { assetApi } from '../services/api';
import { useI18n } from '../context/I18nContext';

interface GraphNode {
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

interface GraphEdge {
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

interface DirectDependency {
  id: string;
  name?: string;
  type?: string;
  criticality?: string;
  displayId?: string;
  relationType?: string;
}

interface AssetGraphProps {
  assetId?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  fallbackNode?: GraphNode;
  focusAssetId?: string;
  heightClassName?: string;
  height?: string;
}

interface SelectedAssetField {
  key: string;
  labelKey: string;
  value: string;
}

interface SelectedAssetConnection {
  key: string;
  relationType: string;
  connectedNode?: GraphNode;
  connectedId?: string;
  connectedName: string;
}

interface SelectedAssetConnections {
  incoming: SelectedAssetConnection[];
  outgoing: SelectedAssetConnection[];
  other: SelectedAssetConnection[];
}

const DEPENDENCY_NODE_WIDTH = 172;
const DEPENDENCY_NODE_HEIGHT = 82;
const FOCUS_NODE_WIDTH = 224;
const FOCUS_NODE_HEIGHT = 112;
const MAX_DEPENDENCY_NODE_WIDTH = 236;
const MAX_FOCUS_NODE_WIDTH = 344;
const NODE_TEXT_START_OFFSET = 64;
const NODE_RIGHT_PADDING = 18;
const ARROW_CLEARANCE = 12;
const NODE_COLLISION_GAP = 24;
const VIEWBOX_CARD_PADDING = 24;
const COLLISION_RESOLUTION_ITERATIONS = 96;
const CONNECTOR_HANDLE_LENGTH = 64;
// Keep an explicit connector corridor between every hierarchy rank. This
// prevents direct and indirect cards from merging visually.
const HIERARCHICAL_FOCUS_CLEARANCE = 72;
const HIERARCHICAL_RANK_CLEARANCE = 56;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const GRAPH_VIEWBOX_WIDTH = 1600;
const GRAPH_VIEWBOX_HEIGHT = 900;
const GRAPH_CENTER = { x: GRAPH_VIEWBOX_WIDTH / 2, y: GRAPH_VIEWBOX_HEIGHT / 2 };
const SIDE_LANE_GAP = 228;
const SIDE_LANE_MIN_X = 140;
const SIDE_LANE_MAX_X = GRAPH_VIEWBOX_WIDTH - SIDE_LANE_MIN_X;
const SIDE_LANE_VERTICAL_GAP = 74;
const BOTTOM_LANE_TOP = GRAPH_CENTER.y + FOCUS_NODE_HEIGHT / 2 + 116;
const BOTTOM_LANE_HORIZONTAL_GAP = 56;
const BOTTOM_LANE_VERTICAL_GAP = 38;
const NEUTRAL_EDGE_COLOR = '#6B7280';
const EDGE_LABEL_WIDTH = 86;
const EDGE_LABEL_HEIGHT = 18;

const CRITICALITY_COLORS: Record<string, { fill: string; stroke: string }> = {
  critical: { fill: '#EF4444', stroke: '#B91C1C' },
  high: { fill: '#F97316', stroke: '#EA580C' },
  medium: { fill: '#EAB308', stroke: '#CA8A04' },
  low: { fill: '#22C55E', stroke: '#16A34A' },
};

const TYPE_COLORS: Record<string, string> = {
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

type GraphPayload = { nodes?: GraphNode[]; edges?: GraphEdge[] };
type GraphResponsePayload = GraphPayload | { data?: GraphResponsePayload | null } | null | undefined;

type GraphDirectionFilter = 'both' | 'upstream' | 'downstream';
type CriticalityThreshold = 'all' | 'critical' | 'high' | 'medium';

const CRITICALITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const CRITICALITY_THRESHOLDS: CriticalityThreshold[] = ['all', 'critical', 'high', 'medium'];

const getCriticalityRank = (criticality?: string): number | undefined => (criticality ? CRITICALITY_RANK[criticality.toLowerCase()] : undefined);

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

const normalizeEndpointLabel = (value?: string): string => (value ?? '').trim().toLowerCase();

const addLookupAlias = (lookup: Map<string, string>, alias: string | undefined, id: string): void => {
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

const estimateTextWidth = (text: string, averageCharacterWidth: number): number => text.length * averageCharacterWidth;

export const getNodeLabel = (node: GraphNode): string => node.name || node.displayId || node.id;

export const getNodeMetadata = (node: GraphNode): string => [node.displayId, node.type, node.criticality].filter(Boolean).join(' · ');

const formatDetailValue = (value: unknown): string | undefined => {
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

const normalizeRelationLabel = (relationType?: string): string => relationType || 'related';

const NEUTRAL_RELATION_TYPES = new Set(['related', 'connects_to', 'integrates_with', 'associated_with', 'linked_to']);

const isNeutralRelation = (relationType?: string): boolean => NEUTRAL_RELATION_TYPES.has((relationType || '').toLowerCase());

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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const distributeCardAwareYPositions = (nodesToPosition: GraphNode[], rootAssetId?: string): number[] => {
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

const getSideLaneX = (nodesToPosition: GraphNode[], rootAssetId: string | undefined, side: 'left' | 'right'): number => {
  const maxWidth = Math.max(DEPENDENCY_NODE_WIDTH, ...nodesToPosition.map((node) => getCardSize(node.id, rootAssetId, node).width));
  const focusWidth = rootAssetId ? getCardSize(rootAssetId, rootAssetId).width : FOCUS_NODE_WIDTH;
  const preferredX = side === 'left'
    ? GRAPH_CENTER.x - focusWidth / 2 - SIDE_LANE_GAP - maxWidth / 2
    : GRAPH_CENTER.x + focusWidth / 2 + SIDE_LANE_GAP + maxWidth / 2;
  const minX = Math.max(maxWidth / 2 + VIEWBOX_CARD_PADDING, SIDE_LANE_MIN_X);
  const maxX = Math.min(GRAPH_VIEWBOX_WIDTH - maxWidth / 2 - VIEWBOX_CARD_PADDING, SIDE_LANE_MAX_X);
  return clamp(preferredX, minX, maxX);
};

const positionSideLaneGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], side: 'left' | 'right', rootAssetId?: string): void => {
  if (nodesToPosition.length === 0) return;
  const x = getSideLaneX(nodesToPosition, rootAssetId, side);
  const yPositions = distributeCardAwareYPositions(nodesToPosition, rootAssetId);
  nodesToPosition.forEach((node, index) => {
    positions.set(node.id, { x, y: yPositions[index] });
  });
};

const positionBottomGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId?: string): void => {
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

type GraphLayoutLane = 'left' | 'right' | 'bottom';

interface GraphLayoutMetadata {
  depths: Map<string, number>;
  lanes: Map<string, GraphLayoutLane>;
  parents: Map<string, string>;
}

const getLaneForRelation = (source: string, target: string, relationType: string | undefined, rootAssetId: string): GraphLayoutLane | undefined => {
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

const sortNodesByParentRank = (nodesToPosition: GraphNode[], depths: Map<string, number>, parents: Map<string, string>, positions: Map<string, { x: number; y: number }>): GraphNode[] => (
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

const spreadYPositionsAroundTargets = (nodesToPosition: GraphNode[], targetYById: Map<string, number>, rootAssetId?: string): number[] => {
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

const distributeHierarchicalYPositions = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId: string | undefined, depths: Map<string, number>, parents: Map<string, string>): number[] => {
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

const positionHierarchicalSideLaneGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], side: 'left' | 'right', rootAssetId: string | undefined, focusNode: GraphNode, depths: Map<string, number>, parents: Map<string, string>): void => {
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

const resolveHierarchicalNodePositionCollisions = (
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

const positionHierarchicalBottomGroup = (positions: Map<string, { x: number; y: number }>, nodesToPosition: GraphNode[], rootAssetId: string | undefined, depths: Map<string, number>): void => {
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

const clampNodePositionToViewbox = (node: GraphNode, position: { x: number; y: number }, rootAssetId?: string): { x: number; y: number } => {
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

const getNodeById = (nodesById: Map<string, GraphNode>, nodeId: string): GraphNode | undefined => nodesById.get(nodeId);

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

const extractDependencyPayload = (payload: unknown): { upstream: DirectDependency[]; downstream: DirectDependency[] } => {
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

const getFillColor = (node: GraphNode): string => {
  if (node.criticality && CRITICALITY_COLORS[node.criticality]) {
    return CRITICALITY_COLORS[node.criticality].fill;
  }
  if (node.type && TYPE_COLORS[node.type]) {
    return TYPE_COLORS[node.type];
  }
  return '#6B7280';
};

const getStrokeColor = (node: GraphNode): string => {
  if (node.criticality && CRITICALITY_COLORS[node.criticality]) {
    return CRITICALITY_COLORS[node.criticality].stroke;
  }
  return '#4B5563';
};

const getNodeInitials = (node: GraphNode): string => getNodeLabel(node).slice(0, 2).toUpperCase();

const truncateTextToWidth = (text: string, availableWidth: number, averageCharacterWidth: number): string => {
  const maxCharacters = Math.max(8, Math.floor(availableWidth / averageCharacterWidth));
  return text.length > maxCharacters ? `${text.substring(0, maxCharacters - 1)}…` : text;
};

const truncateNodeLabel = (node: GraphNode, cardWidth: number): string => {
  const displayName = getNodeLabel(node);
  return truncateTextToWidth(displayName, cardWidth - NODE_TEXT_START_OFFSET - NODE_RIGHT_PADDING, 7.2);
};

type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';

const getPortPoint = (bounds: { x: number; y: number; width: number; height: number }, center: { x: number; y: number }, side: ConnectorSide, clearance: number): { x: number; y: number } => {
  if (side === 'left') return { x: bounds.x - clearance, y: center.y };
  if (side === 'right') return { x: bounds.x + bounds.width + clearance, y: center.y };
  if (side === 'top') return { x: center.x, y: bounds.y - clearance };
  return { x: center.x, y: bounds.y + bounds.height + clearance };
};

const getOppositeConnectorSide = (side: ConnectorSide): ConnectorSide => {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  if (side === 'top') return 'bottom';
  return 'top';
};

const getLaneAwareFocusSide = (focusPos: { x: number; y: number }, relatedPos: { x: number; y: number }): ConnectorSide => {
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

const getConnectorHandlePoint = (point: { x: number; y: number }, side: ConnectorSide, direction: 'away' | 'toward'): { x: number; y: number } => {
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

const doBoundsIntersect = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }): boolean => (
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

export const AssetGraph: React.FC<AssetGraphProps> = ({ assetId, nodes: propNodes, edges: propEdges, fallbackNode, focusAssetId, heightClassName = 'h-[32rem]', height = '512px' }) => {
  const { t } = useI18n();
  const rootAssetId = focusAssetId ?? assetId;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [maxDepth, setMaxDepth] = useState<number>(10);
  const [direction, setDirection] = useState<GraphDirectionFilter>('both');
  const [relationFilter, setRelationFilter] = useState<string>('');
  const [criticalityFilter, setCriticalityFilter] = useState<CriticalityThreshold>('all');

  // Internal nodes/edges state for API loading mode
  const [internalNodes, setInternalNodes] = useState<GraphNode[]>(propNodes || []);
  const [internalEdges, setInternalEdges] = useState<GraphEdge[]>(propEdges || []);

  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Load graph data from API when assetId is provided
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    assetApi.getGraph(assetId, { maxDepth, direction, relationTypes: relationFilter || undefined })
      .then((res) => {
        if (cancelled) return;
        const data = extractGraphPayload(res.data);
        setInternalNodes(data.nodes);
        setInternalEdges(data.edges);
      })
      .catch(async (err) => {
        if (cancelled) return;
        let actionableError = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load graph';
        try {
          const fallbackResponse = await assetApi.getDependencies(assetId);
          if (cancelled) return;
          const fallbackGraph = buildDependencyFallbackGraph(focusAssetId ?? assetId, fallbackNode, fallbackResponse.data);
          if (fallbackGraph.edges.length > 0) {
            setInternalNodes(fallbackGraph.nodes);
            setInternalEdges(fallbackGraph.edges);
            actionableError = `${actionableError}. Showing direct dependencies from the dependencies endpoint instead.`;
          } else {
            setInternalNodes([]);
            setInternalEdges([]);
          }
        } catch (fallbackErr: any) {
          actionableError = `${actionableError}. Direct dependency fallback also failed: ${fallbackErr.response?.data?.error?.message || fallbackErr.response?.data?.message || fallbackErr.message || 'Failed to load dependencies'}.`;
        }
        setError(actionableError);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assetId, maxDepth, direction, relationFilter, focusAssetId]);

  const rawNodes = useMemo(() => assetId ? internalNodes : (propNodes || []), [assetId, internalNodes, propNodes]);
  const nodes = useMemo(() => ensureFocusAssetNode(rawNodes, rootAssetId, fallbackNode), [rawNodes, rootAssetId, fallbackNode]);
  const edges = useMemo(() => assetId ? internalEdges : (propEdges || []), [assetId, internalEdges, propEdges]);
  const rawEdgeEndpointLookup = useMemo(() => createNodeEndpointLookup(nodes), [nodes]);
  const normalizedEdges = useMemo(
    () => edges.map((edge) => {
      const sourceId = resolveEdgeEndpoint(edge, 'source', rawEdgeEndpointLookup);
      const targetId = resolveEdgeEndpoint(edge, 'target', rawEdgeEndpointLookup);
      return { ...edge, sourceId, targetId, source: sourceId ?? edge.source, target: targetId ?? edge.target };
    }),
    [edges, rawEdgeEndpointLookup],
  );
  const filteredGraph = useMemo(
    () => filterGraphForVisibleNodes(nodes, normalizedEdges, rootAssetId, maxDepth, direction, criticalityFilter),
    [nodes, normalizedEdges, rootAssetId, maxDepth, direction, criticalityFilter],
  );
  const visibleNodes = filteredGraph.nodes;
  const visibleEdges = filteredGraph.edges;
  const visualEdges = useMemo(() => buildVisualEdges(visibleNodes, visibleEdges, rootAssetId), [visibleNodes, visibleEdges, rootAssetId]);
  const graphPositions = useMemo(() => calculateNodePositions(visibleNodes, visualEdges, rootAssetId), [visibleNodes, visualEdges, rootAssetId]);
  const focusAssetNode = useMemo(
    () => rootAssetId ? visibleNodes.find((node) => node.id === rootAssetId) : undefined,
    [visibleNodes, rootAssetId],
  );
  const dependencyNodes = useMemo(
    () => rootAssetId ? visibleNodes.filter((node) => node.id !== rootAssetId) : visibleNodes,
    [visibleNodes, rootAssetId],
  );
  const showIsolatedFocusAsset = !!focusAssetNode && dependencyNodes.length === 0 && visualEdges.length === 0;
  const selectedAssetFields = useMemo(
    () => selectedNode ? buildSelectedAssetFields(selectedNode) : [],
    [selectedNode],
  );
  const selectedAssetMetadataFields = useMemo(
    () => selectedNode ? buildSelectedAssetMetadataFields(selectedNode) : [],
    [selectedNode],
  );
  const selectedAssetConnections = useMemo(
    () => selectedNode ? buildSelectedAssetConnections(selectedNode, visibleNodes, visualEdges) : { incoming: [], outgoing: [], other: [] },
    [selectedNode, visibleNodes, visualEdges],
  );
  const selectedAssetHasConnections = selectedAssetConnections.incoming.length > 0 || selectedAssetConnections.outgoing.length > 0 || selectedAssetConnections.other.length > 0;

  useEffect(() => {
    if (!selectedNode) return;
    if (!visibleNodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(focusAssetNode ?? null);
    }
  }, [selectedNode, visibleNodes, focusAssetNode]);

  useEffect(() => {
    nodePositionsRef.current = new Map(graphPositions);
  }, [graphPositions]);

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => draw());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(canvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  // Handle click to select node
  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const positions = nodePositionsRef.current;
    let foundNode: GraphNode | null = null;

    visibleNodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const adjustedX = (rect.width / 2 + pan.x - GRAPH_CENTER.x * zoom + pos.x * zoom);
      const adjustedY = (rect.height / 2 + pan.y - GRAPH_CENTER.y * zoom + pos.y * zoom);

      const size = getCardSize(node.id, rootAssetId, node);
      if (mouseX >= adjustedX - (size.width * zoom) / 2 && mouseX <= adjustedX + (size.width * zoom) / 2 && mouseY >= adjustedY - (size.height * zoom) / 2 && mouseY <= adjustedY + (size.height * zoom) / 2) {
        foundNode = node;
      }
    });

    setSelectedNode(foundNode);
  }, [visibleNodes, isDragging, pan.x, pan.y, zoom, rootAssetId]);

  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const positions = nodePositionsRef.current;
    let foundNode: string | null = null;

    visibleNodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const adjustedX = (rect.width / 2 + pan.x - GRAPH_CENTER.x * zoom + pos.x * zoom);
      const adjustedY = (rect.height / 2 + pan.y - GRAPH_CENTER.y * zoom + pos.y * zoom);

      const size = getCardSize(node.id, rootAssetId, node);
      if (mouseX >= adjustedX - (size.width * zoom) / 2 && mouseX <= adjustedX + (size.width * zoom) / 2 && mouseY >= adjustedY - (size.height * zoom) / 2 && mouseY <= adjustedY + (size.height * zoom) / 2) {
        foundNode = node.id;
      }
    });

    void foundNode;
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Collect unique relation types for filter
  const relationTypes = Array.from(new Set(normalizedEdges.map(e => e.relationType).filter(Boolean))) as string[];
  const graphTransform = `translate(${GRAPH_CENTER.x + pan.x} ${GRAPH_CENTER.y + pan.y}) scale(${zoom}) translate(${-GRAPH_CENTER.x} ${-GRAPH_CENTER.y})`;

  return (
    <div className="relative" ref={containerRef}>
      {/* Filters */}
      {assetId && (
        <div className="flex flex-wrap gap-3 mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('graph.filters.maxDepth')}</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('graph.filters.direction')}</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as GraphDirectionFilter)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            >
              <option value="both">{t('graph.filters.directionBoth')}</option>
              <option value="upstream">{t('graph.filters.directionUpstream')}</option>
              <option value="downstream">{t('graph.filters.directionDownstream')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('graph.filters.criticality')}</label>
            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value as CriticalityThreshold)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            >
              {CRITICALITY_THRESHOLDS.map((threshold) => (
                <option key={threshold} value={threshold}>{t(`graph.filters.criticality.${threshold}`)}</option>
              ))}
            </select>
          </div>
          {relationTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('graph.filters.relationType')}</label>
              <select
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              >
                <option value="">{t('graph.filters.all')}</option>
                {relationTypes.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2 text-xs">
        {rootAssetId && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full inline-block border-2 border-yellow-400 bg-blue-600"></span>
              <span className="text-gray-600 dark:text-gray-400">{t('graph.focusAsset')}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-0.5 inline-block bg-green-600"></span>
              <span className="text-gray-600 dark:text-gray-400">{t('graph.incomingDependencies')}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-0.5 inline-block bg-purple-600"></span>
              <span className="text-gray-600 dark:text-gray-400">{t('graph.outgoingDependencies')}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-0.5 inline-block bg-gray-500"></span>
              <span className="text-gray-600 dark:text-gray-400">{t('graph.neutralDependencies')}</span>
            </span>
          </>
        )}
        {Object.entries(CRITICALITY_COLORS).map(([level, colors]) => (
          <span key={level} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: colors.fill }}></span>
            <span className="text-gray-600 dark:text-gray-400 capitalize">{level}</span>
          </span>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>
      )}

      {/* Canvas */}
      {!loading && visibleNodes.length > 0 && (
        <div data-testid="asset-graph-viewport" className={`relative w-full ${heightClassName} overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900`} style={{ height }}>
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            style={{ width: '100%', height: '100%' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
          <svg
            data-testid="asset-graph-visual-layer"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${GRAPH_VIEWBOX_WIDTH} ${GRAPH_VIEWBOX_HEIGHT}`}
            role="img"
            aria-label="Asset dependency graph"
          >
            <defs>
              <marker id="asset-graph-arrow-incoming" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#16A34A" />
              </marker>
              <marker id="asset-graph-arrow-outgoing" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#7C3AED" />
              </marker>
              <marker id="asset-graph-arrow-neutral" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={NEUTRAL_EDGE_COLOR} />
              </marker>
            </defs>
            <g transform={graphTransform}>
              {visualEdges.map((edge, index) => {
                const source = getEdgeSource(edge);
                const target = getEdgeTarget(edge);
                const sourcePos = source ? graphPositions.get(source) : undefined;
                const targetPos = target ? graphPositions.get(target) : undefined;
                if (!source || !target || !sourcePos || !targetPos) return null;
                const sourceNode = visibleNodes.find((node) => node.id === source);
                const targetNode = visibleNodes.find((node) => node.id === target);
                const isIncomingToFocus = !!rootAssetId && target === rootAssetId;
                const isOutgoingFromFocus = !!rootAssetId && source === rootAssetId;
                const edgeColor = isIncomingToFocus ? '#16A34A' : isOutgoingFromFocus ? '#7C3AED' : NEUTRAL_EDGE_COLOR;
                const edgeMarkerId = isIncomingToFocus ? 'asset-graph-arrow-incoming' : isOutgoingFromFocus ? 'asset-graph-arrow-outgoing' : 'asset-graph-arrow-neutral';
                const edgeLabelPlacement = getEdgeLabelPlacement(edge, graphPositions, visibleNodes, rootAssetId);
                return (
                  <g key={`${source}-${target}-${index}`} data-testid="asset-graph-edge" color={edgeColor}>
                    <path
                      d={getConnectorPath(source, target, sourcePos, targetPos, rootAssetId, sourceNode, targetNode)}
                      fill="none"
                      stroke={edgeColor}
                      strokeWidth={isIncomingToFocus || isOutgoingFromFocus ? 3 : 2}
                      markerEnd={`url(#${edgeMarkerId})`}
                    />
                    {edgeLabelPlacement && (
                      <text
                        x={edgeLabelPlacement.x}
                        y={edgeLabelPlacement.y}
                        textAnchor="middle"
                        className="fill-gray-600 text-[10px] dark:fill-gray-300"
                      >
                        {edge.relationType}
                      </text>
                    )}
                  </g>
                );
              })}
              {visibleNodes.map((node) => {
                const pos = graphPositions.get(node.id);
                if (!pos) return null;
                const focused = rootAssetId === node.id;
                const bounds = getNodeCardBounds(node.id, pos, rootAssetId, node);
                const nodeFill = focused ? '#EFF6FF' : '#FFFFFF';
                const nodeStroke = focused ? '#FACC15' : getStrokeColor(node);
                const accentColor = focused ? '#2563EB' : getFillColor(node);
                const metadata = getNodeMetadata(node);
                return (
                  <g key={node.id} data-testid={`asset-graph-node-${node.id}`} transform={`translate(${pos.x} ${pos.y})`}>
                    <rect
                      data-testid="asset-graph-node-card"
                      x={-bounds.width / 2}
                      y={-bounds.height / 2}
                      width={bounds.width}
                      height={bounds.height}
                      rx={14}
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth={focused ? 3 : 2}
                      className="drop-shadow-sm dark:fill-gray-800"
                    />
                    <circle cx={-bounds.width / 2 + 31} cy={0} r={focused ? 22 : 18} fill={accentColor} stroke={focused ? '#FACC15' : nodeStroke} strokeWidth={focused ? 4 : 2} />
                    <text x={-bounds.width / 2 + 31} y={4} textAnchor="middle" className="fill-white text-[11px] font-bold">
                      {getNodeInitials(node)}
                    </text>
                    {focused && (
                      <text x={-bounds.width / 2 + 64} y={-24} className="fill-blue-700 text-[10px] font-semibold uppercase tracking-wide dark:fill-blue-300">
                        {t('graph.focusAsset')}
                      </text>
                    )}
                    <text x={-bounds.width / 2 + NODE_TEXT_START_OFFSET} y={focused ? -5 : -10} className="fill-gray-900 text-[13px] font-bold dark:fill-gray-100">
                      {truncateNodeLabel(node, bounds.width)}
                    </text>
                    {metadata && (
                      <text x={-bounds.width / 2 + NODE_TEXT_START_OFFSET} y={focused ? 15 : 11} className="fill-gray-600 text-[10px] dark:fill-gray-300">
                        {truncateTextToWidth(metadata, bounds.width - NODE_TEXT_START_OFFSET - NODE_RIGHT_PADDING, 5.8)}
                      </text>
                    )}
                    <title>{getNodeLabel(node)}</title>
                  </g>
                );
              })}
            </g>
          </svg>
          {focusAssetNode && showIsolatedFocusAsset && (
            <div
              data-testid="asset-graph-isolated-focus"
              className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-md -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/95 p-5 text-blue-900 shadow-lg dark:border-blue-800 dark:bg-blue-950/90 dark:text-blue-100"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-yellow-400 bg-blue-600 text-sm font-bold text-white shadow">
                {getNodeInitials(focusAssetNode)}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{t('graph.focusAsset')}</div>
                <div className="text-base font-semibold">{getNodeLabel(focusAssetNode)}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {[focusAssetNode.displayId, focusAssetNode.type, focusAssetNode.criticality].filter(Boolean).join(' · ')}
                </div>
                {showIsolatedFocusAsset && <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">{t('graph.noDependencies')}</div>}
              </div>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-2">
            <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">+</button>
            <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">-</button>
            <button onClick={resetView} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">{t('graph.reset')}</button>
          </div>
        </div>
      )}

      {/* Node Detail Side Panel */}
      {selectedNode && (
        <div data-testid="asset-graph-selected-details" className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{t('graph.details.title')}</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{getNodeLabel(selectedNode)}</h3>
              {selectedNode.displayId && <p className="text-sm text-gray-500 dark:text-gray-400">{selectedNode.displayId}</p>}
            </div>
            <button aria-label={t('common.close')} onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl">×</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
            <section className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('graph.details.assetInformation')}</h4>
              {selectedAssetFields.length > 0 ? (
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {selectedAssetFields.map((field) => (
                    <div key={field.key} className="rounded bg-white p-2 dark:bg-gray-800">
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{t(field.labelKey)}</dt>
                      <dd className="mt-0.5 break-words text-gray-900 dark:text-white">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('graph.details.noAdditionalInformation')}</p>
              )}
              {selectedNode.description && (
                <div className="mt-3 rounded bg-white p-2 text-sm dark:bg-gray-800">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('graph.details.description')}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-gray-900 dark:text-white">{selectedNode.description}</p>
                </div>
              )}
              {selectedAssetMetadataFields.length > 0 && (
                <div className="mt-3">
                  <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('graph.details.metadata')}</h5>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {selectedAssetMetadataFields.map((field) => (
                      <div key={field.key} className="rounded bg-white p-2 dark:bg-gray-800">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{field.labelKey}</dt>
                        <dd className="mt-0.5 break-words text-gray-900 dark:text-white">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>
            <section className="rounded-md border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t('graph.details.connections')}</h4>
              {!selectedAssetHasConnections ? (
                <p data-testid="asset-graph-selected-connections-empty" className="rounded bg-white p-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t('graph.details.noConnections')}</p>
              ) : (
                <div className="grid gap-3 xl:grid-cols-3">
                  {([
                    ['incoming', 'graph.incomingDependencies', selectedAssetConnections.incoming, 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200'],
                    ['outgoing', 'graph.outgoingDependencies', selectedAssetConnections.outgoing, 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200'],
                    ['other', 'graph.neutralDependencies', selectedAssetConnections.other, 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'],
                  ] as const).map(([sectionKey, headingKey, connections, colorClass]) => (
                    <div key={sectionKey} data-testid={`asset-graph-selected-connections-${sectionKey}`}>
                      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(headingKey)} ({connections.length})</h5>
                      {connections.length > 0 ? (
                        <ul className="space-y-2">
                          {connections.map((connection) => (
                            <li key={connection.key} className={`rounded border p-2 text-sm ${colorClass}`}>
                              <div className="font-medium">{connection.connectedName}</div>
                              <div className="mt-1 flex flex-wrap gap-1 text-xs opacity-90">
                                <span className="rounded bg-white/70 px-1.5 py-0.5 dark:bg-black/20">{connection.relationType}</span>
                                {connection.connectedNode?.displayId && <span>{connection.connectedNode.displayId}</span>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded bg-white p-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t('graph.details.noneInSection')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visibleNodes.length === 0 && (
        <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
          {assetId ? t('graph.noDependencies') : t('graph.noData')}
        </div>
      )}
    </div>
  );
};

export default AssetGraph;


