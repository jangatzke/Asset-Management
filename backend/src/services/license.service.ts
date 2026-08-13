import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { recordCreateHistory, recordUpdateHistory, recordDeleteHistory, toHistoryData } from './entityHistory.service';

export type LicensingBasis = 'user' | 'device';
export type AssignmentModel = 'named' | 'concurrent';

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
  licensingBasis?: LicensingBasis;
  assignmentModel?: AssignmentModel;
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
  licensingBasis?: LicensingBasis;
  assignmentModel?: AssignmentModel;
}

export class LicenseService {
  async list(query: ListLicensesQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.LicenseWhereInput = {
      // Exclude soft-deleted licenses from normal listing
      isArchived: { not: true },
    };

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

    if (query.licensingBasis) {
      where.licensingBasis = query.licensingBasis;
    }

    if (query.assignmentModel) {
      where.assignmentModel = query.assignmentModel;
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
      include: { assetLinks: { include: { asset: { include: { assetType: true } } } } },
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
        // Apply defaults for backwards compatibility
        licensingBasis: data.licensingBasis ?? 'user',
        assignmentModel: data.assignmentModel ?? 'named',
      },
    });

    // Record entity history
    await recordCreateHistory({
      entityType: 'License',
      entityId: license.id,
      data: { title: data.title },
      actorId: createdBy,
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

    // Record entity history for update (status-like field is status)
    await recordUpdateHistory({
      entityType: 'License',
      entityId: id,
      oldData: toHistoryData(existing as any),
      newData: toHistoryData(license as any),
      statusField: 'status',
      actorId: updatedBy,
    });

    return license;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.license.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('License not found', 404);
    }

    await prisma.license.update({
      where: { id },
      data: { isArchived: true },
    });

    // Record entity history for delete (archive)
    await recordDeleteHistory({
      entityType: 'License',
      entityId: id,
      actorId: deletedBy,
    });

    return { success: true };
  }

  async getAssets(licenseId: string) {
    const license = await prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new AppError('License not found', 404);
    }

    return prisma.asset.findMany({
      where: { licenseLinks: { some: { licenseId } } },
      include: { assetType: true },
    });
  }
}

export const licenseService = new LicenseService();
