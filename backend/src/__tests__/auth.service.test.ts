/**
 * Tests for AuthService
 *
 * Tests authentication logic: register, login, getCurrentUser,
 * refreshToken, hasAdminUsers, createFirstAdmin, logout, token rotation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Create mock before importing the service
const mockPrismaClient: any = {
  auditLog: {
    create: jest.fn(),
  },
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
      mockPrismaClient.refreshToken.update.mockResolvedValue({});
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);

      const result = await authService.refreshToken(rawRefreshToken);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaClient.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'refresh-1' },
        data: { usedAt: expect.any(Date), replacedById: 'refresh-2' },
      });
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
