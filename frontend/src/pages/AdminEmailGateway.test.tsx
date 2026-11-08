/**
 * Ticket E-mail Gateway admin screen tests.
 *
 * Proves:
 *  - client-side validation is announced via `role="alert"`/`aria-live`
 *  - in-flight disabling prevents double submit
 *  - secret configured / replace pattern never deletes on empty
 *  - secret-ref validation mirrors the backend `env:`/`file:` rules
 *  - provider switch and gateway enablement require confirmation
 *  - IMAP OAuth2 is hidden/disabled unless the provider is Exchange
 */
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// i18n mock: `t` returns the key so assertions are deterministic.
vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const mockGetConfig = vi.fn();
const mockUpdateConfig = vi.fn();
const mockMessages = vi.fn();
const mockStatus = vi.fn();
const mockTestInbound = vi.fn();
const mockTestSmtp = vi.fn();
const mockPollNow = vi.fn();

vi.mock('../services/api', () => ({
  emailGatewayAdminApi: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
    updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
    messages: (...args: unknown[]) => mockMessages(...args),
    status: (...args: unknown[]) => mockStatus(...args),
    testInbound: (...args: unknown[]) => mockTestInbound(...args),
    testSmtp: (...args: unknown[]) => mockTestSmtp(...args),
    pollNow: (...args: unknown[]) => mockPollNow(...args),
  },
}));

import AdminEmailGateway from './AdminEmailGateway';

const sanitizedConfig = {
  enabled: false,
  inboundProvider: 'imap',
  imapHost: 'outlook.office365.com',
  imapPort: 993,
  imapSecure: true,
  imapUser: 'ops@example.com',
  imapMailbox: 'INBOX',
  imapAuthType: 'password',
  exchangeTenantId: '',
  exchangeClientId: '',
  exchangeScopes: 'https://outlook.office365.com/.default',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpSecure: true,
  smtpUser: 'smtp@example.com',
  smtpAuthType: 'basic',
  smtpFromEmail: 'noreply@example.com',
  smtpRejectUnauthorized: true,
  pollIntervalMinutes: 5,
  subjectPrefix: '[ITSM]',
  defaultTicketType: 'incident',
  autoAssignToEmail: '',
  imapPasswordConfigured: true,
  smtpPasswordConfigured: true,
  exchangeClientSecretRefConfigured: false,
};

function renderPage() {
  return render(<AdminEmailGateway />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue({ data: sanctioned(sanitizedConfig) });
  mockMessages.mockResolvedValue({ data: [] });
  mockStatus.mockResolvedValue({ data: { lastPollAt: null, lastPollMessage: null } });
  mockUpdateConfig.mockResolvedValue({ data: sanctioned(sanitizedConfig) });
  mockTestInbound.mockResolvedValue({ data: { ok: true } });
  mockTestSmtp.mockResolvedValue({ data: { ok: true } });
  mockPollNow.mockResolvedValue({ data: { processed: 0 } });
});

afterEach(() => {
  cleanup();
});

/** Strip secret values to mimic the backend sanitizer. */
function sanctioned(config: typeof sanitizedConfig) {
  const { imapPasswordConfigured: _i, smtpPasswordConfigured: _s, exchangeClientSecretRefConfigured: _e, ...rest } = config;
  return {
    ...rest,
    imapPasswordConfigured: config.imapPasswordConfigured,
    smtpPasswordConfigured: config.smtpPasswordConfigured,
    exchangeClientSecretRefConfigured: config.exchangeClientSecretRefConfigured,
  };
}

