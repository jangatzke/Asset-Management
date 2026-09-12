import { useEffect, useState, useMemo } from 'react';
import { reminderAdminApi } from '../services/api';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { useI18n } from '../context/I18nContext';

interface ReminderConfig {
  id?: string;
  enabled: boolean;
  intervalMinutes: number;
  lookAheadDays: number;
  reminderFromEmail?: string | null;
  reminderSubjectPrefix: string;
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

interface ReminderLog {
  id: string;
  createdAt: string;
  runId: string;
  resource: string;
  entityType: string;
  entityId: string;
  recipientEmail?: string | null;
  status: string;
  errorMessage?: string | null;
  dueDate?: string | null;
}

const defaultConfig: ReminderConfig = {
  enabled: false,
  intervalMinutes: 1440,
  lookAheadDays: 0,
  reminderSubjectPrefix: '[ISMS Reminder]',
  smtpPort: 587,
  smtpSecure: false,
  smtpRejectUnauthorized: true,
};

export default function AdminReminders() {
  const { t } = useI18n();
  const [config, setConfig] = useState<ReminderConfig>(defaultConfig);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-reminders', defaultSort: { column: 'time', direction: 'desc' } });

  const sortedLogs = useMemo(() => {
    if (!sort.column) return logs;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (log: ReminderLog) => {
      if (sort.column === 'time') return log.createdAt ? new Date(log.createdAt).getTime() : 0;
      if (sort.column === 'resource') return (log.resource ?? '').toLowerCase();
      if (sort.column === 'recipient') return (log.recipientEmail ?? 'n/a').toLowerCase();
      if (sort.column === 'due') return log.dueDate ? new Date(log.dueDate).getTime() : 0;
      if (sort.column === 'status') return (log.status ?? '').toLowerCase();
      if (sort.column === 'error') return (log.errorMessage ?? '').toLowerCase();
      return '';
    };
    return [...logs].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [logs, sort]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [configRes, logsRes] = await Promise.all([reminderAdminApi.getConfig(), reminderAdminApi.logs(50)]);
      setConfig({ ...defaultConfig, ...configRes.data, smtpPassword: '' });
      setLogs(logsRes.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof ReminderConfig, value: string | number | boolean) => setConfig((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...config };
      if (!payload.smtpPassword) delete payload.smtpPassword;
      const res = await reminderAdminApi.updateConfig(payload);
      setConfig({ ...defaultConfig, ...res.data, smtpPassword: '' });
      setMessage('Reminder automation settings saved. SMTP password was not returned by the API.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to save reminder settings');
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setError(null);
    setMessage(null);
    try {
      await reminderAdminApi.testSmtp();
      setMessage('SMTP connection verified successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'SMTP verification failed');
    }
  };

  const runNow = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await reminderAdminApi.runNow();
      setMessage(`Reminder run completed: ${res.data.total} due, ${res.data.sent} sent, ${res.data.skipped} skipped, ${res.data.failed} failed.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Manual automation run failed');
    }
  };

  if (loading) return <div className="p-6 text-gray-700 dark:text-gray-200">{t('reminders.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('reminders.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('reminders.subtitle')}</p>
      </div>

      {message && <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('reminders.automation')}</h2>
        <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} />
          {t('reminders.enableReminders')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.intervalMinutes')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={5} max={10080} value={config.intervalMinutes} onChange={(e) => update('intervalMinutes', Number(e.target.value))} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.lookAheadDays')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" min={0} max={365} value={config.lookAheadDays} onChange={(e) => update('lookAheadDays', Number(e.target.value))} />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.subjectPrefix')}
            <input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.reminderSubjectPrefix} onChange={(e) => update('reminderSubjectPrefix', e.target.value)} />
          </label>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">{t('reminders.lastRun')}: {config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : t('reminders.never')} · {t('reminders.nextRun')}: {config.nextRunAt ? new Date(config.nextRunAt).toLocaleString() : t('reminders.notScheduled')} · {t('reminders.status')}: {config.lastRunStatus ?? 'n/a'} {config.lastRunMessage ? `(${config.lastRunMessage})` : ''}</div>
      </section>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow p-5 space-y-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('reminders.smtpSettings')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('reminders.secretsWriteOnly')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.smtpHost')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.smtpHost ?? ''} onChange={(e) => update('smtpHost', e.target.value)} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.port')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="number" value={config.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.fromEmail')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.reminderFromEmail ?? ''} onChange={(e) => update('reminderFromEmail', e.target.value)} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.smtpUser')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" value={config.smtpUser ?? ''} onChange={(e) => update('smtpUser', e.target.value)} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-200">{t('reminders.smtpPassword')}<input className="mt-1 w-full rounded border p-2 dark:bg-gray-900" type="password" placeholder={config.smtpPasswordConfigured ? '********' : ''} value={config.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} /></label>
          <div className="flex flex-col justify-end gap-2 text-sm text-gray-700 dark:text-gray-200">
            <label><input type="checkbox" checked={config.smtpSecure} onChange={(e) => update('smtpSecure', e.target.checked)} /> {t('reminders.useImplicitTLS')}</label>
            <label><input type="checkbox" checked={config.smtpRejectUnauthorized} onChange={(e) => update('smtpRejectUnauthorized', e.target.checked)} /> {t('reminders.validateTLS')}</label>
          </div>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? t('reminders.saving') : t('reminders.saveSettings')}</button>
        <button onClick={testSmtp} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">{t('reminders.testSmtp')}</button>
        <button onClick={runNow} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">{t('reminders.runNow')}</button>
      </div>

      <section className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-hidden">
        <div className="p-5"><h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('reminders.recentLog')}</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200"><tr><SortableTh column="time" label={t('reminders.time')} activeColumn={sort.column} direction={sort.column === 'time' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="resource" label={t('reminders.resource')} activeColumn={sort.column} direction={sort.column === 'resource' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="recipient" label={t('reminders.recipient')} activeColumn={sort.column} direction={sort.column === 'recipient' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="due" label={t('reminders.due')} activeColumn={sort.column} direction={sort.column === 'due' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="error" label={t('reminders.error')} activeColumn={sort.column} direction={sort.column === 'error' ? sort.direction : ''} onSort={toggleSort} /></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedLogs.map((log) => <tr key={log.id} className="text-gray-800 dark:text-gray-100"><td className="p-2">{new Date(log.createdAt).toLocaleString()}</td><td className="p-2">{log.resource}</td><td className="p-2">{log.recipientEmail ?? 'n/a'}</td><td className="p-2">{log.dueDate ? new Date(log.dueDate).toLocaleDateString() : 'n/a'}</td><td className="p-2">{log.status}</td><td className="p-2">{log.errorMessage ?? ''}</td></tr>)}
              {sortedLogs.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={6}>{t('reminders.noLogEntries')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
