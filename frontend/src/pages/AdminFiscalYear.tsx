import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { useI18n } from '../context/I18nContext';
import { adminApi } from '../services/api';

const monthDays = (month: number) => [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

const AdminFiscalYear = () => {
  const { t } = useI18n();
  const [startMonth, setStartMonth] = useState(1);
  const [startDay, setStartDay] = useState(1);
  const [timezone] = useState('Europe/Berlin');
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const extractErrorMessage = (err: unknown, fallback: string) => {
    const axiosError = err as AxiosError<{ error?: { message?: string }; message?: string }>;
    return axiosError.response?.data?.error?.message || axiosError.response?.data?.message || axiosError.message || fallback;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.getFiscalYearConfig();
      setStartMonth(data.config.startMonth);
      setStartDay(data.config.startDay);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(extractErrorMessage(err, t('fiscalYear.loadError')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.updateFiscalYearConfig({ startMonth, startDay, timezone });
      setPreview(data);
      setMessage(t('fiscalYear.saved'));
    } catch (err) {
      setError(extractErrorMessage(err, t('fiscalYear.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('fiscalYear.title')}</h1>
      {message && <div className="rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
      {loading && <div className="rounded bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">{t('common.loading')}</div>}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('fiscalYear.startMonth')}
          <select value={startMonth} onChange={(e) => { const month = Number(e.target.value); setStartMonth(month); setStartDay(Math.min(startDay, monthDays(month))); }} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white">
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('fiscalYear.startDay')}
          <select value={startDay} onChange={(e) => setStartDay(Number(e.target.value))} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white">
            {Array.from({ length: monthDays(startMonth) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('fiscalYear.timezone')}
          <input value={timezone} readOnly className="mt-1 w-full rounded border-gray-300 bg-gray-100 dark:bg-gray-700 dark:text-white" />
        </label>
        <div className="md:col-span-3">
          <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </div>
      {preview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><h2 className="font-semibold dark:text-white">{t('fiscalYear.current')}</h2><p className="dark:text-gray-200">{preview.current.label}: {new Date(preview.current.periodStart).toLocaleDateString()} – {new Date(preview.current.periodEnd).toLocaleDateString()}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><h2 className="font-semibold dark:text-white">{t('fiscalYear.next')}</h2><p className="dark:text-gray-200">{preview.next.label}: {new Date(preview.next.periodStart).toLocaleDateString()} – {new Date(preview.next.periodEnd).toLocaleDateString()}</p></div>
        </div>
      )}
    </div>
  );
};

export default AdminFiscalYear;
