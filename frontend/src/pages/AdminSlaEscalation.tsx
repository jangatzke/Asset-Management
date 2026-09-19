import { useEffect, useState, useMemo } from 'react';
import { slaEscalationAdminApi } from '../services/api';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { useI18n } from '../context/I18nContext';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';

interface SlaConfig {
  id?: string;
  enabled: boolean;
  intervalMinutes: number;
  notifyAssignee: boolean;
  notifyManager: boolean;
  notifyEmail: boolean;
  escalationLevels: number[];
  escalationDelayMinutes: number;
  smtpHost?: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string | null;
  smtpPassword?: string;
  smtpRejectUnauthorized: boolean;
  smtpPasswordConfigured?: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastRunStatus?: string | null;
  lastRunMessage?: string | null;
}

interface SlaLog {
  id: string;
  createdAt: string;
  ticketId: string;
  breachType: string;
  level: number;
  escalatedTo?: string | null;
  escalatedToType: string;
  sentVia: string;
  status: string;
  errorMessage?: string | null;
  ticket?: { displayId?: string | null; type?: string | null; title?: string | null; status?: string | null };
}

const defaultConfig: SlaConfig = {
  enabled: false,
  intervalMinutes: 60,
  notifyAssignee: true,
  notifyManager: true,
  notifyEmail: false,
  escalationLevels: [1, 2, 3],
  escalationDelayMinutes: 30,
  smtpPort: 587,
  smtpSecure: false,
  smtpRejectUnauthorized: true,
};

const BREACH_LABELS: Record<string, string> = {
  firstResponse: 'First response',
  resolution: 'Resolution',
};

const SENT_VIA_LABELS: Record<string, string> = {
  'in-app': 'In-app',
  email: 'E-mail',
  none: 'None',
};

