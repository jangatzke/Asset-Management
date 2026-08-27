/**
 * Tests for Auth Routes
 *
 * Tests the HTTP endpoints in auth.routes.ts using Supertest.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

// Mock services before importing routes
const mockAuthService = {
  register: jest.fn<any>(),
  login: jest.fn<any>(),
  getCurrentUser: jest.fn<any>(),
  refreshToken: jest.fn<any>(),
  verifyMfaLogin: jest.fn<any>(),
  beginPreAuthMfaEnrollment: jest.fn<any>(),
  confirmPreAuthMfaEnrollment: jest.fn<any>(),
  changeExpiredPassword: jest.fn<any>(),
  logout: jest.fn<any>(),
  hasAdminUsers: jest.fn<any>(),
  createFirstAdmin: jest.fn<any>(),
};

const mockOidcService = {
  isLocalLoginEnabled: jest.fn<any>(),
  getAuthorizationUrl: jest.fn<any>(),
  handleCallback: jest.fn<any>(),
  getConfig: jest.fn<any>(),
};

jest.mock('../services/auth.service', () => ({
  authService: mockAuthService,
}));

jest.mock('../services/oidc.service', () => ({
  oidcService: mockOidcService,
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userId = 'user-123';
    next();
  }),
  AuthRequest: {},
}));

import { authRouter } from '../routes/auth.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Mock error handler to prevent next() calls from failing
jest.mock('../middleware/errorHandler', () => ({
  errorHandler: jest.fn((_err: any, _req: any, res: any) => {
    res.status(500).json({ error: 'Internal Server Error' });
  }),
}));

describe('Auth Routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  const restoreNodeEnv = () => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS;
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.REFRESH_TOKEN_COOKIE_SECURE;
    restoreNodeEnv();
  });

  afterEach(() => {
    delete process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS;
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.REFRESH_TOKEN_COOKIE_SECURE;
    restoreNodeEnv();
  });

  describe('GET /auth/has-admin', () => {
    it('should return true when admin users exist', async () => {
      mockAuthService.hasAdminUsers.mockResolvedValue(true);

      const response = await request(app).get('/auth/has-admin');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ hasAdmin: true });
    });

    it('should return false when no admin users exist', async () => {
      mockAuthService.hasAdminUsers.mockResolvedValue(false);

      const response = await request(app).get('/auth/has-admin');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ hasAdmin: false });
    });
  });

  describe('POST /auth/create-first-admin', () => {
    const adminData = {
      email: 'admin@example.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
    };

    it('should create first admin when no admins exist', async () => {
      mockAuthService.createFirstAdmin.mockResolvedValue({
        user: adminData,
        token: 'test-token',
      });

      const response = await request(app)
        .post('/auth/create-first-admin')
        .send(adminData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject when admin already exists', async () => {
      mockAuthService.createFirstAdmin.mockRejectedValue(new Error('Admin account already exists'));

      const response = await request(app)
        .post('/auth/create-first-admin')
        .send(adminData);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /auth/register', () => {
    const userData = {
      email: 'user@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user', async () => {
      mockAuthService.register.mockResolvedValue({
        user: userData,
        token: 'test-token',
      });

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject on validation error', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Email already registered'));

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /auth/login', () => {
    const credentials = { email: 'user@example.com', password: 'password123' };

    it('should login with valid credentials', async () => {
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({
        user: { id: 'user-123', email: credentials.email },
        token: 'test-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(response.body).not.toHaveProperty('refreshToken');
    });

    it('should allow refresh cookie Secure to be disabled for local HTTP development', async () => {
      process.env.REFRESH_TOKEN_COOKIE_SECURE = 'false';
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({
        user: { id: 'user-123', email: credentials.email },
        token: 'test-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(response.headers['set-cookie']?.[0]).not.toContain('Secure');
    });

    it('should allow refresh cookie Secure to be forced for HTTPS deployments', async () => {
      process.env.REFRESH_TOKEN_COOKIE_SECURE = 'true';
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({
        user: { id: 'user-123', email: credentials.email },
        token: 'test-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(response.headers['set-cookie']?.[0]).toContain('Secure');
    });

    it('should return MFA enrollment pre-auth without refresh cookie', async () => {
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ state: 'mfa_enrollment_required', preAuthToken: 'preauth-token', expiresInSeconds: 300 });

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ state: 'mfa_enrollment_required', preAuthToken: 'preauth-token', expiresInSeconds: 300 });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should return disabled without pre-auth or session', async () => {
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ state: 'disabled' });

      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ state: 'disabled' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should reject login when local login is disabled', async () => {
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(403);
    });

    it('should reject with invalid credentials', async () => {
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/auth/login')
        .send(credentials);

      expect(response.status).toBe(500);
    });

    it('rejects malformed or excess login input before reaching the authentication service', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123', isAdmin: true });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should rate-limit repeated login attempts when enabled', async () => {
      process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS = 'true';
      process.env.AUTH_RATE_LIMIT_MAX = '2';
      mockOidcService.isLocalLoginEnabled.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({
        user: { id: 'user-123', email: credentials.email },
        token: 'test-token',
      });

      await request(app).post('/auth/login').send(credentials).expect(200);
      await request(app).post('/auth/login').send(credentials).expect(200);
      const response = await request(app).post('/auth/login').send(credentials);

      expect(response.status).toBe(429);
      expect(response.body.error.message).toContain('Too many authentication attempts');
    });
  });

  describe('GET /auth/oidc/authorize', () => {
    it('should return OIDC authorization URL', async () => {
      mockOidcService.getAuthorizationUrl.mockResolvedValue({ authorizeUrl: 'https://oidc.example.com/authorize?state=test', state: 'test' });

      const response = await request(app).get('/auth/oidc/authorize');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authorizeUrl');
      expect(response.body).toHaveProperty('state');
    });
  });

  describe('POST /auth/oidc/callback', () => {
    it('should handle OIDC callback successfully', async () => {
      mockOidcService.handleCallback.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        token: 'test-token',
      });

      const response = await request(app)
        .post('/auth/oidc/callback')
        .send({ code: 'auth-code', state: 'test-state' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should handle OIDC callback failure', async () => {
      mockOidcService.handleCallback.mockRejectedValue(new Error('Invalid code'));

      const response = await request(app)
        .post('/auth/oidc/callback')
        .send({ code: 'invalid', state: 'test-state' });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /auth/oidc/config', () => {
    it('should return OIDC configuration', async () => {
      mockOidcService.getConfig.mockResolvedValue({
        issuer: 'https://oidc.example.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      });

      const response = await request(app).get('/auth/oidc/config');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('issuer');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token from cookie without access-token middleware', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', ['refreshToken=old-token']);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old-token', expect.any(Object));
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    });
  });

  describe('PATCH /auth/me/preferences', () => {
    it('only accepts the supported language and dark-mode preference fields', async () => {
      const response = await request(app)
        .patch('/auth/me/preferences')
        .send({ language: 'fr', isAdmin: true });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Phase 3 pre-auth endpoints', () => {
    it('confirms MFA enrollment pre-auth and issues a refresh cookie', async () => {
      mockAuthService.confirmPreAuthMfaEnrollment.mockResolvedValue({ user: { id: 'user-123' }, token: 'access-token', refreshToken: 'refresh-token', refreshTokenExpiresAt: new Date(Date.now() + 60_000) });

      const response = await request(app).post('/auth/preauth/mfa/confirm').send({ preAuthToken: 'preauth-token', token: '123456' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'access-token');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    });

    it('changes an expired password with pre-auth and returns next MFA state without a cookie', async () => {
      mockAuthService.changeExpiredPassword.mockResolvedValue({ state: 'mfa_required', preAuthToken: 'next-preauth', expiresInSeconds: 300 });

      const response = await request(app).post('/auth/preauth/password/change').send({ preAuthToken: 'preauth-token', newPassword: 'Str0ng!Password2' });

      expect(response.status).toBe(200);
      expect(response.body.state).toBe('mfa_required');
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke current refresh token cookie', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['refreshToken=logout-token']);

      expect(response.status).toBe(200);
      expect(mockAuthService.logout).toHaveBeenCalledWith('logout-token', expect.any(Object));
      expect(response.headers['set-cookie']?.[0]).toContain('refreshToken=');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: ['user'],
      });

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email');
    });
  });
});
