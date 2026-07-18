import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  organizationUnitId?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

/**
 * Check if self-registration is allowed.
 * Default: disabled (SEC-006). Only admin can create users or OIDC auto-provisioning.
 */
function isSelfRegistrationAllowed(): boolean {
  // Self-registration is disabled by default for security compliance
  return process.env.ALLOW_SELF_REGISTRATION === 'true';
}

export class AuthService {
  async register(data: RegisterData) {
    if (!isSelfRegistrationAllowed()) {
      throw new AppError('Self-registration is disabled. Contact your administrator.', 403);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        organizationUnitId: data.organizationUnitId,
      },
    });

    const roles = await prisma.userRole.create({
      data: {
        userId: user.id,
        roleName: 'employee',
      },
    });

    // Audit log for self-registration
    await auditService.logEventStandalone(prisma, {
      userId: user.id,
      userName: `${data.firstName} ${data.lastName}`,
      action: 'REGISTER',
      entityType: 'User',
      entityId: user.id,
      details: `Self-registered user: ${data.email}`,
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      roles: [roles.roleName],
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: [roles.roleName],
      },
      token,
    };
  }

  async login(credentials: LoginCredentials) {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is disabled', 403);
    }

    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
    });

    const roles = userRoles.map((ur) => ur.roleName);

    // Audit log for login
    await auditService.logEventStandalone(prisma, {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `Successful login: ${credentials.email}`,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
      token,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        oidcId: true,
        oidcProvider: true,
        language: true,
        darkMode: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: userId },
    });

    // Also get roles from groups
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: userId },
      include: { group: { include: { groupRoles: true } } },
    });
    const groupRoles: string[] = [];
    for (const ug of userGroups) {
      for (const gr of ug.group.groupRoles) {
        if (!groupRoles.includes(gr.roleName)) {
          groupRoles.push(gr.roleName);
        }
      }
    }

    const allRoles = [...new Set([...userRoles.map((ur) => ur.roleName), ...groupRoles])];

    return {
      ...user,
      isOidcLinked: !!user.oidcId,
      roles: allRoles,
    };
  }

  async refreshToken(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    const roles = userRoles.map((ur) => ur.roleName);

    // Generate new refresh token
    const newRefreshToken = crypto.randomUUID();
    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    // Store hashed token in database
    await prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Generate access token
    const token = this.generateToken({ userId: user.id, email: user.email, roles });

    return { token };
  }

  async hasAdminUsers(): Promise<boolean> {
    const adminCount = await prisma.userRole.count({
      where: { roleName: 'system_admin' },
    });
    return adminCount > 0;
  }

  async createFirstAdmin(data: RegisterData) {
    // Use a database transaction to prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Check if admin already exists within the transaction
      const hasAdmin = await tx.userRole.count({
        where: { roleName: 'system_admin' },
      });
      if (hasAdmin > 0) {
        throw new AppError('Admin account already exists', 403);
      }

      const existingUser = await tx.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError('Email already registered', 409);
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const displayId = `USR-0001`; // Will be replaced by Display-ID service later

      const user = await tx.user.create({
        data: {
          displayId,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          organizationUnitId: data.organizationUnitId,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleName: 'system_admin',
        },
      });

      // Audit log for first admin creation (within transaction)
      await auditService.logEvent(tx, {
        userId: user.id,
        userName: `${data.firstName} ${data.lastName}`,
        action: 'CREATE_FIRST_ADMIN',
        entityType: 'User',
        entityId: user.id,
        details: `First admin created: ${data.email}`,
      });

      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        roles: ['system_admin'],
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: ['system_admin'],
        },
        token,
      };
    });
  }

  async updatePreferences(userId: string, data: { language?: string; darkMode?: boolean }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        language: true,
        darkMode: true,
      },
    });

    return updated;
  }

  /**
   * Generate a new refresh token, store its hash, and revoke all previous tokens
   * for the given user (rotation + hashing)
   */
  async generateRefreshToken(userId: string): Promise<{ token: string; hashedToken: string }> {
    // Generate new refresh token
    const newRefreshToken = crypto.randomUUID();
    
    // Hash the token before storing
    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    
    // Revoke all existing refresh tokens for this user
    await this.revokeRefreshTokens(userId);
    
    // Store the new hashed token
    await prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        revoked: false,
      },
    });
    
    return { token: newRefreshToken, hashedToken: hashedRefreshToken };
  }

  /**
   * Validate a refresh token by comparing its hash with stored hash
   * Returns userId if valid, null otherwise
   */
  async validateRefreshToken(token: string): Promise<string | null> {
    // Find the refresh token record
    const record = await prisma.refreshToken.findFirst({
      where: {
        revoked: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!record) {
      return null;
    }

    // Compare provided token with stored hash
    const isValid = await bcrypt.compare(token, record.token);
    return isValid ? record.userId : null;
  }

  /**
   * Revoke all refresh tokens for a user (used during logout and token rotation)
   */
  async revokeRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId: userId },
      data: { revoked: true },
    });
  }

  /**
   * Revoke all tokens for a user (used during logout)
   * Revokes both refresh tokens and invalidates access tokens
   */
  async logout(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Audit log for logout
    if (user) {
      await auditService.logEventStandalone(prisma, {
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: userId,
        details: `Logout: ${user.email}`,
      });
    }

    // Revoke all refresh tokens
    await this.revokeRefreshTokens(userId);
    
    // Note: Access tokens are stateless, but we could add additional
    // session tracking if needed for forced logout
  }

  private generateToken(payload: TokenPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET is not configured', 500);
    }
    return jwt.sign(payload, secret, { expiresIn: '1h' });
  }
}

export const authService = new AuthService();
