/**
 * Shared, non-component helpers for incident status filtering.
 *
 * Extracted into their own module so that `Incidents.tsx` only exports
 * components, which keeps React Fast Refresh working for the page component.
 */

const activeIncidentStatuses = ['new', 'under_investigation', 'contained'];

export const normalizeIncidentStatusFilter = (value: string | null) => value === 'open' ? 'open' : value ?? '';

export const matchesIncidentStatusFilter = (incident: { status: string }, statusFilter: string) => {
  if (!statusFilter) return true;
  if (statusFilter === 'open') return activeIncidentStatuses.includes(incident.status);
  return incident.status === statusFilter;
};
