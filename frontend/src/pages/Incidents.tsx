import { useState, useEffect } from 'react';
import { incidentApi, nis2Api } from '../services/api';

interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  detectionTime: string;
  knowledgeTime: string;
  isSignificant?: boolean;
  significanceReasons?: string[];
  reports?: Array<{ id: string; reportType: string; status: string; dueAt?: string }>;
  escalations?: Array<{ id: string; reason: string; status: string }>;
}

const Incidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const response = await incidentApi.list();
      setIncidents(response.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const ensureNis2Catalogue = async () => {
    try {
      await nis2Api.ensureMeasuresCatalogue();
      setActionMessage('NIS-2 measures catalogue ensured.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to ensure NIS-2 catalogue');
    }
  };

  const createEarlyWarning = async (incident: Incident) => {
    try {
      await incidentApi.createReport(incident.id, {
        reportType: 'early_warning_24h',
        content: { summary: incident.title, reasons: incident.significanceReasons ?? [] },
        authorId: 'frontend-user',
      });
      setActionMessage(`Draft early warning created for ${incident.title}.`);
      loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create early warning');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'under_investigation':
        return 'bg-yellow-100 text-yellow-800';
      case 'contained':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    const searchLower = search.toLowerCase();
    return (
      incident.title.toLowerCase().includes(searchLower) ||
      incident.description.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading incidents...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Incident Management</h1>
        <button onClick={ensureNis2Catalogue} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Ensure NIS-2 Catalogue
        </button>
      </div>

      {actionMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search incidents..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detection Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NIS-2
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No incidents found
                </td>
              </tr>
            ) : (
              filteredIncidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {incident.title}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                      {incident.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(incident.severity)}`}>
                      {incident.severity?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(incident.detectionTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>{incident.isSignificant ? 'Significant / reportable candidate' : 'Not significant'}</div>
                    <div className="text-xs text-gray-400">Knowledge: {incident.knowledgeTime ? new Date(incident.knowledgeTime).toLocaleString() : '-'}</div>
                    {incident.significanceReasons?.length ? <div className="text-xs text-red-600">{incident.significanceReasons.join(', ')}</div> : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <button onClick={() => createEarlyWarning(incident)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                      24h warning draft
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Incidents;
