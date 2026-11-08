/**
 * Shared data + helpers for the Stage 6b sidebar navigation (MT-2).
 *
 * This module is the single source of truth for:
 *  - the fixed GROUP ORDER and the route→group assignment used by Sidebar,
 *  - the additional sidebar entries that are NOT part of the reorderable
 *    `NAVIGATION_CATALOG` (Action Center, Ticket Workload, Settings) and the
 *    Administration pages (previously the admin sub-page strip in Layout),
 *  - icon resolution for every sidebar href,
 *  - active-path matching (shared by Sidebar and the top-bar utilities).
 *
 * Group assignment rule: every route is assigned from the existing
 * `shared/navigation.ts` catalog + the real routes registered in `App.tsx`.
 * Unknown hrefs fall back to "overview" so a new route stays reachable.
 */
import type { ComponentType } from 'react';
import { NAVIGATION_CATALOG } from '@shared/navigation';
import {
  HomeIcon,
  CubeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  FireIcon,
  Cog6ToothIcon,
  CogIcon,
  KeyIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  BellAlertIcon,
  BanknotesIcon,
  ServerIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  TagIcon,
  ArrowsUpDownIcon,
  CalendarIcon,
  CircleStackIcon,
  EnvelopeOpenIcon,
  SparklesIcon,
  ArrowUpCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { NavigationCatalogItem } from '@shared/navigation';

/** Icon component type compatible with `@heroicons/react/24/outline`. */
export type NavIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

/** Sidebar group slugs in fixed display order (see task Stage 6b). */
export const SIDEBAR_GROUP_ORDER = ['overview', 'assetsRisks', 'complianceIsm', 'operations', 'administration'] as const;
export type SidebarGroupSlug = (typeof SIDEBAR_GROUP_ORDER)[number];

/**
 * Route → group assignment. Derived from `shared/navigation.ts` + App.tsx:
 *  - overview: dashboard, action center, settings (utility)
 *  - assetsRisks: assets, risks, risk-aggregation
 *  - complianceIsm: controls, incidents, NIS2, ISMS operations/process, KRI,
 *    knowledge base, supply chain, control coverage
 *  - operations: tickets (+workload), service catalog, contracts, licenses,
 *    processes, cost planning
 *  - administration: all /admin/* pages (plus the /admin/users catalog anchor)
 */
const GROUP_BY_HREF: Record<string, SidebarGroupSlug> = {
  '/': 'overview',
  '/action-center': 'overview',
  '/settings': 'overview',
  '/assets': 'assetsRisks',
  '/risks': 'assetsRisks',
  '/risk-aggregation': 'assetsRisks',
  '/controls': 'complianceIsm',
  '/incidents': 'complianceIsm',
  '/nis2': 'complianceIsm',
  '/isms-operations': 'complianceIsm',
  '/isms-operations/process': 'complianceIsm',
  '/kri-dashboard': 'complianceIsm',
  '/knowledge-base': 'complianceIsm',
  '/supply-chain': 'complianceIsm',
  '/control-coverage': 'complianceIsm',
  '/tickets': 'operations',
  '/ticket-workload': 'operations',
  '/service-catalog': 'operations',
  '/contracts': 'operations',
  '/licenses': 'operations',
  '/processes': 'operations',
  '/cost-planning': 'operations',
};

/** Resolve the group for an href; unknown routes stay reachable under overview. */
export function getSidebarGroupSlug(href: string): SidebarGroupSlug {
  if (href.startsWith('/admin')) return 'administration';
  return GROUP_BY_HREF[href] ?? 'overview';
}

/** i18n key for a group heading (`nav.group.<slug>`). */
export function sidebarGroupLabelKey(slug: SidebarGroupSlug): string {
  return `nav.group.${slug}`;
}

/**
 * Sidebar entries that are not part of the reorderable catalog. They keep a
 * fixed position inside their group (the admin order config only permutes
 * catalog hrefs). Permissions mirror the backend route guards.
 */
export const SIDEBAR_EXTRA_CATALOG: NavigationCatalogItem[] = [
  { href: '/action-center', nameKey: 'navigation.actionCenter' },
  // /tickets/workload is guarded by requirePermission('tickets.read').
  { href: '/ticket-workload', nameKey: 'navigation.ticketWorkload', permission: 'tickets.read' },
  // /settings is open to every authenticated user.
  { href: '/settings', nameKey: 'navigation.settings' },
];

/**
 * Administration pages (previously the admin sub-page strip in Layout.tsx).
 * All are guarded by `requireAdminAccess` on the backend, so they render only
 * for admins; the order matches the previous strip exactly.
 */
export interface AdminPageDefinition {
  href: string;
  nameKey: string;
}

export const ADMIN_PAGES: AdminPageDefinition[] = [
  { href: '/admin/users', nameKey: 'navigation.userManagement' },
  { href: '/admin/roles', nameKey: 'navigation.roleManagement' },
  { href: '/admin/groups', nameKey: 'navigation.groupManagement' },
  { href: '/admin/asset-types', nameKey: 'navigation.assetTypes' },
  { href: '/admin/organization-units', nameKey: 'navigation.organizationUnits' },
  { href: '/admin/oidc', nameKey: 'navigation.oidcConfig' },
  { href: '/admin/auth-settings', nameKey: 'navigation.authSettings' },
  { href: '/admin/navigation', nameKey: 'navigation.navigationOrder' },
  { href: '/admin/intune', nameKey: 'intune.title' },
  { href: '/admin/vmware', nameKey: 'navigation.vmwareConfig' },
  { href: '/admin/proxmox', nameKey: 'navigation.proxmoxConfig' },
  { href: '/admin/reminders', nameKey: 'navigation.reminderSettings' },
  { href: '/admin/sla-escalation', nameKey: 'slaEscalation.title' },
  { href: '/admin/email-gateway', nameKey: 'emailGateway.title' },
  { href: '/admin/ai', nameKey: 'aiAssistant.title' },
  { href: '/admin/fiscal-year', nameKey: 'navigation.fiscalYearSettings' },
  { href: '/admin/database', nameKey: 'navigation.databaseBackup' },
  { href: '/admin/ticket-slas', nameKey: 'navigation.ticketSlaSettings' },
  { href: '/admin/job-runs', nameKey: 'navigation.jobRuns' },
];

/** Icon map for every sidebar href (replaces the former Layout NAV_ICONS). */
export const SIDEBAR_ICONS: Record<string, NavIcon> = {
  '/': HomeIcon,
  '/assets': CubeIcon,
  '/risks': ExclamationTriangleIcon,
  '/controls': ShieldCheckIcon,
  '/incidents': FireIcon,
  '/tickets': ClipboardDocumentListIcon,
  '/ticket-workload': ClockIcon,
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
  '/action-center': BellAlertIcon,
  '/settings': CogIcon,
  '/admin/users': Cog6ToothIcon,
  '/admin/roles': ShieldCheckIcon,
  '/admin/groups': UserGroupIcon,
  '/admin/asset-types': TagIcon,
  '/admin/organization-units': BuildingOfficeIcon,
  '/admin/oidc': KeyIcon,
  '/admin/auth-settings': KeyIcon,
  '/admin/navigation': ArrowsUpDownIcon,
  '/admin/intune': ServerIcon,
  '/admin/vmware': ServerIcon,
  '/admin/proxmox': ServerIcon,
  '/admin/reminders': BellAlertIcon,
  '/admin/sla-escalation': ArrowUpCircleIcon,
  '/admin/email-gateway': EnvelopeOpenIcon,
  '/admin/ai': SparklesIcon,
  '/admin/fiscal-year': CalendarIcon,
  '/admin/database': CircleStackIcon,
  '/admin/ticket-slas': ClipboardDocumentListIcon,
  '/admin/job-runs': ClockIcon,
};

/** Icon for an href with a safe fallback so unknown routes stay usable. */
export function resolveSidebarIcon(href: string): NavIcon {
  return SIDEBAR_ICONS[href] ?? CogIcon;
}

/**
 * Active-path matching — identical semantics to the old `Layout.isActive`:
 * exact match, sub-path match, and the two special cases for the admin area
 * (any /admin/* activates an admin entry) and the ISMS workspace redirect.
 */
export function isHrefActive(pathname: string, href: string): boolean {
  if (href.startsWith('/admin') && pathname.startsWith('/admin')) {
    return true;
  }
  if (href === '/isms-operations') {
    return pathname === '/isms-operations' || pathname === '/isms-phase6';
  }
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Permission gate identical to the old Layout `hasRequiredPermission`: any-of
 * semantics over the granted list; a missing permission list keeps the legacy
 * "show everything" fallback until the session is refreshed.
 */
export function hasNavPermission(granted: string[] | null | undefined, required?: string | string[]): boolean {
  if (!required) return true;
  if (!granted) return true;
  const grantedSet = new Set(granted);
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((permission) => grantedSet.has(permission));
}

/** Resolve the display label for a catalog-style entry. */
export function resolveNavLabel(entry: { nameKey?: string; label?: string; href: string }, t: (key: string) => string): string {
  return entry.nameKey ? t(entry.nameKey) : (entry.label ?? entry.href);
}

/** Flat match result used by the breadcrumb derivation. */
export interface NavMatchResult {
  nameKey?: string;
  label?: string;
  href: string;
}

/**
 * Derive the module-level breadcrumb trail for a pathname from the canonical
 * navigation definitions (catalog + admin pages) — no per-page path maps.
 * Walks cumulative path segments and emits one crumb per matching nav entry
 * (e.g. `/assets/42` → Home, Assets; `/admin/users` → Home, User Management).
 * The entity leaf crumb is appended by the page via `useBreadcrumbs(leaf)`.
 */
export function matchNavPathname(pathname: string): NavMatchResult[] {
  const crumbs: NavMatchResult[] = [];
  if (!pathname || pathname === '/') return crumbs;
  const segments = pathname.split('/').filter(Boolean);
  let acc = '';
  for (const segment of segments) {
    acc += '/' + segment;
    const catalogHit = NAVIGATION_MATCH_INDEX.get(acc);
    if (catalogHit) {
      // The '/admin/users' catalog anchor is superseded by the concrete admin
      // page definition so admin routes never produce a duplicate crumb.
      const isAdminAnchor = acc === '/admin/users';
      if (!isAdminAnchor) crumbs.push(catalogHit);
      continue;
    }
    const adminHit = ADMIN_PAGES.find((page) => page.href === acc);
    if (adminHit) {
      crumbs.push({ nameKey: adminHit.nameKey, href: adminHit.href });
      continue;
    }
    // Non-matching segment (e.g. an entity id) — stop; the leaf is supplied
    // by the page itself when a name is available in state.
  }
  return crumbs;
}

/** Lookup index over the canonical catalog (built once at module load). */
const NAVIGATION_MATCH_INDEX: Map<string, NavMatchResult> = new Map();
for (const entry of NAVIGATION_CATALOG) {
  NAVIGATION_MATCH_INDEX.set(entry.href, { nameKey: entry.nameKey, label: entry.label, href: entry.href });
}
