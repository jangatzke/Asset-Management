import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';

interface OidcConfig {
  id: string;
  enabled: boolean;
  providerName: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedEmailDomains?: string[];
  autoProvisioning: boolean;
  defaultRoleForNewUsers: string;
  enableGroupMapping: boolean;
  groupClaimToRoleMapping?: Record<string, string>;
  enableLocalLogin: boolean;
}

const AdminOIDC = () => {
  const { t } = useI18n();
  const [config, setConfig] = useState<OidcConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await adminApi.getOidcConfig();
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load OIDC config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const response = await adminApi.updateOidcConfig(config);
      setConfig(response.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save OIDC config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof OidcConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('oidc.noConfig')}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('navigation.oidcConfig')}
      </h1>

      <div className="bg-white dark:bg-card rounded-lg shadow p-6 max-w-3xl">
        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('oidc.enableOidc')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('oidc.enableOidcDescription')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {config.enabled && (
            <>
              {/* Provider Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {t('oidc.providerSettings')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('oidc.tenantId')}
                    </label>
                    <input
                      type="text"
                      value={config.tenantId || ''}
                      onChange={(e) => handleChange('tenantId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('oidc.clientId')}
                    </label>
                    <input
                      type="text"
                      value={config.clientId || ''}
                      onChange={(e) => handleChange('clientId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('oidc.clientSecret')}
                    </label>
                    <input
                      type="password"
                      value={config.clientSecret || ''}
                      onChange={(e) => handleChange('clientSecret', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('oidc.redirectUri')}
                    </label>
                    <input
                      type="text"
                      value={config.redirectUri || ''}
                      onChange={(e) => handleChange('redirectUri', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Allowed Domains */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {t('oidc.allowedDomains')}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('oidc.allowedDomainsDescription')}
                  </label>
                  <input
                    type="text"
                    value={(config.allowedEmailDomains || []).join(', ')}
                    onChange={(e) =>
                      handleChange(
                        'allowedEmailDomains',
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contoso.com, partner.org"
                  />
                </div>
              </div>

              {/* Auto-Provisioning */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {t('oidc.autoProvisioning')}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoProvisioning"
                      checked={config.autoProvisioning}
                      onChange={(e) => handleChange('autoProvisioning', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="autoProvisioning" className="text-sm text-gray-700 dark:text-gray-300">
                      {t('oidc.autoProvisioningDescription')}
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('oidc.defaultRole')}
                    </label>
                    <input
                      type="text"
                      value={config.defaultRoleForNewUsers || ''}
                      onChange={(e) => handleChange('defaultRoleForNewUsers', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Local Login */}
              <div className="flex items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="enableLocalLogin"
                  checked={config.enableLocalLogin}
                  onChange={(e) => handleChange('enableLocalLogin', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="enableLocalLogin" className="text-sm text-gray-700 dark:text-gray-300">
                  {t('oidc.enableLocalLogin')}
                </label>
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {t('common.saved')}
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOIDC;
