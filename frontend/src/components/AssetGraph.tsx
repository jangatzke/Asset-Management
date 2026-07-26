import { useState, useRef, useEffect, useCallback } from 'react';
import { assetApi } from '../services/api';
import { useI18n } from '../context/I18nContext';

interface GraphNode {
  id: string;
  name: string;
  type?: string;
  criticality?: string;
  displayId?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relationType?: string;
}

interface AssetGraphProps {
  assetId?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

const NODE_RADIUS = 28;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

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

export const AssetGraph: React.FC<AssetGraphProps> = ({ assetId, nodes: propNodes, edges: propEdges }) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [direction, setDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const [relationFilter, setRelationFilter] = useState<string>('');

  // Internal nodes/edges state for API loading mode
  const [internalNodes, setInternalNodes] = useState<GraphNode[]>(propNodes || []);
  const [internalEdges, setInternalEdges] = useState<GraphEdge[]>(propEdges || []);

  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Load graph data from API when assetId is provided
  useEffect(() => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    assetApi.getGraph(assetId, { maxDepth, direction, relationTypes: relationFilter || undefined })
      .then((res) => {
        const data = res.data;
        setInternalNodes(data?.nodes ?? []);
        setInternalEdges(data?.edges ?? []);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Failed to load graph');
      })
      .finally(() => setLoading(false));
  }, [assetId, maxDepth, direction, relationFilter]);

  const nodes = assetId ? internalNodes : (propNodes || []);
  const edges = assetId ? internalEdges : (propEdges || []);

  // Initialize node positions in a circular layout
  const initializePositions = useCallback(() => {
    if (nodes.length === 0) return;
    const positions = new Map<string, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(300, Math.max(120, nodes.length * 35));

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    nodePositionsRef.current = positions;
  }, [nodes]);

  useEffect(() => {
    initializePositions();
  }, [initializePositions]);

  // Force-directed layout simulation
  const simulateLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const positions = nodePositionsRef.current;
    const k = 120;
    const damping = 0.85;
    const velocity = new Map<string, { x: number; y: number }>();

    nodes.forEach((node) => {
      if (!velocity.has(node.id)) {
        velocity.set(node.id, { x: 0, y: 0 });
      }
    });

