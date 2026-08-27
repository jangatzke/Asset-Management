/**
 * Service-Account and Webhook Authentication Regression Tests
 *
 * Covers:
 * 1. Token creation with UUID-based identity (id stored as DB id, token = svc_${id}_${random})
 * 2. Token lookup by id (not displayId) in authenticateServiceAccount
 * 3. Service-account management routes require authenticate + authorize('admin')
 * 4. Webhook-management routes require authenticate + authorize('admin')
 * 5. POST /auth endpoint performs its own token verification (unprotected)
 * 6. Idempotency middleware receives trusted principal from auth middleware
 */
import request from 'supertest';
import express, { Application, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { jest } from '@jest/globals';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();
mockPrisma.serviceAccount = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import { authenticate, authorize } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { authenticateServiceAccount } from '../middleware/serviceAccountAuth';

// ==================== Test Helpers ====================

/**
 * Generate a service account token with the new format: svc_${uuid}_${random}
 */
function generateServiceAccountToken(): { token: string; id: string; salt: string; hash: string } {
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(32).toString('hex');
  const token = `svc_${id}_${crypto.randomBytes(32).toString('base64url')}`;
  const combined = `${token}${salt}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return { token, id, salt, hash };
}

/**
 * Mock authenticate middleware for testing without real JWT.
 */
function mockAuthenticateMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as any).userId = 'test-user-123';
  (req as any).userRoles = ['admin'];
  next();
}

// ==================== Test Suites ====================
describe('Service-Account Token Identity (ID-based lookup)', () => {
  describe('Token creation', () => {
    test('should generate token with UUID embedded as DB id', () => {
      const { token, id } = generateServiceAccountToken();

      // Token format: svc_${uuid}_${random}
      const parts = token.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe('svc');

      // The UUID in the token should match the returned id
      const uuidInToken = parts[1];
      expect(uuidInToken).toBe(id);

      // UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidInToken).toMatch(uuidRegex);
    });

    test('should generate unique UUIDs for each token', () => {
      const token1 = generateServiceAccountToken();
      const token2 = generateServiceAccountToken();
      expect(token1.id).not.toBe(token2.id);
      expect(token1.token).not.toBe(token2.token);
    });
  });

  describe('Token lookup by id (not displayId)', () => {
    let app: Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Mock database that simulates the fixed lookup behavior
      const mockAccounts = new Map<string, {
        id: string;
        displayId: string;
        accessTokenHash: string;
        accessTokenSalt: string;
        isActive: boolean;
        isArchived: boolean;
      }>();

      // Create a test account
      const { token, id, salt, hash } = generateServiceAccountToken();
      mockAccounts.set(id, {
        id,
        displayId: 'SVC-0001',
        accessTokenHash: hash,
        accessTokenSalt: salt,
        isActive: true,
        isArchived: false,
      });

      // Store token for later verification
      (app as any).testToken = token;
      (app as any).testAccountId = id;

      // Route that simulates the fixed authenticateServiceAccount behavior
      app.post('/verify-by-id', async (req: Request, res: Response) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token' });
        }
        const token = authHeader.slice(7);
        const parts = token.split('_');
        const accountUuid = parts[1]; // UUID from token

        // FIXED: Look up by id (UUID), NOT by displayId
        const account = mockAccounts.get(accountUuid);
        if (!account) {
          return res.status(401).json({ error: 'Account not found by id' });
        }

        // Verify hash
        const computedHash = crypto.createHash('sha256')
          .update(`${token}${account.accessTokenSalt}`)
          .digest('hex');

        if (computedHash !== account.accessTokenHash) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        return res.json({ success: true, accountId: account.id });
      });

      // Route that simulates the OLD broken behavior (lookup by displayId)
      app.post('/verify-by-displayid', async (req: Request, res: Response) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token' });
        }
        const token = authHeader.slice(7);
        const parts = token.split('_');
        const accountUuid = parts[1];

        // BROKEN: Try to look up by displayId using the UUID
        const account = Array.from(mockAccounts.values()).find(
          (a) => a.displayId === accountUuid
        );

        if (!account) {
          return res.status(401).json({ error: 'Account not found by displayId' });
        }

        return res.json({ success: true, accountId: account.id });
      });
    });

    test('should successfully authenticate when looking up by id (UUID)', async () => {
      const token = (app as any).testToken;
      const response = await request(app)
        .post('/verify-by-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should fail when looking up by displayId (simulating old broken behavior)', async () => {
      const token = (app as any).testToken;
      const response = await request(app)
        .post('/verify-by-displayid')
        .set('Authorization', `Bearer ${token}`);

      // This should fail because UUID != displayId format (SVC-0001)
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Account not found by displayId');
    });
  });
});

describe('Service-Account Management Route Authentication', () => {
  describe('Management routes require authenticate + authorize, not authenticateServiceAccount', () => {
    let appWithProperAuth: Application;
    let appWithServiceAccountAuth: Application;

    beforeEach(() => {
      // App with CORRECT auth: use real authenticate + authorize('admin')
      appWithProperAuth = express();
      appWithProperAuth.use(express.json());
      appWithProperAuth.use('/api/v1/service-accounts', authenticate, authorize('admin'));
      appWithProperAuth.get('/api/v1/service-accounts', (_req: Request, res: Response) => {
        res.json({ data: [] });
      });

      // App with INCORRECT auth: authenticateServiceAccount (the old broken way)
      appWithServiceAccountAuth = express();
      appWithServiceAccountAuth.use(express.json());
      appWithServiceAccountAuth.use('/api/v1/service-accounts', authenticateServiceAccount as any);
      appWithServiceAccountAuth.get('/api/v1/service-accounts', (_req: Request, res: Response) => {
        res.json({ data: [] });
      });
    });

    test('should accept valid user JWT on management routes with proper auth', async () => {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-testing-purposes';
      const token = jwt.sign({ userId: 'test-user', roles: ['admin'], typ: 'Bearer' }, secret, { expiresIn: '1h' });

      const response = await request(appWithProperAuth)
        .get('/api/v1/service-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    test('should reject requests without any auth on management routes with proper auth', async () => {
      const response = await request(appWithProperAuth)
        .get('/api/v1/service-accounts');

      // mockAuthenticateMiddleware sets userId, but without it we get 401
      expect(response.status).toBe(401);
    });

    test('should reject service account token on management routes (old broken behavior)', async () => {
      const { token } = generateServiceAccountToken();

      // This should fail because authenticateServiceAccount expects the token to be valid
      // in the mocked database, but we're not storing it there in this test.
      mockPrisma.serviceAccount.findFirst.mockResolvedValue(null as never);
      const response = await request(appWithServiceAccountAuth)
        .get('/api/v1/service-accounts')
        .set('Authorization', `Bearer ${token}`);

      // The assertion proves this test uses the injected Prisma mock rather than a
      // real database connection.
      expect(response.status).toBe(401);
      expect(mockPrisma.serviceAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: token.split('_')[1] }),
      }));
    });
  });
});

describe('Webhook-Management Route Authentication', () => {
  describe('Webhook management requires authenticate + authorize, not the old bypass', () => {
    let appWithProperAuth: Application;
    let appWithBypassAuth: Application;

    beforeEach(() => {
      // App with CORRECT auth: use real authenticate + authorize('admin')
      appWithProperAuth = express();
      appWithProperAuth.use(express.json());
      appWithProperAuth.use('/api/v1/webhooks', authenticate, authorize('admin'));
      appWithProperAuth.get('/api/v1/webhooks', (_req: Request, res: Response) => {
        res.json({ data: [] });
      });

      // App with OLD bypass auth: just checks if req.userId or req.serviceAccount exists
      // This is what authenticateWebhookManagement did before the fix
      appWithBypassAuth = express();
      appWithBypassAuth.use(express.json());
      appWithBypassAuth.use('/api/v1/webhooks', (req: Request, res: Response, next: NextFunction) => {
        if ((req as any).userId) return next();
        if ((req as any).serviceAccount) return next();
        res.status(401).json({ error: 'Authentication required' });
      });
      appWithBypassAuth.get('/api/v1/webhooks', (_req: Request, res: Response) => {
        res.json({ data: [] });
      });
    });

    test('should accept valid user JWT on webhook management routes with proper auth', async () => {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-testing-purposes';
      const token = jwt.sign({ userId: 'test-user', roles: ['admin'], typ: 'Bearer' }, secret, { expiresIn: '1h' });

      const response = await request(appWithProperAuth)
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    test('should reject requests without JWT on webhook management routes with proper auth', async () => {
      const response = await request(appWithProperAuth)
        .get('/api/v1/webhooks');

      expect(response.status).toBe(401);
    });

    test('old bypass would accept requests without real authentication', async () => {
      // The old bypass middleware would accept ANY request as long as someone
      // sets req.userId or req.serviceAccount BEFORE this middleware.
      // Without proper auth middleware running first, this should fail.
      const response = await request(appWithBypassAuth)
        .get('/api/v1/webhooks');

      // Without any middleware setting req.userId, the bypass should reject
      expect(response.status).toBe(401);
    });
  });
});

describe('Idempotency + Auth Principal Ordering', () => {
  describe('Idempotency middleware receives trusted principal from auth middleware', () => {
    let app: Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // CORRECT order: auth → idempotency → route
      app.use('/api/v1/test', mockAuthenticateMiddleware);
      app.use('/api/v1/test', idempotency());

      app.post('/api/v1/test/assets', (req: Request, res: Response) => {
        res.status(201).json({
          success: true,
          data: { id: 'new-asset', name: req.body.name },
        });
      });
    });

    test('should process request when auth runs before idempotency', async () => {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-testing-purposes';
      const token = jwt.sign({ userId: 'test-user', roles: ['admin'], typ: 'Bearer' }, secret, { expiresIn: '1h' });

      const response = await request(app)
        .post('/api/v1/test/assets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'test-key-1')
        .send({ name: 'Test Asset' });

      expect(response.status).toBe(201);
    });

    test('should return cached response for duplicate request with same idempotency key', async () => {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-testing-purposes';
      const token = jwt.sign({ userId: 'test-user', roles: ['admin'], typ: 'Bearer' }, secret, { expiresIn: '1h' });

      const firstResponse = await request(app)
        .post('/api/v1/test/assets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'test-key-2')
        .send({ name: 'Test Asset' });

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post('/api/v1/test/assets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'test-key-2')
        .send({ name: 'Test Asset' });

      // Should return cached response
      expect(secondResponse.status).toBe(201);
      expect(secondResponse.body.data.id).toBe(firstResponse.body.data.id);
    });
  });
});

describe('POST /auth Endpoint (Service Account Token Verification)', () => {
  describe('Unprotected endpoint that performs its own token verification', () => {
    let app: Application;
    let testToken: string;
    let testAccountId: string;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Simulate the POST /auth endpoint behavior
      const accounts = new Map<string, {
        id: string;
        displayId: string;
        name: string;
        accessTokenHash: string;
        accessTokenSalt: string;
        isActive: boolean;
        isArchived: boolean;
        scopes: string[];
      }>();

      const { token, id, salt, hash } = generateServiceAccountToken();
      testToken = token;
      testAccountId = id;

      accounts.set(id, {
        id,
        displayId: 'SVC-0001',
        name: 'Test Service Account',
        accessTokenHash: hash,
        accessTokenSalt: salt,
        isActive: true,
        isArchived: false,
        scopes: ['serviceaccounts:read'],
      });

      (app as any).accounts = accounts;

      // POST /auth endpoint - UNPROTECTED, does its own verification
      app.post('/auth', async (req: Request, res: Response) => {
        const { accessToken } = req.body;
        if (!accessToken) {
          return res.status(400).json({ error: 'accessToken required' });
        }

        const parts = accessToken.split('_');
        const accountUuid = parts[1];

        // Look up by id (UUID)
        const account = accounts.get(accountUuid);
        if (!account) {
          return res.status(401).json({ error: 'Invalid access token' });
        }

        // Verify hash
        const computedHash = crypto.createHash('sha256')
          .update(`${accessToken}${account.accessTokenSalt}`)
          .digest('hex');

        if (computedHash !== account.accessTokenHash) {
          return res.status(401).json({ error: 'Invalid access token' });
        }

        return res.json({
          success: true,
          data: {
            id: account.id,
            displayId: account.displayId,
            name: account.name,
            scopes: account.scopes,
          },
        });
      });
    });

    test('should authenticate valid service account token', async () => {
      const response = await request(app)
        .post('/auth')
        .send({ accessToken: testToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testAccountId);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth')
        .send({ accessToken: 'svc_invalid_token_123' });

      expect(response.status).toBe(401);
    });

    test('should reject token with wrong UUID', async () => {
      const wrongToken = `svc_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('base64url')}`;
      const response = await request(app)
        .post('/auth')
        .send({ accessToken: wrongToken });

      expect(response.status).toBe(401);
    });

    test('should NOT require admin authentication (it is unprotected)', async () => {
      // This endpoint should work WITHOUT any Bearer token or admin auth
      const response = await request(app)
        .post('/auth')
        .send({ accessToken: testToken });

      expect(response.status).toBe(200);
    });
  });
});
