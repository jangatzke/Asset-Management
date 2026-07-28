/**
 * Tests for AuthService
 *
 * Tests authentication logic: register, login, getCurrentUser,
 * refreshToken, hasAdminUsers, createFirstAdmin, logout, token rotation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Create mock before importing the service
const mockPrismaClient: any = {
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null), // Phase 9: hash-chain lookup
  },
  $queryRaw: jest.fn().mockResolvedValue([{ sequence: 1 }]),
  $executeRaw: jest.fn().mockResolvedValue(1),
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  authSettings: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  preAuthChallenge: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  displayIdCounter: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrismaClient)),
};

// Mock the database module
jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import { testUser, testAdminUser, testUserRole, testAdminUserRole, testUserPassword } from '../test/fixtures';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.ALLOW_SELF_REGISTRATION = 'true';
    // Mock displayIdCounter.upsert to return sequential IDs
    mockPrismaClient.displayIdCounter.upsert.mockResolvedValue({ entityType: 'User', sequence: 1 });
    mockPrismaClient.authSettings.findFirst.mockResolvedValue({
      id: 'auth-settings-1',
      passwordComplexityEnabled: true,
      minPasswordLength: 12,
      passwordHistoryCount: 0,
      passwordValidityDays: 0,
      forceMfa: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaClient.passwordHistory.findMany.mockResolvedValue([]);
    mockPrismaClient.passwordHistory.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.preAuthChallenge.create.mockResolvedValue({ id: 'preauth-1' });
    mockPrismaClient.preAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.preAuthChallenge.count.mockResolvedValue(1);
    mockPrismaClient.preAuthChallenge.findUnique.mockResolvedValue(null);
    mockPrismaClient.$queryRaw.mockResolvedValue([{ sequence: 1 }]);
    mockPrismaClient.$executeRaw.mockResolvedValue(1);
    mockPrismaClient.$transaction.mockImplementation((fn: any) => fn(mockPrismaClient));
  });

  describe('register', () => {
    it('should reject self-registration by default', async () => {
      delete process.env.ALLOW_SELF_REGISTRATION;

      await expect(authService.register({
        email: 'blocked@example.com',
        password: 'password123',
        firstName: 'Blocked',
        lastName: 'User',
      })).rejects.toThrow('Self-registration is disabled. Contact your administrator.');
      expect(mockPrismaClient.user.findUnique).not.toHaveBeenCalled();
    });

    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'Str0ng!Password',
        firstName: 'New',
        lastName: 'User',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        ...testUser,
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
      });
      mockPrismaClient.userRole.create.mockResolvedValue({
        ...testUserRole,
        roleName: 'employee',
      });

      const result = await authService.register(registerData);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerData.email },
      });
      expect(mockPrismaClient.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(registerData.email);
      expect(result.user.roles).toContain('employee');
    });

    it('should throw an error if email is already registered', async () => {
      const registerData = {
        email: testUser.email,
        password: 'Str0ng!Password',
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      await expect(authService.register(registerData)).rejects.toThrow(AppError);
      await expect(authService.register(registerData)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: testUser.email,
        password: testUserPassword,
      };

      // Mock bcrypt.compare to return true
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.user.update.mockResolvedValue({ ...testUser, lastLoginAt: new Date() });

      const result = await authService.login(credentials);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, testUser.passwordHash);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      if (result.state !== 'authenticated') throw new Error('Authenticated result was expected');
      expect(result.user.email).toBe(credentials.email);
    });

    it('should throw an error for invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(credentials)).rejects.toThrow(AppError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw an error for invalid password', async () => {
      const credentials = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(false);

      await expect(authService.login(credentials)).rejects.toThrow(AppError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw an error for inactive user', async () => {
      const credentials = {
        email: testUser.email,
        password: testUserPassword,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...testUser,
        isActive: false,
      });

      await expect(authService.login(credentials)).resolves.toEqual({ state: 'disabled' });
    });

    it('should reject expired local passwords', async () => {
      const credentials = { email: testUser.email, password: testUserPassword };
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.authSettings.findFirst.mockResolvedValue({
        id: 'auth-settings-1',
        passwordComplexityEnabled: true,
        minPasswordLength: 12,
        passwordHistoryCount: 0,
        passwordValidityDays: 1,
        forceMfa: false,
      });
      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...testUser,
        oidcId: null,
        passwordChangedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });

      await expect(authService.login(credentials)).resolves.toEqual(expect.objectContaining({ state: 'password_change_required', preAuthToken: expect.any(String) }));
    });

    it('should require MFA enrollment for local users when forced', async () => {
      const credentials = { email: testUser.email, password: testUserPassword };
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.authSettings.findFirst.mockResolvedValue({
        id: 'auth-settings-1',
        passwordComplexityEnabled: true,
        minPasswordLength: 12,
        passwordHistoryCount: 0,
        passwordValidityDays: 0,
        forceMfa: true,
      });
      mockPrismaClient.user.findUnique.mockResolvedValue({ ...testUser, oidcId: null, mfaEnabled: false });

      await expect(authService.login(credentials)).resolves.toEqual(expect.objectContaining({ state: 'mfa_enrollment_required', preAuthToken: expect.any(String) }));
    });
  });

  describe('changeOwnPassword', () => {
    it('should reject recently used local passwords', async () => {
      (jest.spyOn(bcrypt, 'compare') as any).mockImplementation(async (_plain: string, hash: string) => hash === testUser.passwordHash || hash === 'old-hash');
      mockPrismaClient.user.findUnique.mockResolvedValue({ ...testUser, oidcId: null });
      mockPrismaClient.authSettings.findFirst.mockResolvedValue({
        id: 'auth-settings-1',
        passwordComplexityEnabled: false,
        minPasswordLength: 8,
        passwordHistoryCount: 1,
        passwordValidityDays: 0,
        forceMfa: false,
      });
      mockPrismaClient.passwordHistory.findMany.mockResolvedValue([{ id: 'history-1', userId: testUser.id, passwordHash: 'old-hash' }]);

      await expect(authService.changeOwnPassword(testUser.id, testUserPassword, 'AnyPass123')).rejects.toThrow('Password was used recently');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user with roles', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.userGroup.findMany.mockResolvedValue([]);

      const result = await authService.getCurrentUser(testUser.id);

      expect(result.id).toBe(testUser.id);
      expect(result.email).toBe(testUser.email);
      expect(result.roles).toContain('employee');
    });

    it('should throw an error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent-id')).rejects.toThrow(AppError);
      await expect(authService.getCurrentUser('nonexistent-id')).rejects.toThrow('User not found');
    });
  });

  describe('hasAdminUsers', () => {
    it('should return true if admin exists', async () => {
      mockPrismaClient.userRole.count.mockResolvedValue(1);

      const result = await authService.hasAdminUsers();
      expect(result).toBe(true);
    });

    it('should return false if no admin exists', async () => {
      mockPrismaClient.userRole.count.mockResolvedValue(0);

      const result = await authService.hasAdminUsers();
      expect(result).toBe(false);
    });
  });

  describe('createFirstAdmin', () => {
    it('should create first admin successfully', async () => {
      const adminData = {
        email: 'admin@example.com',
        password: 'Adm1n!Secure',
        firstName: 'Admin',
        lastName: 'User',
      };

      mockPrismaClient.userRole.count.mockResolvedValue(0);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        ...testAdminUser,
        email: adminData.email,
      });
      mockPrismaClient.userRole.create.mockResolvedValue({
        ...testAdminUserRole,
        roleName: 'system_admin',
      });

      const result = await authService.createFirstAdmin(adminData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.roles).toContain('system_admin');
    });

    it('should throw an error if admin already exists', async () => {
      mockPrismaClient.userRole.count.mockResolvedValue(1);

      const adminData = {
        email: 'admin2@example.com',
        password: 'Adm1n!Secure',
        firstName: 'Admin',
        lastName: 'Two',
      };

      await expect(authService.createFirstAdmin(adminData)).rejects.toThrow(AppError);
      await expect(authService.createFirstAdmin(adminData)).rejects.toThrow('Admin account already exists');
    });
  });

  describe('login session', () => {
    it('should return a session and store hashed refresh token on login', async () => {
      const credentials = { email: testUser.email, password: testUserPassword };
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.user.update.mockResolvedValue(testUser);
      mockPrismaClient.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });

      const result = await authService.login(credentials);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('refreshTokenExpiresAt');
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalled();
      const createCall = mockPrismaClient.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).toHaveLength(64);
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh tokens and return a new access token', async () => {
      const rawRefreshToken = 'raw-refresh-token';
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        userId: testUser.id,
        tokenHash: authService.hashRefreshToken(rawRefreshToken),
        familyId: 'family-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
        replacedById: null,
        ipAddress: null,
        userAgent: null,
        user: testUser,
      });
      mockPrismaClient.refreshToken.create.mockResolvedValue({ id: 'refresh-2' });
      mockPrismaClient.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.refreshToken.update.mockResolvedValue({});
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);

      const result = await authService.refreshToken(rawRefreshToken);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'refresh-1', tokenHash: authService.hashRefreshToken(rawRefreshToken), usedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('allows exactly one of two parallel refresh attempts to consume a token', async () => {
      const rawRefreshToken = 'parallel-refresh-token';
      const existing = {
        id: 'refresh-1',
        userId: testUser.id,
        tokenHash: authService.hashRefreshToken(rawRefreshToken),
        familyId: 'family-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
        replacedById: null,
        ipAddress: null,
        userAgent: null,
        user: testUser,
      };
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue(existing);
      mockPrismaClient.refreshToken.create.mockResolvedValueOnce({ id: 'refresh-2' });
      mockPrismaClient.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 2 });
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);

      const results = await Promise.allSettled([authService.refreshToken(rawRefreshToken), authService.refreshToken(rawRefreshToken)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({ where: { familyId: 'family-1' }, data: { revokedAt: expect.any(Date) } });
    });

    it('should reject refresh-token reuse and revoke the token family', async () => {
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        userId: testUser.id,
        tokenHash: authService.hashRefreshToken('old-token'),
        familyId: 'family-1',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        revokedAt: null,
        replacedById: 'refresh-2',
        ipAddress: null,
        userAgent: null,
        user: testUser,
      });
      mockPrismaClient.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(authService.refreshToken('old-token')).rejects.toThrow('Refresh token reuse detected');
      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should reject expired refresh tokens', async () => {
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        userId: testUser.id,
        familyId: 'family-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        revokedAt: null,
        user: testUser,
      });

      await expect(authService.refreshToken('expired-token')).rejects.toThrow('Refresh token expired');
    });

    it('should reject disabled users during refresh', async () => {
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        userId: testUser.id,
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
        user: { ...testUser, isActive: false },
      });

      await expect(authService.refreshToken('disabled-user-token')).rejects.toThrow('Account is disabled');
    });
  });

  describe('pre-auth challenges', () => {
    it('persists non-raw single-use challenges during MFA-required login and consumes them once', async () => {
      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.user.findUnique.mockResolvedValue({ ...testUser, oidcId: null, mfaEnabled: true, mfaSecret: 'plain-secret' });

      const loginResult = await authService.login({ email: testUser.email, password: testUserPassword });
      expect(loginResult.state).toBe('mfa_required');
      if (loginResult.state !== 'mfa_required') throw new Error('MFA pre-auth result was expected');
      const createCall = mockPrismaClient.preAuthChallenge.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe(testUser.id);
      expect(createCall.data.purpose).toBe('mfa_required');
      expect(createCall.data.jtiHash).toHaveLength(64);
      expect(loginResult.preAuthToken).not.toContain(createCall.data.jtiHash);

      await authService.verifyPreAuthToken(loginResult.preAuthToken!, 'mfa_required');
      expect(mockPrismaClient.preAuthChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { usedAt: expect.any(Date) } }));
    });

    it('denies pre-auth challenge replay', async () => {
      const token = jwt.sign({ userId: testUser.id, purpose: 'mfa_required', jti: 'challenge-jti', typ: 'pre_auth' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
      mockPrismaClient.preAuthChallenge.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.preAuthChallenge.findUnique.mockResolvedValue({ jtiHash: 'hash', purpose: 'mfa_required', expiresAt: new Date(Date.now() + 60_000), usedAt: new Date(), revokedAt: null });

      await expect(authService.verifyPreAuthToken(token, 'mfa_required')).rejects.toThrow('Pre-auth token has already been used');
    });

    it('denies expired and wrong-purpose pre-auth challenges', async () => {
      const token = jwt.sign({ userId: testUser.id, purpose: 'password_change', jti: 'challenge-jti', typ: 'pre_auth' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '5m' });
      mockPrismaClient.preAuthChallenge.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.preAuthChallenge.findUnique.mockResolvedValueOnce({ purpose: 'password_change', expiresAt: new Date(Date.now() - 1), usedAt: null, revokedAt: null });
      await expect(authService.verifyPreAuthToken(token, 'password_change')).rejects.toThrow('Pre-auth token expired');

      await expect(authService.verifyPreAuthToken(token, 'mfa_required')).rejects.toThrow('Invalid pre-auth token');
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens for user', async () => {
      mockPrismaClient.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        userId: testUser.id,
        revokedAt: null,
        user: testUser,
      });
      mockPrismaClient.refreshToken.update.mockResolvedValue({});

      await authService.logout('raw-refresh-token');

      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'refresh-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('password change audit coupling', () => {
    it('updates password and writes PASSWORD_CHANGE audit in the same transaction', async () => {
      const token = jwt.sign({ userId: testUser.id, purpose: 'password_change', jti: 'challenge-jti', typ: 'pre_auth' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '5m' });
      mockPrismaClient.preAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.user.findUnique.mockResolvedValue({ ...testUser, isActive: true, oidcId: null });
      mockPrismaClient.user.update.mockResolvedValue({ ...testUser, mustChangePasswordOnNext: false });
      mockPrismaClient.authSettings.findFirst.mockResolvedValue({
        id: 'auth-settings-1',
        passwordComplexityEnabled: true,
        minPasswordLength: 8,
        passwordHistoryCount: 1,
        passwordValidityDays: 0,
        forceMfa: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaClient.$queryRaw.mockResolvedValue([{ sequence: 7 }]);
      mockPrismaClient.auditLog.findFirst.mockResolvedValue({ entryHash: 'prev-hash' });

      await authService.changeExpiredPassword(token, 'NewStrong1!');

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockPrismaClient.user.update).toHaveBeenCalled();
      expect(mockPrismaClient.passwordHistory.create).toHaveBeenCalled();
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PASSWORD_CHANGE',
          entityType: 'User',
          entityId: testUser.id,
          sequence: 7,
          previousHash: 'prev-hash',
          entryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });
  });

  describe('generateToken (private)', () => {
    it('should generate a valid JWT token', async () => {
      // We test token generation indirectly through login/register
      const credentials = {
        email: testUser.email,
        password: testUserPassword,
      };

      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.user.update.mockResolvedValue({ ...testUser });

      const result = await authService.login(credentials);
      if ('mfaRequired' in result) throw new Error('MFA challenge was not expected');

      // Verify token can be decoded
      if (result.state !== 'authenticated') throw new Error('Authenticated result was expected');
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET!);
      expect(decoded).toHaveProperty('userId', testUser.id);
      expect(decoded).toHaveProperty('email', testUser.email);
      expect(decoded).not.toHaveProperty('roles');
    });

    it('should throw error if JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;
      
      const credentials = {
        email: testUser.email,
        password: testUserPassword,
      };

      (jest.spyOn(bcrypt, 'compare') as any).mockResolvedValue(true);
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.user.update.mockResolvedValue({ ...testUser });

      await expect(authService.login(credentials)).rejects.toThrow(AppError);
      await expect(authService.login(credentials)).rejects.toThrow('JWT_SECRET is not configured');
    });
  });
});
