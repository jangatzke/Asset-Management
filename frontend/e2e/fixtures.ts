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
