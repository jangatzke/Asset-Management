const { createMockPrismaClient } = require('../test/prisma-mock');

var mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));
jest.mock('../services/ticket.service', () => ({ ticketService: { create: jest.fn(), comment: jest.fn() } }));

const { emailGatewayService } = require('../services/emailGateway.service');

describe('debug', () => {
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
  });

  it('debug poll', async () => {
    const mailParserMock = jest.fn(async () => ({
      from: [{ address: 'user@example.com', name: 'Legit Requester' }],
      to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
      subject: 'Re: disk failure',
      text: 'reply body',
      html: null,
      inReplyTo: '<TCKT-0001@it.example.com>',
      date: new Date(),
    }));
    require('mailparser').simpleParser = mailParserMock;

    const { ImapFlow } = require('imapflow');
    const connectSpy = jest.spyOn(ImapFlow.prototype, 'connect').mockResolvedValue(undefined);
    const logoutSpy = jest.spyOn(ImapFlow.prototype, 'logout').mockResolvedValue(undefined);
    const getMailboxLockSpy = jest
      .spyOn(ImapFlow.prototype, 'getMailboxLock')
      .mockResolvedValue({ release: jest.fn().mockResolvedValue(undefined), mailbox: undefined } as any);
    jest
      .spyOn(ImapFlow.prototype, 'fetch')
      .mockImplementation(async function* () {
        yield { uid: 1, envelope: { messageId: '<test@example.com>', from: [{ address: 'user@example.com' }] } };
      });
    jest
      .spyOn(ImapFlow.prototype, 'fetchOne')
      .mockResolvedValue({ source: Buffer.from('Subject: Re: disk failure\r\nFrom: user@example.com\r\nMessage-ID: <test@example.com>\r\n\r\nreply body') } as any);
    const imapInstance = new ImapFlow();
    imapInstance.open = jest.fn().mockResolvedValue(undefined);

    try {
      const result = await emailGatewayService.pollInbound('email-gateway');
      expect(result.processed).toBe(1);
    } catch (e) {
      console.error('REAL ERROR:', e);
      console.error('STACK:', (e as Error).stack);
      throw e;
    }
  }, 15000);
});
