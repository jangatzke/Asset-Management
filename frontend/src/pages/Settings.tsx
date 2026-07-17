import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuthStore } from '../store/auth';

const Settings = () => {
  const { language, setLanguage, t } = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user } = useAuthStore();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('settings.title')}
      </h1>

      <div className="bg-white dark:bg-card rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
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
                      <span>{t('settings.lightMode')}</span>
                    </svg>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      <span>{t('settings.darkMode')}</span>
                    </svg>
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
