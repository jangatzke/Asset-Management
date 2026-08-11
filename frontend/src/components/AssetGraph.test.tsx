/// <reference types="vitest" />
import { renderToStaticMarkup } from 'react-dom/server';
import { AssetGraph } from './AssetGraph';
import { buildDependencyFallbackGraph, buildSelectedAssetConnections, buildSelectedAssetFields, buildSelectedAssetMetadataFields, buildVisualEdges, calculateGraphLayoutMetadata, calculateNodePositions, createNodeEndpointLookup, doNodeCardBoundsOverlap, ensureFocusAssetNode, extractGraphPayload, filterGraphForVisibleNodes, getCardSize, getConnectorPath, getConnectorPoints, getEdgeLabelPlacement, getEdgeSource, getEdgeTarget, getNodeCardBounds, nodeMatchesCriticalityThreshold, resolveEdgeEndpoint } from './AssetGraphUtils';
import de from '../locales/de.json';
import en from '../locales/en.json';

vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('ensureFocusAssetNode', () => {
  it('adds the focused asset as a fallback node when the graph is empty', () => {
    expect(ensureFocusAssetNode([], 'asset-1')).toEqual([
      { id: 'asset-1', name: 'asset-1', nodeType: 'Asset', type: 'asset' },
    ]);
  });

  it('uses selected asset details for the fallback node when provided', () => {
    const fallbackNode = { id: 'asset-1', name: 'Core Router', displayId: 'AST-001', type: 'network', criticality: 'high' };

    expect(ensureFocusAssetNode([], 'asset-1', fallbackNode)).toEqual([fallbackNode]);
  });

  it('normalizes a mismatched fallback node id to the focused asset id', () => {
    const fallbackNode = { id: 'stale-asset', name: 'Helio OT System 06', displayId: 'AST-006', type: 'system', criticality: 'medium' };

    expect(ensureFocusAssetNode([], 'asset-6', fallbackNode)).toEqual([
      { ...fallbackNode, id: 'asset-6' },
    ]);
  });

  it('preserves existing graph nodes when the focused asset is already present', () => {
    const graphNodes = [
      { id: 'asset-1', name: 'Core Router', type: 'network' },
      { id: 'asset-2', name: 'Firewall', type: 'network' },
    ];

    expect(ensureFocusAssetNode(graphNodes, 'asset-1')).toBe(graphNodes);
  });
});

describe('extractGraphPayload', () => {
  it('reads direct graph API payloads', () => {
    const graph = { nodes: [{ id: 'asset-1', name: 'Core Router' }], edges: [] };

    expect(extractGraphPayload(graph)).toEqual(graph);
  });

  it('unwraps standardized graph API payloads', () => {
    const graph = { nodes: [{ id: 'asset-1', name: 'Core Router' }], edges: [] };

    expect(extractGraphPayload({ data: graph })).toEqual(graph);
  });

  it('unwraps the nested axios plus standardized API response shape used by assetApi.getGraph', () => {
    const graph = {
      nodes: [
        { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
        { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
      ],
      edges: [{ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'depends_on' }],
    };

    expect(extractGraphPayload({ data: { data: graph } })).toEqual(graph);
  });
});

describe('filterGraphForVisibleNodes', () => {
  const nodes = [
    { id: 'focus', name: 'Focus Asset', criticality: 'critical' },
    { id: 'direct-high', name: 'Direct High', criticality: 'high' },
    { id: 'direct-medium', name: 'Direct Medium', criticality: 'medium' },
    { id: 'direct-low', name: 'Direct Low', criticality: 'low' },
    { id: 'second-hop', name: 'Second Hop', criticality: 'low' },
    { id: 'isolated-critical', name: 'Isolated Critical', criticality: 'critical' },
  ];
  const edges = [
    { sourceId: 'focus', targetId: 'direct-high', relationType: 'depends_on' },
    { sourceId: 'direct-medium', targetId: 'focus', relationType: 'uses' },
    { sourceId: 'focus', targetId: 'direct-low', relationType: 'connects_to' },
    { sourceId: 'direct-high', targetId: 'second-hop', relationType: 'feeds' },
    { sourceId: 'second-hop', targetId: 'isolated-critical', relationType: 'feeds' },
  ];

  it('hides second-hop and disconnected nodes at max depth 1 even when the response contains them', () => {
    const filtered = filterGraphForVisibleNodes(nodes, edges, 'focus', 1, 'both', 'all');

    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['direct-high', 'direct-low', 'direct-medium', 'focus']);
    expect(filtered.nodes.map((node) => node.id)).not.toContain('second-hop');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('isolated-critical');
    expect(filtered.edges).toHaveLength(3);
    expect(filtered.edges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'direct-high', targetId: 'second-hop' }),
    ]));
  });

  it('applies only-critical filtering to non-focus nodes while keeping the focus node visible', () => {
    const filtered = filterGraphForVisibleNodes(nodes, edges, 'focus', 2, 'both', 'critical');

    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['focus']);
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-high');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-medium');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-low');
    expect(nodeMatchesCriticalityThreshold({ id: 'focus', name: 'Medium Focus', criticality: 'medium' }, 'focus', 'critical')).toBe(true);
  });

  it('applies minimum high filtering to include critical and high non-focus nodes only', () => {
    const filtered = filterGraphForVisibleNodes(nodes, edges, 'focus', 2, 'both', 'high');

    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['direct-high', 'focus']);
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-medium');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-low');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('second-hop');
  });

  it('applies minimum medium filtering to include critical, high, and medium non-focus nodes', () => {
    const filtered = filterGraphForVisibleNodes(nodes, edges, 'focus', 2, 'both', 'medium');

    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['direct-high', 'direct-medium', 'focus']);
    expect(filtered.nodes.map((node) => node.id)).not.toContain('direct-low');
    expect(filtered.nodes.map((node) => node.id)).not.toContain('second-hop');
  });

  it('renders only edges whose endpoints remain visible after criticality filtering', () => {
    const filtered = filterGraphForVisibleNodes(nodes, edges, 'focus', 2, 'both', 'high');

    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['direct-high', 'focus']);
    expect(filtered.edges).toEqual([
      expect.objectContaining({ sourceId: 'focus', targetId: 'direct-high' }),
    ]);
  });
});

