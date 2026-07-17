import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateAssetData {
  name: string;
  description?: string;
  assetTypeId: string;
  subType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  externalId?: string;
  organizationUnitId?: string;
  locationId?: string;
  technicalOperatorId?: string;
  businessOwnerId?: string;
  informationSecurityResponsibleId?: string;
  businessProcessId?: string;
  serviceId?: string;
  lifecycleStatus?: string;
  purchaseDate?: Date;
  commissioningDate?: Date;
  endOfSaleDate?: Date;
  endOfLifeDate?: Date;
  endOfSupportDate?: Date;
  confidentialityNeed?: string;
  integrityNeed?: string;
  availabilityNeed?: string;
  dataProtectionRelevance?: boolean;
  criticality?: string;
  networkAddresses?: string;
  dnsNames?: string;
  dataSource?: string;
  lastDetectedAt?: Date;
}

export interface UpdateAssetData extends Partial<CreateAssetData> {}

export interface ListAssetsQuery {
  page?: string;
  limit?: string;
  search?: string;
  assetTypeId?: string;
  lifecycleStatus?: string;
  criticality?: string;
  organizationUnitId?: string;
}

export class AssetService {
  async list(query: ListAssetsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.assetTypeId) {
      where.assetTypeId = query.assetTypeId;
    }

    if (query.lifecycleStatus) {
      where.lifecycleStatus = query.lifecycleStatus;
    }

    if (query.criticality) {
      where.criticality = query.criticality;
    }

