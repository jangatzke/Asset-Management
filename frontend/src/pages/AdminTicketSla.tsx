import { useCallback, useEffect, useState } from 'react';
import { adminApi, type TicketTypeConfig } from '../services/api';
import { useI18n } from '../context/I18nContext';

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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t(`tickets.types.${config.type}`)}</h2><p className="text-sm text-gray-600 dark:text-gray-300">{config.description}</p></div><button type="button" onClick={() => void save(config)} disabled={saving === config.type} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving === config.type ? t('common.saving') : t('common.save')}</button></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-gray-200 text-left dark:border-gray-700"><th className="p-2">{t('ticketSla.priority')}</th><th className="p-2">{t('ticketSla.firstResponseHours')}</th><th className="p-2">{t('ticketSla.resolutionHours')}</th></tr></thead><tbody>{priorities.map((priority) => <tr key={priority} className="border-b border-gray-100 dark:border-gray-700"><td className="p-2 font-medium">{t(`tickets.priorities.${priority}`)}</td><td className="p-2"><input aria-label={`${t('ticketSla.firstResponseHours')} ${t(`tickets.priorities.${priority}`)}`} min="0" type="number" value={config.slaPolicy.byPriority[priority].firstResponseHours} onChange={(event) => updateTarget(config.type, priority, 'firstResponseHours', event.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700" /></td><td className="p-2"><input aria-label={`${t('ticketSla.resolutionHours')} ${t(`tickets.priorities.${priority}`)}`} min="0" type="number" value={config.slaPolicy.byPriority[priority].resolutionHours} onChange={(event) => updateTarget(config.type, priority, 'resolutionHours', event.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700" /></td></tr>)}</tbody></table></div>
    </section>)}
  </main>;
}