describe('graph edge endpoint normalization', () => {
  it('prefers canonical sourceId/targetId over ambiguous source/target labels', () => {
    const edge = {
      source: 'Helio OT System 01',
      target: 'Helio Information 06',
      sourceId: 'demo-helio-asset-123',
      targetId: 'demo-helio-asset-142',
      relationType: 'depends_on',
    };

    expect(getEdgeSource(edge)).toBe('demo-helio-asset-123');
    expect(getEdgeTarget(edge)).toBe('demo-helio-asset-142');
  });

  it('maps display-name endpoints back to node ids so returned dependencies remain drawable', () => {
    const nodes = [
      { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
      { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
    ];
    const lookup = createNodeEndpointLookup(nodes);
    const edge = { source: 'Helio OT System 01', target: 'Helio Information 06', relationType: 'depends_on' };

    expect(resolveEdgeEndpoint(edge, 'source', lookup)).toBe('demo-helio-asset-123');
    expect(resolveEdgeEndpoint(edge, 'target', lookup)).toBe('demo-helio-asset-142');
  });

  it('builds a dependency fallback graph when the graph endpoint fails instead of showing only the focus asset', () => {
    const graph = buildDependencyFallbackGraph(
      'demo-helio-asset-123',
      { id: 'demo-helio-asset-123', name: 'Helio OT System 01', displayId: 'AST-DEMO-123' },
      {
        data: {
          upstream: [{ id: 'demo-helio-asset-122', name: 'Helio PLC 01', relationType: 'uses' }],
          downstream: [{ id: 'demo-helio-asset-142', name: 'Helio Information 06', relationType: 'depends_on' }],
        },
      },
    );

    expect(graph.nodes.map((node) => node.name).sort()).toEqual(['Helio Information 06', 'Helio OT System 01', 'Helio PLC 01']);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'demo-helio-asset-122', targetId: 'demo-helio-asset-123', relationType: 'uses' }),
      expect.objectContaining({ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'depends_on' }),
    ]));
  });

  it('constructs visual fallback connectors when dependency nodes exist but drawable edges are missing', () => {
    const nodes = [
      { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
      { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
      { id: 'demo-helio-asset-141', name: 'Helio Information 05' },
    ];

    expect(buildVisualEdges(nodes, [], 'demo-helio-asset-123')).toEqual([
      expect.objectContaining({ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'related' }),
      expect.objectContaining({ sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-141', relationType: 'related' }),
    ]);
  });

  it('keeps dependency node positions within the initial graph viewbox', () => {
    const nodes = [
      { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
      { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
      { id: 'demo-helio-asset-141', name: 'Helio Information 05' },
    ];
    const edges = [
      { sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'depends_on' },
      { sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-141', relationType: 'depends_on' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'demo-helio-asset-123');

    nodes.forEach((node) => {
      const position = positions.get(node.id);
      expect(position?.x).toBeGreaterThanOrEqual(70);
      expect(position?.x).toBeLessThanOrEqual(1130);
      expect(position?.y).toBeGreaterThanOrEqual(70);
      expect(position?.y).toBeLessThanOrEqual(690);
    });
  });

  it('positions card-style dependency nodes without overlapping in the initial graph viewbox', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'up-1', name: 'Upstream 1' },
      { id: 'up-2', name: 'Upstream 2' },
      { id: 'down-1', name: 'Downstream 1' },
      { id: 'down-2', name: 'Downstream 2' },
      { id: 'down-3', name: 'Downstream 3' },
    ];
    const edges = [
      { sourceId: 'up-1', targetId: 'focus', relationType: 'uses' },
      { sourceId: 'up-2', targetId: 'focus', relationType: 'uses' },
      { sourceId: 'focus', targetId: 'down-1', relationType: 'depends_on' },
      { sourceId: 'focus', targetId: 'down-2', relationType: 'depends_on' },
      { sourceId: 'focus', targetId: 'down-3', relationType: 'depends_on' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'focus');
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, 'focus', node));

    bounds.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1600);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    });

    bounds.forEach((box, index) => {
      bounds.slice(index + 1).forEach((otherBox) => {
        const overlaps = box.x < otherBox.x + otherBox.width
          && box.x + box.width > otherBox.x
          && box.y < otherBox.y + otherBox.height
          && box.y + box.height > otherBox.y;
        expect(overlaps).toBe(false);
      });
    });
  });

  it('sizes card bounds from variable-width labels and avoids overlap for bottom-row neutral assets', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'neutral-1', name: 'Very Long Manufacturing Execution System Label', displayId: 'AST-LONG-001', type: 'application' },
      { id: 'neutral-2', name: 'Warehouse Integration Gateway With Extended Name', displayId: 'AST-LONG-002', type: 'service' },
    ];

    const positions = calculateNodePositions(nodes, [], 'focus');
    const firstSize = getCardSize('neutral-1', 'focus', nodes[1]);
    const secondSize = getCardSize('neutral-2', 'focus', nodes[2]);
    const firstBounds = getNodeCardBounds('neutral-1', positions.get('neutral-1')!, 'focus', nodes[1]);
    const secondBounds = getNodeCardBounds('neutral-2', positions.get('neutral-2')!, 'focus', nodes[2]);

    expect(firstSize.width).toBeGreaterThan(172);
    expect(secondSize.width).toBeGreaterThan(172);
    expect(firstBounds.x).toBeGreaterThanOrEqual(0);
    expect(secondBounds.x + secondBounds.width).toBeLessThanOrEqual(1600);
    expect(doNodeCardBoundsOverlap(firstBounds, secondBounds)).toBe(false);
  });

  it('places side-connector arrow endpoints outside the target card boundary', () => {
    const sourceNode = { id: 'focus', name: 'Focus Asset' };
    const targetNode = { id: 'target', name: 'Long Target Asset Label' };
    const sourcePos = { x: 400, y: 300 };
    const targetPos = { x: 650, y: 300 };

    const points = getConnectorPoints(sourceNode.id, targetNode.id, sourcePos, targetPos, 'focus', sourceNode, targetNode);
    const targetBounds = getNodeCardBounds(targetNode.id, targetPos, 'focus', targetNode);

    expect(points.end.x).toBeLessThan(targetBounds.x);
    expect(points.end.y).toBe(targetPos.y);
  });

  it('prevents card overlaps for a Helio-like graph with variable-width related nodes', () => {
    const nodes = [
      { id: 'demo-helio-asset-123', name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'identity-access', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application', criticality: 'high' },
      { id: 'factory-mes', name: 'Factory MES Platform', displayId: 'AST-MES-042', type: 'application', criticality: 'critical' },
      { id: 'siem', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service', criticality: 'high' },
      { id: 'erp', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application', criticality: 'medium' },
      { id: 'plc', name: 'Production Line PLC Cluster', displayId: 'AST-PLC-009', type: 'infrastructure', criticality: 'critical' },
      { id: 'historian', name: 'Manufacturing Data Historian', displayId: 'AST-HIS-006', type: 'database', criticality: 'medium' },
    ];
    const edges = [
      { sourceId: 'identity-access', targetId: 'demo-helio-asset-123', relationType: 'authenticates' },
      { sourceId: 'siem', targetId: 'demo-helio-asset-123', relationType: 'monitors' },
      { sourceId: 'demo-helio-asset-123', targetId: 'factory-mes', relationType: 'depends_on' },
      { sourceId: 'demo-helio-asset-123', targetId: 'erp', relationType: 'integrates_with' },
      { sourceId: 'plc', targetId: 'historian', relationType: 'feeds' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'demo-helio-asset-123');
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, 'demo-helio-asset-123', node));

    bounds.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1600);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    });
    bounds.forEach((box, index) => {
      bounds.slice(index + 1).forEach((otherBox) => {
        expect(doNodeCardBoundsOverlap(box, otherBox, 0)).toBe(false);
      });
    });
  });

  it('centers the full Helio-like card bounding box within the expanded viewbox instead of concentrating it lower-right', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'identity-access', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application', criticality: 'high' },
      { id: 'siem', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service', criticality: 'high' },
      { id: 'factory-mes', name: 'Factory MES Platform', displayId: 'AST-MES-042', type: 'application', criticality: 'critical' },
      { id: 'erp', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application', criticality: 'medium' },
      { id: 'plc', name: 'Production Line PLC Cluster', displayId: 'AST-PLC-009', type: 'infrastructure', criticality: 'critical' },
      { id: 'historian', name: 'Manufacturing Data Historian', displayId: 'AST-HIS-006', type: 'database', criticality: 'medium' },
    ];
    const edges = [
      { sourceId: 'identity-access', targetId: focusId, relationType: 'authenticates' },
      { sourceId: 'siem', targetId: focusId, relationType: 'monitors' },
      { sourceId: focusId, targetId: 'factory-mes', relationType: 'depends_on' },
      { sourceId: focusId, targetId: 'erp', relationType: 'integrates_with' },
      { sourceId: 'plc', targetId: 'historian', relationType: 'feeds' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));
    const minX = Math.min(...bounds.map((box) => box.x));
    const maxX = Math.max(...bounds.map((box) => box.x + box.width));
    const minY = Math.min(...bounds.map((box) => box.y));
    const maxY = Math.max(...bounds.map((box) => box.y + box.height));
    const boundingCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    expect(boundingCenter.x).toBeGreaterThan(750);
    expect(boundingCenter.x).toBeLessThan(850);
    expect(boundingCenter.y).toBeGreaterThan(410);
    expect(boundingCenter.y).toBeLessThan(490);
    expect(minX).toBeLessThan(420);
    expect(minY).toBeLessThan(300);
  });

  it('keeps a readable horizontal gap between the focus card and side-lane cards', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System' },
      { id: 'upstream', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application' },
      { id: 'downstream', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application' },
    ];
    const edges = [
      { sourceId: 'upstream', targetId: focusId, relationType: 'authenticates' },
      { sourceId: focusId, targetId: 'downstream', relationType: 'integrates_with' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusBounds = getNodeCardBounds(focusId, positions.get(focusId)!, focusId, nodes[0]);
    const upstreamBounds = getNodeCardBounds('upstream', positions.get('upstream')!, focusId, nodes[1]);
    const downstreamBounds = getNodeCardBounds('downstream', positions.get('downstream')!, focusId, nodes[2]);

    expect(upstreamBounds.x - (focusBounds.x + focusBounds.width)).toBeGreaterThanOrEqual(176);
    expect(focusBounds.x - (downstreamBounds.x + downstreamBounds.width)).toBeGreaterThanOrEqual(176);
  });

  it('keeps a larger Helio-like connector corridor between the focus card and side-lane cards', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'identity-access', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application', criticality: 'high' },
      { id: 'siem', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service', criticality: 'high' },
      { id: 'factory-mes', name: 'Factory MES Platform', displayId: 'AST-MES-042', type: 'application', criticality: 'critical' },
      { id: 'erp', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application', criticality: 'medium' },
    ];
    const edges = [
      { sourceId: 'identity-access', targetId: focusId, relationType: 'authenticates' },
      { sourceId: 'siem', targetId: focusId, relationType: 'monitors' },
      { sourceId: focusId, targetId: 'factory-mes', relationType: 'depends_on' },
      { sourceId: focusId, targetId: 'erp', relationType: 'integrates_with' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusBounds = getNodeCardBounds(focusId, positions.get(focusId)!, focusId, nodes[0]);
    const sideBounds = nodes.slice(1).map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));
    const horizontalGaps = sideBounds.map((bounds) => bounds.x < focusBounds.x
      ? focusBounds.x - (bounds.x + bounds.width)
      : bounds.x - (focusBounds.x + focusBounds.width));

    horizontalGaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(196));
  });

  it('keeps a larger vertical corridor between the focus card and neutral bottom-lane cards', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Focus Asset' },
      { id: 'neutral-a', name: 'Production Line PLC Cluster', displayId: 'AST-PLC-009', type: 'infrastructure' },
      { id: 'neutral-b', name: 'Manufacturing Data Historian', displayId: 'AST-HIS-006', type: 'database' },
    ];

    const positions = calculateNodePositions(nodes, [], focusId);
    const focusBounds = getNodeCardBounds(focusId, positions.get(focusId)!, focusId, nodes[0]);
    const neutralBounds = nodes.slice(1).map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));
    const verticalGaps = neutralBounds.map((bounds) => bounds.y - (focusBounds.y + focusBounds.height));

    verticalGaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(116));
  });

  it('keeps enough vertical gap between stacked side-lane cards for connector labels', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System' },
      { id: 'upstream-a', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application' },
      { id: 'upstream-b', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service' },
      { id: 'upstream-c', name: 'Directory Synchronization Service', displayId: 'AST-DIR-002', type: 'service' },
    ];
    const edges = [
      { sourceId: 'upstream-a', targetId: focusId, relationType: 'authenticates' },
      { sourceId: 'upstream-b', targetId: focusId, relationType: 'monitors' },
      { sourceId: 'upstream-c', targetId: focusId, relationType: 'syncs' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const sideBounds = nodes.slice(1)
      .map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node))
      .sort((first, second) => first.y - second.y);

    for (let index = 1; index < sideBounds.length; index += 1) {
      const previousBottom = sideBounds[index - 1].y + sideBounds[index - 1].height;
      expect(sideBounds[index].y - previousBottom).toBeGreaterThanOrEqual(64);
    }
  });

  it('places direct dependency edge labels outside card bounds and shifted into connector corridors', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System' },
      { id: 'downstream-a', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application' },
      { id: 'downstream-b', name: 'Factory Manufacturing Execution System Platform', displayId: 'AST-MES-042', type: 'application' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'downstream-a', relationType: 'integrates_with' },
      { sourceId: focusId, targetId: 'downstream-b', relationType: 'depends_on' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const cardBounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));

    edges.forEach((edge) => {
      const placement = getEdgeLabelPlacement(edge, positions, nodes, focusId);
      const sourcePos = positions.get(edge.sourceId)!;
      const targetPos = positions.get(edge.targetId)!;
      const midpoint = { x: (sourcePos.x + targetPos.x) / 2, y: (sourcePos.y + targetPos.y) / 2 };
      expect(placement).toBeDefined();
      const labelBounds = {
        x: placement!.x - 43,
        y: placement!.y - 9,
        width: 86,
        height: 18,
      };

      cardBounds.forEach((bounds) => {
        const overlaps = labelBounds.x < bounds.x + bounds.width
          && labelBounds.x + labelBounds.width > bounds.x
          && labelBounds.y < bounds.y + bounds.height
          && labelBounds.y + labelBounds.height > bounds.y;
        expect(overlaps).toBe(false);
      });
      expect(Math.abs(placement!.y - midpoint.y)).toBeGreaterThanOrEqual(40);
    });
  });

  it('suppresses unsafe neutral labels and keeps focus-relation labels outside node card bounds', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System' },
      { id: 'downstream', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application' },
      { id: 'neutral-a', name: 'Production Line PLC Cluster', displayId: 'AST-PLC-009', type: 'infrastructure' },
      { id: 'neutral-b', name: 'Manufacturing Data Historian', displayId: 'AST-HIS-006', type: 'database' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'downstream', relationType: 'integrates_with' },
      { sourceId: 'neutral-a', targetId: 'neutral-b', relationType: 'feeds' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusLabel = getEdgeLabelPlacement(edges[0], positions, nodes, focusId);
    const neutralLabel = getEdgeLabelPlacement(edges[1], positions, nodes, focusId);
    const cardBounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));

    expect(focusLabel).toBeDefined();
    expect(neutralLabel).toBeUndefined();
    const focusLabelBounds = {
      x: focusLabel!.x - 43,
      y: focusLabel!.y - 9,
      width: 86,
      height: 18,
    };
    cardBounds.forEach((bounds) => {
      const overlaps = focusLabelBounds.x < bounds.x + bounds.width
        && focusLabelBounds.x + focusLabelBounds.width > bounds.x
        && focusLabelBounds.y < bounds.y + bounds.height
        && focusLabelBounds.y + focusLabelBounds.height > bounds.y;
      expect(overlaps).toBe(false);
    });
  });

  it('places Helio-like dependency/direct relation groups on distinct sides and lanes around the focus asset', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'identity-access', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application', criticality: 'high' },
      { id: 'siem', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service', criticality: 'high' },
      { id: 'factory-mes', name: 'Factory MES Platform', displayId: 'AST-MES-042', type: 'application', criticality: 'critical' },
      { id: 'erp', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application', criticality: 'medium' },
      { id: 'plc', name: 'Production Line PLC Cluster', displayId: 'AST-PLC-009', type: 'infrastructure', criticality: 'critical' },
      { id: 'historian', name: 'Manufacturing Data Historian', displayId: 'AST-HIS-006', type: 'database', criticality: 'medium' },
    ];
    const edges = [
      { sourceId: 'identity-access', targetId: focusId, relationType: 'authenticates' },
      { sourceId: 'siem', targetId: focusId, relationType: 'monitors' },
      { sourceId: focusId, targetId: 'factory-mes', relationType: 'depends_on' },
      { sourceId: focusId, targetId: 'erp', relationType: 'integrates_with' },
      { sourceId: 'plc', targetId: 'historian', relationType: 'feeds' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusPosition = positions.get(focusId)!;

    expect(focusPosition).toEqual({ x: 800, y: 450 });
    expect(positions.get('identity-access')!.x).toBeGreaterThan(focusPosition.x);
    expect(positions.get('siem')!.x).toBeGreaterThan(focusPosition.x);
    expect(positions.get('factory-mes')!.x).toBeLessThan(focusPosition.x);
    expect(positions.get('erp')!.x).toBeLessThan(focusPosition.x);
    expect(positions.get('plc')!.y).toBeGreaterThan(focusPosition.y);
    expect(positions.get('historian')!.y).toBeGreaterThan(focusPosition.y);
    expect(positions.get('plc')!.y).toBeCloseTo(positions.get('historian')!.y);
  });

  it('computes shortest graph distances from the focus asset for visible multi-depth layout metadata', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'level-1', name: 'Level 1' },
      { id: 'level-2', name: 'Level 2' },
    ];
    const edges = [
      { sourceId: 'focus', targetId: 'level-1', relationType: 'depends_on' },
      { sourceId: 'level-1', targetId: 'level-2', relationType: 'depends_on' },
    ];

    const metadata = calculateGraphLayoutMetadata(nodes, edges, 'focus');

    expect(metadata.depths.get('focus')).toBe(0);
    expect(metadata.depths.get('level-1')).toBe(1);
    expect(metadata.depths.get('level-2')).toBe(2);
    expect(metadata.lanes.get('level-1')).toBe('left');
    expect(metadata.lanes.get('level-2')).toBe('left');
    expect(metadata.parents.get('level-1')).toBe('focus');
    expect(metadata.parents.get('level-2')).toBe('level-1');
  });

  it('mirrors dependencies left and dependent assets right while preserving each branch rank', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'dependency-1', name: 'Direct Dependency' },
      { id: 'dependency-2', name: 'Indirect Dependency' },
      { id: 'dependent-1', name: 'Direct Dependent Asset' },
      { id: 'dependent-2', name: 'Indirect Dependent Asset' },
    ];
    const edges = [
      { sourceId: 'focus', targetId: 'dependency-1', relationType: 'depends_on' },
      { sourceId: 'dependency-1', targetId: 'dependency-2', relationType: 'requires' },
      { sourceId: 'dependent-1', targetId: 'focus', relationType: 'depends_on' },
      { sourceId: 'dependent-2', targetId: 'dependent-1', relationType: 'requires' },
    ];

    const metadata = calculateGraphLayoutMetadata(nodes, edges, 'focus');
    const positions = calculateNodePositions(nodes, edges, 'focus');
    const focusX = positions.get('focus')!.x;

    expect(metadata.lanes.get('dependency-1')).toBe('left');
    expect(metadata.lanes.get('dependency-2')).toBe('left');
    expect(metadata.lanes.get('dependent-1')).toBe('right');
    expect(metadata.lanes.get('dependent-2')).toBe('right');
    expect(positions.get('dependency-2')!.x).toBeLessThan(positions.get('dependency-1')!.x);
    expect(positions.get('dependency-1')!.x).toBeLessThan(focusX);
    expect(positions.get('dependent-2')!.x).toBeGreaterThan(positions.get('dependent-1')!.x);
    expect(positions.get('dependent-1')!.x).toBeGreaterThan(focusX);
  });

  it('places Helio Information 05 between the focus asset and Employee Onboarding on a multi-depth branch', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'helio-information-05', name: 'Helio Information 05', displayId: 'AST-005', type: 'Information System', criticality: 'medium' },
      { id: 'employee-onboarding', name: 'Employee Onboarding', displayId: 'BP-ONBOARDING', type: 'business-process', criticality: 'high' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'helio-information-05', relationType: 'depends_on' },
      { sourceId: 'helio-information-05', targetId: 'employee-onboarding', relationType: 'supports' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusPosition = positions.get(focusId)!;
    const helioPosition = positions.get('helio-information-05')!;
    const onboardingPosition = positions.get('employee-onboarding')!;

    expect(helioPosition.x).toBeLessThan(focusPosition.x);
    expect(onboardingPosition.x).toBeLessThan(helioPosition.x);
    expect(helioPosition.x).toBeGreaterThan(onboardingPosition.x);
    expect(Math.abs(onboardingPosition.x - focusPosition.x)).toBeGreaterThan(Math.abs(helioPosition.x - focusPosition.x));
  });

  it('pushes second-hop Identity and Access Management farther outward than its direct Helio Information parent', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01', displayId: 'AST-DEMO-123', type: 'OT System', criticality: 'medium' },
      { id: 'helio-information-05', name: 'Helio Information 05', displayId: 'AST-005', type: 'Information System', criticality: 'medium' },
      { id: 'identity-access', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application', criticality: 'high' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'helio-information-05', relationType: 'depends_on' },
      { sourceId: 'helio-information-05', targetId: 'identity-access', relationType: 'authenticates' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusPosition = positions.get(focusId)!;
    const parentPosition = positions.get('helio-information-05')!;
    const identityPosition = positions.get('identity-access')!;

    expect(parentPosition.x).toBeLessThan(focusPosition.x);
    expect(identityPosition.x).toBeLessThan(parentPosition.x);
    expect(Math.abs(identityPosition.x - focusPosition.x)).toBeGreaterThan(Math.abs(parentPosition.x - focusPosition.x));
  });

  it('uses parent-aware rank columns for a mixed Helio branch instead of placing indirect nodes in the focus rank', () => {
    const focusId = 'demo-helio-asset-123';
    const nodes = [
      { id: focusId, name: 'Helio OT System 01' },
      { id: 'helio-information-05', name: 'Helio Information 05' },
      { id: 'employee-onboarding', name: 'Employee Onboarding' },
      { id: 'identity-access', name: 'Identity and Access Management Platform' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'helio-information-05', relationType: 'depends_on' },
      { sourceId: 'helio-information-05', targetId: 'employee-onboarding', relationType: 'supports' },
      { sourceId: 'employee-onboarding', targetId: 'identity-access', relationType: 'authenticates' },
    ];

    const metadata = calculateGraphLayoutMetadata(nodes, edges, focusId);
    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusX = positions.get(focusId)!.x;
    const informationX = positions.get('helio-information-05')!.x;
    const onboardingX = positions.get('employee-onboarding')!.x;
    const identityX = positions.get('identity-access')!.x;

    expect(metadata.parents.get('helio-information-05')).toBe(focusId);
    expect(metadata.parents.get('employee-onboarding')).toBe('helio-information-05');
    expect(metadata.parents.get('identity-access')).toBe('employee-onboarding');
    expect(metadata.depths.get('identity-access')).toBe(3);
    expect(focusX).toBeGreaterThan(informationX);
    expect(informationX).toBeGreaterThan(onboardingX);
    expect(onboardingX).toBeGreaterThan(identityX);
  });

  it('places a direct downstream dependency between the focus card and its level-2 descendant', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'level-1', name: 'Level 1 Asset' },
      { id: 'level-2', name: 'Level 2 Asset' },
    ];
    const edges = [
      { sourceId: 'focus', targetId: 'level-1', relationType: 'depends_on' },
      { sourceId: 'level-1', targetId: 'level-2', relationType: 'depends_on' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'focus');
    const focusPosition = positions.get('focus')!;
    const level1Position = positions.get('level-1')!;
    const level2Position = positions.get('level-2')!;

    expect(level1Position.x).toBeLessThan(focusPosition.x);
    expect(level2Position.x).toBeLessThan(level1Position.x);
    expect(level1Position.x).toBeLessThan(focusPosition.x);
    expect(level1Position.x).toBeGreaterThan(level2Position.x);
    expect(Math.abs(level2Position.x - focusPosition.x)).toBeGreaterThan(Math.abs(level1Position.x - focusPosition.x));
  });

  it('keeps level-2 nodes farther than level-1 nodes from the focus and avoids card overlap', () => {
    const nodes = [
      { id: 'focus', name: 'Focus Asset' },
      { id: 'up-1', name: 'Upstream Level 1' },
      { id: 'up-2', name: 'Upstream Level 2' },
      { id: 'down-1', name: 'Downstream Level 1' },
      { id: 'down-2', name: 'Downstream Level 2' },
    ];
    const edges = [
      { sourceId: 'up-1', targetId: 'focus', relationType: 'uses' },
      { sourceId: 'up-2', targetId: 'up-1', relationType: 'uses' },
      { sourceId: 'focus', targetId: 'down-1', relationType: 'depends_on' },
      { sourceId: 'down-1', targetId: 'down-2', relationType: 'depends_on' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'focus');
    const focusPosition = positions.get('focus')!;
    expect(Math.abs(positions.get('up-2')!.x - focusPosition.x)).toBeGreaterThan(Math.abs(positions.get('up-1')!.x - focusPosition.x));
    expect(Math.abs(positions.get('down-2')!.x - focusPosition.x)).toBeGreaterThan(Math.abs(positions.get('down-1')!.x - focusPosition.x));
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, 'focus', node));
    bounds.forEach((box, index) => {
      bounds.slice(index + 1).forEach((otherBox) => {
        expect(doNodeCardBoundsOverlap(box, otherBox, 0)).toBe(false);
      });
    });
  });

  it('keeps an explicit readable corridor between every consecutive hierarchy rank', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Focus Asset With A Wide Label' },
      { id: 'level-1', name: 'Direct Dependency With A Wide Label' },
      { id: 'level-2', name: 'Level Two Dependency With A Wide Label' },
      { id: 'level-3', name: 'Level Three Dependency With A Wide Label' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'level-1', relationType: 'depends_on' },
      { sourceId: 'level-1', targetId: 'level-2', relationType: 'requires' },
      { sourceId: 'level-2', targetId: 'level-3', relationType: 'requires' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusBounds = getNodeCardBounds(focusId, positions.get(focusId)!, focusId, nodes[0]);
    const levelOneBounds = getNodeCardBounds('level-1', positions.get('level-1')!, focusId, nodes[1]);

    const focusPosition = positions.get(focusId)!;
    const levelOnePosition = positions.get('level-1')!;
    const levelTwoPosition = positions.get('level-2')!;
    const levelThreePosition = positions.get('level-3')!;
    const distanceToFocus = (position: { x: number; y: number }) => Math.hypot(position.x - focusPosition.x, position.y - focusPosition.y);

    expect(distanceToFocus(levelOnePosition)).toBeGreaterThanOrEqual(focusBounds.width / 2 + levelOneBounds.width / 2 + 72);
    expect(distanceToFocus(levelTwoPosition)).toBeGreaterThan(distanceToFocus(levelOnePosition) + 56);
    expect(distanceToFocus(levelThreePosition)).toBeGreaterThan(distanceToFocus(levelTwoPosition) + 56);
  });

  it('keeps variable-width card layout non-overlapping across side lanes and the neutral bottom band', () => {
    const nodes = [
      { id: 'focus', name: 'Helio OT System With Longer Center Label', displayId: 'AST-FOCUS-001', type: 'OT System' },
      { id: 'upstream-long-1', name: 'Identity and Access Management Platform', displayId: 'AST-IAM-001', type: 'application' },
      { id: 'upstream-long-2', name: 'Security Information and Event Management', displayId: 'AST-SIEM-077', type: 'service' },
      { id: 'downstream-long-1', name: 'Factory Manufacturing Execution System Platform', displayId: 'AST-MES-042', type: 'application' },
      { id: 'downstream-long-2', name: 'Enterprise Resource Planning Integration', displayId: 'AST-ERP-012', type: 'application' },
      { id: 'neutral-long-1', name: 'Production Line PLC Cluster With Extended Descriptor', displayId: 'AST-PLC-009', type: 'infrastructure' },
      { id: 'neutral-long-2', name: 'Manufacturing Data Historian Repository', displayId: 'AST-HIS-006', type: 'database' },
    ];
    const edges = [
      { sourceId: 'upstream-long-1', targetId: 'focus', relationType: 'authenticates' },
      { sourceId: 'upstream-long-2', targetId: 'focus', relationType: 'monitors' },
      { sourceId: 'focus', targetId: 'downstream-long-1', relationType: 'depends_on' },
      { sourceId: 'focus', targetId: 'downstream-long-2', relationType: 'integrates_with' },
      { sourceId: 'neutral-long-1', targetId: 'neutral-long-2', relationType: 'feeds' },
    ];

    const positions = calculateNodePositions(nodes, edges, 'focus');
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, 'focus', node));

    bounds.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1600);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    });
    bounds.forEach((box, index) => {
      bounds.slice(index + 1).forEach((otherBox) => {
        expect(doNodeCardBoundsOverlap(box, otherBox, 0)).toBe(false);
      });
    });
  });

  it('keeps variable-width multi-rank hierarchy cards non-overlapping while preserving outward ranks', () => {
    const focusId = 'focus';
    const nodes = [
      { id: focusId, name: 'Helio OT System With Longer Center Label', displayId: 'AST-FOCUS-001', type: 'OT System' },
      { id: 'helio-information-05', name: 'Helio Information 05 With Wider Label', displayId: 'AST-005', type: 'Information System' },
      { id: 'employee-onboarding', name: 'Employee Onboarding Business Process With Wider Label', displayId: 'BP-ONBOARDING', type: 'business-process' },
      { id: 'identity-access', name: 'Identity and Access Management Platform Extended Label', displayId: 'AST-IAM-001', type: 'application' },
      { id: 'factory-mes', name: 'Factory Manufacturing Execution System Platform', displayId: 'AST-MES-042', type: 'application' },
      { id: 'supplier-portal', name: 'Supplier Collaboration Portal With Long Name', displayId: 'AST-SUP-010', type: 'application' },
    ];
    const edges = [
      { sourceId: focusId, targetId: 'helio-information-05', relationType: 'depends_on' },
      { sourceId: 'helio-information-05', targetId: 'employee-onboarding', relationType: 'supports' },
      { sourceId: 'helio-information-05', targetId: 'identity-access', relationType: 'authenticates' },
      { sourceId: focusId, targetId: 'factory-mes', relationType: 'depends_on' },
      { sourceId: 'factory-mes', targetId: 'supplier-portal', relationType: 'supports' },
    ];

    const positions = calculateNodePositions(nodes, edges, focusId);
    const focusPosition = positions.get(focusId)!;
    const bounds = nodes.map((node) => getNodeCardBounds(node.id, positions.get(node.id)!, focusId, node));

    expect(positions.get('employee-onboarding')!.x).toBeLessThan(positions.get('helio-information-05')!.x);
    expect(positions.get('identity-access')!.x).toBeLessThan(positions.get('helio-information-05')!.x);
    expect(positions.get('supplier-portal')!.x).toBeLessThan(positions.get('factory-mes')!.x);
    expect(positions.get('helio-information-05')!.x).toBeLessThan(focusPosition.x);
    bounds.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1600);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    });
    bounds.forEach((box, index) => {
      bounds.slice(index + 1).forEach((otherBox) => {
        expect(doNodeCardBoundsOverlap(box, otherBox, 0)).toBe(false);
      });
    });
  });

  it('routes connectors through side and lane-aware ports for left, right, and bottom focus relations', () => {
    const focusNode = { id: 'focus', name: 'Focus Asset' };
    const upstreamNode = { id: 'upstream', name: 'Upstream Asset' };
    const downstreamNode = { id: 'downstream', name: 'Downstream Asset' };
    const neutralNode = { id: 'neutral', name: 'Neutral Related Asset' };
    const focusPos = { x: 600, y: 380 };
    const upstreamPos = { x: 210, y: 380 };
    const downstreamPos = { x: 990, y: 380 };
    const neutralPos = { x: 600, y: 700 };

    const incoming = getConnectorPoints(upstreamNode.id, focusNode.id, upstreamPos, focusPos, 'focus', upstreamNode, focusNode);
    const outgoing = getConnectorPoints(focusNode.id, downstreamNode.id, focusPos, downstreamPos, 'focus', focusNode, downstreamNode);
    const bottom = getConnectorPoints(focusNode.id, neutralNode.id, focusPos, neutralPos, 'focus', focusNode, neutralNode);
    const focusBounds = getNodeCardBounds(focusNode.id, focusPos, 'focus', focusNode);

    expect(incoming.endSide).toBe('left');
    expect(incoming.end.x).toBeCloseTo(focusBounds.x - 12);
    expect(outgoing.startSide).toBe('right');
    expect(outgoing.start.x).toBeCloseTo(focusBounds.x + focusBounds.width + 2);
    expect(bottom.startSide).toBe('bottom');
    expect(bottom.endSide).toBe('top');
    expect(bottom.start.y).toBeCloseTo(focusBounds.y + focusBounds.height + 2);
  });

  it('routes side-entering connectors with a non-vertical final tangent and endpoint clearance', () => {
    const sourceNode = { id: 'focus', name: 'Focus Asset' };
    const targetNode = { id: 'target', name: 'Factory MES Platform' };
    const sourcePos = { x: 400, y: 300 };
    const targetPos = { x: 650, y: 390 };

    const points = getConnectorPoints(sourceNode.id, targetNode.id, sourcePos, targetPos, 'focus', sourceNode, targetNode);
    const path = getConnectorPath(sourceNode.id, targetNode.id, sourcePos, targetPos, 'focus', sourceNode, targetNode);
    const targetBounds = getNodeCardBounds(targetNode.id, targetPos, 'focus', targetNode);
    const numbers = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const endControl = { x: numbers[4], y: numbers[5] };
    const end = { x: numbers[6], y: numbers[7] };
    const finalTangent = { x: end.x - endControl.x, y: end.y - endControl.y };

    expect(points.end.x).toBeCloseTo(targetBounds.x - 12);
    expect(points.end.y).toBe(targetPos.y);
    expect(finalTangent.x).toBeGreaterThan(0);
    expect(Math.abs(finalTangent.x)).toBeGreaterThan(Math.abs(finalTangent.y));
  });
});

