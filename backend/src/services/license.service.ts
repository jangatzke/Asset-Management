import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateLicenseData {
  title: string;
  description?: string | null;
  licenseType: string;
  vendor?: string | null;
  productId?: string | null;
  licenseKey?: string | null;
  seats?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  renewalDate?: Date | null;
  cost?: number | null;
  currency?: string | null;
  status?: string;
}

export interface UpdateLicenseData extends Partial<CreateLicenseData> {}

export interface ListLicensesQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  licenseType?: string;
  vendor?: string;
  expiringBefore?: string;
}

export class LicenseService {
  async list(query: ListLicensesQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.LicenseWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { vendor: { contains: query.search, mode: 'insensitive' } },
        { licenseKey: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.licenseType) {
      where.licenseType = query.licenseType;
    }

    if (query.vendor) {
      where.vendor = { contains: query.vendor, mode: 'insensitive' };
    }

    if (query.expiringBefore) {
      where.endDate = { lte: new Date(query.expiringBefore) };
    }

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.license.count({ where }),
    ]);

    return {
      data: licenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const license = await prisma.license.findUnique({
      where: { id },
      include: { assets: { include: { assetType: true } } },
    });

    if (!license) {
      throw new AppError('License not found', 404);
    }

    return license;
  }

  async create(data: CreateLicenseData, createdBy?: string) {
    const displayId = `LIC-${Date.now()}`;

    const license = await prisma.license.create({
      data: {
        ...data,
        displayId,
        createdBy,
      },
    });

    return license;
  }

  async update(id: string, data: UpdateLicenseData, updatedBy?: string) {
    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('License not found', 404);
    }

    const license = await prisma.license.update({
      where: { id },
      data: { ...data, updatedBy },
    });

    return license;
  }

  async delete(id: string) {
    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('License not found', 404);
    }

    await prisma.license.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async getAssets(licenseId: string) {
    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new AppError('License not found', 404);
    }

    return prisma.asset.findMany({
      where: { licenseId },
      include: { assetType: true },
    });
  }
}

export const licenseService = new LicenseService();
