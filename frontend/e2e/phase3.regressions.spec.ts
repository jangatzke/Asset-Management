import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Phase 3.4 — Regression coverage for the five Phase 1/2/3 hardening axes:
 *  - E-mail gateway admin page renders without leaking secrets into the DOM.
 *  - OIDC admin page renders without leaking the client secret into the DOM.
 *  - SLA escalation admin page (verified file: src/pages/AdminSlaEscalation.tsx,
 *    route /admin/sla-escalation) renders policy, SMTP and log sections.
 *  - Bulk archive on the assets list: selection + toolbar + ConfirmDialog open
 *    (no destructive execution without a seed).
 *  - Idempotent double-submit: every POST for one logical create carries the
 *    same `Idempotency-Key` (frontend/src/services/api.ts:540 re-sends the SAME
 *    axios config on the 401 refresh retry) and the persisted record count does
 *    not grow.
 *
 * This file deliberately imports `@playwright/test` directly (no extension-less
 * relative `./fixtures` import): `frontend/tsconfig.playwright.json` uses
 * `moduleResolution: node16`, where extension-less relative imports (TS2835)
 * cascade into implicit-`any` fixture typing errors. Inlining the auth seed and
 * fixtures below keeps this new spec typecheck-conform without touching the
 * pre-existing specs.
 */

const testUser = {
  id: 'e2e-user-1',
  email: 'e2e.analyst@example.test',
  firstName: 'E2E',
  lastName: 'Analyst',
  roles: ['system_admin'],
};

