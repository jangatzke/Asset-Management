import { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuthStore } from '../store/auth';
import { authApi } from '../services/api';

const Settings = () => {
  const { language, setLanguage, t } = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user, checkAuth } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ qrCodeDataUrl: string; otpauthUrl: string } | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const beginMfaSetup = async () => {
    setMfaError(null);
    setMfaMessage(null);
    try {
      setMfaSetup((await authApi.beginMfaSetup()).data);
    } catch (error: any) {
      setMfaError(error.response?.data?.error?.message || 'Failed to start MFA setup.');
    }
  };

  const confirmMfaSetup = async () => {
    setMfaError(null);
    setMfaMessage(null);
    try {
      await authApi.confirmMfaSetup(mfaToken);
      setMfaSetup(null);
      setMfaToken('');
      await checkAuth();
      setMfaMessage('MFA enabled successfully.');
    } catch (error: any) {
      setMfaError(error.response?.data?.error?.message || 'Failed to verify MFA code.');
    }
  };

  const disableMfa = async () => {
    setMfaError(null);
    setMfaMessage(null);
    try {
      await authApi.disableMfa(mfaToken);
      setMfaToken('');
      await checkAuth();
      setMfaMessage('MFA disabled.');
    } catch (error: any) {
      setMfaError(error.response?.data?.error?.message || 'Failed to disable MFA.');
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await checkAuth();
      setPasswordMessage('Password changed successfully.');
    } catch (error: any) {
      setPasswordError(error.response?.data?.error?.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('settings.title')}
      </h1>

      <div className="bg-white dark:bg-card rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
          {user?.mustChangePasswordOnNext && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-700 p-4 text-sm text-yellow-800 dark:text-yellow-200">
              {t('settings.mustChangeTemporaryPassword')}
            </div>
          )}

          {/* Account Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('settings.accountInfo')}
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.email')}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.name')}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.accountType')}
                </span>
                <span className="text-sm font-medium">
                  {user?.isOidcLinked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {t('settings.oidcLinked')}
                      {user?.oidcProvider && (
                        <span className="ml-1 text-blue-500 dark:text-blue-400">
                          ({user.oidcProvider})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200">
                      {t('settings.localAccount')}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.roles')}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.roles?.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {!user?.isOidcLinked && (
            <>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('settings.mfaTitle')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {user?.mfaEnabled ? t('settings.mfaEnabled') : t('settings.mfaDisabled')}
              </p>
              {mfaSetup && (
                <div className="space-y-3 mb-4">
                  <img src={mfaSetup.qrCodeDataUrl} alt={t('settings.mfaQrAlt')} className="w-48 h-48" />
                  <p className="break-all text-xs text-gray-500">{mfaSetup.otpauthUrl}</p>
                </div>
              )}
              <input
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                placeholder={t('settings.mfaCode')}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm mb-3"
              />
              {mfaError && <div className="text-sm text-red-600 dark:text-red-400 mb-2">{mfaError}</div>}
              {mfaMessage && <div className="text-sm text-green-600 dark:text-green-400 mb-2">{mfaMessage}</div>}
              <div className="flex gap-2">
                {!user?.mfaEnabled && !mfaSetup && <button type="button" onClick={beginMfaSetup} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">{t('settings.mfaSetup')}</button>}
                {!user?.mfaEnabled && mfaSetup && <button type="button" onClick={confirmMfaSetup} className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700">{t('settings.mfaConfirm')}</button>}
                {user?.mfaEnabled && <button type="button" onClick={disableMfa} className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">{t('settings.mfaDisable')}</button>}
              </div>
            </div>
            <form onSubmit={handlePasswordChange} className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t('settings.changePassword')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.passwordRequirements')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.confirmNewPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {passwordError && <div className="text-sm text-red-600 dark:text-red-400">{passwordError}</div>}
                {passwordMessage && <div className="text-sm text-green-600 dark:text-green-400">{passwordMessage}</div>}
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isChangingPassword ? t('settings.changingPassword') : t('settings.changePassword')}
                </button>
              </div>
            </form>
            </>
          )}

          {/* Language Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.language')}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          {/* Theme Setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.theme')}
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="flex items-center px-4 py-2 border border-gray-300 dark:border-card rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {darkMode ? (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{t('settings.lightMode')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span>{t('settings.darkMode')}</span>
                  </>
                )}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {darkMode ? t('settings.darkMode') : t('settings.lightMode')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
