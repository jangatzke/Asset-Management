/**
 * Item 5: integration coverage for inbound e-mail dedup / persistence.
 *
 * The Prisma client is mocked but stateful (an in-memory EmailMessage table) so
 * multiple polls run against the same durable rows. This exercises:
 *  - dedup across two polls (processed row is skipped on the second poll)
 *  - re-processing a `failed` row (claimable again -> exactly one ticket)
 *  - Message-ID absent fallback key (`f:` arm) used for persistence
 *  - ticket creation with an unmapped sender (requesterId: null)
 *  - no duplicate ticket on a lost claim / concurrent-worker race
 *  - `process rows skipped` and the `m:`/`f:` dedupKey arms
 *
 * No live database required.
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

interface Row {
  id: string;
  dedupKey: string;
  messageId?: string | null;
  fromEmail?: string;
  subject?: string;
  status: string;
  ticketId?: string | null;
  userId?: string | null;
  error?: string | null;
}

let rows: Row[] = [];
let seq = 0;

function seedTables() {
  rows = [];
  seq = 0;

  // Stateful EmailMessage table.
  mockPrisma.emailMessage.findMany.mockImplementation(async (args: any) => {
    const keys = args?.where?.dedupKey?.in;
    if (!Array.isArray(keys)) return [];
    return rows.filter((row) => keys.includes(row.dedupKey)).map((row) => ({ ...row }));
  });
  mockPrisma.emailMessage.create.mockImplementation(async (args: any) => {
    const data = args.data;
    if (rows.some((row) => row.dedupKey === data.dedupKey)) {
      throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
    }
    seq += 1;
    const row: Row = {
      id: `msg-${seq}`,
      dedupKey: data.dedupKey,
      messageId: data.messageId ?? null,
      fromEmail: data.fromEmail,
      subject: data.subject,
      status: data.status ?? 'received',
      ticketId: data.ticketId ?? null,
      userId: null,
    };
    rows.push(row);
    return { ...row };
  });
  mockPrisma.emailMessage.update.mockImplementation(async (args: any) => {
    const row = rows.find((r) => r.id === args.where.id);
    if (!row) return null;
    // Only keys explicitly present in `data` mutate the durable row, so a
    // content update (persist-then-process) cannot accidentally reopen a
    // processed message or clear its ticket link.
    const data = args.data ?? {};
    for (const key of ['fromEmail', 'subject', 'status', 'ticketId', 'userId', 'error'] as const) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        (row as any)[key] = data[key];
      }
    }
    return { ...row };
  });
  mockPrisma.emailMessage.updateMany.mockImplementation(async (args: any) => {
    const where = args.where ?? {};
    let count = 0;
    for (const row of rows) {
      const statusMatches = where.status?.in
        ? where.status.in.includes(row.status)
        : where.status ? row.status === where.status : true;
      if (row.id === where.id && statusMatches && row.ticketId === where.ticketId) {
        Object.assign(row, args.data ?? {});
        count += 1;
      }
    }
    return { count };
  });
  mockPrisma.emailMessage.findUnique.mockImplementation(async (args: any) => {
    const key = args?.where?.dedupKey;
    const row = rows.find((r) => r.dedupKey === key);
    return row ? { ...row } : null;
  });
}

function fetchEnvelope(uid: number, envelope: Record<string, any>) {
  const fetchMock = new ImapFlow().fetch as jest.Mock;
  fetchMock.mockImplementation(async function* () {
    yield { uid, envelope };
  });
}

function parsedMessage(messageId: string | null, subject = 'Re: disk failure', date = fixedDate) {
  return {
    from: { value: [{ address: 'user@example.com', name: 'Legit Requester' }] },
    to: [{ value: [{ address: 'no-reply@it.example.com' }] }],
    subject,
    text: 'reply body',
    html: null,
    inReplyTo: null,
    // mailparser's parsed header carries the Message-ID; absent means fallback key.
    messageId: messageId ?? undefined,
    date,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  seedTables();
  rows = [];
  seq = 0;

  mockPrisma.emailGatewayConfig.findFirst.mockResolvedValue({
    id: 'gateway-1',
    enabled: true,
    inboundProvider: 'imap',
    imapMailbox: 'INBOX',
    defaultTicketType: 'incident',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockPrisma.emailGatewayConfig.update.mockResolvedValue({ id: 'gateway-1' });
  mockPrisma.ticket.findUnique.mockResolvedValue(null);
  mockPrisma.$queryRaw.mockResolvedValue([{ id: 'user-requester', email: 'user@example.com', isActive: true }]);
  ticketCreate.mockResolvedValue({ id: 'ticket-1', displayId: 'TCKT-0001' });
  ticketComment.mockResolvedValue({});
  simpleParser.mockResolvedValue(parsedMessage('<msg-401@example.com>'));
  fetchEnvelope(401, { messageId: '<msg-401@example.com>', from: [{ address: 'user@example.com' }] });
});

describe('EmailGateway inbound dedup / persistence (mock-Prisma integration)', () => {
  it('does not create a second ticket when the same Message-ID arrives on a second poll', async () => {
    const first = await emailGatewayService.pollInbound('email-gateway');
    expect(first.processed).toBe(1);
    expect(ticketCreate).toHaveBeenCalledTimes(1);

    const stored = rows[0];
    expect(stored.status).toBe('processed');
    expect(stored.dedupKey).toBe(computeDedupKey({ messageId: '<msg-401@example.com>', fromEmail: 'x', subject: 'y', receivedAt: fixedDate }));
    expect(stored.dedupKey).toMatch(/^m:[0-9a-f]{64}$/);

    const second = await emailGatewayService.pollInbound('email-gateway');
    expect(second.processed).toBe(0);
    expect(second.skipped).toBe(1);
    expect(ticketCreate).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it('re-processes a `failed` message exactly once (claimable received|failed rows)', async () => {
    const key = computeDedupKey({ messageId: '<msg-401@example.com>', fromEmail: 'user@example.com', subject: 'Re: disk failure', receivedAt: fixedDate });
    rows = [{
      id: 'msg-1',
      dedupKey: key,
      messageId: '<msg-401@example.com>',
      fromEmail: 'user@example.com',
      subject: 'Re: disk failure',
      status: 'failed',
      ticketId: null,
      error: 'smtp transient',
    }];

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(ticketCreate).toHaveBeenCalledTimes(1);

    const claim = mockPrisma.emailMessage.updateMany.mock.calls[0][0];
    expect(claim.where.status.in).toEqual(['received', 'failed']);
    expect(claim.where.ticketId).toBeNull();
    expect(claim.data.status).toBe('processing');

    const stored = rows[0];
    expect(stored.status).toBe('processed');
    expect(stored.ticketId).toBe('ticket-1');
    expect(stored.error ?? null).toBeNull();
  });

  it('uses the synthesized `f:` fallback key when the Message-ID is absent', async () => {
    simpleParser.mockResolvedValue(parsedMessage(null));
    fetchEnvelope(402, { messageId: null, from: [{ address: 'user@example.com' }], date: fixedDate });

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.processed).toBe(1);
    const createPayload = mockPrisma.emailMessage.create.mock.calls[0][0].data;
    expect(createPayload.messageId).toBeNull();
    expect(createPayload.dedupKey).toMatch(/^f:[0-9a-f]{64}$/);
    expect(createPayload.dedupKey).toBe(computeDedupKey({
      messageId: null,
      fromEmail: 'user@example.com',
      subject: 'Re: disk failure',
      receivedAt: fixedDate,
    }));
  });

  it('creates a ticket with requesterId null when the sender is not mapped to a user', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.processed).toBe(1);
    expect(ticketCreate).toHaveBeenCalledTimes(1);
    const [ticketPayload, actorArg] = ticketCreate.mock.calls[0];
    expect(ticketPayload.requesterId).toBeNull();
    expect(ticketPayload.title).toBe('Re: disk failure');
    expect(actorArg).toBe('email-gateway');
    expect(rows[0].userId ?? null).toBeNull();
  });

  it('skips (no duplicate ticket) when a concurrent worker already claimed the row', async () => {
    mockPrisma.emailMessage.updateMany.mockResolvedValue({ count: 0 });

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
    expect(ticketCreate).not.toHaveBeenCalled();
    // The dedup lookup remains a candidate-key batch query (never a `take` scan).
    const query = mockPrisma.emailMessage.findMany.mock.calls[0][0];
    expect(query.where.dedupKey.in).toBeDefined();
    expect(query.take).toBeUndefined();
  });

  it('skips rows already `processed` without touching them', async () => {
    const key = computeDedupKey({ messageId: '<msg-401@example.com>', fromEmail: 'user@example.com', subject: 'Re: disk failure', receivedAt: fixedDate });
    rows = [{
      id: 'msg-processed',
      dedupKey: key,
      messageId: '<msg-401@example.com>',
      status: 'processed',
      ticketId: 'ticket-existing',
    }];

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(mockPrisma.emailMessage.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.emailMessage.update).not.toHaveBeenCalled();
  });

  it('does not double-convert a persisted row that already has a ticket (retry guard)', async () => {
    // The row is `received` (claimable status) but already linked to a ticket:
    // guard 1 must skip it before the claim runs.
    const key = computeDedupKey({ messageId: '<msg-401@example.com>', fromEmail: 'user@example.com', subject: 'Re: disk failure', receivedAt: fixedDate });
    rows = [{
      id: 'msg-linked',
      dedupKey: key,
      messageId: '<msg-401@example.com>',
      status: 'received',
      ticketId: 'ticket-existing',
    }];

    const result = await emailGatewayService.pollInbound('email-gateway');

    expect(result.skipped).toBe(1);
    expect(ticketCreate).not.toHaveBeenCalled();
  });
});
