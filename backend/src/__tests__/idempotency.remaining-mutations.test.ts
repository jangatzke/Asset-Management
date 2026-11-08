/**
 * Idempotency coverage expansion — remaining mutation surfaces.
 *
 * Verifies that the per-route `idempotency()` mounts on the surfaces added in
 * this task behave exactly like the existing D2 core coverage:
 *  - requests without an Idempotency-Key run unchanged;
 *  - a replay with the same key + body returns the cached response without
 *    executing the business operation twice;
 *  - a reused key with a different body returns 409 (never replays);
 *  - concrete path parameters are part of the scope (no cross-entity replay);
 *  - non-JSON successful responses (204) are cached and replayed;
 *  - missing/unauthorized principals are rejected before the handler runs.
 *
 * One representative route per surface group is exercised:
 * contracts, licenses, suppliers (phase6), ticket type change, SLA admin,
 * reminder admin, documents, control implementations, risk treatments.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Business service doubles (only the members touched by the tested routes)
// ---------------------------------------------------------------------------

const mockContractService = {
  create: jest.fn(async (body: any) => ({ id: 'contract-created-1', ...body })),
  update: jest.fn(async (id: string, body: any) => ({ id, ...body })),
  delete: jest.fn(async (id: string) => ({ id, archived: true })),
};

const mockLicenseService = {
  create: jest.fn(async (body: any) => ({ id: 'license-created-1', ...body })),
  update: jest.fn(async (id: string, body: any) => ({ id, ...body })),
  delete: jest.fn(async (id: string) => ({ id, archived: true })),
};

const mockSupplierService = {
  create: jest.fn(async (body: any) => ({ id: 'supplier-created-1', ...body })),
  update: jest.fn(async (id: string, body: any) => ({ id, ...body })),
  archive: jest.fn(async (id: string) => ({ id, archived: true })),
  addContractRelation: jest.fn(async (id: string, contractId: string) => ({ supplierId: id, contractId })),
  removeContractRelation: jest.fn(async (_id: string, _relationId: string) => undefined),
  addRiskRelation: jest.fn(async (id: string, riskId: string) => ({ supplierId: id, riskId })),
  removeRiskRelation: jest.fn(async (_id: string, _relationId: string) => undefined),
  createAssessment: jest.fn(async (supplierId: string, body: any) => ({ id: 'assessment-1', supplierId, ...body })),
  updateAssessment: jest.fn(async (id: string, body: any) => ({ id, ...body })),
};

const mockRiskTreatmentService = {
  create: jest.fn(async (body: any) => ({ id: 'treatment-created-1', ...body })),
  update: jest.fn(async (id: string, body: any) => ({ id, ...body })),
  delete: jest.fn(async (id: string) => ({ id, archived: true })),
};

const mockControlService = {
  createImplementation: jest.fn(async (body: any) => ({ id: 'implementation-1', ...body })),
  createControlTest: jest.fn(async (body: any) => ({ id: 'control-test-1', ...body })),
};

const mockDocumentControlService = {
  create: jest.fn(async (body: any) => ({ id: 'document-1', ...body })),
  updateVersion: jest.fn(async (versionId: string, body: any) => ({ id: versionId, ...body })),
  transition: jest.fn(async (id: string, status: string) => ({ id, status })),
};

const mockTicketService = {
  changeType: jest.fn(async (id: string, type: string) => ({ id, type })),
};

const mockSlaService = {
  getConfig: jest.fn(async () => ({ enabled: true })),
  updateConfig: jest.fn(async (body: any) => ({ ...body })),
  testSmtp: jest.fn(async () => ({ sent: true })),
  scanBreach: jest.fn(async () => ({ escalated: 0 })),
  listLogs: jest.fn(async () => []),
};

const mockReminderService = {
  getConfig: jest.fn(async () => ({ enabled: true })),
  updateConfig: jest.fn(async (body: any) => ({ ...body })),
  testSmtp: jest.fn(async () => ({ sent: true })),
  runAllDue: jest.fn(async () => ({ processed: 0 })),
  listLogs: jest.fn(async () => []),
};

const mockSchedulerRestart = jest.fn(async () => undefined);
const mockGetSlaScheduler = jest.fn(() => ({ restart: mockSchedulerRestart }));
const mockGetReminderScheduler = jest.fn(() => ({ restart: mockSchedulerRestart }));

const mockEntityHistory = jest.fn(async () => ({ data: [] }));

const mockAuthorizationService = {
  buildReadFilter: jest.fn(async () => ({})),
  requireForEntity: jest.fn(async () => undefined),
};

const mockPrisma = {};

jest.mock('../services/contract.service', () => ({ contractService: mockContractService }));
jest.mock('../services/license.service', () => ({ licenseService: mockLicenseService }));
jest.mock('../services/supplier.service', () => ({ supplierService: mockSupplierService }));
jest.mock('../services/risktreatment.service', () => ({ riskTreatmentService: mockRiskTreatmentService }));
jest.mock('../services/control.service', () => ({ controlService: mockControlService }));
jest.mock('../services/document.service', () => ({ documentControlService: mockDocumentControlService }));
jest.mock('../services/ticket.service', () => ({ ticketService: mockTicketService }));
jest.mock('../services/sla.service', () => ({ slaService: mockSlaService }));
jest.mock('../services/reminder.service', () => ({ reminderService: mockReminderService }));
jest.mock('../services/sla.scheduler', () => ({ getSlaScheduler: mockGetSlaScheduler }));
jest.mock('../services/reminder.scheduler', () => ({ getReminderScheduler: mockGetReminderScheduler }));
jest.mock('../services/entityHistory.service', () => ({ getEntityHistory: mockEntityHistory }));
jest.mock('../services/authorization.service', () => ({ authorizationService: mockAuthorizationService }));
jest.mock('../services/audit.service', () => ({ auditService: {}, AuditService: {} }));
jest.mock('../services/phase6.service', () => ({ phase6Service: {}, PHASE6_MODEL_MAP: {} }));
jest.mock('../services/bcm.service', () => ({ bcmService: {} }));
jest.mock('../services/correctiveaction.service', () => ({ correctiveActionService: {} }));
jest.mock('../services/auditWorkflow.service', () => ({ auditWorkflowService: {} }));
jest.mock('../services/training.service', () => ({ trainingService: {} }));
jest.mock('../services/admin.service', () => ({ adminService: {} }));
jest.mock('../services/emailGateway.service', () => ({ emailGatewayService: {} }));
jest.mock('../services/emailGateway.scheduler', () => ({ getEmailGatewayScheduler: jest.fn(() => undefined) }));
jest.mock('../services/fiscalYear.service', () => ({ fiscalYearService: {} }));
jest.mock('../services/auditIntegrity.service', () => ({ auditIntegrityService: {} }));
jest.mock('../services/databaseBackup.service', () => ({ databaseBackupService: {}, PortableBackupPayload: {} }));
jest.mock('../services/navigationConfig.service', () => ({ navigationConfigService: {} }));
jest.mock('../services/navigationView.service', () => ({ navigationViewService: {} }));
jest.mock('../services/ai.service', () => ({ aiService: {} }));
jest.mock('../services/ai.scheduler', () => ({ getAiAssistantScheduler: jest.fn(() => undefined) }));
jest.mock('../config/database', () => ({
  prisma: mockPrisma,
  getSafeDatabaseConfig: jest.fn(() => ({})),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    authorizeEntityRead: jest.fn(() => pass),
    authorizeEntityWrite: jest.fn(() => pass),
    authorizeEntityDelete: jest.fn(() => pass),
    requirePermission: jest.fn(() => pass),
    requireEntityPermission: jest.fn(() => pass),
    requireMappedReadPermission: jest.fn(() => pass),
    requireMappedWritePermission: jest.fn(() => pass),
    requireAdminAccess: jest.fn(pass),
  };
});

// Keep the suites focused on idempotency: skip Zod body/query validation.
jest.mock('../middleware/validation', () => ({
  validateBody: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateParams: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  validateQuery: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

import { contractRouter } from '../routes/contract.routes';
import { licenseRouter } from '../routes/license.routes';
import { phase6Router } from '../routes/phase6.routes';
import { riskTreatmentRouter } from '../routes/risktreatment.routes';
import { controlRouter } from '../routes/control.routes';
import { documentRouter } from '../routes/document.routes';
import { ticketRouter } from '../routes/ticket.routes';
import { adminRouter } from '../routes/admin.routes';
import {
  idempotency,
  IDEMPOTENCY_KEY_HEADER,
  clearInFlightReservations,
  setRedisClient,
} from '../middleware/idempotency';
import { idempotencyStore, stopIdempotencyCleanup } from '../services/idempotency.service';

const app = express();
app.use(express.json());
app.use('/contracts', contractRouter);
app.use('/licenses', licenseRouter);
app.use('/treatments', riskTreatmentRouter);
app.use('/documents', documentRouter);
app.use('/controls', controlRouter);
app.use('/phase6', phase6Router);
app.use('/tickets', ticketRouter);
app.use('/admin', adminRouter);

const conflictError = (res: any) => res.body?.error?.code;

describe('Idempotency coverage on remaining mutation surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStore.clear();
    clearInFlightReservations();
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  afterEach(() => {
    setRedisClient(null);
    stopIdempotencyCleanup();
  });

  describe('contracts', () => {
    it('replays POST /contracts with the same key and body, without a duplicate write', async () => {
      const key = 'remaining-contract-create-key';
      const body = { title: 'Framework agreement' };

      const first = await request(app).post('/contracts').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/contracts').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(second.body).toEqual(first.body);
      expect(mockContractService.create).toHaveBeenCalledTimes(1);
    });

    it('does not replay across concrete path parameters for PATCH /contracts/:id', async () => {
      const key = 'remaining-contract-patch-key';
      const body = { title: 'Update' };

      const first = await request(app).patch('/contracts/contract-1').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).patch('/contracts/contract-2').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const replay = await request(app).patch('/contracts/contract-1').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBeUndefined();
      expect(replay.headers['x-idempotency-cache']).toBe('hit');
      expect(mockContractService.update).toHaveBeenCalledTimes(2);
    });

    it('returns 409 when the same key is reused with a different body', async () => {
      const key = 'remaining-contract-conflict-key';

      const first = await request(app).post('/contracts').set(IDEMPOTENCY_KEY_HEADER, key).send({ title: 'A' });
      const second = await request(app).post('/contracts').set(IDEMPOTENCY_KEY_HEADER, key).send({ title: 'B' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(conflictError(second)).toBe('IDEMPOTENCY_BODY_MISMATCH');
      expect(mockContractService.create).toHaveBeenCalledTimes(1);
    });

    it('leaves requests without an Idempotency-Key unchanged', async () => {
      const body = { title: 'No key' };

      const first = await request(app).post('/contracts').send(body);
      const second = await request(app).post('/contracts').send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.headers['x-idempotency-cache']).toBeUndefined();
      expect(second.headers['x-idempotency-cache']).toBeUndefined();
      expect(mockContractService.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('licenses', () => {
    it('replays POST /licenses with the same key and body', async () => {
      const key = 'remaining-license-create-key';
      const body = { name: 'Seat licence' };

      const first = await request(app).post('/licenses').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/licenses').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(second.body).toEqual(first.body);
      expect(mockLicenseService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('suppliers (phase6)', () => {
    it('replays POST /suppliers with the same key and body', async () => {
      const key = 'remaining-supplier-create-key';
      const body = { name: 'Critical supplier' };

      const first = await request(app).post('/phase6/suppliers').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/phase6/suppliers').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(201);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockSupplierService.create).toHaveBeenCalledTimes(1);
    });

    it('replays a 204 No Content relation delete without a duplicate removal or 504', async () => {
      const key = 'remaining-supplier-relation-delete-key';

      const first = await request(app)
        .delete('/phase6/suppliers/supplier-1/contracts/relation-1')
        .set(IDEMPOTENCY_KEY_HEADER, key);
      const second = await request(app)
        .delete('/phase6/suppliers/supplier-1/contracts/relation-1')
        .set(IDEMPOTENCY_KEY_HEADER, key);

      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(second.text).toBe('');
      expect(mockSupplierService.removeContractRelation).toHaveBeenCalledTimes(1);
    });
  });

  describe('ticket type change', () => {
    it('replays POST /tickets/:id/type with the same key and body', async () => {
      const key = 'remaining-ticket-type-key';
      const body = { type: 'incident' };

      const first = await request(app).post('/tickets/ticket-1/type').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/tickets/ticket-1/type').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(second.body).toEqual(first.body);
      expect(mockTicketService.changeType).toHaveBeenCalledTimes(1);
    });
  });

  describe('SLA escalation admin writes', () => {
    it('replays POST /admin/sla-escalation/run-now without a second breach scan', async () => {
      const key = 'remaining-sla-run-now-key';

      const first = await request(app).post('/admin/sla-escalation/run-now').set(IDEMPOTENCY_KEY_HEADER, key);
      const second = await request(app).post('/admin/sla-escalation/run-now').set(IDEMPOTENCY_KEY_HEADER, key);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockSlaService.scanBreach).toHaveBeenCalledTimes(1);
    });

    it('replays PUT /admin/sla-escalation/config and restarts the scheduler only once', async () => {
      const key = 'remaining-sla-config-key';
      const body = { enabled: false };

      const first = await request(app).put('/admin/sla-escalation/config').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).put('/admin/sla-escalation/config').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockSlaService.updateConfig).toHaveBeenCalledTimes(1);
      expect(mockSchedulerRestart).toHaveBeenCalledTimes(1);
    });
  });

  describe('reminder automation admin writes', () => {
    it('replays POST /admin/reminders/run-now without a second run', async () => {
      const key = 'remaining-reminders-run-now-key';

      const first = await request(app).post('/admin/reminders/run-now').set(IDEMPOTENCY_KEY_HEADER, key);
      const second = await request(app).post('/admin/reminders/run-now').set(IDEMPOTENCY_KEY_HEADER, key);

      expect(first.status).toBe(200);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockReminderService.runAllDue).toHaveBeenCalledTimes(1);
    });
  });

  describe('documents', () => {
    it('replays POST /documents and POST /documents/:id/transition', async () => {
      const createKey = 'remaining-document-create-key';
      const transitionKey = 'remaining-document-transition-key';

      const created = await request(app).post('/documents').set(IDEMPOTENCY_KEY_HEADER, createKey).send({ title: 'Policy' });
      const createdReplay = await request(app).post('/documents').set(IDEMPOTENCY_KEY_HEADER, createKey).send({ title: 'Policy' });
      expect(created.status).toBe(201);
      expect(createdReplay.headers['x-idempotency-cache']).toBe('hit');
      expect(mockDocumentControlService.create).toHaveBeenCalledTimes(1);

      const transitioned = await request(app)
        .post('/documents/document-1/transition')
        .set(IDEMPOTENCY_KEY_HEADER, transitionKey)
        .send({ status: 'approved' });
      const transitionReplay = await request(app)
        .post('/documents/document-1/transition')
        .set(IDEMPOTENCY_KEY_HEADER, transitionKey)
        .send({ status: 'approved' });
      expect(transitioned.status).toBe(200);
      expect(transitionReplay.headers['x-idempotency-cache']).toBe('hit');
      expect(mockDocumentControlService.transition).toHaveBeenCalledTimes(1);
    });
  });

  describe('control implementation writes', () => {
    it('replays POST /controls/implementations exactly once', async () => {
      const key = 'remaining-control-implementation-key';
      const body = { controlId: 'control-1', status: 'planned' };

      const first = await request(app).post('/controls/implementations').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/controls/implementations').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(201);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockControlService.createImplementation).toHaveBeenCalledTimes(1);
    });
  });

  describe('risk treatment writes', () => {
    it('replays POST /treatments with the same key and body', async () => {
      const key = 'remaining-treatment-create-key';
      const body = { riskId: 'risk-1', action: 'mitigate' };

      const first = await request(app).post('/treatments').set(IDEMPOTENCY_KEY_HEADER, key).send(body);
      const second = await request(app).post('/treatments').set(IDEMPOTENCY_KEY_HEADER, key).send(body);

      expect(first.status).toBe(201);
      expect(second.headers['x-idempotency-cache']).toBe('hit');
      expect(mockRiskTreatmentService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('principal and key validation', () => {
    const anonymousHandler = jest.fn(() => undefined);
    const anonymousApp = express();
    anonymousApp.use(express.json());
    anonymousApp.post('/anonymous-write', idempotency({ includeRouteParams: true }), (_req, res) => {
      anonymousHandler();
      res.status(201).json({ ok: true });
    });

    // Same handler, but behind an authentication step that supplies a principal.
    const authenticatedHandler = jest.fn(() => undefined);
    const authenticatedApp = express();
    authenticatedApp.use(express.json());
    authenticatedApp.post(
      '/authenticated-write',
      (req: any, _res: any, next: any) => {
        req.userId = 'user-123';
        next();
      },
      idempotency({ includeRouteParams: true }),
      (_req, res) => {
        authenticatedHandler();
        res.status(201).json({ ok: true });
      },
    );

    it('rejects anonymous replays with 401 MISSING_PRINCIPAL and never runs the handler', async () => {
      const first = await request(anonymousApp)
        .post('/anonymous-write')
        .set(IDEMPOTENCY_KEY_HEADER, 'anonymous-key');
      const second = await request(anonymousApp)
        .post('/anonymous-write')
        .set(IDEMPOTENCY_KEY_HEADER, 'anonymous-key');

      expect(first.status).toBe(401);
      expect(first.body.error.code).toBe('MISSING_PRINCIPAL');
      expect(second.status).toBe(401);
      expect(second.body.error.code).toBe('MISSING_PRINCIPAL');
      expect(anonymousHandler).not.toHaveBeenCalled();
    });

    it('rejects malformed Idempotency-Key values with 400 INVALID_IDEMPOTENCY_KEY', async () => {
      const response = await request(authenticatedApp)
        .post('/authenticated-write')
        .set(IDEMPOTENCY_KEY_HEADER, 'bad key!');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
      expect(authenticatedHandler).not.toHaveBeenCalled();
    });
  });
});
