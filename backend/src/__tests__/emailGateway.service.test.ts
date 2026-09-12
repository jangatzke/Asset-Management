import { createMockPrismaClient } from '../test/prisma-mock';

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/ticket.service', () => ({ ticketService: { create: jest.fn(), comment: jest.fn() } }));

const { emailGatewayService } = require('../services/emailGateway.service');
const { ticketService } = require('../services/ticket.service');

// Hoist module mocks to the top so they apply to ALL describe blocks below.
// If these are declared inside a describe block, the first block can load the
// real modules and cache them before the mock registration takes effect, which
// leaves the real imapflow/mailparser modules active for later tests.
jest.mock('mailparser', () => ({
  simpleParser: jest.fn(async () => ({
    from: { value: [{ address: 'user@example.com', name: 'Legit Requester' }] },
    to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
    subject: 'Re: disk failure',
    text: 'reply body',
    html: null,
    inReplyTo: '<TCKT-0001@it.example.com>',
    date: new Date(),
  })),
}));
jest.mock('imapflow', () => {
  // Shared mocks so tests can override behaviour per test via mockImplementation.
  // Defining these per-instance (inside the constructor) would mean the mock
  // grabbed in beforeEach controls a different object than the one the service
  // actually uses, so per-test overrides would silently do nothing.
  const fetchMock = jest.fn(async function* () {
    yield { uid: 1, envelope: { messageId: '<test@example.com>', from: [{ address: 'attacker@evil.com' }] } };
  });
  const fetchOneMock = jest.fn().mockResolvedValue(Buffer.from('raw source'));
  return {
    ImapFlow: jest.fn(function (this: any) {
      this.connect = jest.fn().mockResolvedValue(undefined);
      this.logout = jest.fn().mockResolvedValue(undefined);
      this.getMailboxLock = jest.fn().mockResolvedValue({ release: jest.fn().mockResolvedValue(undefined) });
      this.fetch = fetchMock;
      this.fetchOne = fetchOneMock;
      return this;
    }),
  };
});

describe('EmailGatewayService configuration security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
      id: 'gateway-1', enabled: false, inboundProvider: 'imap',
      imapPassword: 'imap-secret', smtpPassword: 'smtp-secret', exchangeClientSecretRef: 'env:EXCHANGE_SECRET',
      createdAt: new Date(), updatedAt: new Date(),
    });
  });

  it('never exposes mailbox, SMTP, or Exchange secret values in configuration responses', async () => {
    const config = await emailGatewayService.getConfig();

    expect(config).not.toHaveProperty('imapPassword');
    expect(config).not.toHaveProperty('smtpPassword');
    expect(config).not.toHaveProperty('exchangeClientSecretRef');
    expect(config).toMatchObject({
      imapPasswordConfigured: true,
      smtpPasswordConfigured: true,
      exchangeClientSecretRefConfigured: true,
    });
  });

  it('rejects an unsupported inbound provider before changing configuration', async () => {
    await expect(emailGatewayService.updateConfig({ inboundProvider: 'pop3' }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });

  it('rejects polling intervals outside the bounded operational range', async () => {
    await expect(emailGatewayService.updateConfig({ pollIntervalMinutes: 0 }, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.emailGatewayConfig.update).not.toHaveBeenCalled();
  });
});

describe('EmailGatewayService reply attribution security (From header vs envelope sender)', () => {
// Mock the mail parser so pollInbound runs offline with a deterministic From
// header value. The mock is recreated per test so the From header can change.
let mailParserMock: jest.Mock;
let imapFetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
    id: 'gateway-1',
    enabled: true,
    inboundProvider: 'imap',
    imapMailbox: 'INBOX',
    defaultTicketType: 'incident',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockPrisma.emailMessage.findMany.mockResolvedValue([]);
  mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1' });
  mockPrisma.emailMessage.update.mockResolvedValue({ id: 'msg-1' });
  mockPrisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-internal', displayId: 'TCKT-0001', requesterId: 'user-requester' });
  // resolveUserByEmail uses prisma.$queryRaw; return the matching requester user.
  mockPrisma.$queryRaw.mockImplementation(async () => [
    { id: 'user-requester', email: 'user@example.com', firstName: 'Legit', lastName: 'Requester', isActive: true },
  ]);

  mailParserMock = (require('mailparser').simpleParser as jest.Mock);
  const { ImapFlow } = require('imapflow');
  imapFetchMock = new ImapFlow().fetch as jest.Mock;
});

it('attributes a spoofed From header (mismatched envelope sender) as an internal note, not the requester', async () => {
  // From header impersonates the ticket requester, but the envelope sender is
  // the attacker -> the From header is spoofed and must not be trusted.
  mailParserMock.mockResolvedValue({
    from: { value: [{ address: 'user@example.com', name: 'Legit Requester' }] },
    to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
    subject: 'Re: disk failure',
    text: 'reply body',
    html: null,
    inReplyTo: '<TCKT-0001@it.example.com>',
    date: new Date(),
  });

  const result = await emailGatewayService.pollInbound('email-gateway');

  expect(result.processed).toBe(1);
  expect(ticketService.comment).toHaveBeenCalledTimes(1);
  const [, commentArgs] = ticketService.comment.mock.calls[0];
  // Envelope sender (attacker@evil.com) differs from the From header
  // (user@example.com), so the reply must NOT be attributed to the requester.
  expect(commentArgs.isInternal).toBe(true);
  expect(commentArgs.userId).not.toBe('user-requester');
});

it('attributes a reply whose From header matches the envelope sender as the requester', async () => {
  mailParserMock.mockResolvedValue({
    from: { value: [{ address: 'user@example.com', name: 'Legit Requester' }] },
    to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
    subject: 'Re: disk failure',
    text: 'reply body',
    html: null,
    inReplyTo: '<TCKT-0001@it.example.com>',
    date: new Date(),
  });
  // Envelope sender matches the From header -> trusted -> requester public comment.
  imapFetchMock.mockImplementation(async function* () {
    yield { uid: 1, envelope: { messageId: '<test@example.com>', from: [{ address: 'user@example.com' }] } };
  });

  const result = await emailGatewayService.pollInbound('email-gateway');
  expect(result.processed).toBe(1);
  expect(ticketService.comment).toHaveBeenCalledTimes(1);
  const [, commentArgs, userId] = ticketService.comment.mock.calls[0];
  expect(commentArgs.isInternal).toBe(false);
  expect(userId).toBe('user-requester');
});
});
