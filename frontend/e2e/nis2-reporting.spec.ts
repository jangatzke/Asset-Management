import { expect, incident, test } from './fixtures';

/**
 * Mocked browser-contract coverage for the NIS2 (Art. 23) incident reporting
 * workflow on the incident detail page. Mirrors the patterns of
 * core-workflows.spec.ts: API route fulfillment only, no backend/database.
 */

import type { Route } from '@playwright/test';

// Builds the GET /incidents/:id/nis2/reporting-status payload the UI consumes.
const nis2Status = (state: { isRelevant: boolean; severity: string; reportedAt: string | null; reportDeadline: string | null; finalReportDue: string | null; isReportDeadlineOverdue: boolean; isFinalReportDueOverdue: boolean }) => ({
  status: 'pending',
  ...state,
});

const notRelevantStatus = () => nis2Status({ isRelevant: false, severity: 'not_assessed', reportedAt: null, reportDeadline: null, finalReportDue: null, isReportDeadlineOverdue: false, isFinalReportDueOverdue: false });

// 24h early-warning deadline in the past (overdue → red chip) and the 30d
// final-report deadline in the future (default chip) — exercises the deadline
// visualization derived from the knowledge time.
const incidentWithDeadlines = {
  ...incident,
  notificationDeadlines: [
    // 24h deadline well in the past (overdue → red chip)…
    { id: 'deadline-e2e-1', notificationType: 'early_warning_24h', deadlineDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), knowledgeTimeReference: '2026-08-01T08:10:00.000Z', status: 'pending' },
    // …and the 30d final-report deadline safely in the future (default chip).
    { id: 'deadline-e2e-2', notificationType: 'monthly_final_report', deadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), knowledgeTimeReference: '2026-08-01T08:10:00.000Z', status: 'pending' },
  ],
};

