import { expect, e2eAssets, e2eTicket, paginated, test, testUser } from './fixtures';

import type { Route } from '@playwright/test';
import type { E2eAsset, E2eAssignee } from './fixtures';

/**
 * Mocked browser-contract coverage for the ITIL ticket workflow. Mirrors the
 * patterns of core-workflows.spec.ts: API route fulfillment only, no
 * backend/database. Status options mirror shared/src/ticketTransitions.ts
 * (single source of truth for the ticket state machines).
 */

// The user EntityPicker searches the active-owner endpoint `/users/owners?q=...`
// and labels results as `${firstName} ${lastName} (${email})`; see
// src/services/entityPickerApi.ts (ENDPOINT_CONFIG.user and getEntityLabel).
const janeFix: E2eAssignee = {
  id: 'user-e2e-2',
  email: 'jane.fix@example.test',
  firstName: 'Jane',
  lastName: 'Fix',
  isActive: true,
};
const janeFixLabel = 'Jane Fix (jane.fix@example.test)';

test.describe('ticket workflow', () => {
  test('creates a service_request ticket with automatic requester and no assignee/manager', async ({ page }) => {
    let created: typeof e2eTicket | null = null;
    await page.route('**/api/v1/tickets**', async (route: Route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({ json: paginated(created ? [created as typeof e2eTicket] : []) });
        return;
      }
      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
        // Ticket integrity: the requester is the authenticated user; assignee and
        // manager are optional references and must not be sent by the create form.
        expect(body.requesterId).toBe(testUser.id);
        expect(body).not.toHaveProperty('assigneeId');
        expect(body).not.toHaveProperty('managerId');
        expect(body.type).toBe('service_request');
        created = { ...e2eTicket, title: body.title as string };
        await route.fulfill({ json: created });
        return;
      }
      await route.fulfill({ json: {} });
    });

    await page.goto('/tickets');
    // exact: true — the page also renders a keyboard-shortcut variant 'Create new ticket'.
    await page.getByRole('button', { name: 'New ticket', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('E2E printer outage');
    await page.getByLabel('Description', { exact: true }).fill('Service request raised by the E2E browser journey.');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // The refreshed list renders the persisted display id and title.
    await expect(page.getByRole('link', { name: 'TKT-E2E-001' })).toBeVisible();
    await expect(page.getByText('E2E printer outage')).toBeVisible();
  });

  test('moves a service_request through ITIL transitions including the fulfilled reopen', async ({ page }) => {
    const ticket = { ...e2eTicket };
    await page.route('**/api/v1/tickets**', route => route.fulfill({ json: paginated([ticket]) }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}`, route => route.fulfill({ json: ticket }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assets`, route => route.fulfill({ json: { ticketId: e2eTicket.id, assets: [] } }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/status`, async (route: Route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { status: string };
      ticket.status = body.status;
      await route.fulfill({ json: ticket });
    });

    await page.goto(`/tickets/${e2eTicket.id}`);
    await expect(page.getByRole('heading', { name: /TKT-E2E-001/ })).toBeVisible();

    // new → in_progress is allowed by TICKET_TRANSITIONS.service_request.
    const statusSelect = page.getByLabel('Status');
    await expect(statusSelect).toHaveValue('new');
    await statusSelect.selectOption('in_progress');
    await expect(statusSelect).toHaveValue('in_progress');

    // in_progress → fulfilled, then the ITIL 4 reopen fulfilled → new.
    await statusSelect.selectOption('fulfilled');
    await expect(statusSelect).toHaveValue('fulfilled');
    const reopenOption = statusSelect.locator('option[value="new"]');
    await expect(reopenOption).toHaveCount(1);
    await statusSelect.selectOption('new');
    await expect(statusSelect).toHaveValue('new');
  });

  test('assigns an active user and links multiple assets through the TicketAsset context', async ({ page }) => {
    const ticket = { ...e2eTicket };
    const assets: E2eAsset[] = [];
    let postedAssetIds: string[] = [];
    let postedAssigneeId: string | null | undefined;

    await page.route('**/api/v1/tickets**', route => route.fulfill({ json: paginated([ticket]) }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}`, route => route.fulfill({ json: ticket }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assign`, async (route: Route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { assigneeId: string | null };
      postedAssigneeId = body.assigneeId;
      ticket.assigneeId = body.assigneeId;
      ticket.assignee = body.assigneeId ? janeFix : null;
      await route.fulfill({ json: ticket });
    });
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assets`, async (route: Route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({ json: { ticketId: e2eTicket.id, assets: assets.map((asset, index) => ({ id: `link-${index + 1}`, asset })) } });
        return;
      }
      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}') as { assetIds: string[] };
        postedAssetIds = body.assetIds;
        for (const assetId of body.assetIds) {
          const asset = e2eAssets.find((candidate) => candidate.id === assetId);
          if (asset && !assets.includes(asset)) assets.push(asset);
        }
        await route.fulfill({ json: ticket });
        return;
      }
      await route.fulfill({ json: {} });
    });
    // Active-owner endpoint used by the user EntityPicker (not /users/search).
    await page.route('**/api/v1/users/owners**', route => route.fulfill({ json: paginated([janeFix]) }));
    await page.route('**/api/v1/assets**', route => route.fulfill({ json: paginated(e2eAssets) }));

    await page.goto(`/tickets/${e2eTicket.id}`);
    await expect(page.getByRole('heading', { name: /TKT-E2E-001/ })).toBeVisible();
    await expect(page.getByText('Unassigned')).toBeVisible();

    // Section-scoped locators: the Assignment heading owns its EntityPicker in
    // TicketDetail.tsx (Details tab, active by default).
    const assignmentSection = page.getByRole('heading', { name: 'Assignment' }).locator('..');

    // Assignee EntityPicker: search, pick the user, then assign.
    await assignmentSection.getByRole('combobox').fill('jane');
    await assignmentSection.getByRole('option', { name: janeFixLabel }).click();
    await assignmentSection.getByRole('button', { name: 'Assign', exact: true }).click();
    // The ticket reload shows the human-readable assignee (first + last name).
    await expect(assignmentSection.getByText('Jane Fix', { exact: true })).toBeVisible();
    await expect(assignmentSection.getByText('Unassigned')).toHaveCount(0);
    expect(postedAssigneeId).toBe(janeFix.id);

    // Asset EntityPicker (multiple): link both assets to the ticket. Since
    // Stage 10c / LT-5 the asset context lives in the "Assets" DetailTab —
    // inactive panels are hidden, so activate the tab first and scope to its
    // tabpanel (accessible name comes from the tab label via aria-labelledby).
    // Domain expectation unchanged: assets remain selectable through the
    // EntityPicker and linkable to the ticket. The multi-select keeps its
    // dropdown open, so close it via Escape (the picker keydown handler)
    // before clicking the Attach button.
    await page.getByRole('tab', { name: 'Assets' }).click();
    const assetSection = page.getByRole('tabpanel', { name: 'Assets' });
    await assetSection.getByRole('combobox').fill('AST');
    await assetSection.getByRole('option', { name: 'AST-E2E-001 - E2E file server' }).click();
    await assetSection.getByRole('option', { name: 'AST-E2E-002 - E2E database host' }).click();
    await assetSection.getByRole('combobox').press('Escape');
    await expect(assetSection.getByRole('listbox')).toHaveCount(0);
    await assetSection.getByRole('button', { name: 'Attach asset(s)' }).click();

    await expect(assetSection.getByRole('link', { name: /AST-E2E-001/ })).toBeVisible();
    await expect(assetSection.getByRole('link', { name: /AST-E2E-002/ })).toBeVisible();
    await expect(assetSection.getByText('No assets attached yet.')).toHaveCount(0);
    expect(postedAssetIds).toEqual(['asset-e2e-1', 'asset-e2e-2']);
  });

  test('renders the validation error when an inactive user is assigned', async ({ page }) => {
    const ticket = { ...e2eTicket };
    await page.route('**/api/v1/tickets**', route => route.fulfill({ json: paginated([ticket]) }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}`, route => route.fulfill({ json: ticket }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assets`, route => route.fulfill({ json: { ticketId: e2eTicket.id, assets: [] } }));
    // ticket.service.ts validates user references; an inactive assignee fails.
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assign`, route => route.fulfill({ status: 400, json: { error: { message: 'Assignee must refer to an active user.' } } }));
    await page.route('**/api/v1/users/owners**', route => route.fulfill({ json: paginated([janeFix]) }));

    await page.goto(`/tickets/${e2eTicket.id}`);
    const assignmentSection = page.getByRole('heading', { name: 'Assignment' }).locator('..');
    await expect(assignmentSection.getByText('Unassigned')).toBeVisible();

    await assignmentSection.getByRole('combobox').fill('jane');
    await assignmentSection.getByRole('option', { name: janeFixLabel }).click();
    await assignmentSection.getByRole('button', { name: 'Assign', exact: true }).click();

    // The backend error message is surfaced and the ticket stays unassigned.
    await expect(page.getByRole('alert').filter({ hasText: 'Assignee must refer to an active user.' })).toBeVisible();
    await expect(assignmentSection.getByText('Unassigned')).toBeVisible();
  });
});
