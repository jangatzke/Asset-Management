/**
 * Sidebar — left primary navigation with groups (Stage 6b, MT-2).
 *
 * Replaces the former top-navigation strip (including its JS width-measuring
 * "More" overflow logic) from Layout.tsx. Entries are grouped per
 * `sharedSidebarNav.ts` (fixed group order); within a group the caller-supplied
 * order is kept as-is, so the admin-configured navigation order and saved views
 * remain authoritative. Permission filtering mirrors the old Layout behavior:
 * an entry renders only when `hasNavPermission` accepts it (a missing
 * permission list keeps the legacy "show everything" fallback).
 *
 * Behavior:
 *  - Desktop (lg+): fixed 240px rail, collapsible to 64px icon-only mode; the
 *    collapsed state persists in localStorage (`am.sidebar.collapsed`).
 *  - Mobile (<lg): off-canvas drawer with backdrop, `role="dialog"`,
 *    `aria-modal`, Escape closes, focus is trapped while open and returned to
 *    the opener on close.
 *  - Accessibility: `<nav aria-label>` landmark with ul/li structure, active
 *    entry gets `aria-current="page"`, collapsed icon links keep their label as
 *    `aria-label` + `.sr-only` text, every control is keyboard reachable with a
 *    visible focus ring (semantic tokens only — dark mode switches via CSS vars).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';
import {
  ADMIN_PAGES,
  SIDEBAR_GROUP_ORDER,
  getSidebarGroupSlug,
  hasNavPermission,
  isHrefActive,
  resolveSidebarIcon,
  sidebarGroupLabelKey,
  type SidebarGroupSlug,
} from './sharedSidebarNav';

/** One renderable navigation entry (order already resolved by the caller). */
export interface SidebarEntry {
  href: string;
  name: string;
  /** Permission(s) required to see the entry (any-of semantics). */
  permission?: string | string[];
}

export interface SidebarProps {
  /** Ordered navigation entries (catalog + fixed extras), NOT yet permission-filtered. */
  entries: SidebarEntry[];
  /** Current user permissions; `undefined`/null keeps the legacy show-all fallback. */
  userPermissions?: string[] | null;
  /** Whether the current user may see the Administration group. */
  isAdmin: boolean;
  /** Mobile drawer visibility (the toggle lives in the Layout top bar). */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const COLLAPSED_STORAGE_KEY = 'am.sidebar.collapsed';

/** Persisted rail-collapse state (best-effort, mirrors usePersistedView storage rules). */
function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable — persistence is best-effort */
      }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring-offset';

/** Link classes for a nav row; active state follows the Stage-6b design tokens. */
function itemClasses(active: boolean): string {
  return [
    'group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-fast',
    FOCUS_RING,
    active
      ? 'border-primary-600 bg-surface-hover text-text-primary'
      : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  ].join(' ');
}

/** One navigation row — icon + label (label visually hidden while collapsed). */
function SidebarLink({ entry, active, collapsed, onNavigate }: {
  entry: SidebarEntry;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = resolveSidebarIcon(entry.href);
  return (
    <li>
      <Link
        to={entry.href}
        aria-label={entry.name}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? entry.name : undefined}
        onClick={onNavigate}
        className={[itemClasses(active), collapsed ? 'justify-center px-2' : ''].filter(Boolean).join(' ')}
      >
        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <span className={collapsed ? 'sr-only' : 'truncate'}>{entry.name}</span>
      </Link>
    </li>
  );
}

interface GroupedEntries {
  slug: SidebarGroupSlug;
  items: SidebarEntry[];
}

