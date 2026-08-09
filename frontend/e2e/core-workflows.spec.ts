import { expect, incident, test, testToken, testUser } from './fixtures';

test.describe('core operational browser journeys', () => {
  test('login screen is accessible and authenticated navigation loads the dashboard', async ({ page }) => {
    await page.route('**/api/v1/auth/has-admin', route => route.fulfill({ json: { hasAdmin: true } }));
    await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { user: testUser, token: testToken } }));
    await page.route('**/api/v1/dashboard/**', route => route.fulfill({ json: { data: [] } }));
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ISMS Asset Manager' })).toBeVisible();
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill('not-a-production-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  test('Action Center displays authorized work and routes to the incident detail', async ({ page }) => {
    await page.route('**/api/v1/action-center**', route => route.fulfill({ json: { data: [{ id: incident.id, sourceType: 'notificationDeadline', title: 'Submit 24-hour incident notice', status: 'open', dueDate: '2026-08-02T08:10:00.000Z', urgency: 'critical', assignment: 'mine', href: `/incidents/${incident.id}` }], summary: { overdue: 0, critical: 1, upcoming: 0, planned: 0 }, pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } } }));
    await page.route(`**/api/v1/incidents/${incident.id}`, route => route.fulfill({ json: incident }));
    await page.goto('/');
    await page.getByTestId('action-center-nav').click();
    await expect(page.getByTestId('action-center-page')).toBeVisible();
    await expect(page.getByTestId(`action-center-item-${incident.id}`)).toContainText('Submit 24-hour incident notice');
    await page.getByTestId(`action-center-open-${incident.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/incidents/${incident.id}$`));
    await expect(page.getByTestId('incident-detail-page')).toContainText(incident.displayId);
  });

  test('incident NIS2 assessment can be saved and refreshes the protected incident view', async ({ page }) => {
    let assessmentSaved = false;
    await page.route(`**/api/v1/incidents/${incident.id}/assess`, async route => { assessmentSaved = true; await route.fulfill({ json: { id: 'assessment-e2e-1' } }); });
    await page.route(`**/api/v1/incidents/${incident.id}`, route => route.fulfill({ json: { ...incident, assessments: assessmentSaved ? [{ isReportable: true }] : [] } }));
    await page.goto(`/incidents/${incident.id}`);
    await expect(page.getByRole('heading', { name: 'NIS2 significance and reportability' })).toBeVisible();
    await page.getByPlaceholder('Reporting justification').fill('Material disruption requires a NIS2 notification.');
    await page.getByTestId('incident-save-assessment').click();
    await expect(page.getByText('Reportability assessment saved.')).toBeVisible();
    await expect(page.getByText('Latest assessment: Reportable')).toBeVisible();
  });

  test('Phase 6 training workspace entry presents real operational work controls', async ({ page }) => {
    await page.route('**/api/v1/isms-operations/trainingCourses**', route => route.fulfill({ json: { data: [{ id: 'course-e2e-1', title: 'NIS2 incident response', status: 'active' }] } }));
    await page.route('**/api/v1/isms-operations/trainingAssignments**', route => route.fulfill({ json: { data: [{ id: 'assignment-e2e-1', title: 'NIS2 incident response', status: 'assigned', dueDate: '2026-09-01T00:00:00.000Z' }] } }));
    await page.route('**/api/v1/isms-operations/trainingAcknowledgements**', route => route.fulfill({ json: { data: [] } }));
    await page.goto('/isms-operations/workspace');
    await expect(page.getByRole('heading', { name: 'Operations workspace' })).toBeVisible();
    await expect(page.getByText('NIS2 incident response').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign course' })).toBeVisible();
  });
});
