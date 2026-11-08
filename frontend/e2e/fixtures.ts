import { expect, test as base } from '@playwright/test';

/**
 * Shared fixtures for the mocked browser-contract E2E suite.
 *
 * These specs exercise the real Vite/browser UI but intercept every `/api/v1`
 * call with `page.route()` fulfillment. They are intentionally browser-contract
 * coverage only (no Express, no database) and remain distinct from the
 * full-stack real-E2E plan documented in `docs/e2e-testing.md`.
 */

export interface E2eUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface E2eAsset {
  id: string;
  displayId: string;
  name: string;
  assetType: { name: string };
  manufacturer: string;
  status: string;
}

/** Assignable-user shape returned by the active-owner `/users/owners` options. */
export interface E2eAssignee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}

export interface E2eTicket {
  id: string;
  displayId: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  urgency: string;
  impact: string;
  estimatedEffortUnits: number | null;
  resolutionDueAt: string | null;
  updatedAt: string;
  assigneeId: string | null;
  assignee: E2eAssignee | null;
  requesterId: string;
  requester: { id: string; email: string; firstName: string; lastName: string };
  openedAt: string;
  createdAt: string;
  comments: unknown[];
  problem: unknown | null;
  change: unknown | null;
  linksFrom: unknown[];
  linksTo: unknown[];
}

export const testUser: E2eUser = {
  id: 'e2e-user-1', email: 'e2e.analyst@example.test', firstName: 'E2E', lastName: 'Analyst', roles: ['system_admin'],
};
export const testToken = 'e2e-browser-token';

export interface IncidentDeadlineFixture {
  id: string;
  notificationType: string;
  deadlineDate: string;
  knowledgeTimeReference: string;
  status: string;
}

export interface IncidentFixture {
  id: string;
  displayId: string;
  title: string;
  description: string;
  detectionTime: string;
  knowledgeTime: string;
  incidentManagerId: string;
  isSignificant: boolean;
  significanceReasons: string[];
  status: string;
  severity: string;
  notificationStatus: string;
  notificationDeadlines: IncidentDeadlineFixture[];
  assessments: unknown[];
  reports: unknown[];
  communications: unknown[];
  knowledgeTimeChanges: unknown[];
  incidentAssets: unknown[];
  serviceLinks: unknown[];
  processLinks: unknown[];
}

export const incident: IncidentFixture = {
  id: 'incident-e2e-1', displayId: 'INC-E2E-001', title: 'Tested ransomware containment', description: 'A realistic incident fixture for browser journey verification.',
  detectionTime: '2026-08-01T08:00:00.000Z', knowledgeTime: '2026-08-01T08:10:00.000Z', incidentManagerId: testUser.id,
  isSignificant: true, significanceReasons: ['Critical service disruption'], status: 'open', severity: 'high', notificationStatus: 'pending',
  notificationDeadlines: [{ id: 'deadline-e2e-1', notificationType: 'early_warning_24h', deadlineDate: '2026-08-02T08:10:00.000Z', knowledgeTimeReference: '2026-08-01T08:10:00.000Z', status: 'pending' }],
  assessments: [], reports: [], communications: [], knowledgeTimeChanges: [], incidentAssets: [], serviceLinks: [], processLinks: [],
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { token: testToken } }));
    await page.route('**/api/v1/auth/me', route => route.fulfill({ json: testUser }));
    await use(page);
  },
});

export { expect };

/** Pagination envelope helper for list endpoints (matches the backend `{ data, pagination }` contract). */
export const paginated = <T,>(data: T[], total = data.length) => ({
  data,
  pagination: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
});

/** Two assets for TicketAsset-linking journeys (multiple assets per ticket are the integrity contract). */
export const e2eAssets: E2eAsset[] = [
  { id: 'asset-e2e-1', displayId: 'AST-E2E-001', name: 'E2E file server', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
  { id: 'asset-e2e-2', displayId: 'AST-E2E-002', name: 'E2E database host', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
];

/** service_request ticket fixture: requester is the authenticated E2E user, assignee unassigned (optional reference). */
export const e2eTicket: E2eTicket = {
  id: 'ticket-e2e-1',
  displayId: 'TKT-E2E-001',
  type: 'service_request',
  title: 'E2E printer outage',
  description: 'Service request raised by the E2E browser journey.',
  status: 'new',
  priority: 'medium',
  urgency: 'medium',
  impact: 'medium',
  estimatedEffortUnits: null,
  resolutionDueAt: null,
  updatedAt: '2026-08-01T09:00:00.000Z',
  assigneeId: null,
  assignee: null,
  requesterId: testUser.id,
  requester: { id: testUser.id, email: testUser.email, firstName: testUser.firstName, lastName: testUser.lastName },
  openedAt: '2026-08-01T09:00:00.000Z',
  createdAt: '2026-08-01T09:00:00.000Z',
  comments: [],
  problem: null,
  change: null,
  linksFrom: [],
  linksTo: [],
};
