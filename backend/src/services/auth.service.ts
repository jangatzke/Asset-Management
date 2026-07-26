import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { authSettingsService } from './authSettings.service';

type RefreshTokenWithUser = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  issuedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  replacedById: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    mustChangePasswordOnNext: boolean;
  } | null;
};

export interface LoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
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
}

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSessionResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    mustChangePasswordOnNext?: boolean;
  };
  token: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface MfaChallengePayload {
  userId: string;
  purpose: 'mfa_login';
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
  private readonly refreshTokenBytes = 32;

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET is not configured', 500);
    }
    if (process.env.NODE_ENV !== 'test' && (secret === 'secret' || secret.length < 32)) {
      throw new AppError('JWT secret is not securely configured', 500);
    }
    return secret;
  }

  private getMfaEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY || this.getJwtSecret()).digest();
  }

  private getAccessTokenLifetime(): string {
    return process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '20m';
  }

  private getRefreshTokenLifetimeMs(): number {
    const raw = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d';
    const match = raw.match(/^(\d+)([smhd])$/i);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return value * 24 * 60 * 60 * 1000;
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateOpaqueRefreshToken(): string {
    return crypto.randomBytes(this.refreshTokenBytes).toString('base64url');
  }

  private buildUserName(user: { firstName: string; lastName: string }): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private async getDirectRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({ where: { userId } });
    return userRoles.map((ur) => ur.roleName);
  }

  private async createRefreshSession(userId: string, context: SessionContext, familyId: string = crypto.randomUUID()) {
    const refreshToken = this.generateOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + this.getRefreshTokenLifetimeMs());
    const db = prisma as any;
    const record = await db.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        familyId,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return { refreshToken, expiresAt, record };
  }

  private encryptMfaSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getMfaEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptMfaSecret(value: string): string {
    if (!value.startsWith('v1:')) return value;
    const [, iv, tag, encrypted] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getMfaEncryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  }

  private generateMfaChallenge(userId: string): string {
    return jwt.sign({ userId, purpose: 'mfa_login' }, this.getJwtSecret(), { expiresIn: '5m', algorithm: 'HS256' });
  }

  private verifyMfaChallenge(challenge: string): MfaChallengePayload {
    const payload = jwt.verify(challenge, this.getJwtSecret(), { algorithms: ['HS256'] }) as MfaChallengePayload;
    if (payload.purpose !== 'mfa_login') throw new AppError('Invalid MFA challenge', 401);
    return payload;
  }

  private verifyTotp(secretValue: string, token: string): boolean {
    const secret = this.decryptMfaSecret(secretValue);
    return authenticator.verify({ token: String(token || '').replace(/\s/g, ''), secret });
  }

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

    await authSettingsService.ensurePasswordAllowedForLocalUser(null, data.password);

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

    await authSettingsService.recordPasswordHash(user.id, passwordHash);

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

  async login(credentials: LoginCredentials, context: SessionContext = {}): Promise<AuthSessionResult | { mfaRequired: true; challenge: string }> {
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

    const authSettings = await authSettingsService.getSettings();
    if (!user.oidcId && authSettings.forceMfa && !user.mfaEnabled) {
      throw new AppError('MFA enrollment is required for local accounts before login can continue', 403);
    }

    if (!user.oidcId && authSettingsService.isPasswordExpired(user.passwordChangedAt, authSettings)) {
      throw new AppError('Password has expired. Please contact an administrator or change your password.', 403);
    }

    if (user.mfaEnabled && user.mfaSecret) {
      if (!credentials.mfaToken) {
        return { mfaRequired: true, challenge: this.generateMfaChallenge(user.id) };
      }
      if (!this.verifyTotp(user.mfaSecret, credentials.mfaToken)) {
        throw new AppError('Invalid MFA verification code', 401);
      }
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
    });
    const session = await this.createRefreshSession(user.id, context);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        mustChangePasswordOnNext: user.mustChangePasswordOnNext,
      },
      token,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
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
        mustChangePasswordOnNext: true,
        mfaEnabled: true,
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

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.oidcId) {
      throw new AppError('Password changes for OIDC-linked accounts must be handled by the identity provider', 400);
    }

    const currentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    await authSettingsService.ensurePasswordAllowedForLocalUser(userId, newPassword);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await auditService.logEventStandalone(prisma, {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
      details: 'User changed own password',
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePasswordOnNext: false,
        passwordChangedAt: new Date(),
        updatedBy: userId,
      },
    });
    await authSettingsService.recordPasswordHash(userId, passwordHash);
  }

  async refreshToken(refreshToken: string, context: SessionContext = {}) {
    if (!refreshToken) throw new AppError('Refresh token required', 401);
    const tokenHash = this.hashRefreshToken(refreshToken);
    const db = prisma as any;
    const existing = await db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } }) as RefreshTokenWithUser | null;
    if (!existing) throw new AppError('Invalid refresh token', 401);

    if (existing.usedAt || existing.revokedAt) {
      await db.refreshToken.updateMany({ where: { familyId: existing.familyId }, data: { revokedAt: new Date() } });
      await auditService.logEventStandalone(prisma, {
        userId: existing.userId,
        userName: existing.user ? this.buildUserName(existing.user) : undefined,
        action: 'PERMISSION_CHANGE',
        entityType: 'RefreshToken',
        entityId: existing.id,
        details: `Refresh token reuse detected for family ${existing.familyId}`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AppError('Refresh token reuse detected', 401);
    }

    if (existing.expiresAt <= new Date()) throw new AppError('Refresh token expired', 401);
    if (!existing.user || !existing.user.isActive) throw new AppError('Account is disabled', 403);

    const replacement = await this.createRefreshSession(existing.userId, context, existing.familyId);
    await db.refreshToken.update({
      where: { id: existing.id },
      data: { usedAt: new Date(), replacedById: replacement.record.id },
    });

    const token = this.generateToken({ userId: existing.user.id, email: existing.user.email });
    const roles = await this.getDirectRoles(existing.user.id);
    return {
      token,
      refreshToken: replacement.refreshToken,
      refreshTokenExpiresAt: replacement.expiresAt,
      user: {
        id: existing.user.id,
        email: existing.user.email,
        firstName: existing.user.firstName,
        lastName: existing.user.lastName,
        roles,
        mustChangePasswordOnNext: existing.user.mustChangePasswordOnNext,
      },
    };
  }

  async hasAdminUsers(): Promise<boolean> {
    const adminCount = await prisma.userRole.count({
      where: { roleName: 'system_admin' },
    });
    return adminCount > 0;
  }

  async verifyMfaLogin(challenge: string, token: string, context: SessionContext = {}) {
    const payload = this.verifyMfaChallenge(challenge);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) throw new AppError('Invalid MFA challenge', 401);
    if (!this.verifyTotp(user.mfaSecret, token)) throw new AppError('Invalid MFA verification code', 401);
    const userRoles = await prisma.userRole.findMany({ where: { userId: user.id } });
    const roles = userRoles.map((ur) => ur.roleName);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await auditService.logEventStandalone(prisma, {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      action: 'MFA_LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `Successful MFA login: ${user.email}`,
    });
    const session = await this.createRefreshSession(user.id, context);
    return {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles, mustChangePasswordOnNext: user.mustChangePasswordOnNext },
      token: this.generateToken({ userId: user.id, email: user.email }),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  async beginMfaEnrollment(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.oidcId) throw new AppError('MFA setup for OIDC-linked accounts must be handled by the identity provider', 400);
    const secret = authenticator.generateSecret();
    const issuer = process.env.MFA_ISSUER || 'ISMS Asset Manager';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    await prisma.user.update({ where: { id: userId }, data: { mfaPendingSecret: this.encryptMfaSecret(secret) } });
    return { otpauthUrl, qrCodeDataUrl };
  }

  async confirmMfaEnrollment(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (!user.mfaPendingSecret) throw new AppError('No MFA enrollment in progress', 400);
    if (!this.verifyTotp(user.mfaPendingSecret, token)) throw new AppError('Invalid MFA verification code', 400);
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnabledAt: new Date() },
    });
    await auditService.logEventStandalone(prisma, {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      action: 'MFA_ENABLE',
      entityType: 'User',
      entityId: user.id,
      details: 'TOTP MFA enabled for local account',
    });
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (!user.mfaEnabled || !user.mfaSecret) throw new AppError('MFA is not enabled', 400);
    if (!this.verifyTotp(user.mfaSecret, token)) throw new AppError('Invalid MFA verification code', 400);
    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null } });
    return { mfaEnabled: false };
  }

  async createFirstAdmin(data: RegisterData) {
    await authSettingsService.ensurePasswordAllowedForLocalUser(null, data.password);

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
      const displayId = await tx.displayIdCounter.upsert({
        where: { entityType: 'User' },
        create: { entityType: 'User', sequence: 1 },
        update: { sequence: { increment: 1 } },
      });
      const sequence = displayId.sequence;
      const padded = String(sequence).padStart(4, '0');
      const userDisplayId = `USR-${padded}`;

      const user = await tx.user.create({
        data: {
          displayId: userDisplayId,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          organizationUnitId: data.organizationUnitId,
        },
      });

      await (tx as any).passwordHistory.create({ data: { userId: user.id, passwordHash } });

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

  async logout(refreshToken: string | null, context: SessionContext = {}): Promise<void> {
    const db = prisma as any;
    const record = refreshToken
      ? await db.refreshToken.findUnique({ where: { tokenHash: this.hashRefreshToken(refreshToken) }, include: { user: true } }) as RefreshTokenWithUser | null
      : null;
    const user = record?.user ?? null;

    if (record && !record.revokedAt) {
      await db.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    }

    if (user && record) {
      await auditService.logEventStandalone(prisma, {
        userId: user.id,
        userName: this.buildUserName(user),
        action: 'LOGOUT',
        entityType: 'RefreshToken',
        entityId: record.id,
        details: `Logout: ${user.email}`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
  }

  private generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), { expiresIn: this.getAccessTokenLifetime() as jwt.SignOptions['expiresIn'], algorithm: 'HS256' });
  }
}

export const authService = new AuthService();
