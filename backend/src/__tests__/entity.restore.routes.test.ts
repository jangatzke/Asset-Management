/**
 * Improvement #5 — restore endpoints for tickets, risks, controls and incidents.
 *
 * Route-level coverage:
 * - admin guard (403) runs before any service call
 * - IdParamSchema validation (400 for a non-UUID id)
 * - RestoreEntitySchema validation (400 for an oversized reason)
 * - 404 / 409 service outcomes map to the error envelope
 * - `{ success: true }` envelope and reason forwarding (archive audit parity)
 *
 * Services are mocked; the routers and validation middleware are real.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockUserId = 'user-123';

jest.mock('../config/database', () => ({ prisma: {} }));

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = mockUserId;
    next();
  },
}));

jest.mock('../middleware/idempotency', () => ({
  idempotency: jest.fn(() => jest.fn((_req: any, _res: any, next: any) => next())),
}));

jest.mock('../middleware/errorHandler', () => {
  class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = 'AppError';
      this.statusCode = statusCode;
      this.isOperational = true;
    }
  }
  return { AppError };
});

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEvent: jest.fn(async () => undefined),
    logEventStandalone: jest.fn(async () => undefined),
  },
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    require: jest.fn(async () => undefined),
    requireAdminAccess: jest.fn(async () => undefined),
    requireForEntity: jest.fn(async () => undefined),
    requireEntityPermission: jest.fn(async () => undefined),
    buildReadFilter: jest.fn(async () => ({})),
    buildControlImplementationReadFilter: jest.fn(async () => ({})),
  },
}));

jest.mock('../services/ticket.service', () => ({ ticketService: { restore: jest.fn() } }));
jest.mock('../services/risk.service', () => ({ riskService: { restore: jest.fn() } }));
jest.mock('../services/risk.aggregation', () => ({ riskAggregationService: {} }));
jest.mock('../services/control.service', () => ({ controlService: { restore: jest.fn() } }));
jest.mock('../services/incident.service', () => ({ incidentService: { restore: jest.fn() } }));

import { AppError } from '../middleware/errorHandler';
import { authorizationService } from '../services/authorization.service';
import { ticketService } from '../services/ticket.service';
import { riskService } from '../services/risk.service';
import { controlService } from '../services/control.service';
import { incidentService } from '../services/incident.service';
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
app.use((err: any, _req: any, res: any, _next: any) => {
  const statusCode = err?.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    error: { message: err?.message ?? 'Internal Server Error' },
  });
});

const UUID_ARCHIVED = '550e8400-e29b-41d4-a716-446655440011';
const UUID_MISSING = '550e8400-e29b-41d4-a716-446655440012';
const UUID_ACTIVE = '550e8400-e29b-41d4-a716-446655440013';

const modules = [
  {
    name: 'tickets',
    path: '/tickets',
    restore: ticketService.restore as any,
    notFoundMessage: 'Ticket not found',
    alreadyActiveMessage: 'Ticket is not archived',
  },
  {
    name: 'risks',
    path: '/risks',
    restore: riskService.restore as any,
    notFoundMessage: 'Risk not found',
    alreadyActiveMessage: 'Risk is not archived',
  },
  {
    name: 'controls',
    path: '/controls',
    restore: controlService.restore as any,
    notFoundMessage: 'Control not found',
    alreadyActiveMessage: 'Control is not archived',
  },
  {
    name: 'incidents',
    path: '/incidents',
    restore: incidentService.restore as any,
    notFoundMessage: 'Incident not found',
    alreadyActiveMessage: 'Incident is not archived',
  },
];

const mockAdminAccess = authorizationService.requireAdminAccess as any;

beforeEach(() => {
  mockAdminAccess.mockReset();
  mockAdminAccess.mockResolvedValue(undefined);

  for (const module of modules) {
    module.restore.mockReset();
    module.restore.mockImplementation(async (id: string) => {
      if (id === UUID_MISSING) throw new AppError(module.notFoundMessage, 404);
      if (id === UUID_ACTIVE) throw new AppError(module.alreadyActiveMessage, 409);
      return { success: true };
    });
  }
});

describe('restore entity routes', () => {
  it('restores an archived entity and forwards the reason to the service', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/${UUID_ARCHIVED}/restore`)
        .send({ reason: 'Undo bulk archive' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(module.restore).toHaveBeenCalledWith(UUID_ARCHIVED, mockUserId, 'Undo bulk archive');
    }
  });

  it('accepts a request without a reason and forwards undefined', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/${UUID_ARCHIVED}/restore`)
        .send({});

      expect(response.status).toBe(200);
      expect(module.restore).toHaveBeenCalledWith(UUID_ARCHIVED, mockUserId, undefined);
    }
  });

  it('returns 404 when the entity does not exist', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/${UUID_MISSING}/restore`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe(module.notFoundMessage);
    }
  });

  it('returns 409 when the entity is already active (not archived)', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/${UUID_ACTIVE}/restore`)
        .send({});

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe(module.alreadyActiveMessage);
    }
  });

  it('rejects non-admin callers with 403 before any service call', async () => {
    for (const module of modules) {
      mockAdminAccess.mockRejectedValueOnce(new AppError('Admin access required', 403));

      const response = await request(app)
        .post(`${module.path}/${UUID_ARCHIVED}/restore`)
        .send({});

      expect(response.status).toBe(403);
      expect(module.restore).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid ids with 400 (IdParamSchema) before any service call', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/not-a-uuid/restore`)
        .send({});

      expect(response.status).toBe(400);
      expect(module.restore).not.toHaveBeenCalled();
    }
  });

  it('rejects a reason longer than 500 characters with 400 (RestoreEntitySchema)', async () => {
    for (const module of modules) {
      const response = await request(app)
        .post(`${module.path}/${UUID_ARCHIVED}/restore`)
        .send({ reason: 'a'.repeat(501) });

      expect(response.status).toBe(400);
      expect(module.restore).not.toHaveBeenCalled();
    }
  });
});
