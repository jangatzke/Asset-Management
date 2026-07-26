import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface ListUsersQuery {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber?: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface UserSelectItem {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export class UserService {
  async listUsers(query: ListUsersQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phoneNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' as const },
        include: {
          userRoles: {
            select: {
              roleName: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        roles: user.userRoles.map((ur) => ur.roleName),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchUsers(searchTerm: string, limit: number = 20) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' as const },
      take: Math.min(limit, 100),
      include: {
        userRoles: {
          select: {
            roleName: true,
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      phoneNumber: user.phoneNumber,
      roles: user.userRoles.map((ur) => ur.roleName),
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          select: {
            roleName: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.roleName),
    };
  }

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          select: {
            roleName: true,
          },
        },
      },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    roleNames?: string[];
  }) {
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        userRoles: data.roleNames
          ? {
              create: data.roleNames.map((roleName) => ({ roleName })),
            }
          : undefined,
      },
    });
    return user;
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }
    if (data.firstName) {
      updateData.firstName = data.firstName;
    }
    if (data.lastName) {
      updateData.lastName = data.lastName;
    }
    if (data.phoneNumber !== undefined) {
      updateData.phoneNumber = data.phoneNumber;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  async changePasswordHash(id: string, newHash: string) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: newHash },
    });
  }

  /**
   * Get all active users formatted for dropdown/search in owner fields
   */
  async getOwnersForSelect(search?: string) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userRoles: {
          select: {
            roleName: true,
          },
        },
      },
      take: 500,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      roles: user.userRoles.map((ur) => ur.roleName),
    }));
  }
}
