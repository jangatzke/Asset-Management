import { expect, test as base } from '@playwright/test';

export const testUser = {
  id: 'e2e-user-1', email: 'e2e.analyst@example.test', firstName: 'E2E', lastName: 'Analyst', roles: ['system_admin'],
};
export const testToken = 'e2e-browser-token';

export const incident = {
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
export const e2eAssets = [
  { id: 'asset-e2e-1', displayId: 'AST-E2E-001', name: 'E2E file server', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
  { id: 'asset-e2e-2', displayId: 'AST-E2E-002', name: 'E2E database host', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
];

/** service_request ticket fixture: requester is the authenticated E2E user, assignee unassigned (optional reference). */
export const e2eTicket = {
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
