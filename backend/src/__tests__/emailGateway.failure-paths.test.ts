/**
 * Item 5: failure-path coverage for the e-mail gateway.
 *
 *  - MSAL `acquireExchangeToken` failure handling (no secret leakage).
 *  - IMAP connect/logout cleanup on success and failure (no leaked connections).
 *  - SMTP `verify()` / `sendMail()` errors (bounded retries, no secret logging).
 *  - Secret reference validation (reject traversal / absolute file paths and
 *    invalid env: names, and inline Exchange secrets).
 *
 * All external modules are mocked; no live database or network needed.
 */
const verifyMock = jest.fn();
const sendMailMock = jest.fn();
const closeMock = jest.fn();
const createTransportMock = jest.fn(() => ({
  verify: verifyMock,
  sendMail: sendMailMock,
  close: closeMock,
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: (...args: unknown[]) => createTransportMock(...args) },
}));
jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));

const imapInstances: any[] = [];
jest.mock('imapflow', () => ({
  ImapFlow: jest.fn(function (this: any) {
    this.connect = jest.fn().mockResolvedValue(undefined);
    this.logout = jest.fn().mockResolvedValue(undefined);
    this.getMailboxLock = jest.fn().mockResolvedValue({ release: jest.fn() });
    this.mailbox = { uidNext: 1, exists: 0, path: 'INBOX', unseen: 0 };
    this.fetch = jest.fn();
    this.fetchOne = jest.fn();
    this.search = jest.fn().mockResolvedValue([]);
    this.mailboxOpen = jest.fn().mockResolvedValue({ path: 'INBOX', unseen: 0 });
    imapInstances.push(this);
    return this;
  }),
}));

const acquireTokenByClientCredential = jest.fn();
jest.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn(function (this: any, options: any) {
    this.options = options;
    this.acquireTokenByClientCredential = acquireTokenByClientCredential;
    return this;
  }),
}));

// Keep the real classifier but collapse the retry backoff so bounded-attempt
// tests complete deterministically instead of sleeping 2s/4s per attempt.
jest.mock('../services/transientError', () => {
  const actual = jest.requireActual('../services/transientError');
  return { ...actual, computeBackoffDelay: jest.fn(() => 0) };
});

const mockPrisma = {
  emailGatewayConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  emailMessage: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
  ticket: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/ticket.service', () => ({ ticketService: { create: jest.fn(), comment: jest.fn() } }));

import { EmailGatewayService } from '../services/emailGateway.service';

const secretValue = 'super-secret-exchange-value';
process.env.TEST_EXCHANGE_SECRET = secretValue;

const exchangeConfig = {
  id: 'gateway-1',
  enabled: true,
  inboundProvider: 'exchange',
  imapAuthType: 'oauth2',
  imapUser: 'ops@example.com',
  imapHost: 'outlook.example.com',
  imapPort: 993,
  imapMailbox: 'INBOX',
  exchangeTenantId: 'tenant-1',
  exchangeClientId: 'client-id-1',
  exchangeClientSecretRef: `env:TEST_EXCHANGE_SECRET`,
  exchangeScopes: 'https://outlook.office365.com/.default',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseConfig = {
  id: 'gateway-1',
  enabled: true,
  inboundProvider: 'imap',
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapUser: 'ops@example.com',
  imapPassword: 'imap-secret',
  imapMailbox: 'INBOX',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpAuthType: 'basic',
  smtpUser: 'notify@example.com',
  smtpPassword: 'smtp-secret',
  smtpFromEmail: 'notify@example.com',
  subjectPrefix: '[TCKT]',
};

const ticket = { id: 'ticket-1', displayId: 'TCKT-0001', title: 'Disk failure', status: 'new', priority: 'high' };

describe('Item 5: MSAL token acquisition failure', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    imapInstances.length = 0;
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue(exchangeConfig);
    service = new EmailGatewayService();
  });

  it('propagates a token-acquisition failure without leaking the client secret', async () => {
    acquireTokenByClientCredential.mockRejectedValue(new Error('MSAL network failure'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    let caught: unknown;
    try {
      await service.testInbound();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain(secretValue);
    expect(message).toContain('MSAL network failure');

    // The secret is encrypted/redacted at logging time too.
    const logged = errorSpy.mock.calls.map((args) => args.map((value) => String(value)).join(' ')).join('\n');
    expect(logged).not.toContain(secretValue);
    errorSpy.mockRestore();

    // No IMAP client should have been created when token acquisition fails.
    expect(imapInstances).toHaveLength(0);
  });

  it('rejects missing Exchange credentials with a 400 before contacting MSAL', async () => {
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
      ...exchangeConfig, exchangeClientId: null, exchangeTenantId: null, exchangeClientSecretRef: null,
    });

    await expect(service.testInbound()).rejects.toMatchObject({ statusCode: 400 });
    expect(acquireTokenByClientCredential).not.toHaveBeenCalled();
    expect(imapInstances).toHaveLength(0);
  });
});