describe('AdminEmailGateway', () => {
  it('shows the configured status chip instead of reflecting stored secrets', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const imapSecret = screen.getByLabelText('emailGateway.imapPassword');
    expect(imapSecret).toHaveProperty('value', '');
    expect(imapSecret).toHaveProperty('type', 'password');
    expect(imapSecret.getAttribute('autocomplete')).toBe('new-password');

    const chips = screen.getAllByTestId('secret-status');
    expect(chips.some((chip) => chip.textContent === 'emailGateway.secret.configured')).toBe(true);
  });

  it('announces validation errors with role=alert and blocks submit', async () => {
    mockGetConfig.mockResolvedValue({
      data: sanctioned({ ...sanitizedConfig, imapHost: 'bad host!', smtpFromEmail: 'not-an-email' }),
    });
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'emailGateway.saveConfig' }));

    const alert = await screen.findByTestId('gateway-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('emailGateway.validation.summary');
    expect(mockUpdateConfig).not.toHaveBeenCalled();

    // Field-level messages are assertive alerts tied to aria-describedby.
    const hostError = document.getElementById('imap-host-error');
    expect(hostError).not.toBeNull();
    expect(hostError?.getAttribute('role')).toBe('alert');
  });

  it('never sends a secret value when the field is left empty', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'emailGateway.saveConfig' }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1));

    const payload = mockUpdateConfig.mock.calls[0][0];
    expect(payload).not.toHaveProperty('imapPassword');
    expect(payload).not.toHaveProperty('smtpPassword');
    expect(payload).not.toHaveProperty('exchangeClientSecretRef');
  });

  it('only sends a secret when the admin explicitly replaces it', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    // Clicking "Replace secret" enables the input.
    const replaceButtons = screen.getAllByRole('button', { name: 'emailGateway.secret.replace' });
    fireEvent.click(replaceButtons[0]);

    const imapSecret = screen.getByLabelText('emailGateway.imapPassword') as HTMLInputElement;
    expect(imapSecret.disabled).toBe(false);
    fireEvent.change(imapSecret, { target: { value: 'new-imap-secret' } });

    fireEvent.click(screen.getByRole('button', { name: 'emailGateway.saveConfig' }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1));

    const payload = mockUpdateConfig.mock.calls[0][0];
    expect(payload.imapPassword).toBe('new-imap-secret');
    expect(payload).not.toHaveProperty('smtpPassword');
  });

  it('rejects bad secret references inline without submitting', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const replaceButtons = screen.getAllByRole('button', { name: 'emailGateway.secret.replace' });
    fireEvent.click(replaceButtons[0]);
    const imapSecret = screen.getByLabelText('emailGateway.imapPassword');
    fireEvent.change(imapSecret, { target: { value: 'env:1-BAD' } });

    fireEvent.click(screen.getByRole('button', { name: 'emailGateway.saveConfig' }));
    await screen.findByTestId('gateway-error');

    expect(mockUpdateConfig).not.toHaveBeenCalled();
    const error = document.getElementById('imap-password-error');
    expect(error?.textContent).toBe('emailGateway.validation.secretRefEnv');
  });

  it('disables actions while a request is in flight (no double submit)', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    let release: (value: unknown) => void = () => undefined;
    mockUpdateConfig.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );

    const save = screen.getByRole('button', { name: 'emailGateway.saveConfig' }) as HTMLButtonElement;
    fireEvent.click(save);
    // Second click before the first resolves must be ignored.
    fireEvent.click(save);

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1));
    expect(save.disabled).toBe(true);

    release({ data: sanctioned(sanitizedConfig) });
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it('requires confirmation before switching providers and adjusts IMAP auth', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const provider = screen.getByLabelText('emailGateway.provider');
    fireEvent.change(provider, { target: { value: 'exchange' } });

    // Confirmation dialog appears; provider is unchanged until confirmed.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('emailGateway.confirm.providerTitle')).toBeTruthy();
    expect((provider as HTMLSelectElement).value).toBe('imap');

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect((provider as HTMLSelectElement).value).toBe('exchange'));
  });

  it('requires confirmation before enabling the gateway', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const enabled = screen.getByLabelText('emailGateway.enableGateway');
    fireEvent.click(enabled);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('emailGateway.confirm.enableTitle')).toBeTruthy();
    expect((enabled as HTMLInputElement).checked).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect((enabled as HTMLInputElement).checked).toBe(true));
  });

  it('disables IMAP OAuth2 unless the provider is Exchange', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const auth = screen.getByLabelText('emailGateway.imapAuth') as HTMLSelectElement;
    expect(auth.disabled).toBe(true);
    expect(screen.getByText('emailGateway.imapOauth2Unavailable').textContent).toBe('emailGateway.imapOauth2Unavailable');

    const oauthOption = Array.from((auth as HTMLSelectElement).options).find(
      (option) => option.value === 'oauth2',
    );
    expect(oauthOption?.disabled).toBe(true);
  });

  it('removes a stored secret only after explicit confirmation', async () => {
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    const removeButtons = screen.getAllByRole('button', { name: 'emailGateway.secret.remove' });
    fireEvent.click(removeButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/emailGateway.confirm.removeSecretTitle/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1));

    const payload = mockUpdateConfig.mock.calls[0][0];
    expect(payload.imapPassword).toBeNull();
  });

  it('maps structured backend 400 details onto inline field errors', async () => {
    mockUpdateConfig.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'smtpPort', message: 'smtpPort must be between 1 and 65535' }],
          },
        },
      },
    });
    renderPage();
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'emailGateway.saveConfig' }));
    const alert = await screen.findByTestId('gateway-error');
    expect(alert.textContent).toContain('smtpPort must be between 1 and 65535');
    expect(document.getElementById('smtp-port-error')?.textContent).toContain('smtpPort must be between 1 and 65535');
  });
});
