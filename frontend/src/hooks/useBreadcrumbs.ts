/**
 * useBreadcrumbs — derive the breadcrumb trail for the current route from the
 * canonical navigation definitions (Stage 6b, MT-2).
 *
 * The module part of the trail (e.g. `Dashboard / Assets`) is resolved by
 * `matchNavPathname` against `shared/navigation.ts` + the admin page registry —
 * no per-page path maps. Pages may pass an optional leaf label (entity name)
 * that is already present in their state; NO additional fetching happens here.
 *
 * Path source: `window.location.pathname`. Reading it during render is safe in
 * this app because every routed page lives under `Layout`, which subscribes to
 * the router location (`useLocation`) and therefore re-renders the whole subtree
 * on every client-side navigation — the value can never be stale inside the app.
 * Outside a Router (unit tests) the hook still works and simply derives the
 * trail from whatever `window.location` reports, so pages without a router stub
 * keep rendering.
 */
import { useMemo } from 'react';
import { useI18n } from '../context/I18nContext';
import type { PageHeaderBreadcrumb } from '../components/PageHeader';
import { matchNavPathname, resolveNavLabel } from '../components/sharedSidebarNav';

export interface UseBreadcrumbsOptions {
  /** Optional entity label appended as the current page (leaf) crumb. */
  leaf?: string | null;
}

/**
 * Returns the breadcrumb trail for `PageHeader`/`PageBreadcrumbs`, or an empty
 * array on the dashboard root (a page is its own home — no self-trail).
 */
export function useBreadcrumbs(options: UseBreadcrumbsOptions = {}): PageHeaderBreadcrumb[] {
  const { leaf } = options;
  const { t } = useI18n();
  return useMemo(() => {
    const pathname = window.location.pathname;
    if (!pathname || pathname === '/') return [];
    const crumbs: PageHeaderBreadcrumb[] = [
      { label: t('navigation.dashboard'), to: '/' },
    ];
    for (const match of matchNavPathname(pathname)) {
      crumbs.push({ label: resolveNavLabel(match, t), to: match.href });
    }
    if (leaf) {
      crumbs.push({ label: leaf });
    } else {
      // Without an explicit leaf the last module crumb IS the current page.
      const lastIndex = crumbs.length - 1;
      delete crumbs[lastIndex].to;
    }
    return crumbs;
  }, [t, leaf]);
}

export default useBreadcrumbs;
