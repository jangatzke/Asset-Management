import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();
(mockPrisma as any).$on = jest.fn();
(mockPrisma as any).serviceAccount = {
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../services/intune.scheduler', () => ({ initializeScheduler: jest.fn() }));
jest.mock('../services/reminder.scheduler', () => ({ initializeReminderScheduler: jest.fn() }));
jest.mock('../services/webhookQueue.service', () => ({ startWebhookQueueWorker: jest.fn() }));
jest.mock('../services/bootstrap.service', () => ({ ensureStandardAssetTypes: jest.fn() }));

import { app } from '../index';

const JWT_SECRET = process.env.JWT_SECRET!;
const adminToken = jwt.sign(
  { userId: 'admin-user', roles: ['admin'], typ: 'Bearer' },
  JWT_SECRET,
  { expiresIn: '1h' },
);

function hashToken(token: string, salt: string): string {
  return crypto.createHash('sha256').update(`${token}${salt}`).digest('hex');
}

describe('service-account production route integration', () => {
  const accounts = new Map<string, any>();

  beforeEach(() => {
    accounts.clear();
    mockPrisma.serviceAccount.findFirst.mockImplementation(async ({ where, orderBy }: any) => {
      if (orderBy?.displayId) return null;

      return Array.from(accounts.values()).find((account) => {
        if (where.id && account.id !== where.id) return false;
        if (where.isArchived !== undefined && account.isArchived !== where.isArchived) return false;
        if (where.isActive !== undefined && account.isActive !== where.isActive) return false;
        return true;
      }) ?? null;
    });
    mockPrisma.serviceAccount.create.mockImplementation(async ({ data }: any) => {
      const account = { ...data, createdAt: new Date(), updatedAt: new Date(), lastUsedAt: null };
      accounts.set(account.id, account);
      return account;
    });
    mockPrisma.serviceAccount.update.mockImplementation(async ({ where, data }: any) => {
      const existing = accounts.get(where.id);
      const updated = { ...existing, ...data };
      accounts.set(where.id, updated);
      return updated;
    });
  });

  test('mounts the service-account authentication endpoint at its documented path', async () => {
    const response = await request(app)
      .post('/api/v1/service-accounts/auth')
      .send({ accessToken: 'invalid' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid token format');
  });

  test('allows an admin JWT to create a service account without user API scopes', async () => {
    const response = await request(app)
      .post('/api/v1/service-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Integration account', scopes: ['assets:read'] });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toMatch(/^svc_/);
  });

  test('authenticates the token returned after regeneration', async () => {
    const id = crypto.randomUUID();
    const previousSalt = crypto.randomBytes(32).toString('hex');
    const previousToken = `svc_${id}_previous`;
    accounts.set(id, {
      id,
      displayId: 'SVC-0001',
      name: 'Regenerated account',
      scopes: ['assets:read'],
      isActive: true,
      isArchived: false,
      expiresAt: null,
      accessTokenSalt: previousSalt,
      accessTokenHash: hashToken(previousToken, previousSalt),
    });

    const regenerate = await request(app)
      .post(`/api/v1/service-accounts/${id}/regenerate-token`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(regenerate.status).toBe(200);
    expect(regenerate.body.accessToken).toContain(`svc_${id}_`);

    const authenticate = await request(app)
      .post('/api/v1/service-accounts/auth')
      .send({ accessToken: regenerate.body.accessToken });

    expect(authenticate.status).toBe(200);
    expect(authenticate.body.data.id).toBe(id);
  });
});
