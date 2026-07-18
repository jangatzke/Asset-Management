import { useEffect, useState } from 'react';
import { phase6Api } from '../services/api';

const modules = [
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'bias', label: 'BIA' },
  { key: 'bcps', label: 'BCP' },
  { key: 'auditPlans', label: 'Audits' },
  { key: 'correctiveActions', label: 'CAPA' },
  { key: 'trainingAssignments', label: 'Training' },
  { key: 'managementReviews', label: 'Management Reviews' },
  { key: 'metricDefinitions', label: 'KPI/KRI' },
  { key: 'workflowInstances', label: 'Workflows' },
  { key: 'reportRuns', label: 'Reports' },
];

const ISMSPhase6 = () => {
  const [resource, setResource] = useState('suppliers');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    phase6Api.list(resource)
      .then((response) => setRows(response.data.data ?? []))
      .finally(() => setLoading(false));
  }, [resource]);

  const runExport = async (format: 'json' | 'csv') => {
    const response = await phase6Api.export(resource, { format });
    const payload = response.data.payload ?? '';
    const blob = new Blob([payload], { type: response.data.mimeType ?? 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.data.fileName ?? `${resource}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">ISMS Phase 6</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Supplier, BIA/BCP, Audit, CAPA, Training, Reviews, Metrics, Workflows and Reporting.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runExport('json')} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Export JSON</button>
          <button onClick={() => runExport('csv')} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm">Export CSV</button>
          <button onClick={() => phase6Api.runReminders(resource)} className="px-3 py-2 bg-orange-600 text-white rounded-md text-sm">Run reminders</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {modules.map((module) => (
          <button key={module.key} onClick={() => setResource(module.key)} className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${resource === module.key ? 'bg-blue-100 text-blue-700' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
            {module.label}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Loading...</div> : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="text-left p-3">ID</th><th className="text-left p-3">Title/Name</th><th className="text-left p-3">Status</th><th className="text-left p-3">Due/Review</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700"><td className="p-3">{row.displayId ?? row.id}</td><td className="p-3">{row.title ?? row.legalName ?? row.name ?? row.entityType}</td><td className="p-3">{row.status ?? row.breachStatus ?? '-'}</td><td className="p-3">{row.nextReviewDate ?? row.dueDate ?? row.plannedStart ?? '-'}</td></tr>)}
              {rows.length === 0 && <tr><td className="p-6 text-gray-500" colSpan={4}>No records.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ISMSPhase6;