export default function AdminSlaEscalation() {
  const { t } = useI18n();
  const [config, setConfig] = useState<SlaConfig>(defaultConfig);
  const [logs, setLogs] = useState<SlaLog[]>([]);
  const [loading, setLoading] = useState(true);

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-sla-escalation', defaultSort: { column: 'time', direction: 'desc' } });

  const sortedLogs = useMemo(() => {
    if (!sort.column) return logs;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (log: SlaLog) => {
      if (sort.column === 'time') return log.createdAt ? new Date(log.createdAt).getTime() : 0;
      if (sort.column === 'ticket') return (log.ticket?.displayId ?? '').toLowerCase();
      if (sort.column === 'breach') return (log.breachType ?? '').toLowerCase();
      if (sort.column === 'level') return log.level;
      if (sort.column === 'via') return (log.sentVia ?? '').toLowerCase();
      if (sort.column === 'status') return (log.status ?? '').toLowerCase();
      if (sort.column === 'error') return (log.errorMessage ?? '').toLowerCase();
      return '';
    };
    return [...logs].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [logs, sort]);

  const exportVisibleLogs = () => exportCsv('sla-escalation-log', [
    t('slaEscalation.time'), t('slaEscalation.ticket'), t('slaEscalation.breach'),
    t('slaEscalation.level'), t('slaEscalation.via'), t('common.status'), t('slaEscalation.error'),
  ], sortedLogs.map((log) => [
    log.createdAt,
    log.ticket?.displayId || '',
    BREACH_LABELS[log.breachType] ?? log.breachType,
    log.level,
    SENT_VIA_LABELS[log.sentVia] ?? log.sentVia,
    log.status,
    log.errorMessage || '',
  ]));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [configRes, logsRes] = await Promise.all([slaEscalationAdminApi.getConfig(), slaEscalationAdminApi.logs(50)]);
      setConfig({ ...defaultConfig, ...configRes.data, escalationLevels: [...(configRes.data.escalationLevels ?? [1, 2, 3])], smtpPassword: '' });
      setLogs(logsRes.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load SLA escalation settings');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof SlaConfig, value: string | number | boolean) => setConfig((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...config, escalationLevels: [...(config.escalationLevels ?? [])] };
      if (!payload.smtpPassword) delete payload.smtpPassword;
      const res = await slaEscalationAdminApi.updateConfig(payload);
      setConfig({ ...defaultConfig, ...res.data, escalationLevels: [...(res.data.escalationLevels ?? [1, 2, 3])], smtpPassword: '' });
      setMessage('SLA escalation policy saved. SMTP password was not returned by the API.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to save SLA escalation settings');
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setError(null);
    setMessage(null);
    try {
      await slaEscalationAdminApi.testSmtp();
      setMessage('SMTP connection verified successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'SMTP verification failed');
    }
  };

  const runNow = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await slaEscalationAdminApi.runNow();
      setMessage(`SLA breach scan completed: ${res.data.escalated} escalated, ${res.data.sent} sent, ${res.data.skipped} already handled, ${res.data.failed} failed.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Manual SLA escalation run failed');
    }
  };

  const toggleLevel = (level: number) => {
    const current = [...(config.escalationLevels ?? [])];
    if (current.includes(level)) setConfig((prev) => ({ ...prev, escalationLevels: current.filter((l) => l !== level) }));
    else setConfig((prev) => ({ ...prev, escalationLevels: [...current, level].sort((a, b) => a - b) }));
  };

  if (loading) return <div className="p-6 text-gray-700 dark:text-gray-200">{t('slaEscalation.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('slaEscalation.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('slaEscalation.subtitle')}</p>
      </div>

      {message && <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('slaEscalation.policy')}</h2>
        <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} />
          {t('slaEscalation.enableEscalation')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.intervalMinutes')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={5} max={10080} value={config.intervalMinutes} onChange={(e) => update('intervalMinutes', Number(e.target.value))} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.delayBeforeLevel')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={1} value={config.escalationDelayMinutes} onChange={(e) => update('escalationDelayMinutes', Number(e.target.value))} />
          </label>
        </div>
        <div className="space-y-2">
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.levels')}</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button key={level} type="button" onClick={() => toggleLevel(level)} className={`px-3 py-1 rounded text-sm border ${config.escalationLevels?.includes(level) ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200'}`}>Level {level}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.notifyOnBreach')}</span>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={config.notifyAssignee} onChange={(e) => update('notifyAssignee', e.target.checked)} />
            {t('slaEscalation.notifyAssignee')}
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={config.notifyManager} onChange={(e) => update('notifyManager', e.target.checked)} />
            {t('slaEscalation.notifyManager')}
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={config.notifyEmail} onChange={(e) => update('notifyEmail', e.target.checked)} />
            {t('slaEscalation.notifyEmail')}
          </label>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">{t('slaEscalation.lastRun')}: {config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : t('slaEscalation.never')} · {t('slaEscalation.nextRun')}: {config.nextRunAt ? new Date(config.nextRunAt).toLocaleString() : t('slaEscalation.notScheduled')} · {t('slaEscalation.status')}: {config.lastRunStatus ?? 'n/a'} {config.lastRunMessage ? `(${config.lastRunMessage})` : ''}</div>
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('slaEscalation.smtpSettings')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('slaEscalation.secretsWriteOnly')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.smtpHost')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.smtpHost ?? ''} onChange={(e) => update('smtpHost', e.target.value)} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.port')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" value={config.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.smtpUser')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.smtpUser ?? ''} onChange={(e) => update('smtpUser', e.target.value)} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('slaEscalation.smtpPassword')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="password" placeholder={config.smtpPasswordConfigured ? '********' : ''} value={config.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} /></label>
          <div className="flex flex-col justify-end gap-2 text-sm text-gray-700 dark:text-gray-200">
            <label><input type="checkbox" checked={config.smtpSecure} onChange={(e) => update('smtpSecure', e.target.checked)} /> {t('slaEscalation.useImplicitTLS')}</label>
            <label><input type="checkbox" checked={config.smtpRejectUnauthorized} onChange={(e) => update('smtpRejectUnauthorized', e.target.checked)} /> {t('slaEscalation.validateTLS')}</label>
          </div>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50">{saving ? t('slaEscalation.saving') : t('slaEscalation.saveSettings')}</button>
        <button onClick={testSmtp} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">{t('slaEscalation.testSmtp')}</button>
        <button onClick={runNow} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">{t('slaEscalation.runNow')}</button>
      </div>

      <DataTableShell toolbar={<h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('slaEscalation.recentLog')}</h2>} onExport={exportVisibleLogs} exportLabel="Export CSV">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700"><tr><SortableTh column="time" label={t('slaEscalation.time')} activeColumn={sort.column} direction={sort.column === 'time' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="ticket" label={t('slaEscalation.ticket')} activeColumn={sort.column} direction={sort.column === 'ticket' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="breach" label={t('slaEscalation.breach')} activeColumn={sort.column} direction={sort.column === 'breach' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="level" label={t('slaEscalation.level')} activeColumn={sort.column} direction={sort.column === 'level' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="via" label={t('slaEscalation.via')} activeColumn={sort.column} direction={sort.column === 'via' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="error" label={t('slaEscalation.error')} activeColumn={sort.column} direction={sort.column === 'error' ? sort.direction : ''} onSort={toggleSort} /></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedLogs.map((log) => <tr key={log.id} className="text-gray-800 dark:text-gray-100"><td className="p-2">{new Date(log.createdAt).toLocaleString()}</td><td className="p-2">{log.ticket?.displayId ?? 'n/a'}</td><td className="p-2">{BREACH_LABELS[log.breachType] ?? log.breachType}</td><td className="p-2">Level {log.level}</td><td className="p-2">{SENT_VIA_LABELS[log.sentVia] ?? log.sentVia}</td><td className="p-2">{log.status}</td><td className="p-2">{log.errorMessage ?? ''}</td></tr>)}
              {sortedLogs.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={7}>{t('slaEscalation.noLogEntries')}</td></tr>}
            </tbody>
          </table>
        </div>
      </DataTableShell>
    </div>
  );
}
