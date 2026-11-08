/**
 * App shell (Stage 6b, MT-2): left sidebar navigation + utility top bar.
 *
 * The former top-navigation strip and its JS width-measuring "More" overflow
 * logic (ResizeObserver / clientWidth) were removed; primary navigation now
 * lives in `Sidebar.tsx` (grouped, collapsible, off-canvas on mobile). The
 * top bar is a utility bar only: mobile drawer toggle, command-palette trigger
 * (⌘K), navigation-view switcher, Action Center bell, dark-mode toggle and the
 * user menu. Grouping/ordering/permission rules live in `sharedSidebarNav.ts`
 * and keep the admin-configured order + saved views authoritative.
 *
 * STAGE 6a PADDING VARIANT (unchosen-unchanged): the route container around
 * <Outlet /> is still a NEUTRAL fallback <div> that keeps the legacy base
 * padding/max-width for pages not yet migrated to PageShell. It does NOT render
 * a <main> landmark — exactly one `<main id="main-content">` per page is owned
 * by PageShell (see components/PageShell.tsx), which cancels this fallback
 * padding with matching negative margins so there is no double padding. The
 * sidebar sits left of this column and does not affect the horizontal padding
 * compensation, so PageShell stays untouched. See the inline comment at the
 * container for details.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useDensity } from '../context/DensityContext';
import {
  ShieldCheckIcon,
  CogIcon,
  ChevronDownIcon,
  UserIcon,
  KeyIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon, BellAlertIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  FireIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  Squares2X2Icon,
  SunIcon,
  MoonIcon,
  Bars3BottomLeftIcon,
  Bars3CenterLeftIcon,
} from '@heroicons/react/24/outline';
import { CommandPalette } from './CommandPalette';
import { Sidebar, type SidebarEntry } from './Sidebar';
import { isHrefActive, resolveSidebarIcon, SIDEBAR_EXTRA_CATALOG, type NavIcon } from './sharedSidebarNav';
import { useToast } from './useToast';
import type { CommandPaletteItem } from './CommandPalette';
import { useKeyboardShortcuts, type KeyboardShortcutBinding } from '../hooks/useKeyboardShortcuts';
import { searchApi, authApi, type NavigationViewResponse } from '../services/api';
import type { SearchEntityType } from '@shared/index';
import { NAVIGATION_CATALOG, applyNavigationView } from '@shared/navigation';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout, checkAuth } = useAuthStore();
  // Global default navigation config (admin-configured); per-user overrides and
  // saved views take precedence over it.
  const [globalNavConfig, setGlobalNavConfig] = useState<{ navOrder: string[]; hiddenEntries: string[] }>({ navOrder: [], hiddenEntries: [] });
  const [navViews, setNavViews] = useState<NavigationViewResponse[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const viewsMenuRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const { darkMode, toggleDarkMode, highContrast, toggleHighContrast } = useDarkMode();
  const { density, toggleDensity } = useDensity();
  const { addToast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Mobile off-canvas sidebar drawer (toggle lives in the utility top bar).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    authApi.getNavigationConfig()
      .then((response) => {
        if (cancelled) return;
        setGlobalNavConfig({
          navOrder: Array.isArray(response.data?.navOrder) ? response.data.navOrder : [],
          hiddenEntries: Array.isArray(response.data?.hiddenEntries) ? response.data.hiddenEntries : [],
        });
      })
      .catch(() => undefined); // fall back to the built-in catalog order
    authApi.getNavigationViews()
      .then((response) => {
        if (!cancelled && Array.isArray(response.data)) setNavViews(response.data);
      })
      .catch(() => undefined);
    authApi.getActiveNavigationView()
      .then((response) => {
        if (!cancelled) setActiveViewId(response.data?.view?.id ?? null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user]);

  // When the api layer fails to refresh the access token it clears the token
  // and broadcasts this event; log out locally and send the user back to the
  // login page with the current location preserved for a post-login redirect.
  useEffect(() => {
    const onSessionExpired = () => {
      addToast('warning', t('auth.sessionExpired'));
      logout();
      navigate('/login', { replace: true, state: { next: location.pathname + location.search } });
    };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, [addToast, t, logout, navigate, location]);

  useEffect(() => {
    if (!isLoading && user?.mustChangePasswordOnNext && location.pathname !== '/settings') {
      navigate('/settings');
    }
  }, [isLoading, user, navigate, location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [userMenuOpen]);

  // Same outside-click handling for the navigation-view switcher dropdown.
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!viewsMenuRef.current?.contains(event.target as Node)) setViewsMenuOpen(false);
    };
    if (viewsMenuOpen) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [viewsMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
    setViewsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setUserMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  // Close the command palette / help overlay on Escape. The mobile sidebar
  // drawer handles its own Escape/focus-trap logic inside Sidebar.tsx.
  useEffect(() => {
    const closeOverlay = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (paletteOpen) { setPaletteOpen(false); return; }
      if (helpOpen) { setHelpOpen(false); return; }
    };
    document.addEventListener('keydown', closeOverlay);
    return () => document.removeEventListener('keydown', closeOverlay);
  }, [paletteOpen, helpOpen]);

  // Ctrl/Cmd + K toggles the command palette; `?` toggles the help overlay.
  // These are handled separately from useKeyboardShortcuts because that hook
  // intentionally ignores modifier-key combinations.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const isAdmin = user?.roles?.includes('system_admin');

  // NOTE: All React hooks below must run on every render (unconditionally),
  // so the early returns for loading / unauthenticated states are placed after
  // the hook block, not before it.
  // Required permission per nav entry, mirroring the guards enforced by the
  // backend routes (requirePermission / authorizeEntityRead / requireAdminAccess).
  // Entries without a requirement are open to every authenticated user.
  const hasRequiredPermission = useCallback((required?: string | string[]): boolean => {
    if (!required) return true;
    // Sessions issued before permissions were added to /auth/me carry no list;
    // fall back to showing everything so navigation keeps working until the
    // session is refreshed.
    if (!user?.permissions) return true;
    const granted = new Set(user.permissions);
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.some((permission) => granted.has(permission));
  }, [user]);

  const navigation = useMemo(() => {
    const items = NAVIGATION_CATALOG
      .filter((entry) => !entry.adminOnly || isAdmin)
      .map((entry) => ({
        name: entry.nameKey ? t(entry.nameKey) : (entry.label ?? entry.href),
        href: entry.href,
        icon: resolveSidebarIcon(entry.href),
        permission: entry.permission,
      }));
    const permitted = items.filter((item) => hasRequiredPermission(item.permission));
    // Resolve the effective view: an explicitly selected saved view wins, then
    // the legacy per-user order override, then the global default config.
    // In both default-scope branches the personal hidden list (when set) replaces
    // the globally hidden entries; null falls back to the global configuration.
    const activeView = navViews.find((view) => view.id === activeViewId);
    if (activeView) {
      return applyNavigationView(permitted, activeView);
    }
    const effectiveHiddenEntries = Array.isArray(user?.hiddenNavigationEntries)
      ? user.hiddenNavigationEntries
      : globalNavConfig.hiddenEntries;
    if (Array.isArray(user?.navigationOrder) && user.navigationOrder.length > 0) {
      return applyNavigationView(permitted, {
        navOrder: user.navigationOrder,
        hiddenEntries: effectiveHiddenEntries,
      });
    }
    return applyNavigationView(permitted, { ...globalNavConfig, hiddenEntries: effectiveHiddenEntries });
  }, [t, isAdmin, hasRequiredPermission, user?.navigationOrder, user?.hiddenNavigationEntries, globalNavConfig, navViews, activeViewId]);

  // Sidebar feed: the admin-ordered catalog entries (already permission- and
  // view-filtered) plus the fixed non-catalog entries. Sidebar re-applies its
  // identical permission gate for the extras and groups everything; within a
  // group the incoming order is preserved, so admin ordering stays authoritative.
  const sidebarEntries = useMemo<SidebarEntry[]>(() => {
    const catalogEntries: SidebarEntry[] = navigation.map((item) => ({ href: item.href, name: item.name }));
    const extraEntries: SidebarEntry[] = SIDEBAR_EXTRA_CATALOG
      .filter((entry) => !catalogEntries.some((item) => item.href === entry.href))
      .map((entry) => ({
        href: entry.href,
        name: entry.nameKey ? t(entry.nameKey) : (entry.label ?? entry.href),
        permission: entry.permission,
      }));
    return [...catalogEntries, ...extraEntries];
  }, [navigation, t]);

  const switchView = useCallback((viewId: string | null) => {
    setViewsMenuOpen(false);
    authApi.setActiveNavigationView(viewId)
      .then((response) => setActiveViewId(response.data?.view?.id ?? null))
      .catch(() => addToast('error', t('navigation.views.switchFailed')));
  }, [addToast, t]);

  const availableNavViews = useMemo(
    () => navViews.filter((view) => view.ownerId === null || view.ownerId === user?.id),
    [navViews, user?.id],
  );
  const activeViewName = useMemo(() => {
    const view = availableNavViews.find((entry) => entry.id === activeViewId);
    return view ? view.name : t('navigation.views.default');
  }, [availableNavViews, activeViewId, t]);

  const isActive = (href: string) => isHrefActive(location.pathname, href);

  // List pages are the ones that expose a "create" action via `n`.
  const isListPage = ['/assets', '/risks', '/incidents', '/tickets'].includes(location.pathname);

  // Dispatch a create request to the active list page (creation is modal-based,
  // so there is no dedicated create route). Pages listen for `am:new-*`.
  const handleNew = useCallback(() => {
    if (location.pathname.startsWith('/assets')) {
      document.dispatchEvent(new CustomEvent('am:new-asset'));
    } else if (location.pathname.startsWith('/tickets')) {
      document.dispatchEvent(new CustomEvent('am:new-ticket'));
    }
  }, [location.pathname]);

  const shortcuts = useMemo<KeyboardShortcutBinding[]>(() => {
    const bindings: KeyboardShortcutBinding[] = [
      { sequence: ['g', 'a'], onTrigger: () => navigate('/assets') },
      { sequence: ['g', 'r'], onTrigger: () => navigate('/risks') },
      { sequence: ['g', 'i'], onTrigger: () => navigate('/incidents') },
      { sequence: ['g', 't'], onTrigger: () => navigate('/tickets') },
    ];
    if (isListPage) {
      bindings.push({ sequence: ['n'], onTrigger: () => handleNew() });
    }
    return bindings;
  }, [isListPage, navigate, handleNew]);

  useKeyboardShortcuts(shortcuts);

  // Global full-text search across every entity type the user may read. The
  // backend returns results grouped by type (top hits per category, permission
  // filtered). Results are marked filterable:false so the palette does not
  // re-filter them, and each group header offers a "show all" action that
  // deep-links into the module list with the query prefilled.
  const [entityResults, setEntityResults] = useState<CommandPaletteItem[]>([]);
  const entitySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entitySearchSeq = useRef(0);

  const searchGroupMeta = useMemo(() => ({
    assets: { labelKey: 'navigation.assets', icon: CubeIcon, listRoute: '/assets' },
    tickets: { labelKey: 'navigation.tickets', icon: ClipboardDocumentListIcon, listRoute: '/tickets' },
    incidents: { labelKey: 'navigation.incidents', icon: FireIcon, listRoute: '/incidents' },
    risks: { labelKey: 'navigation.risks', icon: ExclamationTriangleIcon, listRoute: '/risks' },
    controls: { labelKey: 'navigation.controls', icon: ShieldCheckIcon, listRoute: '/controls' },
    contracts: { labelKey: 'navigation.contracts', icon: DocumentTextIcon, listRoute: '/contracts' },
    licenses: { labelKey: 'navigation.licenses', icon: ClipboardDocumentListIcon, listRoute: '/licenses' },
    suppliers: { labelKey: 'navigation.supplyChain', icon: BuildingStorefrontIcon, listRoute: '/supply-chain' },
    knowledge: { labelKey: 'navigation.knowledgeBase', icon: DocumentTextIcon, listRoute: '/knowledge-base' },
  } satisfies Record<SearchEntityType, { labelKey: string; icon: NavIcon; listRoute: string }>), []);

  const runEntitySearch = useCallback((rawQuery: string) => {
    const query = rawQuery.trim();
    const sequence = ++entitySearchSeq.current;
    if (query.length < 2) {
      setEntityResults([]);
      return;
    }
    void (async () => {
      try {
        const response = await searchApi.global({ q: query, limit: 5 });
        if (sequence !== entitySearchSeq.current) return; // stale response
        const results: CommandPaletteItem[] = [];
        for (const group of response.data.groups) {
          const meta = searchGroupMeta[group.entityType];
          if (!meta) continue;
          const sectionLabel = t(meta.labelKey);
          group.items.forEach((item, index) => {
            results.push({
              id: `entity-${group.entityType}-${item.id}`,
              label: item.title,
              description: item.displayId ?? undefined,
              icon: meta.icon,
              section: sectionLabel,
              filterable: false,
              // "Show all" action on the group header → module list with query.
              ...(index === 0 && group.total > group.items.length ? {
                sectionActionLabel: t('search.showAll'),
                onSectionAction: () => {
                  navigate(`${meta.listRoute}?search=${encodeURIComponent(query)}`);
                  setPaletteOpen(false);
                },
              } : {}),
              onSelect: () => { navigate(item.route); setPaletteOpen(false); },
            });
          });
        }
        setEntityResults(results);
      } catch {
        if (sequence === entitySearchSeq.current) setEntityResults([]);
      }
    })();
  }, [navigate, t, searchGroupMeta]);

  const handlePaletteQueryChange = useCallback((query: string) => {
    if (entitySearchTimer.current) clearTimeout(entitySearchTimer.current);
    entitySearchTimer.current = setTimeout(() => runEntitySearch(query), 250);
  }, [runEntitySearch]);

  // Clear pending searches and results whenever the palette closes.
  useEffect(() => {
    if (!paletteOpen) {
      if (entitySearchTimer.current) clearTimeout(entitySearchTimer.current);
      entitySearchSeq.current += 1;
      setEntityResults([]);
    }
  }, [paletteOpen]);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = navigation.map((item) => ({
      id: item.href,
      label: item.name,
      description: item.href,
      icon: item.icon,
      onSelect: () => { navigate(item.href); setPaletteOpen(false); },
    }));
    const extras: CommandPaletteItem[] = [
      { id: 'action-center', label: t('navigation.actionCenter'), description: t('navigation.actionCenter'), icon: BellAlertIcon, onSelect: () => { navigate('/action-center'); setPaletteOpen(false); } },
      { id: 'settings', label: t('settings.title'), description: t('settings.title'), icon: CogIcon, onSelect: () => { navigate('/settings'); setPaletteOpen(false); } },
    ];
    return [...items, ...extras, ...entityResults];
  }, [navigation, t, navigate, entityResults]);

  const helpEntries = useMemo(() => {
    const entries: { keys: string[]; description: string }[] = [
      { keys: ['g', 'a'], description: t('shortcuts.goToAssets') },
      { keys: ['g', 'r'], description: t('shortcuts.goToRisks') },
      { keys: ['g', 'i'], description: t('shortcuts.goToIncidents') },
      { keys: ['g', 't'], description: t('shortcuts.goToTickets') },
      { keys: ['⌘', 'k'], description: t('shortcuts.commandPalette') },
      { keys: ['?'], description: t('shortcuts.showHelp') },
    ];
    if (isListPage) {
      entries.push({ keys: ['n'], description: t('shortcuts.newItem') });
    }
    return entries;
  }, [t, isListPage]);

  // Early returns must come after all hook declarations.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-sm text-text-secondary">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      {/* Skip to content link for keyboard users — must stay the first focusable element. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded shadow-md"
      >
        {t('common.skipToContent')}
      </a>

      {/* Primary navigation: grouped sidebar (fixed rail on lg+, drawer below). */}
      <Sidebar
        entries={sidebarEntries}
        userPermissions={user.permissions ?? null}
        isAdmin={Boolean(isAdmin)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Content column: utility top bar + route outlet. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-default/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            {/* Left: brand (mobile only — the desktop rail shows the app name). */}
            <div className="flex min-w-0 items-center lg:hidden">
              <ShieldCheckIcon className="h-7 w-7 flex-shrink-0 text-primary-600" aria-hidden="true" />
              <span className="ml-2 truncate text-base font-bold text-text-primary">{t('navigation.applicationName')}</span>
            </div>

            {/* Right: utility controls (drawer toggle, palette, views, bell, theme, user). */}
            <div className="ml-auto flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mr-2 rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-controls="sidebar-drawer"
                aria-label={t('navigation.toggleMenu')}
              >
                {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>
              {availableNavViews.length > 0 && (
                <div ref={viewsMenuRef} className="relative mr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewsMenuOpen((open) => !open);
                    }}
                    aria-haspopup="menu"
                    aria-controls="navigation-view-menu"
                    aria-expanded={viewsMenuOpen}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    title={t('navigation.views.switchTooltip')}
                  >
                    <Squares2X2Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="hidden max-w-32 truncate sm:inline">{activeViewName}</span>
                    <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {viewsMenuOpen && (
                    <div
                      id="navigation-view-menu"
                      role="menu"
                      className="absolute right-0 mt-2 w-64 rounded-md border border-border-subtle bg-surface-raised py-1 shadow-e2 z-50"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => switchView(null)}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          activeViewId === null
                            ? 'bg-surface-hover text-text-primary'
                            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        }`}
                      >
                        {t('navigation.views.default')}
                      </button>
                      {availableNavViews.map((view) => (
                        <button
                          key={view.id}
                          type="button"
                          role="menuitem"
                          onClick={() => switchView(view.id)}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            view.id === activeViewId
                              ? 'bg-surface-hover text-text-primary'
                              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          {view.name}
                          {view.ownerId === null && (
                            <span className="ml-2 text-xs text-text-muted">
                              {t('navigation.views.globalBadge')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Global search entry point — opens the command palette, which
                  shows grouped full-text suggestions while typing. The Ctrl/Cmd+K
                  hint mirrors the keyboard shortcut above. */}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="mr-2 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken px-3 py-1.5 text-sm font-medium text-text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                aria-label={t('search.buttonLabel')}
              >
                <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('search.buttonLabel')}</span>
                <kbd className="hidden md:inline-block rounded border border-border-subtle bg-surface-default px-1.5 text-xs font-sans leading-4">Ctrl K</kbd>
              </button>
              <Link to="/action-center" data-testid="action-center-nav" className={`relative mr-2 rounded-md p-2 transition-colors duration-fast ${isActive('/action-center') ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`} aria-label={t('navigation.actionCenter')}>
                <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
              {/* Dark-mode toggle (semantic tokens switch via the .dark class). */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="mr-1 rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                aria-label={t('settings.darkMode')}
                title={t('settings.darkMode')}
              >
                {darkMode ? <SunIcon className="h-5 w-5" aria-hidden="true" /> : <MoonIcon className="h-5 w-5" aria-hidden="true" />}
              </button>
              {/* Global density toggle (Stage 10b / LT-3): compact vs. comfortable,
                  persisted per user via DensityProvider; lists read it through
                  DataTableShell/useTableDensity. */}
              <button
                type="button"
                onClick={toggleDensity}
                aria-pressed={density === 'compact'}
                className="mr-1 rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                aria-label={`${t('common.density')}: ${density === 'compact' ? t('common.densityCompact') : t('common.densityComfortable')}`}
                title={`${t('common.density')}: ${density === 'compact' ? t('common.densityCompact') : t('common.densityComfortable')}`}
              >
                {density === 'compact' ? <Bars3CenterLeftIcon className="h-5 w-5" aria-hidden="true" /> : <Bars3BottomLeftIcon className="h-5 w-5" aria-hidden="true" />}
              </button>
              {/* High-contrast toggle (Stage 10c / LT-6): applies .contrast-high on
                  <html>, which overrides the semantic CSS variables only; persisted
                  per device via DarkModeContext in localStorage 'am.contrast'. */}
              <button
                type="button"
                onClick={toggleHighContrast}
                aria-pressed={highContrast}
                className="mr-1 rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                aria-label={`${t('common.highContrast')}: ${highContrast ? t('common.highContrastOn') : t('common.highContrastOff')}`}
                title={`${t('common.highContrast')}: ${highContrast ? t('common.highContrastOn') : t('common.highContrastOff')}`}
              >
                {/* Half-filled circle — the conventional contrast symbol. */}
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3a9 9 0 0 1 0 18V3z" fill="currentColor" stroke="none" />
                </svg>
              </button>

              {/* User Menu */}
              <div ref={userMenuRef} className="relative ml-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserMenuOpen(!userMenuOpen);
                  }}
                  className="flex items-center space-x-2 text-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  aria-haspopup="menu"
                  aria-controls="user-menu"
                  aria-expanded={userMenuOpen}
                  aria-label={t('navigation.userMenu')}
                >
                  <UserIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden max-w-36 truncate font-medium sm:inline">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-md border border-border-subtle bg-surface-raised py-1 shadow-e2 z-50"
                  >
                    <div className="border-b border-border-subtle px-4 py-2">
                      <div className="text-sm font-medium text-text-primary">
                        {user?.email}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {user?.isOidcLinked ? (
                          <span className="text-primary-600">
                            {t('settings.oidcLinked')}
                          </span>
                        ) : (
                          <span>{t('settings.localAccount')}</span>
                        )}
                      </div>
                    </div>
                    <Link
                      to="/settings"
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CogIcon className="h-4 w-4 inline mr-2" />
                      {t('settings.title')}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 transition-colors duration-fast hover:bg-surface-hover dark:text-red-400"
                    >
                      <KeyIcon className="h-4 w-4 inline mr-2" />
                      {t('navigation.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Stage 6a (MT-1) padding variant — chosen approach: this route
            container is a NEUTRAL fallback box. It keeps the previous base
            padding but applies NO max-width (PageShell is the single width
            instance), and it no longer renders a <main> landmark.
            Pages migrated to PageShell cancel this base padding with matching
            negative margins (see PageShell.tsx header) and provide the single
            `<main id="main-content">` themselves — skip-link target included.
            Do NOT reintroduce a <main> here; exactly one per page, owned by
            PageShell. The sidebar sits outside this column, so the horizontal
            negative-margin compensation is unaffected (Stage 6b). */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        placeholder={t('shortcuts.commandPalettePlaceholder')}
        title={t('shortcuts.commandPalette')}
        onQueryChange={handlePaletteQueryChange}
      />

      {helpOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-gray-900/50 p-4 dark:bg-black/50"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('shortcuts.title')}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('shortcuts.title')}</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label={t('common.close')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <ul className="max-h-96 space-y-3 overflow-y-auto p-4 text-sm" role="list">
              {helpEntries.map((entry, index) => (
                <li key={index} className="flex items-center justify-between gap-4" role="listitem">
                  <span className="text-gray-700 dark:text-gray-300">{entry.description}</span>
                  <span className="flex flex-shrink-0 items-center gap-1">
                    {entry.keys.map((key, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300"
                      >
                        {key}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              {t('shortcuts.pressToClose')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
