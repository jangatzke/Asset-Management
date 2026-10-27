import { useEffect, useState, useMemo } from 'react';
import { aiAdminApi } from '../services/api';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { useI18n } from '../context/I18nContext';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';

interface AiConfig {
  id?: string;
  enabled: boolean;
  baseUrl?: string | null;
  model?: string | null;
  apiKey?: string;
  apiKeyConfigured?: boolean;
  temperature: number;
  maxTokens: number;
  requestTimeoutSeconds: number;
  intervalMinutes: number;
  summarizeTickets: boolean;
  knowledgeDrafts: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastRunStatus?: string | null;
  lastRunMessage?: string | null;
}

interface AiActivity {
  id: string;
  createdAt: string;
  runId: string;
  taskType: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  status: string;
  summary?: string | null;
  errorMessage?: string | null;
  model?: string | null;
  durationMs?: number | null;
}

const defaultConfig: AiConfig = {
  enabled: false,
  temperature: 0.2,
  maxTokens: 1200,
  requestTimeoutSeconds: 60,
  intervalMinutes: 1440,
  summarizeTickets: true,
  knowledgeDrafts: true,
};

export default function AdminAI() {
  const { t } = useI18n();
  const [config, setConfig] = useState<AiConfig>(defaultConfig);
  const [activity, setActivity] = useState<AiActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-ai', defaultSort: { column: 'time', direction: 'desc' } });

  const sortedActivity = useMemo(() => {
    if (!sort.column) return activity;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (entry: AiActivity) => {
      if (sort.column === 'time') return entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
      if (sort.column === 'task') return (entry.taskType ?? '').toLowerCase();
      if (sort.column === 'entity') return (entry.entityLabel ?? '').toLowerCase();
      if (sort.column === 'status') return (entry.status ?? '').toLowerCase();
      return '';
    };
    return [...activity].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [activity, sort]);

  const exportVisibleActivity = () => exportCsv('ai-activity', [
    t('aiAssistant.time'), t('aiAssistant.task'), t('aiAssistant.entity'),
    t('common.status'), t('aiAssistant.summary'), t('aiAssistant.error'),
  ], sortedActivity.map((entry) => [
    entry.createdAt,
    entry.taskType,
    entry.entityLabel ?? '',
    entry.status,
    entry.summary ?? '',
    entry.errorMessage ?? '',
  ]));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial AI config/activity load only; load uses current translation fallback for this mount.
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [configRes, activityRes] = await Promise.all([aiAdminApi.getConfig(), aiAdminApi.activity(100)]);
      setConfig({ ...defaultConfig, ...configRes.data, apiKey: '' });
      setActivity(activityRes.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? t('aiAssistant.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof AiConfig, value: string | number | boolean) => setConfig((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { ...config };
      if (!payload.apiKey) delete payload.apiKey;
      delete payload.apiKeyConfigured;
      const res = await aiAdminApi.updateConfig(payload);
      setConfig({ ...defaultConfig, ...res.data, apiKey: '' });
      setMessage(t('aiAssistant.saved'));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? t('aiAssistant.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await aiAdminApi.testConnection();
      setMessage(t('aiAssistant.testSuccess', { model: res.data.model, latency: res.data.latencyMs }));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? t('aiAssistant.testError'));
    }
  };

  const runNow = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await aiAdminApi.runNow();
      setMessage(t('aiAssistant.runResult', { triage: res.data.triageNotes, drafts: res.data.knowledgeDrafts, skipped: res.data.skipped, failed: res.data.failed }));
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? t('aiAssistant.runError'));
    }
  };

  if (loading) return <div className="p-6 text-gray-700 dark:text-gray-200">{t('aiAssistant.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('aiAssistant.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('aiAssistant.subtitle')}</p>
      </div>

      {message && <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('aiAssistant.connection')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('aiAssistant.secretsWriteOnly')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.baseUrl')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" placeholder="https://api.openai.com/v1" value={config.baseUrl ?? ''} onChange={(e) => update('baseUrl', e.target.value)} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.model')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" placeholder="gpt-4o-mini" value={config.model ?? ''} onChange={(e) => update('model', e.target.value)} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.apiKey')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="password" placeholder={config.apiKeyConfigured ? '********' : ''} value={config.apiKey ?? ''} onChange={(e) => update('apiKey', e.target.value)} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.temperature')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" step="0.1" min={0} max={2} value={config.temperature} onChange={(e) => update('temperature', Number(e.target.value))} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.maxTokens')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={64} max={8000} value={config.maxTokens} onChange={(e) => update('maxTokens', Number(e.target.value))} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.timeoutSeconds')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={5} max={300} value={config.requestTimeoutSeconds} onChange={(e) => update('requestTimeoutSeconds', Number(e.target.value))} />
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('aiAssistant.automation')}</h2>
        <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} />
          {t('aiAssistant.enable')}
        </label>
        <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
          <label><input type="checkbox" checked={config.summarizeTickets} onChange={(e) => update('summarizeTickets', e.target.checked)} /> {t('aiAssistant.taskTriage')}</label>
          <label><input type="checkbox" checked={config.knowledgeDrafts} onChange={(e) => update('knowledgeDrafts', e.target.checked)} /> {t('aiAssistant.taskKnowledge')}</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('aiAssistant.intervalMinutes')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={5} max={10080} value={config.intervalMinutes} onChange={(e) => update('intervalMinutes', Number(e.target.value))} />
          </label>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">{t('aiAssistant.lastRun')}: {config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : t('aiAssistant.never')} · {t('aiAssistant.nextRun')}: {config.nextRunAt ? new Date(config.nextRunAt).toLocaleString() : t('aiAssistant.notScheduled')} · {t('reminders.status')}: {config.lastRunStatus ?? 'n/a'} {config.lastRunMessage ? `(${config.lastRunMessage})` : ''}</div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50">{saving ? t('aiAssistant.saving') : t('aiAssistant.saveSettings')}</button>
        <button onClick={testConnection} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">{t('aiAssistant.testConnection')}</button>
        <button onClick={runNow} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">{t('aiAssistant.runNow')}</button>
      </div>

      <DataTableShell toolbar={<h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('aiAssistant.activityLog')}</h2>} onExport={exportVisibleActivity} exportLabel="Export CSV">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700"><tr><SortableTh column="time" label={t('aiAssistant.time')} activeColumn={sort.column} direction={sort.column === 'time' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="task" label={t('aiAssistant.task')} activeColumn={sort.column} direction={sort.column === 'task' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="entity" label={t('aiAssistant.entity')} activeColumn={sort.column} direction={sort.column === 'entity' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="summary" label={t('aiAssistant.summary')} activeColumn={sort.column} direction={sort.column === 'summary' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="error" label={t('aiAssistant.error')} activeColumn={sort.column} direction={sort.column === 'error' ? sort.direction : ''} onSort={toggleSort} /></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedActivity.map((entry) => <tr key={entry.id} className="text-gray-800 dark:text-gray-100"><td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td><td className="p-2">{entry.taskType}</td><td className="p-2">{entry.entityLabel ?? 'n/a'}</td><td className="p-2">{entry.status}</td><td className="p-2">{entry.summary ?? ''}</td><td className="p-2">{entry.errorMessage ?? ''}</td></tr>)}
              {sortedActivity.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={6}>{t('aiAssistant.noEntries')}</td></tr>}
            </tbody>
          </table>
        </div>
      </DataTableShell>
    </div>
  );
}
