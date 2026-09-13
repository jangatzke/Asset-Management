import { useCallback, useEffect, useState } from 'react';
import { adminApi, type TicketTypeConfig } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { SortableTh } from '../components/SortableTh';
import { exportCsv } from '../utils/csvExport';

const priorities = ['low', 'medium', 'high', 'critical'];

function cloneConfig(config: TicketTypeConfig): TicketTypeConfig {
  return {
    ...config,
    slaPolicy: {
      byPriority: Object.fromEntries(priorities.map((priority) => [priority, { ...config.slaPolicy.byPriority[priority] }])),
    },
  };
}

export default function AdminTicketSla() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<TicketTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTicketTypes();
      setConfigs(response.data.map(cloneConfig));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('ticketSla.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const updateTarget = (type: string, priority: string, field: 'firstResponseHours' | 'resolutionHours', value: string) => {
    setConfigs((current) => current.map((config) => config.type !== type ? config : {
      ...config,
      slaPolicy: {
        byPriority: {
          ...config.slaPolicy.byPriority,
          [priority]: { ...config.slaPolicy.byPriority[priority], [field]: Number(value) },
        },
      },
    }));
  };

  const [sort, setSort] = useState<Record<string, { column: string; direction: 'asc' | 'desc' }>>({});

  const toggleSort = (type: string, column: string) => setSort((prev) => {
    const prevColumn = prev[type];
    const direction = prevColumn?.column === column && prevColumn.direction === 'asc' ? 'desc' : 'asc';
    return { ...prev, [type]: { column, direction } };
  });

  const sortedPriorities = (config: TicketTypeConfig) => {
    const col = sort[config.type]?.column ?? '';
    const dir = sort[config.type]?.direction ?? 'asc';
    if (!col) return priorities;
    const factor = dir === 'desc' ? -1 : 1;
    const get = (priority: string) => {
      const entry = config.slaPolicy.byPriority[priority];
      if (col === 'priority') return priorities.indexOf(priority);
      if (col === 'firstResponseHours') return entry.firstResponseHours ?? 0;
      if (col === 'resolutionHours') return entry.resolutionHours ?? 0;
      return 0;
    };
    return [...priorities].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * factor : av > bv ? 1 * factor : 0; });
  };

  const exportVisibleSla = (config: TicketTypeConfig) => exportCsv(`ticket-sla-${config.type}`, [
    t('ticketSla.priority'), t('ticketSla.firstResponseHours'), t('ticketSla.resolutionHours'),
  ], sortedPriorities(config).map((priority) => [
    t(`tickets.priorities.${priority}`),
    config.slaPolicy.byPriority[priority].firstResponseHours,
    config.slaPolicy.byPriority[priority].resolutionHours,
  ]));

  const save = async (config: TicketTypeConfig) => {
    setSaving(config.type);
    try {
      const response = await adminApi.updateTicketType(config.type, {
        label: config.label,
        description: config.description,
        enabled: config.enabled,
        defaultPriority: config.defaultPriority,
        slaPolicy: config.slaPolicy,
      });
      setConfigs((current) => current.map((item) => item.type === config.type ? cloneConfig(response.data) : item));
      setMessage(t('ticketSla.saved'));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('ticketSla.saveError'));
    } finally {
      setSaving(null);
    }
  };

  return <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ticketSla.title')}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('ticketSla.description')}</p></header>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{error}</div>}
    {message && <div className="rounded border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100">{message}</div>}
    {loading ? <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p> : configs.map((config) => <section key={config.type} className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t(`tickets.types.${config.type}`)}</h2><p className="text-sm text-gray-600 dark:text-gray-300">{config.description}</p></div><div className="flex gap-2"><button type="button" onClick={() => exportVisibleSla(config)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Export CSV</button><button type="button" onClick={() => void save(config)} disabled={saving === config.type} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving === config.type ? t('common.saving') : t('common.save')}</button></div></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-gray-200 text-left dark:border-gray-700"><SortableTh column="priority" label={t('ticketSla.priority')} activeColumn={sort[config.type]?.column ?? ''} direction={sort[config.type]?.column === 'priority' ? sort[config.type].direction : ''} onSort={(col) => toggleSort(config.type, col)} /><SortableTh column="firstResponseHours" label={t('ticketSla.firstResponseHours')} activeColumn={sort[config.type]?.column ?? ''} direction={sort[config.type]?.column === 'firstResponseHours' ? sort[config.type].direction : ''} onSort={(col) => toggleSort(config.type, col)} /><SortableTh column="resolutionHours" label={t('ticketSla.resolutionHours')} activeColumn={sort[config.type]?.column ?? ''} direction={sort[config.type]?.column === 'resolutionHours' ? sort[config.type].direction : ''} onSort={(col) => toggleSort(config.type, col)} /></tr></thead><tbody>{sortedPriorities(config).map((priority) => <tr key={`${config.type}-${priority}`} className="border-b border-gray-100 dark:border-gray-700"><td className="p-2 font-medium">{t(`tickets.priorities.${priority}`)}</td><td className="p-2"><input aria-label={`${t('ticketSla.firstResponseHours')} ${t(`tickets.priorities.${priority}`)}`} min="0" type="number" value={config.slaPolicy.byPriority[priority].firstResponseHours} onChange={(event) => updateTarget(config.type, priority, 'firstResponseHours', event.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700" /></td><td className="p-2"><input aria-label={`${t('ticketSla.resolutionHours')} ${t(`tickets.priorities.${priority}`)}`} min="0" type="number" value={config.slaPolicy.byPriority[priority].resolutionHours} onChange={(event) => updateTarget(config.type, priority, 'resolutionHours', event.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700" /></td></tr>)}</tbody></table></div>
    </section>)}
  </main>;
}
