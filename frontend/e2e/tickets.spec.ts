import { expect, e2eAssets, e2eTicket, paginated, test, testUser } from './fixtures';

import type { Route } from '@playwright/test';

/**
 * Mocked browser-contract coverage for the ITIL ticket workflow. Mirrors the
 * patterns of core-workflows.spec.ts: API route fulfillment only, no
 * backend/database. Status options mirror shared/src/ticketTransitions.ts
 * (single source of truth for the ticket state machines).
 */

// EntityPicker option labels for users fall back to the email (the shared
// getEntityLabel helper prefers displayId+name, then legalName/name/title/email).
const janeFix = { id: 'user-e2e-2', email: 'jane.fix@example.test', firstName: 'Jane', lastName: 'Fix' };

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
    await expect(page.getByLabel('Status')).toHaveValue('in_progress');

    // in_progress → fulfilled, then the ITIL 4 reopen fulfilled → new.
    await page.getByLabel('Status').selectOption('fulfilled');
    await expect(page.getByLabel('Status')).toHaveValue('fulfilled');
    const reopenOption = page.getByLabel('Status').locator('option[value="new"]');
    await expect(reopenOption).toHaveCount(1);
    await page.getByLabel('Status').selectOption('new');
    await expect(page.getByLabel('Status')).toHaveValue('new');
  });

  test('assigns an active user and links multiple assets through the TicketAsset context', async ({ page }) => {
    const ticket = { ...e2eTicket };
    const assets: typeof e2eAssets = [];
    await page.route('**/api/v1/tickets**', route => route.fulfill({ json: paginated([ticket]) }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}`, route => route.fulfill({ json: ticket }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assign`, async (route: Route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { assigneeId: string | null };
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
        for (const assetId of body.assetIds) {
          const asset = e2eAssets.find((candidate) => candidate.id === assetId);
          if (asset && !assets.includes(asset)) assets.push(asset);
        }
        await route.fulfill({ json: ticket });
        return;
      }
      await route.fulfill({ json: {} });
    });
    await page.route('**/api/v1/users/search**', route => route.fulfill({ json: paginated([janeFix]) }));
    await page.route('**/api/v1/assets**', route => route.fulfill({ json: paginated(e2eAssets) }));

    await page.goto(`/tickets/${e2eTicket.id}`);
    await expect(page.getByRole('heading', { name: /TKT-E2E-001/ })).toBeVisible();
    await expect(page.getByText('Unassigned')).toBeVisible();

    // Assignee EntityPicker: search, pick the user, then assign.
    await page.locator('input[role="combobox"]').first().fill('jane');
    await page.getByRole('option', { name: janeFix.email }).click();
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(page.getByText('Jane Fix')).toBeVisible();
    await expect(page.getByText('Unassigned')).toHaveCount(0);

    // Asset EntityPicker (multiple): link both assets to the ticket.
    await page.locator('input[role="combobox"]').nth(1).fill('AST');
    await page.getByRole('option', { name: 'AST-E2E-001 - E2E file server' }).click();
    await page.getByRole('option', { name: 'AST-E2E-002 - E2E database host' }).click();
    // The multi-select picker stays open; close it via an outside mousedown
    // (the picker listens on document mousedown) so it no longer intercepts
    // the attach click.
    await page.getByRole('heading', { name: 'Asset context' }).click();
    await page.getByRole('button', { name: 'Attach asset(s)' }).click();
    await expect(page.getByRole('link', { name: /AST-E2E-001/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /AST-E2E-002/ })).toBeVisible();
    await expect(page.getByText('No assets attached yet.')).toHaveCount(0);
    expect(assets.map((asset) => asset.id)).toEqual(['asset-e2e-1', 'asset-e2e-2']);
  });

  test('renders the validation error when an inactive user is assigned', async ({ page }) => {
    const ticket = { ...e2eTicket };
    await page.route('**/api/v1/tickets**', route => route.fulfill({ json: paginated([ticket]) }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}`, route => route.fulfill({ json: ticket }));
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assets`, route => route.fulfill({ json: { ticketId: e2eTicket.id, assets: [] } }));
    // ticket.service.ts validates user references; an inactive assignee fails.
    await page.route(`**/api/v1/tickets/${e2eTicket.id}/assign`, route => route.fulfill({ status: 400, json: { error: { message: 'Assignee must refer to an active user.' } } }));
    await page.route('**/api/v1/users/search**', route => route.fulfill({ json: paginated([janeFix]) }));

    await page.goto(`/tickets/${e2eTicket.id}`);
    await expect(page.getByText('Unassigned')).toBeVisible();

    await page.locator('input[role="combobox"]').first().fill('jane');
    await page.getByRole('option', { name: janeFix.email }).click();
    await page.getByRole('button', { name: 'Assign', exact: true }).click();

    // The backend error message is surfaced and the ticket stays unassigned.
    await expect(page.getByRole('alert')).toContainText('Assignee must refer to an active user.');
    await expect(page.getByText('Unassigned')).toBeVisible();
  });
});
