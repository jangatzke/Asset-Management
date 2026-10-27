import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { ArrowUturnLeftIcon, InformationCircleIcon, PlusIcon, StarIcon, TrashIcon } from '@heroicons/react/24/outline';
import NavigationOrderEditor, { type NavigationOrderEntry } from '../components/NavigationOrderEditor';
import { adminApi, type NavigationViewResponse } from '../services/api';
import { useAuthStore } from '../store/auth';
import { NAVIGATION_CATALOG, applyNavigationOrder } from '@shared/navigation';
import { useToast } from '../components/useToast';

const DEFAULT_SCOPE = '__default__';

const AdminNavigation = () => {
  const { t } = useI18n();
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const [entries, setEntries] = useState<NavigationOrderEntry[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [savedHidden, setSavedHidden] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [views, setViews] = useState<NavigationViewResponse[]>([]);
  const [scope, setScope] = useState<string>(DEFAULT_SCOPE); // DEFAULT_SCOPE or a view id
  const [newViewName, setNewViewName] = useState('');

  // Editable catalog: admin-only entries are only shown to admins so that the
  // editor matches what each admin actually sees in the header.
  const catalogEntries = useMemo<NavigationOrderEntry[]>(() => {
    const isAdmin = (user?.roles ?? []).includes('system_admin');
    return NAVIGATION_CATALOG
      .filter((entry) => !entry.adminOnly || isAdmin)
      .map((entry) => ({ href: entry.href, label: entry.nameKey ? t(entry.nameKey) : (entry.label ?? entry.href) }));
  }, [t, user?.roles]);

  const catalogHrefs = useMemo(() => new Set(catalogEntries.map((entry) => entry.href)), [catalogEntries]);

  const effectiveOrderFor = useCallback((stored: string[]) => applyNavigationOrder(
    catalogEntries.map((entry) => ({ ...entry })),
    stored.filter((href) => catalogHrefs.has(href)),
  ).map((entry) => entry.href), [catalogEntries, catalogHrefs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [configResponse, viewsResponse] = await Promise.all([
          adminApi.getNavigationConfig(),
          adminApi.getGlobalNavigationViews().catch(() => ({ data: [] as NavigationViewResponse[] })),
        ]);
        if (cancelled) return;
        setViews(Array.isArray(viewsResponse.data) ? viewsResponse.data : []);
        const stored = Array.isArray(configResponse.data?.navOrder) ? configResponse.data.navOrder : [];
        const storedHidden = Array.isArray(configResponse.data?.hiddenEntries) ? configResponse.data.hiddenEntries : [];
        const effectiveOrder = effectiveOrderFor(stored);
        setScope(DEFAULT_SCOPE);
        setOrder(effectiveOrder);
        setSavedOrder(effectiveOrder);
        setHidden(storedHidden.filter((href: string) => catalogHrefs.has(href)));
        setSavedHidden(storedHidden.filter((href: string) => catalogHrefs.has(href)));
      } catch {
        if (!cancelled) addToast('error', t('navigationOrder.loadError'));
      } finally {
        if (!cancelled) {
          setEntries(catalogEntries);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [catalogEntries, catalogHrefs, effectiveOrderFor, addToast, t]);

  const selectScope = (nextScope: string) => {
    if (scope === nextScope) return;
    if (nextScope === DEFAULT_SCOPE) {
      void adminApi.getNavigationConfig().then((response) => {
        const stored = Array.isArray(response.data?.navOrder) ? response.data.navOrder : [];
        const storedHidden = Array.isArray(response.data?.hiddenEntries) ? response.data.hiddenEntries : [];
        const effectiveOrder = effectiveOrderFor(stored);
        setScope(DEFAULT_SCOPE);
        setOrder(effectiveOrder);
        setSavedOrder(effectiveOrder);
        setHidden(storedHidden.filter((href: string) => catalogHrefs.has(href)));
        setSavedHidden(storedHidden.filter((href: string) => catalogHrefs.has(href)));
      });
      return;
    }
    const view = views.find((entry) => entry.id === nextScope);
    if (!view) return;
    const effectiveOrder = effectiveOrderFor(view.navOrder);
    setScope(nextScope);
    setOrder(effectiveOrder);
    setSavedOrder(effectiveOrder);
    setHidden(view.hiddenEntries.filter((href) => catalogHrefs.has(href)));
    setSavedHidden(view.hiddenEntries.filter((href) => catalogHrefs.has(href)));
  };

  const dirty = order.join('|') !== savedOrder.join('|') || hidden.join('|') !== savedHidden.join('|');

  const refreshViews = async () => {
    try {
      const response = await adminApi.getGlobalNavigationViews();
      setViews(Array.isArray(response.data) ? response.data : []);
    } catch {
      // keep the previous list if a refresh fails
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (scope === DEFAULT_SCOPE) {
        await adminApi.updateNavigationConfig(order, hidden);
      } else {
        await adminApi.updateGlobalNavigationView(scope, { navOrder: order, hiddenEntries: hidden });
      }
      setSavedOrder(order);
      setSavedHidden(hidden);
      addToast('success', t('navigationOrder.saved'));
    } catch {
      addToast('error', t('navigationOrder.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await adminApi.resetNavigationConfig();
      const defaultOrder = catalogEntries.map((entry) => entry.href);
      setOrder(defaultOrder);
      setSavedOrder(defaultOrder);
      setHidden([]);
      setSavedHidden([]);
      addToast('success', t('navigationOrder.resetDone'));
    } catch {
      addToast('error', t('navigationOrder.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateView = async () => {
    const name = newViewName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const created = await adminApi.createGlobalNavigationView({
        name,
        navOrder: order,
        hiddenEntries: hidden,
      });
      setNewViewName('');
      await refreshViews();
      selectScope(created.data.id);
      addToast('success', t('navViews.created'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    if (scope === DEFAULT_SCOPE) return;
    setSaving(true);
    try {
      await adminApi.setDefaultGlobalNavigationView(scope);
      await refreshViews();
      addToast('success', t('navViews.defaultSet'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteView = async () => {
    if (scope === DEFAULT_SCOPE) return;
    setSaving(true);
    try {
      await adminApi.deleteGlobalNavigationView(scope);
      await refreshViews();
      selectScope(DEFAULT_SCOPE);
      addToast('success', t('navViews.deleted'));
    } catch {
      addToast('error', t('navViews.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const selectedView = views.find((view) => view.id === scope);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('navigationOrder.title')}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{t('navigationOrder.description')}</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start gap-3 mb-6 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
          <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{t('navigationOrder.hint')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label htmlFor="nav-view-select" className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('navViews.scopeLabel')}
          </label>
          <select
            id="nav-view-select"
            value={scope}
            onChange={(event) => selectScope(event.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value={DEFAULT_SCOPE}>{t('navViews.defaultScope')}</option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}{view.isDefault ? ` (${t('navViews.defaultBadge')})` : ''}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : (
          <>
            <NavigationOrderEditor
              entries={entries}
              value={order}
              onChange={setOrder}
              disabled={saving}
              hidden={hidden}
              onToggleHidden={(href) =>
                setHidden((current) => (current.includes(href) ? current.filter((entry) => entry !== href) : [...current, href]))
              }
            />

            <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
              {scope === DEFAULT_SCOPE && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                  {t('navigationOrder.reset')}
                </button>
              )}
              {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">{t('navigationOrder.unsavedChanges')}</span>}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('navViews.globalTitle')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('navViews.globalDescription')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newViewName}
                  onChange={(event) => setNewViewName(event.target.value)}
                  placeholder={t('navViews.newViewPlaceholder')}
                  className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={handleCreateView}
                  disabled={!newViewName.trim() || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t('navViews.create')}
                </button>
                {scope !== DEFAULT_SCOPE && (
                  <>
                    <button
                      type="button"
                      onClick={handleSetDefault}
                      disabled={saving || selectedView?.isDefault}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <StarIcon className="h-4 w-4" />
                      {t('navViews.setDefault')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteView}
                      disabled={saving}
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
  );
};

export default AdminNavigation;
