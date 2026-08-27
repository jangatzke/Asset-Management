/**
 * Shared, non-component helpers for risk status filtering.
 *
 * Extracted into their own module so that `Risks.tsx` only exports
 * components, which keeps React Fast Refresh working for the page component.
 */

const openRiskStatuses = ['identified', 'assessed', 'treatment_planned', 'treatment_in_progress'];

export const normalizeRiskStatusFilter = (value: string | null) => value === 'open' ? 'open' : value ?? '';

export const matchesRiskStatusFilter = (risk: { status: string }, statusFilter: string) => {
  if (!statusFilter) return true;
  if (statusFilter === 'open') return openRiskStatuses.includes(risk.status);
  return risk.status === statusFilter;
};
