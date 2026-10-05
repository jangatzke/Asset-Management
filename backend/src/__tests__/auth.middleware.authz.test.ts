/**
 * Tests for middleware/auth.ts
 *
 * Covers:
 * - S4: authorize() verifies CURRENT roles from the database (not token roles),
 *   a short-lived in-memory cache, and the invalidation helper.
 * - S5: unified getJwtSecret() behavior (production fail-fast, dev fallback).
 */
import { jest } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrisma = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

import { authenticate, authorize, getJwtSecret, invalidateUserAuthorizationCache } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

// Use the strong test secret installed by src/test/setup.ts so tokens are
// signed with exactly what the unified getJwtSecret() resolves at request time.
// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
const JWT_SECRET = process.env.JWT_SECRET!;

function buildApp(...roles: string[]): Application {
  const app = express();
  app.use('/protected', authenticate, authorize(...roles));
  app.get('/protected', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

function tokenFor(userId: string, roles: string[]): string {
  // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret
  return jwt.sign({ userId, roles, typ: 'Bearer' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('authorize() current-role verification (S4)', () => {
  let app: Application;

  beforeEach(() => {
    invalidateUserAuthorizationCache();
    app = buildApp('admin');
  });

  it('rejects a role that exists only in the JWT but not in the database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, userRoles: [] });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor('user-1', ['admin'])}`);

    expect(response.status).toBe(403);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { isActive: true, userRoles: { select: { roleName: true } } },
    });
  });

  it('accepts a role that exists in the database even when the token lacks it', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, userRoles: [{ roleName: 'admin' }] });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor('user-2', [])}`);

    expect(response.status).toBe(200);
  });

  it('rejects inactive users with 403 even when the token carries the role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: false, userRoles: [{ roleName: 'admin' }] });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor('user-3', ['admin'])}`);

    expect(response.status).toBe(403);
  });

  it('serves repeated requests from the cache and honors invalidation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, userRoles: [{ roleName: 'admin' }] });
    const token = tokenFor('user-4', ['admin']);

    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);

    // Role removed + explicit invalidation takes effect immediately.
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, userRoles: [] });
    invalidateUserAuthorizationCache('user-4');

    expect((await request(app).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('fails closed with 503 when current roles cannot be loaded', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tokenFor('user-5', ['admin'])}`);

    expect(response.status).toBe(503);
  });
});

describe('unified getJwtSecret() (S5)', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses the configured strong secret', () => {
    process.env.JWT_SECRET = 'a-strong-secret-value-that-is-at-least-32-chars';
    expect(getJwtSecret()).toBe('a-strong-secret-value-that-is-at-least-32-chars');
  });

  it('throws in production when the secret is weak or missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is weak or missing/);
  });

  it('generates a stable development fallback for weak secrets outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'secret';
    const first = getJwtSecret();
    expect(first).not.toBe('secret');
    expect(first.length).toBeGreaterThanOrEqual(64);
    // Stable within the process so issued tokens remain verifiable.
    expect(getJwtSecret()).toBe(first);
  });
});
