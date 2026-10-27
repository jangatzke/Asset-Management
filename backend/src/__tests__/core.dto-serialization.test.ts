/**
 * Tests for Core-Service DTO Serialization (Subtask 3 / ISSUE-7)
 *
 * Proves that:
 * (a) credential-like fields (passwordHash, mfa*, apiTokenHash, clientSecret,
 *     connectorSecret, ...) never appear in service responses — including
 *     nested includes (user-like relations embedded in asset/ticket payloads);
 * (b) frontend-relevant fields (createdBy, updatedBy, ids, relational
 *     structures) survive serialization;
 * (c) paginated envelopes from Subtask 1 keep their shape
 *     (`{ data, pagination: { page, limit, total, totalPages } }`).
 *
 * The mocked services wrap their fixtures with the REAL serialization helpers
 * from ../utils/dto — exactly as the now-serialized core services do — so the
 * full pipeline (service serialization -> route res.json) is exercised.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { serializeEntity, serializeEnvelope } from '../utils/dto';

const REDACTED_KEYS = [
  'passwordHash',
  'mfaSecret',
  'mfaPendingSecret',
  'clientSecret',
  'clientSecretRef',
  'encryptedPassword',
  'accessTokenHash',
  'accessTokenSalt',
  'apiTokenHash',
  'connectorSecret',
  'secret',
];

/**
 * The secret-laden user object embedded via includes. Mirrors a raw Prisma
 * User row as it would flow into e.g. ticket `requester`/`assignee` includes
 * or asset owner relations.
 */
const userWithSecrets = {
  id: 'user-1',
  displayId: 'USER-0001',
  email: 'owner@example.com',
  firstName: 'Alice',
  lastName: 'Owner',
  isActive: true,
  passwordHash: '$2b$10$shouldneverleak',
  mfaSecret: 'JBSWY3DPEHPK3PXP',
  apiTokenHash: 'abc123hash',
  clientSecret: 'oauth-secret-value',
  connectorSecret: 'connector-secret-value',
  // Frontend-relevant audit fields must be preserved:
  createdBy: 'admin-1',
  updatedBy: 'admin-2',
};

const assetWithEmbeddedUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  displayId: 'ASSET-0001',
  name: 'Notebook Alice',
  isArchived: false,
  createdBy: 'admin-1',
  updatedBy: 'admin-2',
  assetType: { id: 'type-1', name: 'Hardware', inventoryEnabled: true, inventoryPattern: 'NB####' },
  networkAddresses: [{ id: 'na-1', address: '10.0.0.1', type: 'ipv4', primary: true }],
  processLinks: [{ id: 'pl-1', process: { id: 'proc-1', name: 'Process A' } }],
  // Embedded user-like relations exercise the recursive redaction:
  ownerRelation: userWithSecrets,
  secondaryRelation: [userWithSecrets],
};

const mockAssetService = {
  list: jest.fn(() => Promise.resolve(serializeEnvelope({
    data: [assetWithEmbeddedUser],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }))),
  getById: jest.fn(() => Promise.resolve(serializeEntity(assetWithEmbeddedUser))),
  create: jest.fn(() => Promise.resolve(serializeEntity(assetWithEmbeddedUser))),
  update: jest.fn(() => Promise.resolve(serializeEntity(assetWithEmbeddedUser))),
  getRelations: jest.fn(() => Promise.resolve(serializeEnvelope({
    data: [{ id: 'rel-1', targetAsset: userWithSecrets }],
    sourceRelations: [],
    targetRelations: [{ id: 'rel-1', targetAsset: userWithSecrets }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }))),
};

const mockTicketService = {
  getById: jest.fn(() => Promise.resolve(serializeEntity({
    id: 'ticket-1',
    displayId: 'TICKET-0001',
    title: 'Broken laptop',
    version: 3,
    createdBy: 'user-9',
    updatedBy: 'user-9',
    requester: { ...userWithSecrets, id: 'requester-1' },
    assignee: { ...userWithSecrets, id: 'assignee-1' },
    manager: { ...userWithSecrets, id: 'manager-1' },
    assets: [{ asset: { id: 'asset-1', displayId: 'ASSET-0001', name: 'Notebook' } }],
    comments: [{ id: 'c-1', authorId: 'user-9', authorName: 'User Nine', body: 'hi' }],
    incident: { id: 'inc-1', financialImpact: { toJSON: () => '100' } },
  }))),
  list: jest.fn(() => Promise.resolve(serializeEnvelope({
    data: [{ id: 'ticket-1', requester: userWithSecrets, assets: [] }],
    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  }))),
};

jest.mock('../services/asset.service', () => ({
  assetService: mockAssetService,
}));

jest.mock('../services/ticket.service', () => ({
  ticketService: mockTicketService,
}));

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

jest.mock('../middleware/validation', () => ({
  validateBody: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  validateQuery: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  validateParams: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
}));

jest.mock('../config/database', () => ({
  prisma: {},
}));

jest.mock('../services/authorization.service', () => ({
  authorizationService: {
    buildReadFilter: jest.fn(() => Promise.resolve({})),
    buildControlImplementationReadFilter: jest.fn(() => Promise.resolve(undefined)),
  },
}));

import { assetRouter } from '../routes/asset.routes';
import { ticketRouter } from '../routes/ticket.routes';

const app = express();
app.use(express.json());
app.use('/assets', assetRouter);
app.use('/tickets', ticketRouter);

const ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';

/** Collect every occurrence of a key from a JSON-serialized payload. */
function collectKeys(value: unknown, seen: Set<string>): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, seen);
    return;
  }
  for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
    seen.add(key);
    collectKeys(current, seen);
  }
}

