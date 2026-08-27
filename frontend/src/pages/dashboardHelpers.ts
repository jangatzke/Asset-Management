/**
 * Shared, non-component helpers for the Dashboard page.
 *
 * Extracted into their own module so that `Dashboard.tsx` only exports
 * components, which keeps React Fast Refresh working for the page component.
 */

export interface DashboardMetrics {
  totalAssets: number;
  openRisks: number;
  activeIncidents: number;
  controls: number;
}

export const emptyDashboardMetrics: DashboardMetrics = {
  totalAssets: 0,
  openRisks: 0,
  activeIncidents: 0,
  controls: 0,
};

export const paginatedTotal = (payload: any): number => {
  const total = payload?.pagination?.total ?? payload?.total;
  if (typeof total === 'number') return total;
  if (typeof total === 'string') return Number(total) || 0;
  return Array.isArray(payload?.data) ? payload.data.length : 0;
};
