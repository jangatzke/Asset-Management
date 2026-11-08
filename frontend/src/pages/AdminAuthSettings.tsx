import { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { adminApi } from '../services/api';
import { formatApiError } from '../utils/apiError';

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
      setError(formatApiError(err, t('authSettings.loadError'), t('common.referenceId')));
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
      setError(formatApiError(err, t('authSettings.saveError'), t('common.referenceId')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('authSettings.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('authSettings.description')}</p>
      </div>
      {message && <div className="rounded bg-status-info-bg p-3 text-sm text-status-info-fg">{message}</div>}
      {error && <div className="rounded bg-status-critical-bg p-3 text-sm text-status-critical-fg">{error}</div>}
      {loading && <div className="rounded bg-surface-sunken p-3 text-sm text-text-primary">{t('common.loading')}</div>}

      <div className="bg-surface-default rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 rounded border border-border-subtle p-4">
            <input
              type="checkbox"
              checked={form.passwordComplexityEnabled}
              onChange={(event) => setForm((current) => ({ ...current, passwordComplexityEnabled: event.target.checked }))}
              className="mt-1 rounded border-border-subtle"
            />
            <span>
              <span className="block font-medium text-text-primary">{t('authSettings.passwordComplexity')}</span>
              <span className="block text-sm text-text-muted">{t('authSettings.passwordComplexityHelp')}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded border border-border-subtle p-4">
            <input
              type="checkbox"
              checked={form.forceMfa}
              onChange={(event) => setForm((current) => ({ ...current, forceMfa: event.target.checked }))}
              className="mt-1 rounded border-border-subtle"
            />
            <span>
              <span className="block font-medium text-text-primary">{t('authSettings.forceMfa')}</span>
              <span className="block text-sm text-text-muted">{t('authSettings.forceMfaHelp')}</span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm font-medium text-text-primary">
            {t('authSettings.minPasswordLength')}
            <input type="number" min="1" max="128" value={form.minPasswordLength} onChange={(e) => updateNumber('minPasswordLength', e.target.value)} className="mt-1 w-full rounded border-border-subtle bg-surface-default text-text-primary" />
          </label>
          <label className="block text-sm font-medium text-text-primary">
            {t('authSettings.passwordHistoryCount')}
            <input type="number" min="0" max="24" value={form.passwordHistoryCount} onChange={(e) => updateNumber('passwordHistoryCount', e.target.value)} className="mt-1 w-full rounded border-border-subtle bg-surface-default text-text-primary" />
            <span className="mt-1 block text-xs text-text-muted">{t('authSettings.zeroDisables')}</span>
          </label>
          <label className="block text-sm font-medium text-text-primary">
            {t('authSettings.passwordValidityDays')}
            <input type="number" min="0" max="3650" value={form.passwordValidityDays} onChange={(e) => updateNumber('passwordValidityDays', e.target.value)} className="mt-1 w-full rounded border-border-subtle bg-surface-default text-text-primary" />
            <span className="mt-1 block text-xs text-text-muted">{t('authSettings.zeroNeverExpires')}</span>
          </label>
        </div>

        <div className="rounded bg-status-warn-bg p-4 text-sm text-status-warn-fg">
          {t('authSettings.localOnlyNotice')}
        </div>

        <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-surface-disabled disabled:text-text-muted">
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
};

export default AdminAuthSettings;