    for (let step = 0; step < 60; step++) {
      const forces = new Map<string, { x: number; y: number }>();
      nodes.forEach((node) => forces.set(node.id, { x: 0, y: 0 }));

      // Repulsive forces
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const posA = positions.get(nodes[i].id);
          const posB = positions.get(nodes[j].id);
          if (!posA || !posB) continue;

          let dx = posA.x - posB.x;
          let dy = posA.y - posB.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = (k * k) / dist;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          const forceA = forces.get(nodes[i].id)!;
          const forceB = forces.get(nodes[j].id)!;
          forceA.x += fx; forceA.y += fy;
          forceB.x -= fx; forceB.y -= fy;
        }
      }

      // Attractive forces along edges
      edges.forEach((edge) => {
        const posA = positions.get(edge.source);
        const posB = positions.get(edge.target);
        if (!posA || !posB) return;

        let dx = posA.x - posB.x;
        let dy = posA.y - posB.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = (dist * dist) / k;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const forceA = forces.get(edge.source);
        const forceB = forces.get(edge.target);
        if (forceA) { forceA.x -= fx; forceA.y -= fy; }
        if (forceB) { forceB.x += fx; forceB.y += fy; }
      });

      // Apply forces with damping
      nodes.forEach((node) => {
        const pos = positions.get(node.id);
        const vel = velocity.get(node.id)!;
        const force = forces.get(node.id)!;
        if (!pos) return;

        vel.x = (vel.x + force.x) * damping;
        vel.y = (vel.y + force.y) * damping;
        pos.x += vel.x;
        pos.y += vel.y;
      });
    }
  }, [nodes, edges]);

  useEffect(() => {
    simulateLayout();
  }, [simulateLayout]);

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

    ctx.save();
    ctx.translate(rect.width / 2 + pan.x, rect.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-400, -300);

    const positions = nodePositionsRef.current;
    const isHighlighted = (nodeId: string) => selectedNode?.id === nodeId || hoveredNode === nodeId;
    const isConnectedToHighlight = (nodeId: string) => {
      if (!selectedNode && !hoveredNode) return true;
      const targetId = selectedNode?.id || hoveredNode;
      if (nodeId === targetId) return true;
      return edges.some(
        (e) => (e.source === targetId && e.target === nodeId) || (e.target === targetId && e.source === nodeId)
      );
    };

    // Draw edges
    edges.forEach((edge) => {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      if (!sourcePos || !targetPos) return;

      const connected = isConnectedToHighlight(edge.source) && isConnectedToHighlight(edge.target);
      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.strokeStyle = connected ? '#6B7280' : '#D1D5DB';
      ctx.lineWidth = connected ? 2 : 1;
      ctx.stroke();

      // Draw relation type label
      if (edge.relationType && connected) {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#9CA3AF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.relationType, midX, midY - 8);
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const highlighted = isHighlighted(node.id);
      const connected = isConnectedToHighlight(node.id);

      // Node circle with criticality/type color
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
      if (highlighted) {
        ctx.fillStyle = '#3B82F6';
      } else if (!connected) {
        ctx.fillStyle = '#9CA3AF';
      } else {
        ctx.fillStyle = getFillColor(node);
      }
      ctx.fill();

      ctx.strokeStyle = highlighted ? '#1D4ED8' : getStrokeColor(node);
      ctx.lineWidth = highlighted ? 3 : 2;
      ctx.stroke();

      // Node label - display ID or name
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const displayName = (node.displayId || node.name);
      const truncated = displayName.length > 9 ? displayName.substring(0, 8) + '…' : displayName;
      ctx.fillText(truncated, pos.x, pos.y - 5);

      // Type label below
      if (node.type && connected) {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#E5E7EB';
        ctx.fillText(node.type, pos.x, pos.y + 8);
      }
    });

    ctx.restore();
  }, [nodes, edges, zoom, pan, selectedNode, hoveredNode]);

  useEffect(() => {
    draw();
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

    nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const adjustedX = (rect.width / 2 + pan.x - 400 * zoom + pos.x * zoom);
      const adjustedY = (rect.height / 2 + pan.y - 300 * zoom + pos.y * zoom);

      const dx = mouseX - adjustedX;
      const dy = mouseY - adjustedY;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS * zoom) {
        foundNode = node;
      }
    });

    setSelectedNode(foundNode);
  }, [nodes, isDragging]);

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

    nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const adjustedX = (rect.width / 2 + pan.x - 400 * zoom + pos.x * zoom);
      const adjustedY = (rect.height / 2 + pan.y - 300 * zoom + pos.y * zoom);

      const dx = mouseX - adjustedX;
      const dy = mouseY - adjustedY;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS * zoom) {
        foundNode = node.id;
      }
    });

    setHoveredNode(foundNode);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Collect unique relation types for filter
  const relationTypes = Array.from(new Set(edges.map(e => e.relationType).filter(Boolean))) as string[];

  return (
    <div className="relative" ref={containerRef}>
      {/* Filters */}
      {assetId && (
        <div className="flex flex-wrap gap-3 mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Max Depth</label>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            >
              <option value="both">Both</option>
              <option value="upstream">Upstream</option>
              <option value="downstream">Downstream</option>
            </select>
          </div>
          {relationTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Relation Type</label>
              <select
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              >
                <option value="">All</option>
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
      {!loading && nodes.length > 0 && (
        <>
          <canvas
            ref={canvasRef}
            className="w-full h-96 rounded-lg border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing"
            style={{ width: '100%', height: '384px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onMouseLeave={() => { handleMouseUp(); setHoveredNode(null); }}
            onWheel={handleWheel}
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">+</button>
            <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">-</button>
            <button onClick={resetView} className="bg-white dark:bg-gray-800 px-2 py-1 rounded shadow text-sm hover:bg-gray-50 dark:hover:bg-gray-700">{t('graph.reset')}</button>
          </div>
        </>
      )}

      {/* Node Detail Side Panel */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedNode.name}</h3>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl">×</button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {selectedNode.displayId && (
              <>
                <dt className="text-gray-500 dark:text-gray-400">Display ID</dt>
                <dd className="text-gray-900 dark:text-white">{selectedNode.displayId}</dd>
              </>
            )}
            {selectedNode.type && (
              <>
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-gray-900 dark:text-white capitalize">{selectedNode.type}</dd>
              </>
            )}
            {selectedNode.criticality && (
              <>
                <dt className="text-gray-500 dark:text-gray-400">Criticality</dt>
                <dd className="text-gray-900 dark:text-white capitalize">{selectedNode.criticality}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && nodes.length === 0 && (
        <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
          {assetId ? t('graph.noDependencies') : t('graph.noData')}
        </div>
      )}
    </div>
  );
};

export default AssetGraph;

