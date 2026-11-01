/**
 * Phase 2.1 / D4 bulk operation route tests.
 *
 * Verifies the bulk archive endpoints for tickets, risks, controls and incidents
 * plus the ticket bulk status transition. Services are mocked; aggregation is
 * performed in the routers themselves (no service rewrites).
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const ticketRows = new Map<string, { id: string; displayId: string; type: string; status: string; isArchived: boolean }>();

const mockPrisma = {
  ticket: {
    findUnique: jest.fn(async ({ where }: any) => ticketRows.get(where.id) ?? null),
    findMany: jest.fn(async ({ where }: any) => where?.id?.in
      ? where.id.in.map((id: string) => ticketRows.get(id)).filter(Boolean)
      : Array.from(ticketRows.values())),
    update: jest.fn(async ({ where, data }: any) => {
      const row = ticketRows.get(where.id);
      if (!row) throw new Error('missing ticket');
      Object.assign(row, data);
      return row;
    }),
  },
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

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

jest.mock('../middleware/idempotency', () => ({
  idempotency: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
}));

jest.mock('../middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'AppError';
    }
  },
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    requireForEntity: jest.fn(async (_userId: string, _permission: string, _entityType: string, entityId: string) => {
      if (entityId === 'forbidden-risk') {
        const error: any = new Error('permission denied');
        error.statusCode = 403;
        throw error;
      }
    }),
    require: jest.fn(async () => undefined),
    buildReadFilter: jest.fn(async () => ({})),
    buildControlImplementationReadFilter: jest.fn(async () => ({})),
  },
}));

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEventStandalone: jest.fn(async () => undefined),
  },
}));

jest.mock('../services/ticket.service', () => ({
  ticketService: {
    changeStatus: jest.fn(async (id: string, status: string) => {
      const row = ticketRows.get(id);
      if (row) row.status = status;
      return { id, status };
    }),
    list: jest.fn(async () => ({ data: [], pagination: { total: 0 } })),
    listTypes: jest.fn(async () => []),
    getById: jest.fn(async (id: string) => ticketRows.get(id)),
    workload: jest.fn(async () => ({})),
    listCatalog: jest.fn(async () => []),
  },
}));

jest.mock('../services/risk.service', () => ({
  riskService: {
    delete: jest.fn(async (id: string) => {
      if (id === 'forbidden-risk') {
        const error: any = new Error('permission denied');
        error.statusCode = 403;
        throw error;
      }
      if (id === 'archived-risk') {
        const error: any = new Error('Risk already archived');
        error.statusCode = 409;
        throw error;
      }
      return { id };
    }),
    list: jest.fn(async () => ({ data: [], pagination: { total: 0 } })),
    getById: jest.fn(async () => ({})),
  },
  riskAggregationService: {},
}));

jest.mock('../services/control.service', () => ({
  controlService: {
    delete: jest.fn(async (id: string) => {
      if (id === 'archived-control') {
        const error: any = new Error('Control already archived');
        error.statusCode = 409;
        throw error;
      }
      return { id };
    }),
    list: jest.fn(async () => ({ data: [], pagination: { total: 0 } })),
  },
}));

jest.mock('../services/incident.service', () => ({
  incidentService: {
    delete: jest.fn(async (id: string) => {
      if (id === 'archived-incident') {
        const error: any = new Error('Incident already archived');
        error.statusCode = 409;
        throw error;
      }
      return { id };
    }),
    list: jest.fn(async () => ({ data: [], pagination: { total: 0 } })),
  },
}));

import { ticketRouter } from '../routes/ticket.routes';
import { riskRouter } from '../routes/risk.routes';
import { controlRouter } from '../routes/control.routes';
import { incidentRouter } from '../routes/incident.routes';

const app = express();
app.use(express.json());
app.use('/tickets', ticketRouter);
app.use('/risks', riskRouter);
app.use('/controls', controlRouter);
app.use('/incidents', incidentRouter);

const UUID_A = '550e8400-e29b-41d4-a716-446655440001';
const UUID_B = '550e8400-e29b-41d4-a716-446655440002';
const UUID_C = '550e8400-e29b-41d4-a716-446655440003';

beforeEach(() => {
  ticketRows.clear();
  ticketRows.set(UUID_A, { id: UUID_A, displayId: 'TCKT-0001', type: 'service_request', status: 'new', isArchived: false });
  ticketRows.set(UUID_B, { id: UUID_B, displayId: 'TCKT-0002', type: 'service_request', status: 'in_progress', isArchived: false });
  ticketRows.set(UUID_C, { id: UUID_C, displayId: 'TCKT-0003', type: 'incident', status: 'resolved', isArchived: true });
});

describe('Phase 2.1 bulk archive routes', () => {
  it('POST /tickets/bulk-archive returns BulkOperationResult counts', async () => {
    const response = await request(app)
      .post('/tickets/bulk-archive')
      .send({ ids: [UUID_A, UUID_B] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.succeededCount).toBe(2);
    expect(response.body.failedCount).toBe(0);
    expect(response.body.succeeded).toEqual([
      { id: UUID_A, status: 200 },
      { id: UUID_B, status: 200 },
    ]);
    expect(response.body.failed).toEqual([]);
  });

  it('POST /tickets/bulk-archive keeps partial failures per id and does not abort', async () => {
    const response = await request(app)
      .post('/tickets/bulk-archive')
      .send({ ids: [UUID_A, UUID_C, UUID_B] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.succeededCount).toBe(2);
    expect(response.body.failedCount).toBe(1);
    expect(response.body.failed).toEqual([
      expect.objectContaining({ id: UUID_C, status: 404 }),
    ]);
    expect(response.body.succeeded.map((entry: any) => entry.id)).toEqual([UUID_A, UUID_B]);
  });

  it('POST /risks/bulk-archive aggregates per-item results', async () => {
    const response = await request(app)
      .post('/risks/bulk-archive')
      .send({ ids: [UUID_A, 'forbidden-risk', UUID_B] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.succeededCount).toBe(2);
    expect(response.body.failedCount).toBe(1);
    expect(response.body.failed[0]).toEqual(expect.objectContaining({ id: 'forbidden-risk', status: 403 }));
  });

  it('POST /controls/bulk-archive aggregates per-item results', async () => {
    const response = await request(app)
      .post('/controls/bulk-archive')
      .send({ ids: [UUID_A, 'archived-control', UUID_B] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.succeededCount).toBe(2);
    expect(response.body.failedCount).toBe(1);
    expect(response.body.failed[0]).toEqual(expect.objectContaining({ id: 'archived-control', status: 409 }));
  });

  it('POST /incidents/bulk-archive aggregates per-item results', async () => {
    const response = await request(app)
      .post('/incidents/bulk-archive')
      .send({ ids: [UUID_A, 'archived-incident'] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.succeededCount).toBe(1);
    expect(response.body.failedCount).toBe(1);
    expect(response.body.failed[0]).toEqual(expect.objectContaining({ id: 'archived-incident', status: 409 }));
  });

  it('rejects an empty ids array with 400 (schema min(1))', async () => {
    const response = await request(app)
      .post('/tickets/bulk-archive')
      .send({ ids: [] });

    expect(response.status).toBe(400);
  });
});

describe('Phase 2.1 bulk ticket transition', () => {
  it('POST /tickets/bulk-transition rejects invalid combinations with 400', async () => {
    // UUID_C is a resolved incident; in the shared matrix resolved -> new is the
    // only row, so in_progress cannot be a valid target for the combination.
    const response = await request(app)
      .post('/tickets/bulk-transition')
      .send({ ids: [UUID_C], toStatus: 'in_progress' });

    expect(response.status).toBe(400);
    expect(response.body.error ?? response.text).toContain('Bulk transition rejected');
  });

  it('POST /tickets/bulk-transition rejects unknown ids with 400 before any write', async () => {
    const response = await request(app)
      .post('/tickets/bulk-transition')
      .send({ ids: ['550e8400-e29b-41d4-a716-446655440099'], toStatus: 'fulfilled' });

    expect(response.status).toBe(400);
    expect(response.body.error ?? response.text).toContain('Ticket not found');
  });

  it('POST /tickets/bulk-transition aggregates valid transitions', async () => {
    // service_request: new -> fulfilled and in_progress -> fulfilled are both
    // in the shared matrix.
    const response = await request(app)
      .post('/tickets/bulk-transition')
      .send({ ids: [UUID_A, UUID_B], toStatus: 'fulfilled' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.succeededCount).toBe(2);
    expect(response.body.failedCount).toBe(0);
    expect(ticketRows.get(UUID_A)?.status).toBe('fulfilled');
    expect(ticketRows.get(UUID_B)?.status).toBe('fulfilled');
  });
});

describe('Static bulk routes are registered before /:id', () => {
  it('does not resolve /bulk-archive as an id route', async () => {
    const response = await request(app)
      .post('/tickets/bulk-archive')
      .send({ ids: [UUID_A] });

    // The static handler owns the response (200 envelope), so the parametric
    // GET /:id list handler cannot claim the POST.
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('succeededCount');
  });
});
