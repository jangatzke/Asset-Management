/**
 * Route-level authorization integration tests for scoped write paths.
 *
 * Scope of this suite (docs/authorization-gap-analysis.md §11.7):
 * - Supertest against a real Express app that mounts the real routers plus the
 *   REAL `authenticate`, `entityAuth` and `AuthorizationService` middleware.
 *   Only the entity service modules behind the routes are replaced so handler
 *   responses are deterministic without a database.
 * - Negative paths: missing permission (unauthorized role), wrong scope
 *   (cross-entity access), missing entity authorization and API scopes.
 * - Positive control paths: the same routes return 2xx when the caller holds
 *   the permission inside the authorized scope.
 * - Characterization tests document two known runtime gaps without altering
 *   behavior: entity write middleware does not consult `user.isActive`, and a
 *   category wildcard (`assets:*`) does not satisfy an exact API scope.
 *
 * Coverage: asset create/update/delete + relations, ticket create/update/
 * transition, risk create/update/delete, control create/update/delete + SoA
 * item + implementation, and the ISMS policy-document write routes.
 *
 * IMPORTANT: the tests intentionally do NOT mock `../middleware/auth`,
 * `../middleware/entityAuth`, `../middleware/validation`,
 * `../middleware/idempotency`, `../middleware/errorHandler` or
 * `../services/authorization.service`. Those are the components under test.
 */
import { jest } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

