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
  userGroup: {
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
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
        password: 'password123',
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
        password: 'password123',
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

      await expect(authService.login(credentials)).rejects.toThrow(AppError);
      await expect(authService.login(credentials)).rejects.toThrow('Account is disabled');
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
        password: 'adminpass123',
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
        password: 'password123',
        firstName: 'Admin',
        lastName: 'Two',
      };

      await expect(authService.createFirstAdmin(adminData)).rejects.toThrow(AppError);
      await expect(authService.createFirstAdmin(adminData)).rejects.toThrow('Admin account already exists');
    });
  });

  describe('refreshToken', () => {
    it('should generate a new access token and store hashed refresh token', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockPrismaClient.userRole.findMany.mockResolvedValue([testUserRole]);
      mockPrismaClient.refreshToken.create.mockResolvedValue({});

      const result = await authService.refreshToken(testUser.id);

      expect(result).toHaveProperty('token');
      expect(mockPrismaClient.refreshToken.create).toHaveBeenCalled();
      
      // Verify the stored token is hashed (not plaintext)
      const createCall = mockPrismaClient.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.token).not.toBe(testUser.id);
      expect(createCall.data.token).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should throw error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(authService.refreshToken('nonexistent')).rejects.toThrow(AppError);
      await expect(authService.refreshToken('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens for user', async () => {
      mockPrismaClient.refreshToken.updateMany.mockResolvedValue({});

      await authService.logout(testUser.id);

      expect(mockPrismaClient.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: testUser.id },
        data: { revoked: true },
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

      // Verify token can be decoded
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET!);
      expect(decoded).toHaveProperty('userId', testUser.id);
      expect(decoded).toHaveProperty('email', testUser.email);
      expect(decoded).toHaveProperty('roles', ['employee']);
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
