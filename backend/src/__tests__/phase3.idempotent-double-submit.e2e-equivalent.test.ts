/**
 * Phase 3.4 — Backend equivalent for the browser double-submit E2E.
 *
 * The browser spec (`frontend/e2e/phase3.regressions.spec.ts`) observes the
 * frontend axios interceptor at `frontend/src/services/api.ts:540`: the 401
 * refresh path re-sends the SAME config object, so the `Idempotency-Key`
 * survives the retry. This test proves the backend half of that contract
 * deterministically, without a browser:
 *
 *  - A 401-expired logical create is retried with the SAME key → the replay
 *    returns the FIRST response (X-Idempotency-Cache: hit) and the business
 *    operation runs exactly once, so the record count does not grow.
 *  - A genuine rapid second submit with a DIFFERENT key is NOT deduplicated
 *    (the middleware is key-scoped), which documents why the frontend must
 *    reuse the key rather than regenerate it.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockTicketService = {
  create: jest.fn(async (body: any, userId: string) => ({
    id: `ticket-created-${mockTicketService.create.mock.calls.length}`,
    displayId: 'TKT-E2E-001',
    ...body,
    requesterId: userId,
  })),
  workload: jest.fn(async () => ({})),
};

jest.mock('../services/ticket.service', () => ({ ticketService: mockTicketService }));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireEntityPermission: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
  requireAdminAccess: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../middleware/validation', () => ({
  validateBody: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateParams: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateQuery: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../config/database', () => ({ prisma: {} }));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    buildReadFilter: jest.fn(async () => ({})),
    requireForEntity: jest.fn(async () => undefined),
  },
}));

import { ticketRouter } from '../routes/ticket.routes';
import {
  clearInFlightReservations,
  setRedisClient,
  IDEMPOTENCY_KEY_HEADER,
} from '../middleware/idempotency';
import { idempotencyStore, stopIdempotencyCleanup } from '../services/idempotency.service';

const app = express();
app.use(express.json());
app.use('/tickets', ticketRouter);

const createBody = {
  type: 'service_request',
  title: 'E2E idempotent double submit',
  description: 'Same logical create submitted twice.',
  urgency: 'medium',
  impact: 'medium',
  requesterId: 'user-123',
};

describe('Phase 3.4 — idempotent double-submit (backend equivalent of the browser E2E)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketService.create.mockClear();
    idempotencyStore.clear();
    clearInFlightReservations();
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  afterEach(() => {
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  it('replays the first response for a retried create that reuses the key and never grows the record set', async () => {
    const key = 'phase-3-4-browser-retry-key';

    const first = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, key)
      .send(createBody);
    expect(first.status).toBe(201);
    expect(first.headers['x-idempotency-cache']).toBeUndefined();
    expect(mockTicketService.create).toHaveBeenCalledTimes(1);

    // The axios refresh interceptor re-sends the SAME config object, which
    // already carries the key — the second call is the same logical operation.
    const retried = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, key)
      .send(createBody);

    expect(retried.status).toBe(201);
    expect(retried.headers['x-idempotency-cache']).toBe('hit');
    expect(retried.body).toEqual(first.body);
    expect(retried.body.id).toBe(first.body.id);
    // Business operation executed once → no duplicate durable record.
    expect(mockTicketService.create).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate a second submit that generates a NEW key (documents why the frontend must reuse the key)', async () => {
    const retryKey = 'phase-3-4-logical-operation-key';
    const newKey = 'phase-3-4-regenerated-key';

    const first = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, retryKey)
      .send(createBody);
    const second = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, newKey)
      .send(createBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['x-idempotency-cache']).toBeUndefined();
    // Different keys are isolated namespaces → the service runs twice.
    expect(mockTicketService.create).toHaveBeenCalledTimes(2);
    expect(second.body.id).not.toBe(first.body.id);
  });

  it('returns 409 for a reused key with a different body (never silently replays the wrong payload)', async () => {
    const key = 'phase-3-4-body-mismatch-key';

    const first = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, key)
      .send(createBody);
    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post('/tickets')
      .set(IDEMPOTENCY_KEY_HEADER, key)
      .send({ ...createBody, title: 'A different title' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
    expect(mockTicketService.create).toHaveBeenCalledTimes(1);
  });
});