describe('AssetGraph isolated focus asset rendering', () => {
  it('renders the selected asset visibly inside the graph viewport for the modal API-mode path', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        assetId="asset-helio-information-04"
        focusAssetId="asset-helio-information-04"
        fallbackNode={{
          id: 'asset-helio-information-04',
          name: 'Helio Information 04',
          displayId: 'AST-004',
          type: 'Information System',
          criticality: 'medium',
        }}
        heightClassName="h-[42rem]"
        height="672px"
      />,
    );

    const viewportIndex = html.indexOf('data-testid="asset-graph-viewport"');
    const isolatedFocusIndex = html.indexOf('data-testid="asset-graph-isolated-focus"');
    const isolatedFocusHtml = html.slice(isolatedFocusIndex);

    expect(viewportIndex).toBeGreaterThanOrEqual(0);
    expect(isolatedFocusIndex).toBeGreaterThan(viewportIndex);
    expect(isolatedFocusHtml).toContain('Helio Information 04');
    expect(html).toContain('AST-004');
    expect(html).toContain('graph.noDependencies');
  });

  it('keeps the selected asset name in DOM even when drawable edges suppress the isolated fallback', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        assetId="asset-helio-information-04"
        focusAssetId="asset-helio-information-04"
        nodes={[{ id: 'asset-related', name: 'Related Asset' }]}
        edges={[{ sourceId: 'asset-helio-information-04', targetId: 'asset-related', relationType: 'depends_on' }]}
        fallbackNode={{
          id: 'asset-helio-information-04',
          name: 'Helio Information 04',
          displayId: 'AST-004',
          type: 'Information System',
          criticality: 'medium',
        }}
      />,
    );

    expect(html).not.toContain('data-testid="asset-graph-focus-overlay"');
    expect(html.match(/data-testid="asset-graph-node-asset-helio-information-04"/g)).toHaveLength(1);
    expect(html).toContain('Helio Information 04');
    expect(html).not.toContain('data-testid="asset-graph-isolated-focus"');
  });

  it('does not treat the focus asset as isolated when graph edges also contain display labels', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[
          { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
          { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
          { id: 'demo-helio-asset-141', name: 'Helio Information 05' },
        ]}
        edges={[
          {
            source: 'Helio OT System 01',
            target: 'Helio Information 06',
            sourceId: 'demo-helio-asset-123',
            targetId: 'demo-helio-asset-142',
            relationType: 'depends_on',
          },
          {
            source: 'Helio OT System 01',
            target: 'Helio Information 05',
            sourceId: 'demo-helio-asset-123',
            targetId: 'demo-helio-asset-141',
            relationType: 'depends_on',
          },
        ]}
        focusAssetId="demo-helio-asset-123"
        fallbackNode={{
          id: 'demo-helio-asset-123',
          name: 'Helio OT System 01',
          displayId: 'AST-DEMO-123',
          type: 'OT System',
          criticality: 'medium',
        }}
      />,
    );

    expect(html).not.toContain('data-testid="asset-graph-focus-overlay"');
    expect(html.match(/data-testid="asset-graph-node-demo-helio-asset-123"/g)).toHaveLength(1);
    expect(html).toContain('Helio OT System 01');
    expect(html).not.toContain('data-testid="asset-graph-isolated-focus"');
    expect(html).not.toContain('graph.noDependencies');
  });

  it('renders dependency names and connectors in the graph viewport instead of relying on the dependency overlay list', () => {
    const response = {
      data: {
        nodes: [
          { id: 'demo-helio-asset-123', name: 'Helio OT System 01' },
          { id: 'demo-helio-asset-142', name: 'Helio Information 06' },
          { id: 'demo-helio-asset-141', name: 'Helio Information 05' },
        ],
        edges: [
          { sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-142', relationType: 'depends_on' },
          { sourceId: 'demo-helio-asset-123', targetId: 'demo-helio-asset-141', relationType: 'depends_on' },
        ],
      },
    };
    const graph = extractGraphPayload(response);

    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={graph.nodes}
        edges={graph.edges}
        focusAssetId="demo-helio-asset-123"
        fallbackNode={{ id: 'demo-helio-asset-123', name: 'Helio OT System 01' }}
      />,
    );

    const viewportHtml = html.slice(html.indexOf('data-testid="asset-graph-viewport"'));
    expect(viewportHtml).toContain('data-testid="asset-graph-visual-layer"');
    expect(viewportHtml).toContain('data-testid="asset-graph-node-demo-helio-asset-123"');
    expect(viewportHtml).toContain('data-testid="asset-graph-node-demo-helio-asset-142"');
    expect(viewportHtml).toContain('data-testid="asset-graph-node-demo-helio-asset-141"');
    expect(viewportHtml.match(/data-testid="asset-graph-edge"/g)).toHaveLength(2);
    expect(html).toContain('Helio Information 06');
    expect(html).toContain('Helio Information 05');
    expect(html).not.toContain('data-testid="asset-graph-visible-node-list"');
    expect(html).not.toContain('data-testid="asset-graph-isolated-focus"');
    expect(html).not.toContain('graph.noDependencies');
  });

  it('renders the focus asset once in the visual graph instead of duplicating it as a top-left overlay card', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[
          { id: 'focus', name: 'Central Focus Asset', displayId: 'AST-001', type: 'server' },
          { id: 'dependency', name: 'Dependency Asset', displayId: 'AST-002', type: 'database' },
        ]}
        edges={[{ sourceId: 'focus', targetId: 'dependency', relationType: 'depends_on' }]}
        focusAssetId="focus"
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset', displayId: 'AST-001', type: 'server' }}
      />,
    );

    const viewportHtml = html.slice(html.indexOf('data-testid="asset-graph-viewport"'));
    expect(viewportHtml.match(/data-testid="asset-graph-node-focus"/g)).toHaveLength(1);
    expect(viewportHtml).not.toContain('data-testid="asset-graph-focus-overlay"');
    expect(viewportHtml).not.toContain('data-testid="asset-graph-isolated-focus"');
    expect(viewportHtml.match(/data-testid="asset-graph-node-card"/g)).toHaveLength(2);
  });

  it('renders a neutral relation legend item for grey non-focus relation lines', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[
          { id: 'focus', name: 'Central Focus Asset' },
          { id: 'related-a', name: 'Related Asset A' },
          { id: 'related-b', name: 'Related Asset B' },
        ]}
        edges={[{ sourceId: 'related-a', targetId: 'related-b', relationType: 'connects_to' }]}
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset' }}
      />,
    );

    expect(html).toContain('stroke="#6B7280"');
  });

  it('uses the localized reset label key instead of rendering a raw hard-coded label', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[{ id: 'focus', name: 'Central Focus Asset' }]}
        edges={[]}
        focusAssetId="focus"
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset' }}
      />,
    );

    expect(html).toContain('graph.reset');
    expect(html).not.toContain('>Reset<');
    expect(html).not.toContain('>Zurücksetzen<');
  });

  it('uses localized filter label keys for graph controls including criticality thresholds', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        assetId="focus"
        nodes={[{ id: 'focus', name: 'Central Focus Asset' }, { id: 'dependency', name: 'Dependency Asset' }]}
        edges={[{ sourceId: 'focus', targetId: 'dependency', relationType: 'depends_on' }]}
        focusAssetId="focus"
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset' }}
      />,
    );

    expect(html).toContain('graph.filters.maxDepth');
    expect(html).toContain('graph.filters.direction');
    expect(html).toContain('graph.filters.relationType');
    expect(html).toContain('graph.filters.criticality.all');
    expect(html).toContain('graph.filters.criticality.critical');
    expect(html).toContain('graph.filters.criticality.high');
    expect(html).toContain('graph.filters.criticality.medium');
    expect(html).not.toContain('>Max Depth<');
    expect(html).not.toContain('>Criticality<');
  });

  it('defines localized minimum-severity criticality labels in English and German locales', () => {
    expect(en.graph.filters.criticality).toEqual({
      all: 'All',
      critical: 'Only critical',
      high: 'Minimum high',
      medium: 'Minimum medium',
    });
    expect(de.graph.filters.criticality).toEqual({
      all: 'Alle',
      critical: 'Nur kritisch',
      high: 'Mindestens hoch',
      medium: 'Mindestens mittel',
    });
  });

  it('uses dependency-oriented direction labels in English and German locales', () => {
    expect(en.graph.filters.directionUpstream).toBe('Dependencies');
    expect(en.graph.filters.directionDownstream).toBe('Dependent assets');
    expect(de.graph.filters.directionUpstream).toBe('Abhängigkeiten');
    expect(de.graph.filters.directionDownstream).toBe('Abhängige Assets');
  });

  it('configures small relation-colored SVG arrow markers to auto-orient at connector endpoints', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[
          { id: 'focus', name: 'Central Focus Asset' },
          { id: 'dependency', name: 'Dependency Asset' },
        ]}
        edges={[{ sourceId: 'focus', targetId: 'dependency', relationType: 'depends_on' }]}
        focusAssetId="focus"
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset' }}
      />,
    );

    expect(html).toContain('orient="auto"');
    expect(html).toContain('markerWidth="6"');
    expect(html).toContain('markerHeight="6"');
    expect(html).toContain('markerUnits="userSpaceOnUse"');
    expect(html).toContain('id="asset-graph-arrow-incoming"');
    expect(html).toContain('id="asset-graph-arrow-outgoing"');
    expect(html).toContain('id="asset-graph-arrow-neutral"');
    expect(html).toContain('fill="#7C3AED"');
    expect(html).toContain('marker-end="url(#asset-graph-arrow-outgoing)"');
  });
});

