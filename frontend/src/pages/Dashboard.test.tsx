/// <reference types="vitest" />
import { paginatedTotal } from './dashboardHelpers';
import { matchesIncidentStatusFilter, normalizeIncidentStatusFilter } from './incidentStatusHelpers';
import { matchesRiskStatusFilter, normalizeRiskStatusFilter } from './riskStatusHelpers';

test('paginatedTotal reads totals from paginated backend responses', () => {
  expect(paginatedTotal({ data: [{ id: 'asset-1' }], pagination: { total: 42 } })).toBe(42);
  expect(paginatedTotal({ data: [], total: '7' })).toBe(7);
});

test('paginatedTotal falls back to returned row count for non-paginated responses', () => {
  expect(paginatedTotal({ data: [{ id: 'one' }, { id: 'two' }] })).toBe(2);
  expect(paginatedTotal({})).toBe(0);
});

test('risk status drill-down filter treats open as non-terminal risk statuses', () => {
  expect(normalizeRiskStatusFilter('open')).toBe('open');
  expect(matchesRiskStatusFilter({ status: 'identified' }, 'open')).toBe(true);
  expect(matchesRiskStatusFilter({ status: 'treatment_in_progress' }, 'open')).toBe(true);
  expect(matchesRiskStatusFilter({ status: 'accepted' }, 'open')).toBe(false);
  expect(matchesRiskStatusFilter({ status: 'closed' }, 'open')).toBe(false);
});

test('incident status drill-down filter treats open as active incident statuses', () => {
  expect(normalizeIncidentStatusFilter('open')).toBe('open');
  expect(matchesIncidentStatusFilter({ status: 'new' }, 'open')).toBe(true);
  expect(matchesIncidentStatusFilter({ status: 'under_investigation' }, 'open')).toBe(true);
  expect(matchesIncidentStatusFilter({ status: 'resolved' }, 'open')).toBe(false);
  expect(matchesIncidentStatusFilter({ status: 'closed' }, 'open')).toBe(false);
});