describe('Item 5: IMAP connection cleanup', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    imapInstances.length = 0;
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({ ...baseConfig, enabled: false });
    service = new EmailGatewayService();
  });

  // buildImapClient spies must not leak into later tests in this suite.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs out the IMAP client after a successful test-inbound probe', async () => {
    await service.testInbound();

    const client = imapInstances[0];
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it('logs out the IMAP client even when the probe throws after connect', async () => {
    // Build the probe failure on the client after construction.
    const connectSpy = jest.fn().mockImplementation(() => {
      throw new Error('IMAP connect failed');
    });

    jest.spyOn(EmailGatewayService.prototype as any, 'buildImapClient').mockImplementation(function (
      this: any,
      config: any,
    ) {
      const client = {
        connect: connectSpy,
        logout: jest.fn().mockResolvedValue(undefined),
        getMailboxLock: jest.fn(),
        mailbox: { path: 'INBOX', unseen: 0 },
        search: jest.fn(),
        mailboxOpen: jest.fn(),
      };
      imapInstances.push(client);
      return client;
    } as any);

    await expect(service.testInbound()).rejects.toThrow('IMAP connect failed');
    const client = imapInstances[imapInstances.length - 1];
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it('logs out and releases the mailbox lock after a poll (success path)', async () => {
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({ ...baseConfig });
    mockPrisma.emailGatewayConfig.update.mockResolvedValue({ id: 'gateway-1' });

    await service.pollInbound('email-gateway');

    const client = imapInstances[imapInstances.length - 1];
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.logout).toHaveBeenCalledTimes(1);
    const lock = await client.getMailboxLock.mock.results[0].value;
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('logs out the IMAP client after a poll failure (no leaked connection)', async () => {
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({ ...baseConfig });
    mockPrisma.emailGatewayConfig.update.mockResolvedValue({ id: 'gateway-1' });

    jest.spyOn(EmailGatewayService.prototype as any, 'buildImapClient').mockImplementation(function () {
      const client = {
        connect: jest.fn().mockResolvedValue(undefined),
        logout: jest.fn().mockResolvedValue(undefined),
        getMailboxLock: jest.fn().mockRejectedValue(new Error('mailbox unavailable')),
        mailbox: { uidNext: 1, exists: 0 },
        fetch: jest.fn(),
        fetchOne: jest.fn(),
      };
      imapInstances.push(client);
      return client;
    } as any);

    await expect(service.pollInbound('email-gateway')).rejects.toThrow('mailbox unavailable');
    const client = imapInstances[imapInstances.length - 1];
    expect(client.logout).toHaveBeenCalledTimes(1);
  });
});

describe('Item 5: SMTP verify/sendMail failure handling', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({ ...baseConfig });
    mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1' });
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockResolvedValue({});
    service = new EmailGatewayService();
  });

  it('surfaces verify() failures as a 502 and never logs the SMTP secret', async () => {
    verifyMock.mockRejectedValue(new Error('SMTP verify failed for notify@example.com'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(service.testSmtp()).rejects.toMatchObject({ statusCode: 502 });

    const logged = [...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .map((args) => args.map((value) => String(value)).join(' '))
      .join('\n');
    expect(logged).not.toContain('smtp-secret');
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('retries transient sendMail failures only up to the bounded attempt count', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (service as any).enqueueConfirmation({ ticket, toEmail: 'user@example.com', config: baseConfig });
    await service.drainConfirmations(10_000);

    // CONFIRMATION_MAX_ATTEMPTS defaults to 3; every attempt is transient.
    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(mockPrisma.emailMessage.create).not.toHaveBeenCalled();

    const logged = errorSpy.mock.calls.map((args) => args.map((v) => String(v)).join(' ')).join('\n');
    expect(logged).not.toContain('smtp-secret');
    expect(logged).not.toContain('notify@example.com');
    errorSpy.mockRestore();
  });

  it('does not retry deterministic sendMail failures (EAUTH) and logs no secrets', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('auth rejected'), { code: 'EAUTH' }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (service as any).enqueueConfirmation({ ticket, toEmail: 'user@example.com', config: baseConfig });
    await service.drainConfirmations(10_000);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(mockPrisma.emailMessage.create).not.toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((args) => args.map((v) => String(v)).join(' ')).join('\n');
    expect(logged).not.toContain('smtp-secret');
    errorSpy.mockRestore();
  });
});

describe('Item 5: secret reference validation', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({ id: 'gateway-1', inboundProvider: 'imap' });
    mockPrisma.emailGatewayConfig.update.mockImplementation(async (args: any) => ({ id: 'gateway-1', ...args.data }));
    service = new EmailGatewayService();
  });

  it.each([
    ['file:../../etc/passwd', 'Invalid secret file path'],
    ['file:secrets/../../.env', 'Invalid secret file path'],
    ['file:/etc/passwd', 'must be relative'],
    ['file:C:/Windows/system32/drivers/etc/hosts', 'must be relative'],
  ])('rejects unsafe file: reference %s', async (ref, messageFragment) => {
    await expect(service.updateConfig({ exchangeClientSecretRef: ref }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining(messageFragment) });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });

  it.each([
    ['env:1INVALID', 'valid environment variable'],
    ['env:BAD-NAME', 'valid environment variable'],
    ['env:', 'valid environment variable'],
  ])('rejects invalid env: reference %s', async (ref) => {
    await expect(service.updateConfig({ exchangeClientSecretRef: ref }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });

  it('rejects a raw inline Exchange client secret', async () => {
    await expect(service.updateConfig({ exchangeClientSecretRef: 'raw-inline-client-secret' }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });

  it('rejects imapAuthType=oauth2 combined with the imap provider', async () => {
    await expect(service.updateConfig({ inboundProvider: 'imap', imapAuthType: 'oauth2' }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });
});
