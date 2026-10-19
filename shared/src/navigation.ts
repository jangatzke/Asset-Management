// Canonical catalog of top-navigation entries. This is the single source of
// truth for which menu items exist and their default order; both the backend
// (global navigation order config + user overrides) and the frontend (Layout,
// admin reordering UI) derive from it. Reordering only permutes these hrefs;
// unknown/removed hrefs fall back to their default catalog position.

export interface NavigationCatalogItem {
  /** Route path used as stable identifier for ordering. */
  href: string;
  /** i18n key for the label (resolved via t(nameKey)). */
  nameKey?: string;
  /** Literal label override (for entries without an i18n key). */
  label?: string;
  /** Permission(s) required to see the entry (any-of semantics). */
  permission?: string | string[];
  /** Entry is only rendered for users with admin access. */
  adminOnly?: boolean;
}

export const NAVIGATION_CATALOG: NavigationCatalogItem[] = [
  { href: '/', nameKey: 'navigation.dashboard' },
  { href: '/assets', nameKey: 'navigation.assets', permission: 'assets.read' },
  { href: '/risks', nameKey: 'navigation.risks', permission: 'risks.read' },
  { href: '/controls', nameKey: 'navigation.controls', permission: 'controls.read' },
  { href: '/incidents', nameKey: 'navigation.incidents', permission: 'incidents.read' },
  { href: '/tickets', nameKey: 'navigation.tickets', permission: 'tickets.read' },
  { href: '/service-catalog', nameKey: 'navigation.serviceCatalog', permission: 'serviceCatalog.read' },
  // NIS2 routes are guarded with authorizeEntityRead('controls').
  { href: '/nis2', label: 'NIS2', permission: 'controls.read' },
  // Contract routes require admin access (requireAdminAccess).
  { href: '/contracts', nameKey: 'navigation.contracts', permission: 'administration.access' },
  { href: '/licenses', nameKey: 'navigation.licenses' },
  { href: '/processes', nameKey: 'navigation.processes' },
  // Cost planning routes use authorizeEntityRead('costPlanning') which maps to bcm.read.
  { href: '/cost-planning', nameKey: 'navigation.costPlanning', permission: 'bcm.read' },
  // ISMS operations expose several phase6 resources; show the entry when the
  // user can read at least one of them.
  { href: '/isms-operations', nameKey: 'navigation.ismsOperations', permission: ['audits.read', 'training.read', 'correctiveActions.read', 'evidence.read'] },
  // KRI board reads metric definitions/values via requireMappedReadPermission('auditPlans') -> audits.read.
  { href: '/kri-dashboard', nameKey: 'navigation.kriDashboard', permission: 'audits.read' },
  // Knowledge base reads via requirePermission('documents.read').
  { href: '/knowledge-base', nameKey: 'navigation.knowledgeBase', permission: 'documents.read' },
  // Supply-chain overview reads via requireMappedReadPermission('suppliers') -> suppliers.read.
  { href: '/supply-chain', nameKey: 'navigation.supplyChain', permission: 'suppliers.read' },
  // Control coverage matrix reads via requirePermission('controls.read').
  { href: '/control-coverage', nameKey: 'navigation.controlCoverage', permission: 'controls.read' },
  { href: '/isms-operations/process', nameKey: 'navigation.ismsProcessWorkspace', permission: ['documents.read', 'interestedParties.read', 'training.read'] },
  { href: '/risk-aggregation', nameKey: 'navigation.riskAggregation', adminOnly: true },
  { href: '/admin/users', nameKey: 'navigation.admin', adminOnly: true },
];

export const NAVIGATION_HREFS: string[] = NAVIGATION_CATALOG.map((item) => item.href);

/** A saved navigation configuration: order + explicitly hidden entries. */
export interface NavigationViewConfig {
  /** Ordered list of known hrefs; missing hrefs keep their default position. */
  navOrder: readonly string[];
  /** Hrefs that are hidden in this view (e.g. collapsed into nothing at all). */
  hiddenEntries: readonly string[];
}

/**
 * Reorder `items` (which must carry an `href`) according to a stored order of
 * hrefs. Entries not present in `order` keep their relative default position at
 * the end, so new menu items added in later releases remain reachable.
 */
export function applyNavigationOrder<T extends { href: string }>(items: T[], order: readonly string[] | null | undefined): T[] {
  if (!Array.isArray(order) || order.length === 0) return items;
  const rank = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    if (!rank.has(order[i])) rank.set(order[i], i);
  }
  const defaultIndex = new Map<string, number>();
  for (let i = 0; i < items.length; i++) defaultIndex.set(items[i].href, i);
  return [...items].sort((a, b) => {
    const rankA = rank.has(a.href) ? rank.get(a.href)! : Number.MAX_SAFE_INTEGER;
    const rankB = rank.has(b.href) ? rank.get(b.href)! : Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    // Both ordered or both unordered: keep the stable default order.
    return (defaultIndex.get(a.href) ?? 0) - (defaultIndex.get(b.href) ?? 0);
  });
}

/**
 * Apply a saved view: drop hidden hrefs, then reorder the rest. Unknown hrefs in
 * either list are ignored so removed menu entries never break stored views.
 */
export function applyNavigationView<T extends { href: string }>(
  items: T[],
  view: NavigationViewConfig | null | undefined,
): T[] {
  const hidden = new Set(Array.isArray(view?.hiddenEntries) ? view!.hiddenEntries : []);
  const visible = hidden.size === 0 ? items : items.filter((item) => !hidden.has(item.href));
  return applyNavigationOrder(visible, Array.isArray(view?.navOrder) ? view!.navOrder : undefined);
}