function expectNoSecretKeys(body: unknown): void {
  const seen = new Set<string>();
  collectKeys(body, seen);
  for (const secretKey of REDACTED_KEYS) {
    expect(seen).not.toContain(secretKey);
  }
}

describe('Core-service DTO serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('asset endpoints', () => {
    it('GET /assets/:id omits all credential-like fields, including nested relations', async () => {
      const response = await request(app).get(`/assets/${ASSET_ID}`);
      expect(response.status).toBe(200);

      expectNoSecretKeys(response.body);
      // Raw string leak check (belt and braces for the JSON body):
      expect(response.text).not.toContain('$2b$10$shouldneverleak');
      expect(response.text).not.toContain('JBSWY3DPEHPK3PXP');
      expect(response.text).not.toContain('oauth-secret-value');
      expect(response.text).not.toContain('connector-secret-value');
    });

    it('GET /assets/:id preserves frontend-relevant fields (createdBy, updatedBy, ids, relations)', async () => {
      const response = await request(app).get(`/assets/${ASSET_ID}`);

      expect(response.body.createdBy).toBe('admin-1');
      expect(response.body.updatedBy).toBe('admin-2');
      expect(response.body.id).toBe(ASSET_ID);
      expect(response.body.displayId).toBe('ASSET-0001');
      expect(response.body.assetType.id).toBe('type-1');
      expect(Array.isArray(response.body.networkAddresses)).toBe(true);
      expect(response.body.processLinks[0].process.id).toBe('proc-1');
      // Owner identity context survives, only credentials are gone:
      expect(response.body.ownerRelation.email).toBe('owner@example.com');
      expect(response.body.ownerRelation.createdBy).toBe('admin-1');
    });

    it('GET /assets (list) keeps the paginated envelope intact', async () => {
      const response = await request(app).get('/assets');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(Array.isArray(response.body.data)).toBe(true);
      expectNoSecretKeys(response.body);
    });

    it('POST /assets (create) returns the serialized entity without an envelope', async () => {
      const response = await request(app).post('/assets').send({ name: 'x' });
      expect(response.status).toBe(201);
      // Create-returns are NOT enveloped: plain entity shape
      expect(response.body.displayId).toBe('ASSET-0001');
      expectNoSecretKeys(response.body);
      expect(response.body.createdBy).toBe('admin-1');
    });

    it('GET /assets/:id/relations serializes slices while preserving the envelope', async () => {
      const response = await request(app).get(`/assets/${ASSET_ID}/relations`);
      expect(response.status).toBe(200);
      expect(response.headers['x-total-count']).toBeDefined();
      expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(Array.isArray(response.body.sourceRelations)).toBe(true);
      expect(Array.isArray(response.body.targetRelations)).toBe(true);
      expectNoSecretKeys(response.body);
    });
  });

  describe('ticket endpoints', () => {
    it('GET /tickets/:id redacts credential-like fields from user-like relations', async () => {
      const response = await request(app).get('/tickets/ticket-1');
      expect(response.status).toBe(200);

      expectNoSecretKeys(response.body);
      expect(response.text).not.toContain('$2b$10$shouldneverleak');

      // User identity context survives (select-scoped + serialized):
      expect(response.body.requester.email).toBe('owner@example.com');
      expect(response.body.requester.id).toBe('requester-1');
      expect(response.body.assignee.isActive).toBe(true);
      expect(response.body.manager.displayId).toBe('USER-0001');
    });

    it('GET /tickets/:id preserves createdBy/updatedBy and relational structures', async () => {
      const response = await request(app).get('/tickets/ticket-1');

      expect(response.body.createdBy).toBe('user-9');
      expect(response.body.updatedBy).toBe('user-9');
      expect(response.body.assets[0].asset.displayId).toBe('ASSET-0001');
      expect(response.body.comments[0].authorName).toBe('User Nine');
      // Prisma Decimal keeps its JSON contract:
      expect(response.body.incident.financialImpact).toBe('100');
    });

    it('GET /tickets (list) keeps the paginated envelope', async () => {
      const response = await request(app).get('/tickets');
      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
      expectNoSecretKeys(response.body);
    });
  });

  describe('serializeEntity unit contract', () => {
    it('passes Date and Decimal-like values through untouched', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const decimalLike = { toJSON: () => '42.5' };
      const result = serializeEntity({ createdAt: now, score: decimalLike });
      expect(result.createdAt).toBe(now);
      expect(result.score).toBe(decimalLike);
    });

    it('returns null input as null (Prisma findUnique contract)', () => {
      expect(serializeEntity(null)).toBeNull();
    });
  });
});
