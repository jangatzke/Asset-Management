/**
 * Durable deduplication + bounded polling semantics for the e-mail gateway.
 *
 * These tests run entirely against the mocked Prisma/ImapFlow modules and do
 * not require a live database. They verify:
 *  - `computeDedupKey()` determinism (Message-ID vs. synthesized fallback).
 *  - Bounded polling fetches a newest-N window instead of `1:*`.
 *  - The batched durable dedup lookup skips already-processed messages.
 *  - Persist-then-process is idempotent: an existing linked ticket is never
 *    converted twice, and a lost claim skips instead of creating a ticket.
 */
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn().mockResolvedValue({}) } }));

const ticketCreate = jest.fn();
const ticketComment = jest.fn();
jest.mock('../services/ticket.service', () => ({ ticketService: { create: ticketCreate, comment: ticketComment } }));

jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));

jest.mock('imapflow', () => {
  const fetchMock = jest.fn();
  return {
    ImapFlow: jest.fn(function (this: any) {
      this.connect = jest.fn().mockResolvedValue(undefined);
      this.logout = jest.fn().mockResolvedValue(undefined);
      this.getMailboxLock = jest.fn().mockResolvedValue({ release: jest.fn().mockResolvedValue(undefined) });
      this.mailbox = { uidNext: 501, exists: 500 };
      this.fetch = fetchMock;
      this.fetchOne = jest.fn().mockResolvedValue({ source: Buffer.from('raw source') });
      return this;
    }),
  };
});

const { emailGatewayService, computeDedupKey } = require('../services/emailGateway.service');
const { simpleParser } = require('mailparser');
const { ImapFlow } = require('imapflow');

const fixedDate = new Date('2026-11-05T10:00:00.000Z');
const parsedMessage = {
  from: { value: [{ address: 'user@example.com', name: 'Legit Requester' }] },
  to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
  subject: 'Re: disk failure',
  text: 'reply body',
  html: null,
  inReplyTo: '<TCKT-0001@it.example.com>',
  date: fixedDate,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
    id: 'gateway-1', enabled: true, inboundProvider: 'imap', imapMailbox: 'INBOX',
    defaultTicketType: 'incident', createdAt: new Date(), updatedAt: new Date(),
  });
  mockPrisma.emailMessage.findMany.mockResolvedValue([]);
  mockPrisma.emailMessage.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1', ticketId: null });
  mockPrisma.emailMessage.update.mockResolvedValue({ id: 'msg-1' });
  mockPrisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-internal', displayId: 'TCKT-0001', requesterId: 'user-requester' });
  mockPrisma.$queryRaw.mockResolvedValue([{ id: 'user-requester', email: 'user@example.com', isActive: true }]);
  simpleParser.mockResolvedValue(parsedMessage);

  const fetchMock = new ImapFlow().fetch as jest.Mock;
  fetchMock.mockImplementation(async function* () {
    yield { uid: 401, envelope: { messageId: '<msg-401@example.com>', from: [{ address: 'user@example.com' }] } };
  });
});

describe('computeDedupKey', () => {
  it('is deterministic and Message-ID driven when a Message-ID exists', () => {
    const a = computeDedupKey({ messageId: '<abc@example.com>', fromEmail: 'x@y', subject: 's', receivedAt: fixedDate });
    const b = computeDedupKey({ messageId: '  <abc@example.com> ', fromEmail: 'other@z', subject: 't', receivedAt: new Date() });
    expect(a).toBe(b);
    expect(a).toMatch(/^m:[0-9a-f]{64}$/);
  });

  it('synthesizes a stable fallback hash when the Message-ID is absent', () => {
    const a = computeDedupKey({ messageId: null, fromEmail: 'User@Example.com', subject: ' Disk  failure ', receivedAt: fixedDate });
    const b = computeDedupKey({ messageId: null, fromEmail: 'user@example.com', subject: 'disk  failure', receivedAt: fixedDate });
    expect(a).toBe(b);
    expect(a).toMatch(/^f:[0-9a-f]{64}$/);
    // A different receivedAt yields a different fallback key.
    expect(computeDedupKey({ messageId: null, fromEmail: 'user@example.com', subject: 'disk failure', receivedAt: new Date(fixedDate.getTime() + 1000) })).not.toBe(a);
  });
});

describe('bounded polling + durable dedup', () => {
  it('fetches only the newest UID window instead of the whole mailbox', async () => {
    const fetchMock = new ImapFlow().fetch as jest.Mock;
    await emailGatewayService.pollInbound('email-gateway');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [range] = fetchMock.mock.calls[0];
    // uidNext=501 with MAX_MESSAGES_PER_POLL=100 -> [401:*, uid:true]
    expect(range).toBe('401:*');
    expect(range).not.toBe('1:*');
  });

  it('skips a durable row that is already processed (in-memory window removed)', async () => {
    const processedKey = computeDedupKey({ messageId: '<msg-401@example.com>', fromEmail: 'user@example.com', subject: 'ignored', receivedAt: fixedDate });
    mockPrisma.emailMessage.findMany.mockResolvedValue([
      { id: 'existing', dedupKey: processedKey, messageId: '<msg-401@example.com>', status: 'processed', ticketId: 'ticket-1' },
    ]);

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
    expect(ticketCreate).not.toHaveBeenCalled();
    // The dedup query must be a candidate-key batch query, never a `take` scan.
    const query = mockPrisma.emailMessage.findMany.mock.calls[0][0];
    expect(query.where.dedupKey.in).toContain(processedKey);
    expect(query.take).toBeUndefined();
  });

  it('does not convert twice when the persisted row already has a ticket', async () => {
    mockPrisma.emailMessage.create.mockResolvedValue({ id: 'msg-1', dedupKey: 'f:x', ticketId: 'ticket-existing', status: 'received' });

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(mockPrisma.emailMessage.updateMany).not.toHaveBeenCalled();
  });

  it('loses the atomic claim race and skips instead of creating a duplicate ticket', async () => {
    mockPrisma.emailMessage.updateMany.mockResolvedValue({ count: 0 });

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(ticketCreate).not.toHaveBeenCalled();
  });

  it('persists with a dedupKey and falls back to the durable row on a duplicate insert', async () => {
    mockPrisma.emailMessage.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    mockPrisma.emailMessage.findUnique.mockResolvedValue({ id: 'msg-existing', dedupKey: 'f:x', ticketId: 'ticket-existing' });

    const result = await emailGatewayService.pollInbound('email-gateway');

    const createPayload = mockPrisma.emailMessage.create.mock.calls[0][0].data;
    expect(createPayload.dedupKey).toMatch(/^(m|f):[0-9a-f]{64}$/);
    expect(mockPrisma.emailMessage.findUnique).toHaveBeenCalledWith({ where: { dedupKey: createPayload.dedupKey } });
    expect(result.skipped).toBe(1);
    expect(ticketCreate).not.toHaveBeenCalled();
  });
});
