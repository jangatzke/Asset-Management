import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuthStore } from '../store/auth';
import { authApi, type NavigationViewResponse } from '../services/api';
import NavigationOrderEditor, { type NavigationOrderEntry } from '../components/NavigationOrderEditor';
import { NAVIGATION_CATALOG, applyNavigationOrder } from '@shared/navigation';
import { useToast } from '../components/useToast';
import { PlusIcon, StarIcon, TrashIcon } from '@heroicons/react/24/outline';

const DEFAULT_SCOPE = '__default__';

const Settings = () => {
  const { language, setLanguage, t } = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user, checkAuth, updateUserPreferences } = useAuthStore();
  const { addToast } = useToast();
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
  const [navEntries, setNavEntries] = useState<NavigationOrderEntry[]>([]);
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [navSavedOrder, setNavSavedOrder] = useState<string[]>([]);
  const [navHidden, setNavHidden] = useState<string[]>([]);
  const [navSavedHidden, setNavSavedHidden] = useState<string[]>([]);
  const [navLoading, setNavLoading] = useState(true);
  const [navSaving, setNavSaving] = useState(false);
  const [navViews, setNavViews] = useState<NavigationViewResponse[]>([]);
  const [navScope, setNavScope] = useState<string>(DEFAULT_SCOPE); // DEFAULT_SCOPE or a personal view id
  const [newViewName, setNewViewName] = useState('');

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

  // Per-user override of the global top-navigation order. The effective order is
  // personal ?? global default; saving an override stores it in the user's
  // preferences, clearing it (null) falls back to the admin-defined default.
  const isAdminUser = Boolean(user?.roles?.includes('system_admin'));
  const canSeeEntry = useCallback((required?: string | string[]) => {
    if (!required) return true;
    if (!user?.permissions) return true;
    const granted = new Set(user.permissions);
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.some((permission) => granted.has(permission));
  }, [user]);

  const navCatalogEntries = useMemo<NavigationOrderEntry[]>(() => (
    NAVIGATION_CATALOG
      .filter((entry) => !entry.adminOnly || isAdminUser)
      .filter((entry) => canSeeEntry(entry.permission))
      .map((entry) => ({ href: entry.href, label: entry.nameKey ? t(entry.nameKey) : (entry.label ?? entry.href) }))
  ), [t, isAdminUser, canSeeEntry]);

  const catalogHrefs = useMemo(() => new Set(navCatalogEntries.map((entry) => entry.href)), [navCatalogEntries]);

  const effectiveOrderFor = useCallback((stored: string[]) => applyNavigationOrder(
    navCatalogEntries.map((entry) => ({ ...entry })),
    stored.filter((href) => catalogHrefs.has(href)),
  ).map((entry) => entry.href), [navCatalogEntries, catalogHrefs]);

  // Loads the personal default scope: effective order and hidden entries come
  // from the personal overrides (when present) otherwise from the global
  // default configuration. Explicit null arguments force the global fallback.
  const loadDefaultScope = useCallback(async (personalOverride?: string[] | null, personalHidden?: string[] | null) => {
    const response = await authApi.getNavigationConfig();
    const stored = Array.isArray(response.data?.navOrder) ? response.data.navOrder : [];
    const globalHidden = Array.isArray(response.data?.hiddenEntries) ? response.data.hiddenEntries : [];
    const personalRaw = personalOverride !== undefined ? personalOverride : user?.navigationOrder;
    const personal = Array.isArray(personalRaw) && personalRaw.length > 0 ? personalRaw : null;
    const effectiveOrder = effectiveOrderFor(personal ?? stored);
    setNavOrder(effectiveOrder);
    setNavSavedOrder(effectiveOrder);
    const hiddenRaw = personalHidden !== undefined ? personalHidden : user?.hiddenNavigationEntries;
    const effectiveHidden = (Array.isArray(hiddenRaw) ? hiddenRaw : globalHidden).filter((href) => catalogHrefs.has(href));
    setNavHidden(effectiveHidden);
    setNavSavedHidden(effectiveHidden);
  }, [effectiveOrderFor, catalogHrefs, user?.navigationOrder, user?.hiddenNavigationEntries]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const viewsResponse = await authApi.getNavigationViews().catch(() => ({ data: [] as NavigationViewResponse[] }));
        if (cancelled) return;
        setNavViews(Array.isArray(viewsResponse.data) ? viewsResponse.data : []);
        await loadDefaultScope();
      } catch {
        if (!cancelled) addToast('error', t('navigationOrder.loadError'));
      } finally {
        if (!cancelled) {
          setNavEntries(navCatalogEntries);
          setNavLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navCatalogEntries, loadDefaultScope, addToast, t]);

  const hasPersonalNavOverride = Array.isArray(user?.navigationOrder) && (user?.navigationOrder?.length ?? 0) > 0;
  const hasPersonalHiddenOverride = Array.isArray(user?.hiddenNavigationEntries);
  const navDirty = navOrder.join('|') !== navSavedOrder.join('|') || navHidden.join('|') !== navSavedHidden.join('|');

  const selectNavScope = (nextScope: string) => {
    if (navScope === nextScope) return;
    if (nextScope === DEFAULT_SCOPE) {
      setNavScope(DEFAULT_SCOPE);
      void loadDefaultScope().catch(() => addToast('error', t('navigationOrder.loadError')));
      return;
    }
    const view = navViews.find((entry) => entry.id === nextScope);
    if (!view) return;
    const effectiveOrder = effectiveOrderFor(view.navOrder);
    setNavScope(nextScope);
    setNavOrder(effectiveOrder);
    setNavSavedOrder(effectiveOrder);
    setNavHidden(view.hiddenEntries.filter((href) => catalogHrefs.has(href)));
    setNavSavedHidden(view.hiddenEntries.filter((href) => catalogHrefs.has(href)));
  };

  const refreshNavViews = async () => {
    try {
      const response = await authApi.getNavigationViews();
      setNavViews(Array.isArray(response.data) ? response.data : []);
    } catch {
      // keep the previous list if a refresh fails
    }
  };

  const saveNavOrder = async () => {
    setNavSaving(true);
    try {
      if (navScope === DEFAULT_SCOPE) {
        // Only send the fields that actually changed so hiding entries never
        // creates an unwanted order override (and vice versa).
        const orderChanged = navOrder.join('|') !== navSavedOrder.join('|');
        const hiddenChanged = navHidden.join('|') !== navSavedHidden.join('|');
        await authApi.updatePreferences({
          ...(orderChanged ? { navigationOrder: navOrder } : {}),
          ...(hiddenChanged ? { hiddenNavigationEntries: navHidden } : {}),
        });
        if (orderChanged) updateUserPreferences({ navigationOrder: navOrder });
        if (hiddenChanged) updateUserPreferences({ hiddenNavigationEntries: navHidden });
        setNavSavedOrder(navOrder);
        setNavSavedHidden(navHidden);
      } else {
        await authApi.updateNavigationView(navScope, { navOrder, hiddenEntries: navHidden });
        setNavSavedOrder(navOrder);
        setNavSavedHidden(navHidden);
        await refreshNavViews();
      }
      addToast('success', t('navigationOrder.saved'));
    } catch {
      addToast('error', t('navigationOrder.saveError'));
    } finally {
      setNavSaving(false);
    }
  };

  const clearNavOverride = async () => {
    setNavSaving(true);
    try {
      // Clears both personal overrides so the global defaults apply again.
      await authApi.updatePreferences({ navigationOrder: null, hiddenNavigationEntries: null });
      updateUserPreferences({ navigationOrder: null, hiddenNavigationEntries: null });
      await loadDefaultScope(null, null);
      addToast('success', t('navigationOrder.resetDone'));
    } catch {
      addToast('error', t('navigationOrder.saveError'));
    } finally {
      setNavSaving(false);
    }
  };

  const createNavView = async () => {
    const name = newViewName.trim();
    if (!name) return;
    setNavSaving(true);
    try {
      const created = await authApi.createNavigationView({
        name,
        navOrder,
        hiddenEntries: navHidden,
      });
      setNewViewName('');
      await refreshNavViews();
      const effectiveOrder = effectiveOrderFor(created.data.navOrder);
      setNavScope(created.data.id);
      setNavOrder(effectiveOrder);
      setNavSavedOrder(effectiveOrder);
      setNavHidden(created.data.hiddenEntries.filter((href) => catalogHrefs.has(href)));
      setNavSavedHidden(created.data.hiddenEntries.filter((href) => catalogHrefs.has(href)));
      addToast('success', t('navViews.created'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setNavSaving(false);
    }
  };

  const setDefaultNavView = async () => {
    if (navScope === DEFAULT_SCOPE) return;
    setNavSaving(true);
    try {
      await authApi.setDefaultNavigationView(navScope);
      await refreshNavViews();
      addToast('success', t('navViews.defaultSet'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setNavSaving(false);
    }
  };

  const deleteNavView = async () => {
    if (navScope === DEFAULT_SCOPE) return;
    setNavSaving(true);
    try {
      await authApi.deleteNavigationView(navScope);
      await refreshNavViews();
      setNavScope(DEFAULT_SCOPE);
      await loadDefaultScope();
      addToast('success', t('navViews.deleted'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setNavSaving(false);
    }
  };

  const selectedNavView = navViews.find((view) => view.id === navScope);

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
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                      {t('settings.oidcLinked')}
                      {user?.oidcProvider && (
                        <span className="ml-1 text-primary-500 dark:text-primary-400">
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
                {!user?.mfaEnabled && !mfaSetup && <button type="button" onClick={beginMfaSetup} className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">{t('settings.mfaSetup')}</button>}
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
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                {passwordError && <div className="text-sm text-red-600 dark:text-red-400">{passwordError}</div>}
                {passwordMessage && <div className="text-sm text-green-600 dark:text-green-400">{passwordMessage}</div>}
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
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
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de' | 'es' | 'fr')}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
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
                className="flex items-center px-4 py-2 border border-gray-300 dark:border-card rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

          {/* Navigation views (personal views + order/visibility editor) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {t('settings.navigationOrderTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {t('settings.navigationOrderDescription')}
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label htmlFor="settings-nav-view-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('navViews.scopeLabel')}
              </label>
              <select
                id="settings-nav-view-select"
                value={navScope}
                onChange={(event) => selectNavScope(event.target.value)}
                className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value={DEFAULT_SCOPE}>{t('navViews.defaultScope')}</option>
                {navViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}{view.isDefault ? ` (${t('navViews.defaultBadge')})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {navScope === DEFAULT_SCOPE && (
              <div className={`mb-4 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${hasPersonalNavOverride || hasPersonalHiddenOverride ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                {hasPersonalNavOverride || hasPersonalHiddenOverride ? t('navigationOrder.overrideActive') : t('navigationOrder.usingGlobal')}
              </div>
            )}
            {navLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            ) : (
              <>
                <NavigationOrderEditor
                  entries={navEntries}
                  value={navOrder}
                  onChange={setNavOrder}
                  disabled={navSaving}
                  hidden={navHidden}
                  onToggleHidden={(href) =>
                    setNavHidden((current) => (current.includes(href) ? current.filter((entry) => entry !== href) : [...current, href]))
                  }
                />
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={saveNavOrder}
                    disabled={!navDirty || navSaving}
                    className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {navSaving ? t('common.saving') : t('common.save')}
                  </button>
                  {navScope === DEFAULT_SCOPE && (
                    <button
                      type="button"
                      onClick={clearNavOverride}
                      disabled={!(hasPersonalNavOverride || hasPersonalHiddenOverride) || navSaving}
                      className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {t('navigationOrder.useGlobal')}
                    </button>
                  )}
                  {navDirty && <span className="text-xs text-amber-600 dark:text-amber-400">{t('navigationOrder.unsavedChanges')}</span>}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('navViews.personalTitle')}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('navViews.personalDescription')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newViewName}
                      onChange={(event) => setNewViewName(event.target.value)}
                      placeholder={t('navViews.newViewPlaceholder')}
                      className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      type="button"
                      onClick={createNavView}
                      disabled={!newViewName.trim() || navSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t('navViews.create')}
                    </button>
                    {navScope !== DEFAULT_SCOPE && (
                      <>
                        <button
                          type="button"
                          onClick={setDefaultNavView}
                          disabled={navSaving || selectedNavView?.isDefault}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <StarIcon className="h-4 w-4" />
                          {t('navViews.setDefault')}
                        </button>
                        <button
                          type="button"
                          onClick={deleteNavView}
                          disabled={navSaving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-300 dark:border-red-700 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <TrashIcon className="h-4 w-4" />
                          {t('navViews.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