test.describe('NIS2 incident reporting workflow', () => {
  test('marks the incident NIS2-relevant and renders 24h/30d deadlines incl. overdue visualization', async ({ page }) => {
    let marked = false;
    await page.route(`**/api/v1/incidents/${incident.id}`, route => route.fulfill({ json: marked ? { ...incidentWithDeadlines, nis2Relevant: true } : incidentWithDeadlines }));
    await page.route(`**/api/v1/incidents/${incident.id}/nis2/**`, async (route: Route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path.endsWith('/reporting-status')) {
        await route.fulfill({ json: marked
          ? nis2Status({ isRelevant: true, severity: 'not_assessed', reportedAt: null, reportDeadline: '2026-08-02T08:10:00.000Z', finalReportDue: '2026-09-01T08:10:00.000Z', isReportDeadlineOverdue: true, isFinalReportDueOverdue: true })
          : notRelevantStatus() });
        return;
      }
      if (request.method() === 'POST' && path.endsWith('/mark-relevant')) {
        marked = true;
        await route.fulfill({ json: { id: incident.id, nis2Relevant: true } });
        return;
      }
      await route.fulfill({ json: {} });
    });

    await page.goto(`/incidents/${incident.id}`);
    await expect(page.getByTestId('incident-detail-page')).toContainText(incident.displayId);

    // Not yet relevant: the marking control is offered while the deadline
    // section still renders the significant incident's pending deadlines.
    await expect(page.getByRole('button', { name: 'Mark as NIS2-relevant' })).toBeVisible();
    await expect(page.getByText('Notification deadlines').first()).toBeVisible();
    await expect(page.getByText('24-hour early warning', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark as NIS2-relevant' }).click();
    await expect(page.getByText('Incident marked as NIS2-relevant. Deadlines calculated from the knowledge time.')).toBeVisible();

    // The refreshed NIS2 status panel appears with the severity badge and both
    // deadline labels; both dates are in the past → two overdue tags show.
    await expect(page.getByText('not assessed', { exact: true })).toBeVisible();
    await expect(page.getByText('72h notification deadline:')).toBeVisible();
    await expect(page.getByText('Final report due:')).toBeVisible();
    await expect(page.getByText('(overdue)', { exact: true })).toHaveCount(2);

    // Deadline rows visualize state: the 24h deadline is overdue (red chip),
    // the 30d final-report deadline is still pending (default chip).
    const earlyWarningRow = page.getByText('24-hour early warning', { exact: true }).first().locator('..');
    await expect(earlyWarningRow.locator('span.bg-red-100')).toHaveText('pending');
    const finalReportRow = page.getByText('Final report', { exact: true }).first().locator('..');
    await expect(finalReportRow.locator('span.bg-primary-100')).toHaveText('pending');
  });

  test('submits early warning, 72h notification, and final report through the reporting workflow', async ({ page }) => {
    const futureReportDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureFinalDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const severityStates: Record<string, ReturnType<typeof nis2Status>> = {
      not_assessed: nis2Status({ isRelevant: true, severity: 'not_assessed', reportedAt: null, reportDeadline: null, finalReportDue: null, isReportDeadlineOverdue: false, isFinalReportDueOverdue: false }),
      early_warning: nis2Status({ isRelevant: true, severity: 'early_warning', reportedAt: '2026-08-01T09:00:00.000Z', reportDeadline: futureReportDeadline, finalReportDue: null, isReportDeadlineOverdue: false, isFinalReportDueOverdue: false }),
      notification: nis2Status({ isRelevant: true, severity: 'notification', reportedAt: '2026-08-01T09:00:00.000Z', reportDeadline: futureReportDeadline, finalReportDue: futureFinalDue, isReportDeadlineOverdue: false, isFinalReportDueOverdue: false }),
      final: nis2Status({ isRelevant: true, severity: 'final', reportedAt: '2026-08-01T09:30:00.000Z', reportDeadline: futureReportDeadline, finalReportDue: futureFinalDue, isReportDeadlineOverdue: false, isFinalReportDueOverdue: false }),
    };
    const submissions: string[] = [];
    let severity = 'not_assessed';

    await page.route(`**/api/v1/incidents/${incident.id}`, route => route.fulfill({ json: { ...incident, nis2Relevant: true } }));
    await page.route(`**/api/v1/incidents/${incident.id}/nis2/**`, async (route: Route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path.endsWith('/reporting-status')) {
        await route.fulfill({ json: severityStates[severity] });
        return;
      }
      if (request.method() === 'POST') {
        if (path.endsWith('/early-warning')) { submissions.push('early_warning'); severity = 'early_warning'; await route.fulfill({ json: { reportType: 'early_warning_24h' } }); return; }
        if (path.endsWith('/notification')) { submissions.push('notification'); severity = 'notification'; await route.fulfill({ json: { reportType: 'incident_notification_72h' } }); return; }
        if (path.endsWith('/final-report')) { submissions.push('monthly_final_report'); severity = 'final'; await route.fulfill({ json: { reportType: 'monthly_final_report' } }); return; }
      }
      await route.fulfill({ json: {} });
    });

    await page.goto(`/incidents/${incident.id}`);
    await expect(page.getByText('not assessed', { exact: true })).toBeVisible();

    // Step 1 — the early warning is only submittable with a description.
    const earlyWarningButton = page.getByRole('button', { name: 'Submit early warning' });
    await expect(earlyWarningButton).toBeDisabled();
    await page.getByPlaceholder('Short description of the incident for the early warning (required)').fill('Ransomware detected on a production file server.');
    await earlyWarningButton.click();
    await expect(page.getByText('Early warning submitted.')).toBeVisible();
    await expect(page.getByText('early warning', { exact: true })).toBeVisible();
    await expect(page.getByText('Early warning already submitted.')).toBeVisible();
    await expect(page.getByText('Reported at:')).toBeVisible();
    await expect(page.getByText('72h notification deadline:')).toBeVisible();

    // Step 2 — the formal 72-hour notification to the competent authority.
    const notificationButton = page.getByRole('button', { name: 'Submit 72h notification' });
    await expect(notificationButton).toBeDisabled();
    await page.getByPlaceholder('Description for the formal 72h notification to the competent authority (required)').fill('Formal notification submitted to the competent authority.');
    await notificationButton.click();
    await expect(page.getByText('NIS2 notification submitted.')).toBeVisible();
    await expect(page.getByText('notification', { exact: true })).toBeVisible();
    await expect(page.getByText('Final report due:')).toBeVisible();

    // Step 3 — the final report one month after the notification.
    const finalReportButton = page.getByRole('button', { name: 'Submit final report' });
    await expect(finalReportButton).toBeDisabled();
    await page.getByPlaceholder('Summary description (required)').fill('Final report summary');
    await page.getByPlaceholder('Full final report content (required)').fill('Containment, eradication and lessons learned for the ransomware incident.');
    await finalReportButton.click();
    await expect(page.getByText('NIS2 final report submitted.')).toBeVisible();

    // Final state: severity badge switches to 'final' and the completed
    // message replaces all submission controls.
    await expect(page.getByText('final', { exact: true })).toBeVisible();
    await expect(page.getByText('All NIS2 reports have been submitted for this incident.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit early warning' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit 72h notification' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit final report' })).toHaveCount(0);
    expect(submissions).toEqual(['early_warning', 'notification', 'monthly_final_report']);
  });

  test('shows overdue tags only while reports are outstanding and never for the final severity', async ({ page }) => {
    await page.route(`**/api/v1/incidents/${incident.id}`, route => route.fulfill({ json: { ...incident, nis2Relevant: true } }));
    await page.route(`**/api/v1/incidents/${incident.id}/nis2/reporting-status`, route => route.fulfill({ json: nis2Status({
      isRelevant: true, severity: 'notification', reportedAt: '2026-08-01T09:00:00.000Z', reportDeadline: '2026-08-04T08:10:00.000Z', finalReportDue: '2026-09-01T08:10:00.000Z', isReportDeadlineOverdue: false, isFinalReportDueOverdue: true,
    }) }));

    await page.goto(`/incidents/${incident.id}`);
    // Severity 'notification': the 72h deadline tag is suppressed, but the
    // final report due date is still flagged as overdue.
    await expect(page.getByText('notification', { exact: true })).toBeVisible();
    const deadlineLine = page.getByText('72h notification deadline:').first();
    await expect(deadlineLine).not.toContainText('(overdue)');
    const finalDueLine = page.getByText('Final report due:').first();
    await expect(finalDueLine).toContainText('(overdue)');

    // Submitted final report: no overdue tag remains even for overdue dates.
    await page.route(`**/api/v1/incidents/${incident.id}/nis2/reporting-status`, route => route.fulfill({ json: nis2Status({
      isRelevant: true, severity: 'final', reportedAt: '2026-08-01T09:30:00.000Z', reportDeadline: '2026-08-04T08:10:00.000Z', finalReportDue: '2026-09-01T08:10:00.000Z', isReportDeadlineOverdue: true, isFinalReportDueOverdue: true,
    }) }));
    await page.goto(`/incidents/${incident.id}`);
    await expect(page.getByText('final', { exact: true })).toBeVisible();
    await expect(page.getByText('All NIS2 reports have been submitted for this incident.')).toBeVisible();
    await expect(page.getByText('(overdue)', { exact: true })).toHaveCount(0);
  });
});
