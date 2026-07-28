import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { useI18n } from '../context/I18nContext';
import { adminApi } from '../services/api';

interface AuthSettingsForm {
  passwordComplexityEnabled: boolean;
  minPasswordLength: number;
  passwordHistoryCount: number;
  passwordValidityDays: number;
  forceMfa: boolean;
}

const defaults: AuthSettingsForm = {
  passwordComplexityEnabled: true,
  minPasswordLength: 12,
  passwordHistoryCount: 0,
  passwordValidityDays: 0,
  forceMfa: false,
};

const AdminAuthSettings = () => {
  const { t } = useI18n();
  const [form, setForm] = useState<AuthSettingsForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const extractErrorMessage = (err: unknown, fallback: string) => {
    const axiosError = err as AxiosError<{ error?: { message?: string }; message?: string }>;
    return axiosError.response?.data?.error?.message || axiosError.response?.data?.message || axiosError.message || fallback;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.getAuthSettings();
      setForm({
        passwordComplexityEnabled: Boolean(data.passwordComplexityEnabled),
        minPasswordLength: Number(data.minPasswordLength),
        passwordHistoryCount: Number(data.passwordHistoryCount),
        passwordValidityDays: Number(data.passwordValidityDays),
        forceMfa: Boolean(data.forceMfa),
      });
    } catch (err) {
      setError(extractErrorMessage(err, t('authSettings.loadError')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial settings load only; load uses current translation fallback for this mount.
  }, []);

  const updateNumber = (field: keyof AuthSettingsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: Number(value) }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.updateAuthSettings(form);
      setForm({
        passwordComplexityEnabled: Boolean(data.passwordComplexityEnabled),
        minPasswordLength: Number(data.minPasswordLength),
        passwordHistoryCount: Number(data.passwordHistoryCount),
        passwordValidityDays: Number(data.passwordValidityDays),
        forceMfa: Boolean(data.forceMfa),
      });
      setMessage(t('authSettings.saved'));
    } catch (err) {
      setError(extractErrorMessage(err, t('authSettings.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('authSettings.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('authSettings.description')}</p>
      </div>
      {message && <div className="rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
      {loading && <div className="rounded bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">{t('common.loading')}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 rounded border border-gray-200 dark:border-gray-700 p-4">
            <input
              type="checkbox"
              checked={form.passwordComplexityEnabled}
              onChange={(event) => setForm((current) => ({ ...current, passwordComplexityEnabled: event.target.checked }))}
              className="mt-1 rounded border-gray-300"
            />
            <span>
              <span className="block font-medium text-gray-900 dark:text-white">{t('authSettings.passwordComplexity')}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">{t('authSettings.passwordComplexityHelp')}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded border border-gray-200 dark:border-gray-700 p-4">
            <input
              type="checkbox"
              checked={form.forceMfa}
              onChange={(event) => setForm((current) => ({ ...current, forceMfa: event.target.checked }))}
              className="mt-1 rounded border-gray-300"
            />
            <span>
              <span className="block font-medium text-gray-900 dark:text-white">{t('authSettings.forceMfa')}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">{t('authSettings.forceMfaHelp')}</span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('authSettings.minPasswordLength')}
            <input type="number" min="1" max="128" value={form.minPasswordLength} onChange={(e) => updateNumber('minPasswordLength', e.target.value)} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('authSettings.passwordHistoryCount')}
            <input type="number" min="0" max="24" value={form.passwordHistoryCount} onChange={(e) => updateNumber('passwordHistoryCount', e.target.value)} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('authSettings.zeroDisables')}</span>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('authSettings.passwordValidityDays')}
            <input type="number" min="0" max="3650" value={form.passwordValidityDays} onChange={(e) => updateNumber('passwordValidityDays', e.target.value)} className="mt-1 w-full rounded border-gray-300 dark:bg-gray-700 dark:text-white" />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('authSettings.zeroNeverExpires')}</span>
          </label>
        </div>

        <div className="rounded bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          {t('authSettings.localOnlyNotice')}
        </div>

        <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
};

export default AdminAuthSettings;
