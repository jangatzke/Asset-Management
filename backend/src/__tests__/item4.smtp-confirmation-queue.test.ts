/**
 * Item 4: SMTP transport reuse/timeouts and bounded confirmation queue.
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
jest.mock('imapflow', () => ({ ImapFlow: jest.fn(function (this: any) { return this; }) }));
jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));
jest.mock('@azure/msal-node', () => ({ ConfidentialClientApplication: jest.fn() }));

const mockPrisma = {
  emailGatewayConfig: { findFirst: jest.fn(), update: jest.fn() },
  emailMessage: { create: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/ticket.service', () => ({ ticketService: { create: jest.fn(), comment: jest.fn() } }));

import { EmailGatewayService } from '../services/emailGateway.service';

const baseConfig = {
  id: 'gateway-1',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpAuthType: 'basic',
  smtpUser: 'notify@example.com',
  smtpPassword: 'smtp-secret',
  smtpFromEmail: 'notify@example.com',
  subjectPrefix: '[TCKT]',
};

const ticket = { id: 'ticket-1', displayId: 'TCKT-0001', title: 'Disk failure', status: 'new', priority: 'high' };

describe('Item 4: SMTP transport reuse and timeouts', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockResolvedValue({});
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue(baseConfig);
    mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1' });
    service = new EmailGatewayService();
  });

  it('reuses one verified transporter for repeated sends with the same config', async () => {
    const config = { ...baseConfig, smtpConnectionTimeoutMs: 5_000, smtpGreetingTimeoutMs: 6_000, smtpSocketTimeoutMs: 7_000 };

    await (service as any).getSmtpTransport(config);
    await (service as any).getSmtpTransport(config);

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);
    const options = createTransportMock.mock.calls[0][0];
    expect(options.connectionTimeout).toBe(5_000);
    expect(options.greetingTimeout).toBe(6_000);
    expect(options.socketTimeout).toBe(7_000);
    expect(options.pool).toBe(false);
  });

  it('applies bounded defaults when timeouts are not configured', async () => {
    await (service as any).getSmtpTransport(baseConfig);

    const options = createTransportMock.mock.calls[0][0];
    expect(options.connectionTimeout).toBe(30_000);
    expect(options.greetingTimeout).toBe(30_000);
    expect(options.socketTimeout).toBe(60_000);
  });

  it('closes the previous transport and rebuilds when the connection identity changes', async () => {
    await (service as any).getSmtpTransport(baseConfig);
    await (service as any).getSmtpTransport({ ...baseConfig, smtpHost: 'smtp2.example.com' });

    expect(createTransportMock).toHaveBeenCalledTimes(2);
    expect(closeMock).toHaveBeenCalled();
  });

  it('never puts the SMTP secret into the cache key', () => {
    const key = (service as any).smtpCacheKey(baseConfig);
    expect(key).not.toContain('smtp-secret');
    expect(key).toContain('smtp.example.com');
  });
});

describe('Item 4: bounded confirmation queue', () => {
  let service: EmailGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockResolvedValue({});
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue(baseConfig);
    mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1' });
    service = new EmailGatewayService();
  });

  it('delivers enqueued confirmations and writes an audit row per send', async () => {
    await (service as any).enqueueConfirmation({ ticket, toEmail: 'user@example.com', config: baseConfig });
    await service.drainConfirmations(2_000);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(mockPrisma.emailMessage.create).toHaveBeenCalledTimes(1);
  });

  it('delivers multiple confirmations concurrently without blocking the caller', async () => {
    sendMailMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({}), 20)));
    for (let i = 0; i < 6; i += 1) {
      (service as any).enqueueConfirmation({
        ticket: { ...ticket, id: `ticket-${i}`, displayId: `TCKT-${i}` },
        toEmail: 'user@example.com',
        config: baseConfig,
      });
    }

    await service.drainConfirmations(5_000);

    expect(sendMailMock).toHaveBeenCalledTimes(6);
    expect(mockPrisma.emailMessage.create).toHaveBeenCalledTimes(6);
  });

  it('retries transient SMTP failures and succeeds on the next attempt', async () => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));
    (service as any).enqueueConfirmation({ ticket, toEmail: 'user@example.com', config: baseConfig });

    await service.drainConfirmations(10_000);

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(mockPrisma.emailMessage.create).toHaveBeenCalledTimes(1);
  });

  it('does not retry deterministic SMTP failures', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('auth rejected'), { code: 'EAUTH' }));
    (service as any).enqueueConfirmation({ ticket, toEmail: 'user@example.com', config: baseConfig });

    await service.drainConfirmations(10_000);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(mockPrisma.emailMessage.create).not.toHaveBeenCalled();
  });

  it('drops the oldest queued confirmation when the queue is full', () => {
    // Freeze the pump so enqueues accumulate without draining.
    (service as any).confirmationDraining = true;
    const max = 200;

    for (let i = 0; i <= max; i += 1) {
      (service as any).enqueueConfirmation({
        ticket: { ...ticket, id: `ticket-${i}`, displayId: `TCKT-${i}` },
        toEmail: 'user@example.com',
        config: baseConfig,
      });
    }

    const queue = (service as any).confirmationQueue;
    expect(queue).toHaveLength(max);
    expect(queue[0].ticket.displayId).toBe('TCKT-1');
    expect(queue[max - 1].ticket.displayId).toBe(`TCKT-${max}`);
    // Release the frozen pump for cleanliness (no queued work expected since
    // assertions ran synchronously before the pump can run).
    (service as any).confirmationDraining = false;
    (service as any).confirmationQueue.length = 0;
  });
});
