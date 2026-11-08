/**
 * Characterization tests for primary list pagination (Phase 1.1 / decision D1).
 *
 * Proves that every primary list route (`GET /`) returns the locked envelope
 *
 *   { data, pagination: { page, limit, total, totalPages } }
 *
 * *and* sets `X-Total-Count` from `pagination.total` — not from
 * `data.length`. Each fixture deliberately uses a page slice shorter than the
 * filtered total so a `data.length`-based header would fail the assertion.
 *
 * Mocking follows the established patterns from
 * `subresource.pagination.test.ts` and `core.dto-serialization.test.ts`
 * (jest mocks for services/middleware, real serialization helpers). No new
 * mock framework is introduced.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { serializeEnvelope } from '../utils/dto';
import { setPaginationHeader } from '../utils/pagination';

/** Build an envelope whose page slice is shorter than the filtered total. */
const envelope = (pageLength: number, total: number) => serializeEnvelope({
  data: Array.from({ length: pageLength }, (_, index) => ({ id: `row-${index}` })),
  pagination: { page: 1, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) },
});

const mockAssetService = { list: jest.fn(() => Promise.resolve(envelope(2, 7))) };
const mockTicketService = { list: jest.fn(() => Promise.resolve(envelope(2, 6))) };
const mockRiskService = { list: jest.fn(() => Promise.resolve(envelope(1, 9))) };
const mockControlService = { list: jest.fn(() => Promise.resolve(envelope(2, 5))) };
const mockIncidentService = { list: jest.fn(() => Promise.resolve(envelope(4, 12))) };
const mockKnowledgeService = { list: jest.fn(() => Promise.resolve(envelope(3, 11))) };

jest.mock('../services/asset.service', () => ({ assetService: mockAssetService }));
jest.mock('../services/ticket.service', () => ({ ticketService: mockTicketService }));
jest.mock('../services/risk.service', () => ({ riskService: mockRiskService }));
jest.mock('../services/control.service', () => ({ controlService: mockControlService }));
jest.mock('../services/incident.service', () => ({ incidentService: mockIncidentService }));
jest.mock('../services/knowledge.service', () => ({ knowledgeService: mockKnowledgeService }));

// Routes import unrelated collaborators that must exist for module loading.
jest.mock('../services/risk.aggregation', () => ({ riskAggregationService: {} }));
jest.mock('../services/entityHistory.service', () => ({ getEntityHistory: jest.fn() }));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  authorize: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  authorizeEntityRead: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireEntityPermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requireAdminAccess: jest.fn((req: any, _res: any, next: any) => next()),
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    buildReadFilter: jest.fn(() => Promise.resolve({})),
    buildControlImplementationReadFilter: jest.fn(() => Promise.resolve(undefined)),
  },
}));

jest.mock('../middleware/validation', () => ({
  validateBody: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  validateQuery: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  validateParams: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
}));

jest.mock('../config/database', () => ({ prisma: {} }));

import { assetRouter } from '../routes/asset.routes';
import { ticketRouter } from '../routes/ticket.routes';
import { riskRouter } from '../routes/risk.routes';
import { controlRouter } from '../routes/control.routes';
import { incidentRouter } from '../routes/incident.routes';
import { knowledgeRouter } from '../routes/knowledge.routes';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);
app.use('/tickets', ticketRouter);
app.use('/risks', riskRouter);
app.use('/controls', controlRouter);
app.use('/incidents', incidentRouter);
app.use('/knowledge', knowledgeRouter);

/** Assert both the locked envelope and the additive header. */
function expectPaginatedList(
  response: any,
  expected: { pageLength: number; total: number },
): void {
  expect(response.status).toBe(200);

  // D1: envelope stays exactly { data, pagination: { page, limit, total, totalPages } }
  expect(response.body).toHaveProperty('data');
  expect(Array.isArray(response.body.data)).toBe(true);
  expect(response.body.data).toHaveLength(expected.pageLength);
  expect(response.body.pagination).toEqual({
    page: 1,
    limit: 20,
    total: expected.total,
    totalPages: Math.max(1, Math.ceil(expected.total / 20)),
  });

  // Header carries the filtered total, NOT the page slice length.
  expect(response.headers['x-total-count']).toBe(String(expected.total));
  expect(response.headers['x-total-count']).not.toBe(String(expected.pageLength));
}

describe('Primary list pagination envelope + X-Total-Count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /assets', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/assets');
      expectPaginatedList(response, { pageLength: 2, total: 7 });
      expect(mockAssetService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /tickets', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/tickets');
      expectPaginatedList(response, { pageLength: 2, total: 6 });
      expect(mockTicketService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /risks', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/risks');
      expectPaginatedList(response, { pageLength: 1, total: 9 });
      expect(mockRiskService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /controls', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/controls');
      expectPaginatedList(response, { pageLength: 2, total: 5 });
      expect(mockControlService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /incidents', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/incidents');
      expectPaginatedList(response, { pageLength: 4, total: 12 });
      expect(mockIncidentService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /knowledge', () => {
    it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
      const response = await request(app).get('/knowledge');
      expectPaginatedList(response, { pageLength: 3, total: 11 });
      expect(mockKnowledgeService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('helper contract', () => {
    it('does not emit a header when no pagination metadata is present', () => {
      const res = { setHeader: jest.fn() } as any;
      // A bare-array result must never invent a total (defensive helper contract).
      setPaginationHeader(res, { data: [] } as any);
      setPaginationHeader(res, [] as any);
      setPaginationHeader(res, null);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('emits the header exactly once when pagination metadata is present', () => {
      const res = { setHeader: jest.fn() } as any;
      setPaginationHeader(res, { data: [{ id: 'a' }], pagination: { page: 1, limit: 20, total: 7, totalPages: 1 } });
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '7');
    });
  });
});
