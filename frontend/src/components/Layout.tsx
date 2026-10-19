import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import {
  HomeIcon,
  CubeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  FireIcon,
  Cog6ToothIcon,
  CogIcon,
  ChevronDownIcon,
  UserIcon,
  KeyIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon, BellAlertIcon,
  BanknotesIcon,
  ServerIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  BuildingStorefrontIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { CommandPalette } from './CommandPalette';
import { useToast } from './useToast';
import type { CommandPaletteItem } from './CommandPalette';
import { useKeyboardShortcuts, type KeyboardShortcutBinding } from '../hooks/useKeyboardShortcuts';
import { assetApi, ticketApi, incidentApi, authApi, type NavigationViewResponse } from '../services/api';
import { NAVIGATION_CATALOG, applyNavigationView } from '@shared/navigation';

// Icons live in the frontend; the shared catalog owns hrefs/labels/permissions.
const NAV_ICONS: Record<string, typeof HomeIcon> = {
  '/': HomeIcon,
  '/assets': CubeIcon,
  '/risks': ExclamationTriangleIcon,
  '/controls': ShieldCheckIcon,
  '/incidents': FireIcon,
  '/tickets': ClipboardDocumentListIcon,
  '/service-catalog': ClipboardDocumentListIcon,
  '/nis2': ShieldCheckIcon,
  '/contracts': DocumentTextIcon,
  '/licenses': ClipboardDocumentListIcon,
  '/processes': ServerIcon,
  '/cost-planning': BanknotesIcon,
  '/isms-operations': ChartBarIcon,
  '/kri-dashboard': ChartBarIcon,
  '/knowledge-base': DocumentTextIcon,
  '/supply-chain': BuildingStorefrontIcon,
  '/control-coverage': ShieldCheckIcon,
  '/isms-operations/process': ClipboardDocumentCheckIcon,
  '/risk-aggregation': ChartBarIcon,
  '/admin/users': Cog6ToothIcon,
};

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
  const { addToast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const navMeasureRef = useRef<HTMLDivElement>(null);
  // null until the first measurement runs, then the number of desktop nav items
  // that fit in the header; the rest are collapsed into a "More" dropdown.
  const [visibleNavCount, setVisibleNavCount] = useState<number | null>(null);

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

  // Same outside-click handling for the overflow ("More") navigation dropdown.
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    };
    if (moreMenuOpen) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [moreMenuOpen]);

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
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setMoreMenuOpen(false);
    setViewsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      setUserMenuOpen(false);
      setMoreMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  // Close the command palette / help overlay on Escape.
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
        icon: NAV_ICONS[entry.href] ?? CogIcon,
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

  const isActive = (href: string) => {
    if (href === '/admin/users' && location.pathname.startsWith('/admin')) {
      return true;
    }
    if (href === '/isms-operations') {
      return location.pathname === '/isms-operations' || location.pathname === '/isms-phase6';
    }
    // Exact match or sub-path match (e.g. /isms-operations/process)
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  // Responsive navigation: measure how many desktop entries fit in the header
  // and collapse the rest into a "More" dropdown instead of scrolling/clipping.
  useLayoutEffect(() => {
    const container = navContainerRef.current;
    const logo = logoRef.current;
    const measure = navMeasureRef.current;
    if (!container || !logo || !measure) return;

    const NAV_GAP = 4; // matches lg:gap-1 on the strip
    const LOGO_NAV_MARGIN = 24; // matches lg:ml-6 between logo and nav strip
    const MORE_BUTTON_RESERVE = 110; // width reserved for the "More" trigger

    const countFitting = (widths: number[], available: number) => {
      let used = 0;
      let count = 0;
      for (const width of widths) {
        if (used + (count > 0 ? NAV_GAP : 0) + width > available) break;
        used += width + (count > 0 ? NAV_GAP : 0);
        count++;
      }
      return count;
    };

    const computeVisibleCount = () => {
      const items = Array.from(measure.children) as HTMLElement[];
      if (items.length === 0) {
        setVisibleNavCount(0);
        return;
      }
      // The container is a flex-1 element, so its width reflects the space that
      // is actually available for navigation regardless of its content.
      const available = container.clientWidth - logo.getBoundingClientRect().width - LOGO_NAV_MARGIN;
      const widths = items.map((el) => el.getBoundingClientRect().width);
      let count = countFitting(widths, available);
      if (count < items.length) {
        // Not everything fits: reserve space for the "More" trigger and recount.
        count = countFitting(widths, available - MORE_BUTTON_RESERVE);
      }
      setVisibleNavCount(count);
    };

    computeVisibleCount();
    const observer = new ResizeObserver(computeVisibleCount);
    // Observe both the container (window resizes) and the offscreen clone
    // (webfont loading can change item widths without any resize event).
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [navigation]);

  const visibleCount = visibleNavCount ?? 0;
  const primaryNavItems = navigation.slice(0, visibleCount);
  const overflowNavItems = navigation.slice(visibleCount);
  const moreMenuActive = overflowNavItems.some((item) => isActive(item.href));

  const navLinkClass = (href: string) => `px-2 xl:px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
    isActive(href)
      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
  }`;

  const renderNavLink = (item: { name: string; href: string; icon: typeof HomeIcon }) => (
    <Link key={item.href} to={item.href} className={navLinkClass(item.href)}>
      <item.icon className="h-5 w-5 inline mr-1" />
      {item.name}
    </Link>
  );

  const adminSubPages = [
    { name: t('navigation.userManagement'), href: '/admin/users' },
    { name: t('navigation.roleManagement'), href: '/admin/roles' },
    { name: t('navigation.groupManagement'), href: '/admin/groups' },
    { name: t('navigation.assetTypes'), href: '/admin/asset-types' },
    { name: t('navigation.organizationUnits'), href: '/admin/organization-units' },
    { name: t('navigation.oidcConfig'), href: '/admin/oidc' },
    { name: t('navigation.authSettings'), href: '/admin/auth-settings' },
    { name: t('navigation.navigationOrder'), href: '/admin/navigation' },
    { name: t('intune.title'), href: '/admin/intune' },
    { name: t('navigation.vmwareConfig'), href: '/admin/vmware' },
    { name: t('navigation.proxmoxConfig'), href: '/admin/proxmox' },
    { name: t('navigation.reminderSettings'), href: '/admin/reminders' },
    { name: t('slaEscalation.title'), href: '/admin/sla-escalation' },
    { name: t('emailGateway.title'), href: '/admin/email-gateway' },
    { name: t('aiAssistant.title'), href: '/admin/ai' },
    { name: t('navigation.fiscalYearSettings'), href: '/admin/fiscal-year' },
    { name: t('navigation.databaseBackup'), href: '/admin/database' },
    { name: t('navigation.ticketSlaSettings'), href: '/admin/ticket-slas' },
  ];

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

  // Global entity search across assets, tickets and incidents. Results are
  // fetched server-side (each list endpoint already supports ?search=),
  // marked filterable:false so the palette does not re-filter them, and
  // rendered under section headings below the static navigation commands.
  const [entityResults, setEntityResults] = useState<CommandPaletteItem[]>([]);
  const entitySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entitySearchSeq = useRef(0);

  const runEntitySearch = useCallback((rawQuery: string) => {
    const query = rawQuery.trim();
    const sequence = ++entitySearchSeq.current;
    if (query.length < 2) {
      setEntityResults([]);
      return;
    }
    void (async () => {
      const results: CommandPaletteItem[] = [];
      const [assetRes, ticketRes, incidentRes] = await Promise.allSettled([
        assetApi.list({ search: query, limit: 5, page: 1 }),
        ticketApi.list({ search: query, limit: 5, page: 1 }),
        incidentApi.list({ search: query, limit: 5, page: 1 }),
      ]);
      if (assetRes.status === 'fulfilled') {
        const rows: any[] = (assetRes.value as any)?.data?.data ?? (Array.isArray((assetRes.value as any)?.data) ? (assetRes.value as any).data : []);
        rows.slice(0, 5).forEach((row: any) => results.push({
          id: `entity-asset-${row.id}`,
          label: row.name ?? row.displayId ?? row.id,
          description: row.displayId ? `${t('navigation.assets')} · ${row.displayId}` : t('navigation.assets'),
          icon: CubeIcon,
          section: t('navigation.assets'),
          filterable: false,
          onSelect: () => { navigate(`/assets/${row.id}`); setPaletteOpen(false); },
        }));
      }
      if (ticketRes.status === 'fulfilled') {
        const rows: any[] = (ticketRes.value as any)?.data?.data ?? [];
        rows.slice(0, 5).forEach((row: any) => results.push({
          id: `entity-ticket-${row.id}`,
          label: row.title ?? row.displayId ?? row.id,
          description: row.displayId ? `${t('navigation.tickets')} · ${row.displayId}` : t('navigation.tickets'),
          icon: ClipboardDocumentListIcon,
          section: t('navigation.tickets'),
          filterable: false,
          onSelect: () => { navigate(`/tickets/${row.id}`); setPaletteOpen(false); },
        }));
      }
      if (incidentRes.status === 'fulfilled') {
        const rows: any[] = (incidentRes.value as any)?.data?.data ?? (Array.isArray((incidentRes.value as any)?.data) ? (incidentRes.value as any).data : []);
        rows.slice(0, 5).forEach((row: any) => results.push({
          id: `entity-incident-${row.id}`,
          label: row.title ?? row.id,
          description: t('navigation.incidents'),
          icon: ExclamationTriangleIcon,
          section: t('navigation.incidents'),
          filterable: false,
          onSelect: () => { navigate(`/incidents/${row.id}`); setPaletteOpen(false); },
        }));
      }
      if (sequence === entitySearchSeq.current) {
        setEntityResults(results);
      }
    })();
  }, [navigate, t]);

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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded shadow-md"
      >
        {t('common.skipToContent')}
      </a>
      <nav className="bg-white dark:bg-gray-800 shadow-sm" aria-label={t('navigation.mainNavigation')}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between min-h-16 gap-3 py-2 lg:py-0">
            {/* No overflow-hidden here: the responsive collapse keeps the nav
                within bounds, and clipping would also cut off the "More"
                dropdown panel. */}
            <div ref={navContainerRef} className="flex items-center flex-1 min-w-0">
                <div ref={logoRef} className="flex-shrink-0 flex items-center min-w-0">
                  <ShieldCheckIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white truncate">
                  {t('navigation.applicationName')}
                </span>
              </div>
               {/* Responsive nav strip: entries that fit are rendered inline and
                   the rest collapse into a "More" dropdown. This avoids both the
                   old clipping (overflow-hidden) and an ugly scrollbar. */}
               <div className="hidden lg:ml-6 lg:flex lg:items-center lg:gap-1 min-w-0">
                 {primaryNavItems.map(renderNavLink)}
                 {visibleNavCount !== null && overflowNavItems.length > 0 && (
                   <div ref={moreMenuRef} className="relative">
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         setMoreMenuOpen((open) => !open);
                       }}
                       aria-haspopup="menu"
                       aria-controls="overflow-navigation-menu"
                       aria-expanded={moreMenuOpen}
                       className={`px-2 xl:px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap inline-flex items-center gap-1 ${
                         moreMenuActive
                           ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                           : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                       }`}
                     >
                       {t('navigation.moreNavigation')}
                       <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                     </button>
                     {moreMenuOpen && (
                       <div
                         id="overflow-navigation-menu"
                         role="menu"
                         className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                       >
                         {overflowNavItems.map((item) => (
                           <Link
                             key={item.href}
                             to={item.href}
                             role="menuitem"
                             onClick={() => setMoreMenuOpen(false)}
                             className={`block px-4 py-2 text-sm ${
                               isActive(item.href)
                                 ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                                 : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                             }`}
                           >
                             <item.icon className="h-4 w-4 inline mr-2" />
                             {item.name}
                           </Link>
                         ))}
                       </div>
                     )}
                   </div>
                 )}
               </div>
               {/* Offscreen clone used only to measure each entry's width for the
                   responsive calculation above; invisible and non-interactive. */}
               <div ref={navMeasureRef} aria-hidden="true" className="hidden lg:flex absolute left-[-9999px] top-[-9999px] items-center gap-1 whitespace-nowrap pointer-events-none select-none">
                 {navigation.map(renderNavLink)}
               </div>
            </div>
              <div className="flex items-center flex-shrink-0">
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
                      className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
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
                        className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => switchView(null)}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            activeViewId === null
                              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {view.name}
                            {view.ownerId === null && (
                              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                {t('navigation.views.globalBadge')}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="mr-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  aria-label={t('shortcuts.commandPalette')}
                >
                  <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('shortcuts.commandPalette')}</span>
                </button>
               <Link to="/action-center" data-testid="action-center-nav" className={`relative mr-2 rounded-md p-2 ${isActive('/action-center') ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`} aria-label={t('navigation.actionCenter')}>
                  <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
               </Link>
               <button
                 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                 className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 mr-2"
                 aria-expanded={mobileMenuOpen}
                 aria-controls="mobile-navigation-menu"
                 aria-label={t('navigation.toggleMenu')}
               >
                 {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
               </button>

               {/* User Menu */}
               <div ref={userMenuRef} className="relative ml-1">
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     setUserMenuOpen(!userMenuOpen);
                   }}
                   className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none"
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
                     className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                   >
                     <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                       <div className="font-medium text-gray-900 dark:text-white">
                         {user?.email}
                       </div>
                       <div className="text-xs mt-1">
                         {user?.isOidcLinked ? (
                           <span className="text-primary-600 dark:text-primary-400">
                             {t('settings.oidcLinked')}
                           </span>
                         ) : (
                           <span className="text-gray-500">{t('settings.localAccount')}</span>
                         )}
                       </div>
                     </div>
                     <Link
                       to="/settings"
                       role="menuitem"
                       className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                       className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                     >
                       <KeyIcon className="h-4 w-4 inline mr-2" />
                       {t('navigation.logout')}
                     </button>
                   </div>
                 )}
               </div>
             </div>
           </div>
           {mobileMenuOpen && (
             <div id="mobile-navigation-menu" className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-3" role="navigation" aria-label={t('navigation.mobileNavigation')}>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {navigation.map((item) => (
                   <Link
                     key={item.name}
                     to={item.href}
                     onClick={() => setMobileMenuOpen(false)}
                     className={`px-3 py-2 rounded-md text-sm font-medium ${
                       isActive(item.href)
                         ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                         : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                     }`}
                   >
                     <item.icon className="h-5 w-5 inline mr-1" />
                     {item.name}
                   </Link>
                 ))}
               </div>
             </div>
           )}
         </div>
       </nav>
       {isAdmin && location.pathname.startsWith('/admin') && (
         <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
           <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm border-b border-gray-200 dark:border-gray-700 mb-6 py-3 overflow-visible">
             {adminSubPages.map((page) => (
               <Link
                 key={page.href}
                 to={page.href}
                 className={`font-medium whitespace-nowrap ${
                   location.pathname === page.href
                     ? 'text-primary-700 dark:text-primary-300 border-b-2 border-primary-600 dark:border-primary-400'
                     : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                 }`}
               >
                 {page.name}
               </Link>
             ))}
           </nav>
         </div>
       )}
       <main id="main-content" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
         <Outlet />
       </main>

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