    if (query.organizationUnitId) {
      where.organizationUnitId = query.organizationUnitId;
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assetType: true,
          organizationUnit: true,
          location: true,
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      data: assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        assetType: true,
        organizationUnit: true,
        location: true,
        sourceRelations: {
          include: { targetAsset: true },
        },
        targetRelations: {
          include: { sourceAsset: true },
        },
      },
    });

    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    return asset;
  }

  async create(data: CreateAssetData, createdBy?: string) {
    const displayId = `AST-${Date.now()}`;

    const asset = await prisma.asset.create({
      data: {
        ...data,
        displayId,
        createdBy,
      },
      include: {
        assetType: true,
        organizationUnit: true,
        location: true,
      },
    });

    // AST-030: Log initial lifecycle status
    if (data.lifecycleStatus) {
      await prisma.assetLifecycleLog.create({
        data: {
          assetId: asset.id,
          newStatus: data.lifecycleStatus,
          changedByUserId: createdBy,
          reason: 'Asset created',
        },
      });
    }

    return asset;
  }

  async update(id: string, data: UpdateAssetData, updatedBy?: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    // AST-030: Log lifecycle status changes
    const statusChanged = data.lifecycleStatus && data.lifecycleStatus !== existing.lifecycleStatus;

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
      include: {
        assetType: true,
        organizationUnit: true,
        location: true,
      },
    });

    if (statusChanged) {
      await prisma.assetLifecycleLog.create({
        data: {
          assetId: id,
          previousStatus: existing.lifecycleStatus,
          newStatus: data.lifecycleStatus!,
          changedByUserId: updatedBy,
        },
      });
    }

    return asset;
  }

  async delete(id: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    await prisma.asset.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async getRelations(assetId: string) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        sourceRelations: {
          include: { targetAsset: true },
        },
        targetRelations: {
          include: { sourceAsset: true },
        },
      },
    });

    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    return {
      sourceRelations: asset.sourceRelations,
      targetRelations: asset.targetRelations,
    };
  }

  async createRelation(assetId: string, relationData: {
    targetAssetId: string;
    relationshipType: string;
    description?: string;
  }) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Source asset not found', 404);
    }

    const target = await prisma.asset.findUnique({ where: { id: relationData.targetAssetId } });
    if (!target) {
      throw new AppError('Target asset not found', 404);
    }

    const relation = await prisma.assetRelation.create({
      data: {
        sourceAssetId: assetId,
        ...relationData,
      },
    });

    return relation;
  }

  async getAssetTypes() {
    return prisma.assetType.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  // AST-030: List lifecycle logs for an asset
  async getLifecycleLogs(assetId: string) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    return prisma.assetLifecycleLog.findMany({
      where: { assetId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // AST-032 + AST-034: Find assets without owner, without criticality rating, without audit status, or past end-of-life/support/sale dates
  async findIncompleteAssets() {
    const now = new Date();

    const [withoutOwner, withoutCriticality, withoutAuditStatus, endOfSupportPassed, endOfLifePassed, endOfSalePassed] = await Promise.all([
      // Assets missing business owner OR technical operator
      prisma.asset.findMany({
        where: {
          isArchived: false,
          OR: [
            { businessOwnerId: null },
            { technicalOperatorId: null },
          ],
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true,
          businessOwnerId: true, technicalOperatorId: true, criticality: true,
        },
      }),
      // Assets without criticality rating (still at default 'low' but never explicitly rated)
      prisma.asset.findMany({
        where: {
          isArchived: false,
          criticality: 'low', // In practice, you'd track whether it was explicitly set
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true, criticality: true,
        },
      }),
      // Assets without current audit status (no recent audit)
      prisma.asset.findMany({
        where: {
          isArchived: false,
          lastDetectedAt: null,
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true, dataSource: true,
        },
      }),
      // AST-034: Assets past end of support date (no longer supported by vendor)
      prisma.asset.findMany({
        where: {
          isArchived: false,
          endOfSupportDate: { lt: now },
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true,
          endOfSupportDate: true, criticality: true,
        },
      }),
      // AST-034: Assets past end of life date (should be decommissioned)
      prisma.asset.findMany({
        where: {
          isArchived: false,
          endOfLifeDate: { lt: now },
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true,
          endOfLifeDate: true, criticality: true, lifecycleStatus: true,
        },
      }),
      // AST-034: Assets past end of sale date (no longer available for purchase)
      prisma.asset.findMany({
        where: {
          isArchived: false,
          endOfSaleDate: { lt: now },
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true,
          endOfSaleDate: true, criticality: true,
        },
      }),
    ]);

    return {
      withoutOwner: withoutOwner.map(a => ({ ...a, issue: 'missing_owner' as const })),
      withoutCriticality: withoutCriticality.map(a => ({ ...a, issue: 'unrated_criticality' as const })),
      withoutAuditStatus: withoutAuditStatus.map(a => ({ ...a, issue: 'no_audit_status' as const })),
      // AST-034: Unmanaged asset reports for end-of-life/support/sale
      endOfSupportPassed: endOfSupportPassed.map(a => ({ ...a, issue: 'end_of_support_passed' as const })),
      endOfLifePassed: endOfLifePassed.map(a => ({ ...a, issue: 'end_of_life_passed' as const })),
      endOfSalePassed: endOfSalePassed.map(a => ({ ...a, issue: 'end_of_sale_passed' as const })),
    };
  }

  // AST-033: Responsibility confirmation workflow
  async confirmResponsibility(assetId: string, userId: string, role: 'owner' | 'operator' | 'security_responsible') {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    const updateData: any = {};
    let logReason = '';

    switch (role) {
      case 'owner':
        updateData.businessOwnerId = userId;
        logReason = `Business ownership confirmed by user ${userId}`;
        break;
      case 'operator':
        updateData.technicalOperatorId = userId;
        logReason = `Technical operatorship confirmed by user ${userId}`;
        break;
      case 'security_responsible':
        updateData.informationSecurityResponsibleId = userId;
        logReason = `Information security responsibility confirmed by user ${userId}`;
        break;
      default:
        throw new AppError('Invalid responsibility role', 400);
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: updateData,
    });

    // Log the confirmation
    await prisma.assetLifecycleLog.create({
      data: {
        assetId,
        newStatus: `responsibility_${role}_confirmed`,
        changedByUserId: userId,
        reason: logReason,
      },
    });

    return { success: true, role, userId };
  }
}

export const assetService = new AssetService();