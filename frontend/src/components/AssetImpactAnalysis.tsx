
import { useState, useEffect } from 'react';
import { assetApi } from '../services/api';
import { useI18n } from '../context/I18nContext';

interface ImpactNode {
  id: string;
  name: string;
  type?: string;
  criticality?: string;
  displayId?: string;
  depth: number;
  impactLevel?: 'critical' | 'high' | 'medium' | 'low';
}

interface ImpactAnalysisData {
  assetId: string;
  assetName: string;
  totalAffected: number;
  criticalPaths: string[];
  singlePointsOfFailure: string[];
  affectedByType: Record<string, number>;
  affectedBySeverity: Record<string, number>;
  tree: ImpactNode[];
}

interface AssetImpactAnalysisProps {
  assetId: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  low: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-red-300 dark:border-red-700',
  high: 'border-orange-300 dark:border-orange-700',
  medium: 'border-yellow-300 dark:border-yellow-700',
  low: 'border-green-300 dark:border-green-700',
};

const AssetImpactAnalysis: React.FC<AssetImpactAnalysisProps> = ({ assetId }) => {
  const { t } = useI18n();
  const [data, setData] = useState<ImpactAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    assetApi.getImpactAnalysis(assetId)
      .then((res) => {
        const result = res.data;
        setData(result as ImpactAnalysisData);
        // Auto-expand first level
        if (result?.tree) {
          const initialExpanded = new Set<string>();
          result.tree.forEach((node: ImpactNode) => {
            if (node.depth <= 1) initialExpanded.add(node.id);
          });
          setExpandedNodes(initialExpanded);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Failed to load impact analysis');
      })
      .finally(() => setLoading(false));
  }, [assetId]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderTree = (nodes: ImpactNode[], depth: number = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = nodes.some(n => n.depth === node.depth + 1 && isChildOf(nodes, n.id, node.id));

      return (
        <div key={node.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-3' : ''}`}>
          <div
            className={`flex items-center gap-2 py-2 px-3 rounded-md mb-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
              SEVERITY_BORDER[node.impactLevel || 'low']
            }`}
            onClick={() => hasChildren && toggleNode(node.id)}
          >
            {hasChildren && (
              <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
            )}
            {!hasChildren && <span className="w-3"></span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_COLORS[node.impactLevel || 'low']}`}>
              {node.impactLevel || 'low'}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{node.name}</span>
            {node.displayId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">({node.displayId})</span>
            )}
            {node.type && (
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{node.type}</span>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>
              {renderTree(
                nodes.filter(n => n.depth === node.depth + 1),
                depth + 1
              )}
            </div>
          )}
        </div>
      );
    });
  };

  // Simple helper - in a real implementation this would track parent-child relationships
  const isChildOf = (_nodes: ImpactNode[], _childId: string, _parentId: string) => {
    return true; // Simplified for display
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Impact Analysis: {data.assetName}
        </h2>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalAffected}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Affected</div>
          </div>
          {Object.entries(data.affectedBySeverity || {}).map(([level, count]) => (
            <div key={level} className={`rounded-lg p-4 text-center ${SEVERITY_COLORS[level]}`}>
              <div className="text-2xl font-bold">{count as number}</div>
              <div className="text-sm capitalize">{level}</div>
            </div>
          ))}
        </div>

        {/* Affected by Type */}
        {Object.keys(data.affectedByType || {}).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Affected by Asset Type</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.affectedByType).map(([type, count]) => (
                <span key={type} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {type}: {count as number}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Critical Paths */}
        {data.criticalPaths?.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">⚠️ Critical Paths</h3>
            <ul className="list-disc list-inside space-y-1">
              {data.criticalPaths.map((path, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{path}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Single Points of Failure */}
        {data.singlePointsOfFailure?.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">🔴 Single Points of Failure</h3>
            <ul className="list-disc list-inside space-y-1">
              {data.singlePointsOfFailure.map((spof, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{spof}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Impact Tree */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cascading Effects</h3>
        {data.tree?.length > 0 ? (
          renderTree(data.tree)
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No downstream dependencies found.
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetImpactAnalysis;