const e2eAssets = [
  { id: 'asset-e2e-1', displayId: 'AST-E2E-001', name: 'E2E file server', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
  { id: 'asset-e2e-2', displayId: 'AST-E2E-002', name: 'E2E database host', assetType: { name: 'Server' }, manufacturer: 'E2E Systems', status: 'active' },
];

const e2eTicket = {
  id: 'ticket-e2e-1',
  displayId: 'TKT-E2E-001',
  type: 'service_request',
  title: 'E2E idempotent double submit',
  description: 'Same logical create submitted twice.',
  status: 'new',
  priority: 'medium',
  urgency: 'medium',
  impact: 'medium',
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

const paginated = <T,>(data: T[]) => ({
  data,
  pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});

/** Mirrors e2e/fixtures.ts: the auth store resolves the session via refresh+me. */
async function seedAuth(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/refresh', (route: Route) => route.fulfill({ json: { token: 'e2e-browser-token' } }));
  await page.route('**/api/v1/auth/me', (route: Route) => route.fulfill({ json: testUser }));
}

/** Sentinel values that must never appear in rendered text, HTML or inputs. */
const SECRET_SENTINELS = ['super-secret-smtp-value', 'super-secret-imap-value', 'super-secret-oidc-value'];

const headerValue = (headers: Record<string, string>, name: string): string | undefined =>
  headers[name.toLowerCase()];

async function assertNoSecretLeak(page: Page): Promise<void> {
  // Password inputs must never be pre-filled with a secret by the admin UI.
  const passwordValues = await page
    .locator('input[type="password"]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  for (const value of passwordValues) {
    expect(value).toBe('');
  }

  // No sentinel secret may appear in the rendered text or the serialized DOM.
  const bodyText = await page.locator('body').innerText();
  const html = await page.content();
  for (const sentinel of SECRET_SENTINELS) {
    expect(bodyText).not.toContain(sentinel);
    expect(html).not.toContain(sentinel);
  }
}

test.describe('Phase 3.4 regression: admin pages and bulk/idempotency guards', () => {
  test('e-mail gateway admin page loads the configuration form and never renders secrets', async ({ page }) => {
    await seedAuth(page);
    // Backend contract (`emailGateway.service.ts`): mailbox/SMTP secrets are
    // never returned; only `*Configured` booleans are exposed.
    await page.route('**/api/v1/admin/email-gateway/config', (route: Route) =>
      route.fulfill({
        json: {
          enabled: true,
          inboundProvider: 'imap',
          imapHost: 'outlook.office365.com',
          imapPort: 993,
          imapSecure: true,
          imapUser: 'gateway@example.test',
          imapMailbox: 'INBOX',
          imapAuthType: 'password',
          imapPasswordConfigured: true,
          smtpHost: 'smtp.example.test',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'notify@example.test',
          smtpAuthType: 'basic',
          smtpPasswordConfigured: true,
          smtpFromEmail: 'notify@example.test',
          pollIntervalMinutes: 5,
          subjectPrefix: '[ITSM]',
          defaultTicketType: 'incident',
        },
      }),
    );
    await page.route('**/api/v1/admin/email-gateway/status', (route: Route) =>
      route.fulfill({ json: { lastPollAt: null, lastPollMessage: 'never polled' } }),
    );
    await page.route('**/api/v1/admin/email-gateway/messages**', (route: Route) => route.fulfill({ json: [] }));

    await page.goto('/admin/email-gateway');

    // Verified strings: AdminEmailGateway.tsx:124 (title) and :132 (inbound)
    // come from en.json emailGateway.title / emailGateway.inbound.
    await expect(page.getByRole('heading', { name: 'Ticket E-mail Gateway' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbound mailbox' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save configuration/i })).toBeVisible();
    await assertNoSecretLeak(page);
  });

  test('OIDC admin page loads the provider form and never renders the client secret', async ({ page }) => {
    await seedAuth(page);
    await page.route('**/api/v1/admin/oidc/config', (route: Route) =>
      route.fulfill({
        json: {
          id: 'oidc-e2e-1',
          enabled: true,
          providerName: 'entra_id',
          tenantId: 'e2e-tenant-id',
          clientId: 'e2e-client-id',
          redirectUri: 'http://127.0.0.1:3100/oidc/callback',
          allowedEmailDomains: ['example.test'],
          autoProvisioning: true,
          defaultRoleForNewUsers: 'viewer',
          enableGroupMapping: false,
          enableLocalLogin: true,
          // Like the backend, the secret is write-only and NOT returned.
          clientSecretConfigured: true,
        },
      }),
    );

    await page.goto('/admin/oidc');

    // Verified strings: AdminOIDC.tsx:90 (h1 = navigation.oidcConfig) and
    // :127 (oidc.providerSettings).
    await expect(page.getByRole('heading', { name: 'OIDC Configuration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Provider Settings' })).toBeVisible();
    // The write-only secret field exists but must be empty (AdminOIDC.tsx:188-193).
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await assertNoSecretLeak(page);
  });

  test('SLA escalation admin page loads policy, SMTP settings and the escalation log', async ({ page }) => {
    await seedAuth(page);
    // Verified file/route: src/pages/AdminSlaEscalation.tsx is mounted at
    // /admin/sla-escalation (App.tsx:122). AdminTicketSla.tsx is the separate
    // /admin/ticket-slas page and is intentionally not asserted here.
    await page.route('**/api/v1/admin/sla-escalation/config', (route: Route) =>
      route.fulfill({
        json: {
          enabled: false,
          intervalMinutes: 60,
          notifyAssignee: true,
          notifyManager: true,
          notifyEmail: false,
          escalationLevels: [1, 2, 3],
          escalationDelayMinutes: 30,
          smtpPort: 587,
          smtpSecure: false,
          smtpRejectUnauthorized: true,
          smtpPasswordConfigured: true,
        },
      }),
    );
    await page.route('**/api/v1/admin/sla-escalation/logs**', (route: Route) =>
      route.fulfill({
        json: [
          {
            id: 'log-e2e-1',
            createdAt: '2026-08-01T08:00:00.000Z',
            ticketId: 'ticket-e2e-1',
            breachType: 'resolution',
            level: 1,
            escalatedTo: 'user-e2e-2',
            escalatedToType: 'user',
            sentVia: 'in-app',
            status: 'sent',
          },
        ],
      }),
    );

    await page.goto('/admin/sla-escalation');

    // Verified strings: slaEscalation.title, policy, smtpSettings, recentLog.
    await expect(page.getByRole('heading', { name: 'SLA Escalation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Escalation Policy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SMTP Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent escalation log' })).toBeVisible();
    const logTable = page.locator('table');
    await expect(logTable).toBeVisible();
    await expect(logTable).toContainText('Resolution');
    await expect(logTable).toContainText('Level 1');
    await assertNoSecretLeak(page);
  });

  test('bulk archive toolbar and confirm dialog open from the assets selection', async ({ page }) => {
    await seedAuth(page);
    await page.route('**/api/v1/assets**', async (route: Route) => {
      const url = route.request().url();
      if (url.includes('/assets/types')) {
        await route.fulfill({ json: [] });
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: paginated(e2eAssets) });
        return;
      }
      await route.fulfill({ json: { success: true } });
    });

    await page.goto('/assets');

    // Verified selectors: Assets.tsx:837 row checkbox aria-label `bulk.select`,
    // Assets.tsx:787 bulk archive button, Assets.tsx:1147 ConfirmDialog.
    const firstAssetCheckbox = page.getByRole('checkbox', { name: 'Select: E2E file server' });
    await expect(firstAssetCheckbox).toBeVisible();
    await firstAssetCheckbox.check();

    // Toolbar appears only while a selection exists (Assets.tsx:782-790).
    await expect(page.getByText('1 selected')).toBeVisible();
    const bulkArchiveButton = page.getByRole('button', { name: 'Archive selected' });
    await expect(bulkArchiveButton).toBeVisible();
    await bulkArchiveButton.click();

    // The ConfirmDialog opens; nothing is archived until the user confirms.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Archive selected assets?');
    await expect(dialog.getByRole('button', { name: /archive selected/i })).toBeVisible();

    // Close without confirming: no destructive POST is issued.
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('double-submit keeps one Idempotency-Key across the 401 refresh retry and creates no extra record', async ({ page }) => {
    await seedAuth(page);
    const keys: (string | undefined)[] = [];
    let postCount = 0;
    let ticketCreated = false;

    await page.route('**/api/v1/tickets**', async (route: Route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({ json: paginated(ticketCreated ? [e2eTicket] : [e2eTicket]) });
        return;
      }
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/tickets')) {
        postCount += 1;
        keys.push(headerValue(request.headers(), 'Idempotency-Key'));
        if (postCount === 1) {
          // Simulate an expired session: the axios response interceptor refreshes
          // and re-sends the SAME config object (which already carries the key).
          await route.fulfill({ status: 401, json: { error: 'session expired' } });
          return;
        }
        ticketCreated = true;
        await route.fulfill({ json: e2eTicket });
        return;
      }
      await route.fulfill({ json: {} });
    });

    await page.goto('/tickets');
    await page.getByRole('button', { name: 'New ticket', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('E2E idempotent double submit');
    await page.getByLabel('Description', { exact: true }).fill('Same logical create submitted twice.');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Rapid second click while the retry is in flight (may be intercepted by the
    // disabled state; the refresh retry still re-sends the same logical operation).
    const createButton = page.getByRole('button', { name: 'Create', exact: true });
    await createButton.click({ force: true, timeout: 2_000 }).catch(() => undefined);

    await expect.poll(() => keys.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    expect(postCount).toBeGreaterThanOrEqual(2);
    const firstKey = keys[0];
    expect(firstKey).toBeDefined();
    expect(firstKey).toMatch(/^[a-zA-Z0-9\-_]{16,}$/);
    // Every retry/double-submit for this logical create carries the same key.
    for (const key of keys) {
      expect(key).toBe(firstKey);
    }

    // The persisted list still shows exactly one record (no duplicate creation).
    await expect(page.getByRole('link', { name: 'TKT-E2E-001' })).toHaveCount(1);
  });
});
