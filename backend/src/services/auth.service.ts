import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

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

export class AuthService {
  async register(data: RegisterData) {
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: userId },
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      roles: userRoles.map((ur) => ur.roleName),
    });

    return { token };
  }

  async hasAdminUsers(): Promise<boolean> {
    const adminCount = await prisma.userRole.count({
      where: { roleName: 'system_admin' },
    });
    return adminCount > 0;
  }

  async createFirstAdmin(data: RegisterData) {
    // Check if admin already exists
    const hasAdmin = await this.hasAdminUsers();
    if (hasAdmin) {
      throw new AppError('Admin account already exists', 403);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const displayId = `USR-${Date.now()}`;

    const user = await prisma.user.create({
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

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleName: 'system_admin',
      },
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

  private generateToken(payload: TokenPayload): string {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    return jwt.sign(payload, secret, { expiresIn: '1h' });
  }
}

export const authService = new AuthService();