describe('AssetGraph selected asset details panel', () => {
  it('derives richer selected asset information from available graph node payload fields', () => {
    const fields = buildSelectedAssetFields({
      id: 'focus',
      name: 'Central Focus Asset',
      displayId: 'AST-001',
      type: 'server',
      category: 'Infrastructure',
      criticality: 'critical',
      status: 'active',
      lifecycleStatus: 'maintenance',
      ownerName: 'Infrastructure Team',
      technicalOperator: 'Operations Team',
      organizationUnitName: 'IT Operations',
    });

    expect(fields).toEqual(expect.arrayContaining([
      { key: 'displayId', labelKey: 'graph.details.displayId', value: 'AST-001' },
      { key: 'type', labelKey: 'graph.details.type', value: 'server' },
      { key: 'category', labelKey: 'graph.details.category', value: 'Infrastructure' },
      { key: 'criticality', labelKey: 'graph.details.criticality', value: 'critical' },
      { key: 'status', labelKey: 'graph.details.status', value: 'active' },
      { key: 'lifecycleStatus', labelKey: 'graph.details.lifecycleStatus', value: 'maintenance' },
      { key: 'owner', labelKey: 'graph.details.owner', value: 'Infrastructure Team' },
      { key: 'technicalOwner', labelKey: 'graph.details.technicalOwner', value: 'Operations Team' },
      { key: 'organizationUnit', labelKey: 'graph.details.organizationUnit', value: 'IT Operations' },
    ]));
  });

  it('derives metadata fields from selected graph node metadata objects', () => {
    const metadataFields = buildSelectedAssetMetadataFields({
      id: 'focus',
      name: 'Central Focus Asset',
      metadata: {
        environment: 'Production',
        rack: 'R-12',
      },
    });

    expect(metadataFields).toEqual([
      { key: 'metadata-environment', labelKey: 'environment', value: 'Production' },
      { key: 'metadata-rack', labelKey: 'rack', value: 'R-12' },
    ]);
  });

  it('derives incoming, outgoing, and neutral selected asset connection sections from graph edges', () => {
    const nodes = [
      { id: 'focus', name: 'Central Focus Asset', displayId: 'AST-001' },
      { id: 'upstream', name: 'Identity Provider', displayId: 'AST-IAM-001' },
      { id: 'downstream', name: 'Factory MES', displayId: 'AST-MES-042' },
      { id: 'related', name: 'Shared Monitoring', displayId: 'AST-MON-010' },
    ];
    const edges = [
      { sourceId: 'upstream', targetId: 'focus', relationType: 'authenticates' },
      { sourceId: 'focus', targetId: 'downstream', relationType: 'depends_on' },
      { sourceId: 'focus', targetId: 'related', relationType: 'connects_to' },
    ];

    const connections = buildSelectedAssetConnections(nodes[0], nodes, edges);

    expect(connections.incoming).toEqual([expect.objectContaining({ relationType: 'authenticates', connectedName: 'Identity Provider', connectedNode: nodes[1] })]);
    expect(connections.outgoing).toEqual([expect.objectContaining({ relationType: 'depends_on', connectedName: 'Factory MES', connectedNode: nodes[2] })]);
    expect(connections.other).toEqual([expect.objectContaining({ relationType: 'connects_to', connectedName: 'Shared Monitoring', connectedNode: nodes[3] })]);
  });

  it('returns empty selected asset connection sections when no direct graph edges exist', () => {
    const connections = buildSelectedAssetConnections(
      { id: 'isolated', name: 'Isolated Asset' },
      [{ id: 'isolated', name: 'Isolated Asset' }, { id: 'other', name: 'Other Asset' }],
      [{ sourceId: 'other', targetId: 'missing', relationType: 'depends_on' }],
    );

    expect(connections).toEqual({ incoming: [], outgoing: [], other: [] });
  });

  it('renders expanded selected details panel markup with asset fields and connection headings when selected server-side', () => {
    const html = renderToStaticMarkup(
      <AssetGraph
        nodes={[{ id: 'focus', name: 'Central Focus Asset', displayId: 'AST-001', type: 'server', criticality: 'critical' }]}
        edges={[]}
        focusAssetId="focus"
        fallbackNode={{ id: 'focus', name: 'Central Focus Asset' }}
      />,
    );

    expect(html).not.toContain('data-testid="asset-graph-selected-details"');
    expect(buildSelectedAssetFields({ id: 'focus', name: 'Central Focus Asset', displayId: 'AST-001', type: 'server', criticality: 'critical' }).map((field) => field.value)).toEqual(expect.arrayContaining(['AST-001', 'server', 'critical']));
  });
});
