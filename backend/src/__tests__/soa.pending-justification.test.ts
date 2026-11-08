/**
 * Phase 3.3 – SoA pending-justification audit report.
 *
 * Proves:
 *  - The report flags empty rationales, the generated placeholder
 *    (`ISO27001_SOA_PENDING_JUSTIFICATION`) and applicability decisions still
 *    under review, derived from existing SoAItem fields only.
 *  - Empty/missing data yields `{ totalPending: 0, entries: [] }` without throwing.
 *  - GET /controls/soa/pending-justifications returns the report structurally
 *    (not 500) and sets neither `X-Total-Count` nor an idempotency header.
 */
import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const findManyMock = jest.fn();

jest.mock('../config/database', () => {
  const prisma: any = {
    soAItem: { findMany: (...args: any[]) => findManyMock(...args) },
  };
  return { prisma };
});

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'soa-report-user';
    next();
  },
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityRead: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityWrite: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityDelete: () => (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  requireEntityPermission: () => (_req: any, _res: any, next: any) => next(),
  // The router also registers POST /controls/:id/restore (improvement roadmap #5),
  // which needs requireAdminAccess to be a middleware in this module-level mock.
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn() },
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    requireForEntity: jest.fn(async () => undefined),
    buildReadFilter: jest.fn(),
    buildControlImplementationReadFilter: jest.fn(),
  },
}));

jest.mock('../services/catalog.service', () => ({ catalogService: {} }));

import { controlService } from '../services/control.service';
import { controlRouter } from '../routes/control.routes';

const PLACEHOLDER = 'Scope-specific applicability decision pending; assess the associated risk and document the rationale before submitting this SoA.';

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  soaId: 'soa-1',
  requirementId: null,
  controlId: 'ctrl-1',
  applicability: 'applicable',
  justification: 'Required by the risk assessment',
  implementationStatus: 'planned',
  version: 1,
  control: { id: 'ctrl-1', title: 'A.5.1 Policies for information security', catalogId: 'A.5.1' },
  soa: { id: 'soa-1', version: 1, approvalStatus: 'draft', scopeId: 'scope-1' },
  ...overrides,
});

beforeEach(() => {
  findManyMock.mockReset().mockResolvedValue([]);
});

describe('ControlService.buildPendingJustificationReport', () => {
  it('returns an empty structure for missing data without throwing', async () => {
    findManyMock.mockResolvedValue([]);
    const report = await controlService.buildPendingJustificationReport();
    expect(report).toEqual(
      expect.objectContaining({ totalPending: 0, entries: [] }),
    );
    expect(typeof report.generatedAt).toBe('string');
  });

  it('flags empty, placeholder and under-review items from a real fixture', async () => {
    findManyMock.mockResolvedValue([
      buildItem({ id: 'item-empty', justification: '   ' }),
      buildItem({ id: 'item-placeholder', applicability: 'under_review', justification: PLACEHOLDER }),
      buildItem({ id: 'item-review', applicability: 'under_review', justification: 'Scope rationale still being drafted' }),
      buildItem({ id: 'item-ok' }),
    ]);

    const report = await controlService.buildPendingJustificationReport();

    expect(report.totalPending).toBe(3);
    expect(report.entries.map((entry) => entry.soaItemId)).toEqual(['item-empty', 'item-placeholder', 'item-review']);
    expect(report.entries.every((entry) => typeof entry.reason === 'string')).toBe(true);
    expect(report.entries.every((entry) => entry.controlId !== undefined && entry.controlTitle !== undefined)).toBe(true);

    const byId = new Map(report.entries.map((entry) => [entry.soaItemId, entry]));
    expect(byId.get('item-empty')?.reason).toBe('empty_justification');
    expect(byId.get('item-placeholder')?.reason).toBe('placeholder_pending_justification');
    expect(byId.get('item-review')?.reason).toBe('pending_applicability_decision');
    expect(byId.get('item-placeholder')?.controlTitle).toBe('A.5.1 Policies for information security');
  });
});

describe('GET /controls/soa/pending-justifications route', () => {
  const app = express();
  app.use(express.json());
  app.use('/controls', controlRouter);

  it('returns the report structurally with HTTP 200', async () => {
    findManyMock.mockResolvedValue([buildItem({ id: 'item-empty', justification: '' })]);

    const response = await request(app).get('/controls/soa/pending-justifications');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        totalPending: 1,
        entries: expect.any(Array),
      }),
    );
    expect(response.body.entries[0]).toEqual(
      expect.objectContaining({
        soaItemId: 'item-empty',
        reason: expect.any(String),
        controlId: expect.anything(),
      }),
    );
  });

  it('returns an empty report instead of an error when no data exists', async () => {
    findManyMock.mockResolvedValue([]);
    const response = await request(app).get('/controls/soa/pending-justifications');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ totalPending: 0, entries: [] }));
  });

  it('does not set X-Total-Count (report, not a paginated list)', async () => {
    const response = await request(app).get('/controls/soa/pending-justifications');
    expect(response.headers['x-total-count']).toBeUndefined();
  });
});