/** The actual `<nav>` content, shared by the desktop rail and the mobile drawer. */
function SidebarNav({ groups, pathname, collapsed, onNavigate }: {
  groups: GroupedEntries[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('navigation.mainNavigation')} className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      {groups.map((group, groupIndex) => (
        <div key={group.slug} className={groupIndex > 0 ? 'mt-3 border-t border-border-subtle pt-2' : undefined}>
          <h2 className={collapsed ? 'sr-only' : 'px-3 pb-1 pt-3 text-caption text-text-muted'}>
            {t(sidebarGroupLabelKey(group.slug))}
          </h2>
          <ul className="space-y-0.5 px-2">
            {group.items.map((entry) => (
              <SidebarLink
                key={entry.href}
                entry={entry}
                active={isHrefActive(pathname, entry.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Group + permission-filter the ordered entries. Filtering keeps the incoming
 * order intact, so admin-configured ordering and saved views are respected.
 * The Administration group is appended last (fixed position) from ADMIN_PAGES.
 */
function useGroupedEntries(entries: SidebarEntry[], userPermissions: string[] | null | undefined, isAdmin: boolean): GroupedEntries[] {
  const { t } = useI18n();
  return useMemo(() => {
    const visible = entries.filter((entry) => hasNavPermission(userPermissions, entry.permission));
    const byGroup = new Map<SidebarGroupSlug, SidebarEntry[]>();
    for (const entry of visible) {
      const slug = getSidebarGroupSlug(entry.href);
      if (!byGroup.has(slug)) byGroup.set(slug, []);
      byGroup.get(slug)!.push(entry);
    }
    if (isAdmin) {
      byGroup.set('administration', ADMIN_PAGES.map((page) => ({ href: page.href, name: t(page.nameKey) })));
    }
    return SIDEBAR_GROUP_ORDER
      .filter((slug) => (byGroup.get(slug)?.length ?? 0) > 0)
      .map((slug) => ({ slug, items: byGroup.get(slug)! }));
  }, [entries, userPermissions, isAdmin, t]);
}

export function Sidebar({ entries, userPermissions, isAdmin, mobileOpen, onMobileClose }: SidebarProps) {
  const { t } = useI18n();
  const location = useLocation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const groups = useGroupedEntries(entries, userPermissions, isAdmin);
  const drawerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Mobile drawer: focus management + Escape close (focus trap for Tab cycling).
  useEffect(() => {
    if (!mobileOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const container = drawerRef.current;
    const focusableSelector = 'a[href], button:not([disabled])';
    const first = container?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMobileClose();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [mobileOpen, onMobileClose]);

  const collapseButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-pressed={collapsed}
      aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
      title={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
      className={`m-2 flex items-center justify-center rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary ${FOCUS_RING}`}
    >
      {collapsed ? <ChevronRightIcon className="h-5 w-5" aria-hidden="true" /> : <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );

  return (
    <>
      {/* Desktop rail: fixed left sidebar, sticky for the full viewport height. */}
      <aside
        className={`sticky top-0 hidden h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-surface-default transition-[width] duration-base lg:flex ${collapsed ? 'w-16' : 'w-60'}`}
        aria-label={t('navigation.mainNavigation')}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          {collapsed ? (
            <span className="sr-only">{t('navigation.applicationName')}</span>
          ) : (
            <span className="truncate text-sm font-bold text-text-primary">{t('navigation.applicationName')}</span>
          )}
        </div>
        <SidebarNav groups={groups} pathname={location.pathname} collapsed={collapsed} />
        {collapseButton}
      </aside>

      {/* Mobile off-canvas drawer with backdrop. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t('navigation.mobileNavigation')}>
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/50 dark:bg-black/50"
            onClick={onMobileClose}
            aria-label={t('common.close')}
            tabIndex={-1}
          />
          <div
            ref={drawerRef}
            className={`absolute left-0 top-0 flex h-full flex-col border-r border-border-subtle bg-surface-default shadow-e3 transition-[width] duration-base ${collapsed ? 'w-16' : 'w-60'}`}
          >
            <div className="flex items-center justify-between px-2 py-3">
              {!collapsed && <span className="truncate px-2 text-sm font-bold text-text-primary">{t('navigation.applicationName')}</span>}
              <button
                type="button"
                onClick={onMobileClose}
                aria-label={t('common.close')}
                className={`rounded-md p-2 text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary ${FOCUS_RING}`}
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav groups={groups} pathname={location.pathname} collapsed={collapsed} onNavigate={onMobileClose} />
            {collapseButton}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
