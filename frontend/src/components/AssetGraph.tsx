import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { assetApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { GraphNode, GraphEdge, AssetGraphProps, NODE_TEXT_START_OFFSET, NODE_RIGHT_PADDING, MIN_ZOOM, MAX_ZOOM, GRAPH_VIEWBOX_WIDTH, GRAPH_VIEWBOX_HEIGHT, GRAPH_CENTER, NEUTRAL_EDGE_COLOR, CRITICALITY_COLORS, ensureFocusAssetNode, GraphDirectionFilter, CriticalityThreshold, CRITICALITY_THRESHOLDS, extractGraphPayload, getEdgeSource, getEdgeTarget, createNodeEndpointLookup, resolveEdgeEndpoint, buildVisualEdges, filterGraphForVisibleNodes, getNodeLabel, getNodeMetadata, buildSelectedAssetFields, buildSelectedAssetMetadataFields, buildSelectedAssetConnections, getCardSize, getNodeCardBounds, calculateNodePositions, buildDependencyFallbackGraph, getFillColor, getStrokeColor, getNodeInitials, truncateTextToWidth, truncateNodeLabel, getConnectorPath, getEdgeLabelPlacement } from './AssetGraphUtils';

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
  }, [assetId, maxDepth, direction, relationFilter, focusAssetId, fallbackNode]);

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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t('graph.filters.criticalityFilter')}</label>
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