// Handler-level collaboration modules (NOT authorization middleware).
const mockAssetService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createRelation: jest.fn(),
  list: jest.fn(),
};
const mockAssetGraphService = { getGraph: jest.fn(), impactAnalysis: jest.fn() };
const mockTicketService = {
  create: jest.fn(),
  update: jest.fn(),
  changeStatus: jest.fn(),
  list: jest.fn(),
};
const mockAuditService = { logEventStandalone: jest.fn(), logEvent: jest.fn() };
const mockRiskService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
};
const mockRiskAggregationService = { aggregate: jest.fn() };
const mockControlService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateSOAItem: jest.fn(),
  createImplementation: jest.fn(),
};
const mockDocumentService = {
  create: jest.fn(),
  updateVersion: jest.fn(),
  transition: jest.fn(),
  listDocuments: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/asset.service', () => ({ assetService: mockAssetService }));
jest.mock('../services/asset.graph', () => ({ assetGraphService: mockAssetGraphService }));
jest.mock('../services/ticket.service', () => ({ ticketService: mockTicketService }));
jest.mock('../services/audit.service', () => ({ auditService: mockAuditService }));
jest.mock('../services/risk.service', () => ({ riskService: mockRiskService }));
jest.mock('../services/risk.aggregation', () => ({ riskAggregationService: mockRiskAggregationService }));
jest.mock('../services/entityHistory.service', () => ({ getEntityHistory: jest.fn() }));
jest.mock('../services/control.service', () => ({ controlService: mockControlService }));
jest.mock('../services/document.service', () => ({ documentControlService: mockDocumentService }));

import { assetRouter } from '../routes/asset.routes';
import { ticketRouter } from '../routes/ticket.routes';
import { riskRouter } from '../routes/risk.routes';
import { controlRouter } from '../routes/control.routes';
import { documentRouter } from '../routes/document.routes';
import { errorHandler } from '../middleware/errorHandler';
import { requireScopes, SCOPE_HEADER } from '../middleware/apiScopes';

// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
const JWT_SECRET = process.env.JWT_SECRET!;

// Invalid-but-valid UUIDs (version 4 / variant 8) accepted by EntityIdSchema.
const ASSET_UUID = '11111111-1111-4111-8111-111111111111';
const TARGET_ASSET_UUID = '22222222-2222-4222-8222-222222222222';
const ASSET_TYPE_UUID = '33333333-3333-4333-8333-333333333333';
const TICKET_UUID = '44444444-4444-4444-8444-444444444444';
const RISK_UUID = '55555555-5555-4555-8555-555555555555';
const CONTROL_UUID = '66666666-6666-4666-8666-666666666666';
const IMPLEMENTATION_UUID = '77777777-7777-4777-8777-777777777777';
const OU_A_UUID = '88888888-8888-4888-8888-888888888888';
const OU_B_UUID = '99999999-9999-4999-8999-999999999999';
const SOA_ITEM_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOCUMENT_VERSION_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const USER_ID = 'user-1';
const LE_A = 'legal-entity-a';
const LE_B = 'legal-entity-b';
const OU_A = 'ou-a';
const OU_B = 'ou-b';

function tokenFor(userId: string = USER_ID): string {
  // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
  return jwt.sign({ userId, roles: [], typ: 'Bearer' }, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Builds the `userRole` rows consumed by AuthorizationService.getUserRoles().
 * Scope fields are assignment-level constraints; a role without any scope
 * field is unrestricted.
 */
function roleRow(
  permissions: string[],
  scope: {
    legalEntityId?: string | null;
    organizationUnitId?: string | null;
    scopeId?: string | null;
    siteId?: string | null;
  } = {},
  options: { roleName?: string; validFrom?: Date | null; validUntil?: Date | null; userId?: string } = {},
) {
  return {
    userId: options.userId ?? USER_ID,
    roleName: options.roleName ?? 'scoped-writer',
    legalEntityId: scope.legalEntityId ?? null,
    organizationUnitId: scope.organizationUnitId ?? null,
    scopeId: scope.scopeId ?? null,
    siteId: scope.siteId ?? null,
    validFrom: options.validFrom ?? null,
    validUntil: options.validUntil ?? null,
    role: {
      rolePermissions: permissions.map((name) => ({ permission: { name } })),
    },
  };
}

function grantRoles(...rows: ReturnType<typeof roleRow>[]) {
  mockPrisma.userRole.findMany.mockResolvedValue(rows as any);
}

/** Asset row shape returned by resolveEntityScope() for entityType 'assets'. */
function assetEntityRow(ouId: string, legalEntityId: string) {
  return {
    id: ASSET_UUID,
    organizationUnitId: ouId,
    locationId: null,
    organizationUnit: { legalEntityId },
    location: null,
  };
}

function riskEntityRow(ouId: string, legalEntityId: string) {
  return { id: RISK_UUID, organizationUnitId: ouId, organizationUnit: { legalEntityId } };
}

function controlImplementationRow(ouId: string, legalEntityId: string) {
  return {
    id: CONTROL_UUID,
    organizationUnitId: ouId,
    siteId: null,
    scopeId: null,
    organizationUnit: { legalEntityId },
    site: null,
  };
}

function ticketAssetRow(ouId: string, legalEntityId: string) {
  return {
    asset: {
      organizationUnitId: ouId,
      locationId: null,
      organizationUnit: { legalEntityId },
      location: null,
    },
  };
}

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/assets', assetRouter);
  app.use('/api/v1/tickets', ticketRouter);
  app.use('/api/v1/risks', riskRouter);
  app.use('/api/v1/controls', controlRouter);
  app.use('/api/v1/documents', documentRouter);
  app.use(errorHandler);
  return app;
}

/**
 * Mounts only the real `requireScopes` middleware. Scope data is populated by a
 * harness middleware that mirrors what service-account/user auth would set.
 */
function buildScopeHarness(): Application {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const raw = req.headers[SCOPE_HEADER.toLowerCase()];
    req.userScopes = typeof raw === 'string' ? raw.split(',').map((value: string) => value.trim()).filter(Boolean) : [];
    next();
  });
  app.post('/scoped', requireScopes('assets:write'), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

const VALID_ASSET_CREATE = { name: 'Scoped asset', assetTypeId: ASSET_TYPE_UUID };
const VALID_ASSET_UPDATE = { description: 'Updated description' };
const VALID_ASSET_RELATION = { targetAssetId: TARGET_ASSET_UUID, relationshipType: 'depends_on' };
const VALID_TICKET_CREATE = { type: 'service_request', title: 'Scoped request' };
const VALID_TICKET_UPDATE = { title: 'Updated title' };
const VALID_TICKET_STATUS = { status: 'in_progress' };
const VALID_RISK_CREATE = {
  title: 'Scoped risk',
  description: 'Risk description',
  possibleImpact: 'Impact',
  likelihood: 3,
  impact: 3,
  assessorId: USER_ID,
  riskOwnerId: USER_ID,
  nextReviewDate: '2026-12-01',
  justification: 'Justification',
};
const VALID_RISK_UPDATE = { title: 'Updated risk' };
const VALID_CONTROL_CREATE = {
  catalogId: 'iso27001',
  catalogVersion: '2022',
  title: 'Scoped control',
  description: 'Control description',
  controlGoal: 'Control goal',
};
const VALID_CONTROL_UPDATE = { title: 'Updated control' };
const VALID_SOA_PATCH = { applicability: 'applicable' };
const VALID_IMPLEMENTATION_CREATE = {
  controlId: CONTROL_UUID,
  organizationUnitId: OU_A_UUID,
  responsibleUserId: USER_ID,
};
const VALID_DOCUMENT_CREATE = {
  title: 'Policy',
  documentType: 'policy',
  ownerId: USER_ID,
  content: 'Policy content',
};
const VALID_DOCUMENT_VERSION_PATCH = { content: 'Updated content' };

describe('scoped write authorization (route middleware, real auth)', () => {
  const app = buildApp();
  const scopeApp = buildScopeHarness();

  beforeEach(() => {
    // Role resolution defaults: no grants, no groups, no ISMS membership rows.
    mockPrisma.userRole.findMany.mockResolvedValue([]);
    mockPrisma.userGroup.findMany.mockResolvedValue([]);
    mockPrisma.ismsScopeLegalEntity.findMany.mockResolvedValue([]);

    // Entity scope defaults: entity missing until a test provides a row.
    mockPrisma.asset.findUnique.mockResolvedValue(null);
    mockPrisma.risk.findUnique.mockResolvedValue(null);
    mockPrisma.controlImplementation.findUnique.mockResolvedValue(null);
    mockPrisma.control.findUnique.mockResolvedValue(null);
    mockPrisma.ticketAsset.findFirst.mockResolvedValue(null);

    // Handler defaults (positive-path responses).
    mockAssetService.create.mockResolvedValue({ id: ASSET_UUID });
    mockAssetService.update.mockResolvedValue({ id: ASSET_UUID });
    mockAssetService.delete.mockResolvedValue({ id: ASSET_UUID, isArchived: true });
    mockAssetService.createRelation.mockResolvedValue({ id: 'relation-1' });
    mockTicketService.create.mockResolvedValue({ id: TICKET_UUID });
    mockTicketService.update.mockResolvedValue({ id: TICKET_UUID });
    mockTicketService.changeStatus.mockResolvedValue({ id: TICKET_UUID, status: 'in_progress' });
    mockRiskService.create.mockResolvedValue({ id: RISK_UUID });
    mockRiskService.update.mockResolvedValue({ id: RISK_UUID });
    mockRiskService.delete.mockResolvedValue({ id: RISK_UUID, isArchived: true });
    mockControlService.create.mockResolvedValue({ id: CONTROL_UUID });
    mockControlService.update.mockResolvedValue({ id: CONTROL_UUID });
    mockControlService.delete.mockResolvedValue({ id: CONTROL_UUID });
    mockControlService.updateSOAItem.mockResolvedValue({ id: SOA_ITEM_UUID });
    mockControlService.createImplementation.mockResolvedValue({ id: IMPLEMENTATION_UUID });
    mockDocumentService.create.mockResolvedValue({ id: 'document-1' });
    mockDocumentService.updateVersion.mockResolvedValue({ id: DOCUMENT_VERSION_UUID });
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('rejects a write request without a bearer token (401)', async () => {
      const response = await request(app).post('/api/v1/assets').send(VALID_ASSET_CREATE);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(mockAssetService.create).not.toHaveBeenCalled();
    });

    it('rejects a pre_auth token (401)', async () => {
      const preAuthToken = jwt.sign({ userId: USER_ID, roles: [], typ: 'pre_auth' }, JWT_SECRET, { expiresIn: '1h' });
      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${preAuthToken}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Authentication pending approval');
    });
  });

  // ---------------------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------------------
  describe('asset write routes', () => {
    it('denies asset create when assets.write is not granted (403)', async () => {
      grantRoles(roleRow(['assets.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(mockAssetService.create).not.toHaveBeenCalled();
    });

    it('creates an asset when assets.write is granted (201)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: ASSET_UUID });
      expect(mockAssetService.create).toHaveBeenCalledTimes(1);
    });

    it('denies asset update when the asset is outside the role scope (403)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_B, LE_B));

      const response = await request(app)
        .put(`/api/v1/assets/${ASSET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_UPDATE);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('assets.write');
      expect(mockAssetService.update).not.toHaveBeenCalled();
    });

    it('updates an asset inside the role scope (200)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_A, LE_A));

      const response = await request(app)
        .put(`/api/v1/assets/${ASSET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_UPDATE);

      expect(response.status).toBe(200);
      expect(mockAssetService.update).toHaveBeenCalledWith(ASSET_UUID, expect.any(Object), USER_ID);
    });

    it('denies asset delete when the asset is outside the role scope (403)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_B, LE_B));

      const response = await request(app)
        .delete(`/api/v1/assets/${ASSET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(403);
      expect(mockAssetService.delete).not.toHaveBeenCalled();
    });

    it('archives an asset inside the role scope (200)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_A, LE_A));

      const response = await request(app)
        .delete(`/api/v1/assets/${ASSET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(200);
      expect(mockAssetService.delete).toHaveBeenCalledWith(ASSET_UUID, USER_ID);
    });

    it('denies relation creation when the source asset is outside the role scope (403)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_B, LE_B));

      const response = await request(app)
        .post(`/api/v1/assets/${ASSET_UUID}/relations`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_RELATION);

      expect(response.status).toBe(403);
      expect(mockAssetService.createRelation).not.toHaveBeenCalled();
    });

    it('creates a relation when the source asset is inside the role scope (201)', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(assetEntityRow(OU_A, LE_A));

      const response = await request(app)
        .post(`/api/v1/assets/${ASSET_UUID}/relations`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_RELATION);

      expect(response.status).toBe(201);
      expect(mockAssetService.createRelation).toHaveBeenCalledTimes(1);
    });

    it('maps a missing asset on authorizeEntity routes to 500 (characterization)', async () => {
      // authorizeEntity() converts non-403 AppErrors (here the 404 "Asset not
      // found" from resolveEntityScope) into "Authorization check failed"/500.
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/v1/assets/${ASSET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_UPDATE);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Authorization check failed');
      expect(mockAssetService.update).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing asset on requireEntityPermission routes', async () => {
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/assets/${ASSET_UUID}/relations`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_RELATION);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Asset not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Tickets
  // ---------------------------------------------------------------------------
  describe('ticket write routes', () => {
    it('denies ticket create when tickets.write is not granted (403)', async () => {
      grantRoles(roleRow(['tickets.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_CREATE);

      expect(response.status).toBe(403);
      expect(mockTicketService.create).not.toHaveBeenCalled();
    });

    it('creates a ticket when tickets.write is granted (201)', async () => {
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_CREATE);

      expect(response.status).toBe(201);
      expect(mockTicketService.create).toHaveBeenCalledTimes(1);
    });

    it('denies ticket update when the linked asset is outside the role scope (403)', async () => {
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));
      mockPrisma.ticketAsset.findFirst.mockResolvedValue(ticketAssetRow(OU_B, LE_B));

      const response = await request(app)
        .put(`/api/v1/tickets/${TICKET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_UPDATE);

      expect(response.status).toBe(403);
      expect(mockTicketService.update).not.toHaveBeenCalled();
    });

    it('updates a ticket when the linked asset is inside the role scope (200)', async () => {
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));
      mockPrisma.ticketAsset.findFirst.mockResolvedValue(ticketAssetRow(OU_A, LE_A));

      const response = await request(app)
        .put(`/api/v1/tickets/${TICKET_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_UPDATE);

      expect(response.status).toBe(200);
      expect(mockTicketService.update).toHaveBeenCalledWith(TICKET_UUID, expect.any(Object), USER_ID);
    });

    it('fails closed for a ticket without a linked asset when the role is scoped (403)', async () => {
      // resolveEntityScope('tickets') returns an empty scope when no ticketAsset
      // row exists, so a scope-constrained role cannot match.
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));
      mockPrisma.ticketAsset.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/tickets/${TICKET_UUID}/status`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_STATUS);

      expect(response.status).toBe(403);
      expect(mockTicketService.changeStatus).not.toHaveBeenCalled();
    });

    it('denies ticket transition when the linked asset is outside the role scope (403)', async () => {
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));
      mockPrisma.ticketAsset.findFirst.mockResolvedValue(ticketAssetRow(OU_B, LE_B));

      const response = await request(app)
        .post(`/api/v1/tickets/${TICKET_UUID}/status`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_STATUS);

      expect(response.status).toBe(403);
      expect(mockTicketService.changeStatus).not.toHaveBeenCalled();
    });

    it('transitions a ticket inside the role scope (200)', async () => {
      grantRoles(roleRow(['tickets.write'], { organizationUnitId: OU_A }));
      mockPrisma.ticketAsset.findFirst.mockResolvedValue(ticketAssetRow(OU_A, LE_A));

      const response = await request(app)
        .post(`/api/v1/tickets/${TICKET_UUID}/status`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_TICKET_STATUS);

      expect(response.status).toBe(200);
      expect(mockTicketService.changeStatus).toHaveBeenCalledWith(TICKET_UUID, 'in_progress', undefined, USER_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // Risks
  // ---------------------------------------------------------------------------
  describe('risk write routes', () => {
    it('denies risk create when risks.write is not granted (403)', async () => {
      grantRoles(roleRow(['risks.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_RISK_CREATE);

      expect(response.status).toBe(403);
      expect(mockRiskService.create).not.toHaveBeenCalled();
    });

    it('creates a risk when risks.write is granted (201)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_RISK_CREATE);

      expect(response.status).toBe(201);
      expect(mockRiskService.create).toHaveBeenCalledTimes(1);
    });

    it('denies risk update when the risk is outside the role scope (403)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));
      mockPrisma.risk.findUnique.mockResolvedValue(riskEntityRow(OU_B, LE_B));

      const response = await request(app)
        .put(`/api/v1/risks/${RISK_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_RISK_UPDATE);

      expect(response.status).toBe(403);
      expect(mockRiskService.update).not.toHaveBeenCalled();
    });

    it('updates a risk inside the role scope (200)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));
      mockPrisma.risk.findUnique.mockResolvedValue(riskEntityRow(OU_A, LE_A));

      const response = await request(app)
        .put(`/api/v1/risks/${RISK_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_RISK_UPDATE);

      expect(response.status).toBe(200);
      expect(mockRiskService.update).toHaveBeenCalledWith(RISK_UUID, expect.any(Object), USER_ID);
    });

    it('denies risk delete when the risk is outside the role scope (403)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));
      mockPrisma.risk.findUnique.mockResolvedValue(riskEntityRow(OU_B, LE_B));

      const response = await request(app)
        .delete(`/api/v1/risks/${RISK_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(403);
      expect(mockRiskService.delete).not.toHaveBeenCalled();
    });

    it('deletes a risk inside the role scope (200)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));
      mockPrisma.risk.findUnique.mockResolvedValue(riskEntityRow(OU_A, LE_A));

      const response = await request(app)
        .delete(`/api/v1/risks/${RISK_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(200);
      expect(mockRiskService.delete).toHaveBeenCalledWith(RISK_UUID, USER_ID);
    });

    it('maps a missing risk on authorizeEntityDelete to 500 (characterization)', async () => {
      grantRoles(roleRow(['risks.write'], { organizationUnitId: OU_A }));
      mockPrisma.risk.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/risks/${RISK_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Authorization check failed');
      expect(mockRiskService.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  describe('control write routes', () => {
    it('denies control create when controls.write is not granted (403)', async () => {
      grantRoles(roleRow(['controls.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/controls')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_CONTROL_CREATE);

      expect(response.status).toBe(403);
      expect(mockControlService.create).not.toHaveBeenCalled();
    });

    it('creates a control when controls.write is granted (201)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/controls')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_CONTROL_CREATE);

      expect(response.status).toBe(201);
      expect(mockControlService.create).toHaveBeenCalledTimes(1);
    });

    it('denies control update when the implementation is outside the role scope (403)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(controlImplementationRow(OU_B, LE_B));

      const response = await request(app)
        .put(`/api/v1/controls/${CONTROL_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_CONTROL_UPDATE);

      expect(response.status).toBe(403);
      expect(mockControlService.update).not.toHaveBeenCalled();
    });

    it('updates a control when the implementation is inside the role scope (200)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(controlImplementationRow(OU_A, LE_A));

      const response = await request(app)
        .put(`/api/v1/controls/${CONTROL_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_CONTROL_UPDATE);

      expect(response.status).toBe(200);
      expect(mockControlService.update).toHaveBeenCalledWith(CONTROL_UUID, expect.any(Object), USER_ID);
    });

    it('fails closed for a catalog-only control when the role is scoped (403)', async () => {
      // Controls without a ControlImplementation resolve to an empty scope.
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(null);
      mockPrisma.control.findUnique.mockResolvedValue({ id: CONTROL_UUID });

      const response = await request(app)
        .put(`/api/v1/controls/${CONTROL_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_CONTROL_UPDATE);

      expect(response.status).toBe(403);
      expect(mockControlService.update).not.toHaveBeenCalled();
    });

    it('denies control delete when the implementation is outside the role scope (403)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(controlImplementationRow(OU_B, LE_B));

      const response = await request(app)
        .delete(`/api/v1/controls/${CONTROL_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(403);
      expect(mockControlService.delete).not.toHaveBeenCalled();
    });

    it('deletes a control when the implementation is inside the role scope (200)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(controlImplementationRow(OU_A, LE_A));

      const response = await request(app)
        .delete(`/api/v1/controls/${CONTROL_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`);

      expect(response.status).toBe(200);
      expect(mockControlService.delete).toHaveBeenCalledWith(CONTROL_UUID);
    });

    it('denies the SoA item patch without controls.write (403)', async () => {
      grantRoles(roleRow(['controls.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .patch(`/api/v1/controls/soa/items/${SOA_ITEM_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_SOA_PATCH);

      expect(response.status).toBe(403);
      expect(mockControlService.updateSOAItem).not.toHaveBeenCalled();
    });

    it('updates a SoA item when controls.write is granted (200)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .patch(`/api/v1/controls/soa/items/${SOA_ITEM_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_SOA_PATCH);

      expect(response.status).toBe(200);
      expect(mockControlService.updateSOAItem).toHaveBeenCalledWith(SOA_ITEM_UUID, expect.any(Object), USER_ID);
    });

    it('denies control implementation creation without controls.write (403)', async () => {
      grantRoles(roleRow(['controls.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/controls/implementations')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_IMPLEMENTATION_CREATE);

      expect(response.status).toBe(403);
      expect(mockControlService.createImplementation).not.toHaveBeenCalled();
    });

    it('creates a control implementation when controls.write is granted (201)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/controls/implementations')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_IMPLEMENTATION_CREATE);

      expect(response.status).toBe(201);
      expect(mockControlService.createImplementation).toHaveBeenCalledWith(expect.any(Object), USER_ID);
    });
  });

  // ---------------------------------------------------------------------------
  // ISMS documents (representative ISMS write surface)
  // ---------------------------------------------------------------------------
  describe('ISMS document write routes', () => {
    it('denies document create without controls.write (403)', async () => {
      // document.routes maps authorizeEntityWrite('controls') onto controls.write.
      grantRoles(roleRow(['controls.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_DOCUMENT_CREATE);

      expect(response.status).toBe(403);
      expect(mockDocumentService.create).not.toHaveBeenCalled();
    });

    it('creates a document when controls.write is granted (201)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_DOCUMENT_CREATE);

      expect(response.status).toBe(201);
      expect(mockDocumentService.create).toHaveBeenCalledWith(expect.any(Object), USER_ID);
    });

    it('denies document version update without controls.write (403)', async () => {
      grantRoles(roleRow(['controls.read'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .patch(`/api/v1/documents/versions/${DOCUMENT_VERSION_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_DOCUMENT_VERSION_PATCH);

      expect(response.status).toBe(403);
      expect(mockDocumentService.updateVersion).not.toHaveBeenCalled();
    });

    it('updates a document version when controls.write is granted (200)', async () => {
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));

      const response = await request(app)
        .patch(`/api/v1/documents/versions/${DOCUMENT_VERSION_UUID}`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_DOCUMENT_VERSION_PATCH);

      expect(response.status).toBe(200);
      expect(mockDocumentService.updateVersion).toHaveBeenCalledWith(
        DOCUMENT_VERSION_UUID,
        expect.any(Object),
        USER_ID,
      );
    });

    it('maps a document transition with unknown id to 500 (characterization)', async () => {
      // authorizeEntityWrite('controls') reads :id, resolves it as a control
      // implementation/control and — because documents do not exist in those
      // tables — raises 404, which the middleware maps to 500.
      grantRoles(roleRow(['controls.write'], { organizationUnitId: OU_A }));
      mockPrisma.controlImplementation.findUnique.mockResolvedValue(null);
      mockPrisma.control.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/v1/documents/${TICKET_UUID}/transition`)
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send({ status: 'review' });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Authorization check failed');
      expect(mockDocumentService.transition).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Identity edge cases
  // ---------------------------------------------------------------------------
  describe('identity edge cases', () => {
    it('denies an authenticated user without any role assignments (403)', async () => {
      grantRoles();

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${tokenFor('unknown-user')}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(403);
      expect(mockAssetService.create).not.toHaveBeenCalled();
    });

    it('treats an expired role assignment as ineffective (403)', async () => {
      grantRoles(
        roleRow(
          ['assets.write'],
          { organizationUnitId: OU_A },
          { validFrom: new Date('2020-01-01T00:00:00Z'), validUntil: new Date('2020-02-01T00:00:00Z') },
        ),
      );

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(403);
      expect(mockAssetService.create).not.toHaveBeenCalled();
    });

    it('documents that entity write middleware ignores user.isActive (gap characterization)', async () => {
      // KNOWN GAP (reported, not fixed here): AuthorizationService and the
      // entity write middleware never read `user.isActive`; only authorize()
      // enforces it. An inactive user with an active role assignment therefore
      // passes this route. The assertion pins the current behavior so a future
      // hardening change is visible.
      grantRoles(roleRow(['assets.write'], { organizationUnitId: OU_A }));
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, isActive: false });

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${tokenFor()}`)
        .send(VALID_ASSET_CREATE);

      expect(response.status).toBe(201);
      expect(mockAssetService.create).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // API scopes
  // ---------------------------------------------------------------------------
  describe('API scope enforcement (requireScopes)', () => {
    it('rejects a request without API scopes (403, raw scope error)', async () => {
      const response = await request(scopeApp).post('/scoped').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient Scopes');
      expect(response.body.missingScopes).toEqual(['assets:write']);
      expect(response.body.grantedScopes).toEqual([]);
    });

    it('accepts the exact required scope (200)', async () => {
      const response = await request(scopeApp)
        .post('/scoped')
        .set(SCOPE_HEADER, 'assets:write')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it('accepts the global wildcard scope (200)', async () => {
      const response = await request(scopeApp)
        .post('/scoped')
        .set(SCOPE_HEADER, '*')
        .send({});

      expect(response.status).toBe(200);
    });

    it('rejects a wrong scope (403)', async () => {
      const response = await request(scopeApp)
        .post('/scoped')
        .set(SCOPE_HEADER, 'assets:read')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient Scopes');
      expect(response.body.grantedScopes).toEqual(['assets:read']);
    });

    it('documents that a category wildcard does not satisfy an exact scope (gap characterization)', async () => {
      // KNOWN LIMITATION: requireScopes() only expands a granted wildcard to the
      // exact required scope (`assets:*` -> `assets:*` vs required
      // `assets:write` never matches). Pinning current behavior.
      const response = await request(scopeApp)
        .post('/scoped')
        .set(SCOPE_HEADER, 'assets:*')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.missingScopes).toEqual(['assets:write']);
    });
  });
});
