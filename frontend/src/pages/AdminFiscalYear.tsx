import { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { adminApi } from '../services/api';
import { formatApiError } from '../utils/apiError';

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
      setError(formatApiError(err, t('fiscalYear.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial fiscal-year load only; load uses current translation fallback for this mount.
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.updateFiscalYearConfig({ startMonth, startDay, timezone });
      setPreview(data);
      setMessage(t('fiscalYear.saved'));
    } catch (err) {
      setError(formatApiError(err, t('fiscalYear.saveError'), t('common.referenceId')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{t('fiscalYear.title')}</h1>
      {message && <div className="rounded bg-status-info-bg p-3 text-sm text-status-info-fg">{message}</div>}
      {error && <div className="rounded bg-status-critical-bg p-3 text-sm text-status-critical-fg">{error}</div>}
      {loading && <div className="rounded bg-surface-sunken p-3 text-sm text-text-primary">{t('common.loading')}</div>}
      <div className="bg-surface-default rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block text-sm font-medium text-text-primary">
          {t('fiscalYear.startMonth')}
          <select value={startMonth} onChange={(e) => { const month = Number(e.target.value); setStartMonth(month); setStartDay(Math.min(startDay, monthDays(month))); }} className="mt-1 w-full rounded border-border-subtle bg-surface-default text-text-primary">
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-text-primary">
          {t('fiscalYear.startDay')}
          <select value={startDay} onChange={(e) => setStartDay(Number(e.target.value))} className="mt-1 w-full rounded border-border-subtle bg-surface-default text-text-primary">
            {Array.from({ length: monthDays(startMonth) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-text-primary">
          {t('fiscalYear.timezone')}
          <input value={timezone} readOnly className="mt-1 w-full rounded border-border-subtle bg-surface-sunken text-text-primary" />
        </label>
        <div className="md:col-span-3">
          <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-surface-disabled">{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </div>
      {preview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-default rounded-lg shadow p-4"><h2 className="font-semibold text-text-primary">{t('fiscalYear.current')}</h2><p className="text-text-primary">{preview.current.label}: {new Date(preview.current.periodStart).toLocaleDateString()} – {new Date(preview.current.periodEnd).toLocaleDateString()}</p></div>
          <div className="bg-surface-default rounded-lg shadow p-4"><h2 className="font-semibold text-text-primary">{t('fiscalYear.next')}</h2><p className="text-text-primary">{preview.next.label}: {new Date(preview.next.periodStart).toLocaleDateString()} – {new Date(preview.next.periodEnd).toLocaleDateString()}</p></div>
        </div>
      )}
    </div>
  );
};

export default AdminFiscalYear;
