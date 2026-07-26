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
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS;
    delete process.env.AUTH_RATE_LIMIT_MAX;
  });

  afterEach(() => {
    delete process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS;
    delete process.env.AUTH_RATE_LIMIT_MAX;
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
      mockOidcService.getAuthorizationUrl.mockResolvedValue('https://oidc.example.com/authorize?state=test');

      const response = await request(app).get('/auth/oidc/authorize');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authorizeUrl');
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
