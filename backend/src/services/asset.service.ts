import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { nextDisplayId } from './displayId.service';
import { recordCreateHistory, recordUpdateHistory, recordDeleteHistory, toHistoryData } from './entityHistory.service';

// Lifecycle status transitions allowed (AST-030)
const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  planned: ['ordered', 'in_stock'],
  ordered: ['planned', 'in_stock'],
  in_stock: ['ordered', 'active', 'maintenance'],
  active: ['maintenance', 'isolated'],
  maintenance: ['active', 'decommissioned'],
  isolated: ['active', 'decommissioned'],
  decommissioned: ['disposed', 'destroyed'],
  disposed: [],
  destroyed: [],
  lost: [],
  unknown: ['planned', 'ordered', 'in_stock', 'active'],
};

export interface CreateAssetData {
  name: string;
  description?: string;
  assetTypeId: string;
  assetSubtypeId?: string;
  inventoryNumber?: string;
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

  // Junction table relations (M:N) — arrays of IDs
  processIds?: string[];
  serviceIds?: string[];
  contractIds?: string[];
  licenseIds?: string[];

  // Contract/License info (AST-002) — legacy convenience fields
  licenseInfo?: string;
  contractEndsAt?: Date;
  licenseExpiresAt?: Date;

  // Extended rating dimensions (AST-004)
  personnelSafetyRelevance?: string;
  regulatoryRelevance?: string;
  financialDamagePotential?: string;
  productionDowntimeImpact?: string;

  lifecycleStatus?: string;

  // Dates
  purchaseDate?: Date;
  commissioningDate?: Date;
  endOfSaleDate?: Date;
  endOfLifeDate?: Date;
  endOfSupportDate?: Date;

  // CIA triad needs
  confidentialityNeed?: string;
  integrityNeed?: string;
  availabilityNeed?: string;

  dataProtectionRelevance?: boolean;
  criticality?: string;
  complianceRelevance?: boolean;

  // Network addresses (normalized) — replaces comma-separated string
  networkAddresses?: Array<{ address: string; type: string; primary?: boolean }>;

  dataSource?: string;
  lastDetectedAt?: Date;
}

export interface UpdateAssetData extends Partial<CreateAssetData> {}

export interface ListAssetsQuery {
  page?: string;
  limit?: string;
  search?: string;
  assetTypeId?: string;
  assetSubtypeId?: string;
  lifecycleStatus?: string;
  criticality?: string;
  organizationUnitId?: string;
  archived?: string | boolean; // true/"true" = include archived, default exclude
}

export class AssetService {
  private async resolveInventoryConfig(tx: any, assetTypeId: string, assetSubtypeId?: string) {
    const assetType = await tx.assetType.findUnique({ where: { id: assetTypeId } });
    if (!assetType) throw new AppError('Asset type not found', 404);
    if (!assetSubtypeId) return { assetType, subtype: null, enabled: assetType.inventoryEnabled, pattern: assetType.inventoryPattern, owner: 'type' as const };

    const subtype = await tx.assetSubtype.findUnique({ where: { id: assetSubtypeId } });
    if (!subtype || subtype.assetTypeId !== assetTypeId) throw new AppError('Asset subtype does not belong to selected asset type', 400);
    return {
      assetType,
      subtype,
      enabled: subtype.inventoryEnabled ?? assetType.inventoryEnabled,
      pattern: subtype.inventoryPattern ?? assetType.inventoryPattern,
      owner: subtype.inventoryEnabled !== null || subtype.inventoryPattern ? 'subtype' as const : 'type' as const,
    };
  }

  private formatInventoryNumber(pattern: string, sequence: number) {
    const marker = pattern.match(/#+/);
    if (!marker) throw new AppError('Inventory pattern must contain # placeholders, e.g. NB####', 400);
    return pattern.replace(marker[0], String(sequence).padStart(marker[0].length, '0'));
  }

  private async allocateInventoryNumber(tx: any, assetTypeId: string, assetSubtypeId?: string, manual?: string, currentAssetId?: string) {
    const config = await this.resolveInventoryConfig(tx, assetTypeId, assetSubtypeId);
    if (manual) {
      const existing = await tx.asset.findUnique({ where: { inventoryNumber: manual } });
      if (existing && existing.id !== currentAssetId) throw new AppError('Inventory number must be globally unique', 409);
      return manual;
    }
    if (!config.enabled) return undefined;
    if (!config.pattern) throw new AppError('Inventory generation requires an inventory pattern', 400);

    const model = config.owner === 'subtype' && config.subtype ? tx.assetSubtype : tx.assetType;
    const id = config.owner === 'subtype' && config.subtype ? config.subtype.id : config.assetType.id;
    let sequence = config.owner === 'subtype' && config.subtype ? config.subtype.inventoryNextSequence : config.assetType.inventoryNextSequence;
    for (let attempts = 0; attempts < 10000; attempts += 1) {
      const candidate = this.formatInventoryNumber(config.pattern, sequence);
      const exists = await tx.asset.findUnique({ where: { inventoryNumber: candidate } });
      sequence += 1;
      if (!exists) {
        await model.update({ where: { id }, data: { inventoryNextSequence: sequence } });
        return candidate;
      }
    }
    throw new AppError('Unable to allocate a free inventory number', 409);
  }
  // ==========================================
  // List / Read
  // ==========================================

  async list(query: ListAssetsQuery, authzWhere: Prisma.AssetWhereInput = {}) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {};

    // Exclude archived assets by default unless explicitly requested.
    // Use isArchived for compatibility with the generated Prisma client;
    // archivedAt is written on archive/restore and becomes queryable after client regeneration.
    if (query.archived !== true && query.archived !== 'true') {
      where.isArchived = false;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { displayId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.assetTypeId) {
      where.assetTypeId = query.assetTypeId;
    }

    if (query.assetSubtypeId) {
      (where as any).assetSubtypeId = query.assetSubtypeId;
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

    const effectiveWhere: Prisma.AssetWhereInput = Object.keys(authzWhere).length ? { AND: [where, authzWhere] } : where;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: effectiveWhere,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assetType: true,
          assetSubtype: true,
          organizationUnit: true,
          location: true,
          networkAddresses: true,
          processLinks: { include: { process: true } },
          serviceLinks: { include: { service: true } },
          contractLinks: { include: { contract: true } },
          licenseLinks: { include: { license: true } },
        } as any,
      }),
      prisma.asset.count({ where: effectiveWhere }),
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
        assetSubtype: true,
        organizationUnit: true,
        location: true,
        networkAddresses: true,
        sourceRelations: {
          include: { targetAsset: true },
        },
        targetRelations: {
          include: { sourceAsset: true },
        },
        processLinks: { include: { process: true } },
        serviceLinks: { include: { service: true } },
        contractLinks: { include: { contract: true } },
        licenseLinks: { include: { license: true } },
      } as any,
    });

    if (!asset) {
      throw new AppError('Asset not found', 404);
    }

    return asset;
  }

  // ==========================================
  // Create (with DisplayId, junction tables, network addresses)
  // ==========================================

  async create(data: CreateAssetData, createdBy?: string) {
    const asset = await prisma.$transaction(async (tx) => {
      // Generate sequential display ID (ASSET-0001, ASSET-0002, ...)
      const displayId = await nextDisplayId(tx, 'Asset');
      const inventoryNumber = await this.allocateInventoryNumber(tx, data.assetTypeId, data.assetSubtypeId, data.inventoryNumber);

      const { networkAddresses, processIds, serviceIds, contractIds, licenseIds, ...assetFields } = data;
      const assetData: any = {
        ...assetFields,
        displayId,
        inventoryNumber,
        createdBy,
        // Ensure new assets are active. archivedAt is included for the normalized schema;
        // any is used because local Prisma client generation can be stale on Windows file locks.
        isArchived: false,
        archivedAt: null,
      };

      const createdAsset = await tx.asset.create({
        data: assetData,
        include: {
          assetType: true,
          assetSubtype: true,
          organizationUnit: true,
          location: true,
        } as any,
      });

      // Create network addresses if provided
      if (data.networkAddresses && data.networkAddresses.length > 0) {
        await tx.networkAddress.createMany({
          data: data.networkAddresses.map((na) => ({
            assetId: createdAsset.id,
            address: na.address,
            type: na.type,
            primary: na.primary ?? false,
          })),
        });
      }

      // Create junction table entries for M:N relations
      if (data.processIds && data.processIds.length > 0) {
        await tx.assetProcess.createMany({
          data: data.processIds.map((processId) => ({
            assetId: createdAsset.id,
            processId,
          })),
        });
      }

      if (data.serviceIds && data.serviceIds.length > 0) {
        await tx.assetService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            assetId: createdAsset.id,
            serviceId,
          })),
        });
      }

      if (data.contractIds && data.contractIds.length > 0) {
        await tx.assetContract.createMany({
          data: data.contractIds.map((contractId) => ({
            assetId: createdAsset.id,
            contractId,
          })),
        });
      }

      if (data.licenseIds && data.licenseIds.length > 0) {
        await tx.assetLicense.createMany({
          data: data.licenseIds.map((licenseId) => ({
            assetId: createdAsset.id,
            licenseId,
          })),
        });
      }

      // AST-030: Log initial lifecycle status in transaction
      const lifecycleStatus = data.lifecycleStatus ?? 'planned';
      await tx.assetLifecycleLog.create({
        data: {
          assetId: createdAsset.id,
          newStatus: lifecycleStatus,
          changedByUserId: createdBy,
          reason: 'Asset created',
        },
      });

      return createdAsset;
    });

    // Audit log for asset creation (outside transaction to avoid lock issues)
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'ASSET_CREATE',
        entityType: 'Asset',
        entityId: asset.id,
        details: `Created asset: ${data.name} (${asset.displayId})`,
      });
    }

    // Record entity history
    await recordCreateHistory({
      entityType: 'Asset',
      entityId: asset.id,
      data: { name: data.name },
      actorId: createdBy,
    });

    return this.getById(asset.id);
  }

  // ==========================================
  // Update (with junction table sync, lifecycle logging)
  // ==========================================

  async update(id: string, data: UpdateAssetData, updatedBy?: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    // Cannot update archived assets (except unarchive — use restore method)
    if ((existing as any).archivedAt || existing.isArchived) {
      throw new AppError('Cannot modify archived asset. Restore it first.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Audit log for critical field changes
      if (updatedBy && (data.criticality !== undefined || data.lifecycleStatus !== undefined)) {
        await auditService.logEventStandalone(prisma, {
          userId: updatedBy,
          action: 'ASSET_UPDATE',
          entityType: 'Asset',
          entityId: id,
          details: `Updated asset: ${existing.name}`,
          oldValue: { criticality: existing.criticality, lifecycleStatus: existing.lifecycleStatus },
          newValue: {
            criticality: data.criticality ?? existing.criticality,
            lifecycleStatus: data.lifecycleStatus ?? existing.lifecycleStatus,
          },
        });
      }

      // AST-030: Log lifecycle status changes in transaction
      const statusChanged = data.lifecycleStatus && data.lifecycleStatus !== existing.lifecycleStatus;

      // Build update data without networkAddresses (handled separately)
      const { networkAddresses, processIds, serviceIds, contractIds, licenseIds, ...updateFields } = data;
      if (data.assetSubtypeId !== undefined || data.assetTypeId !== undefined || data.inventoryNumber !== undefined) {
        updateFields.inventoryNumber = await this.allocateInventoryNumber(
          tx,
          data.assetTypeId ?? existing.assetTypeId,
          data.assetSubtypeId ?? (existing as any).assetSubtypeId,
          data.inventoryNumber,
          id,
        );
      }
      const updateData: Prisma.AssetUpdateInput = {
        ...updateFields,
        updatedBy,
      };

      const updatedAsset = await tx.asset.update({
        where: { id },
        data: updateData,
        include: {
          assetType: true,
          assetSubtype: true,
          organizationUnit: true,
          location: true,
        } as any,
      });

      // Sync network addresses if provided (delete old, create new)
      if (networkAddresses !== undefined) {
        await tx.networkAddress.deleteMany({ where: { assetId: id } });
        if (networkAddresses.length > 0) {
          await tx.networkAddress.createMany({
            data: networkAddresses.map((na: any) => ({
              assetId: id,
              address: na.address,
              type: na.type,
              primary: na.primary ?? false,
            })),
          });
        }
      }

      // Sync junction table entries if provided (delete old, create new)
      if (processIds !== undefined) {
        await tx.assetProcess.deleteMany({ where: { assetId: id } });
        if (processIds.length > 0) {
          await tx.assetProcess.createMany({
            data: processIds.map((processId: string) => ({
              assetId: id,
              processId,
            })),
          });
        }
      }

      if (serviceIds !== undefined) {
        await tx.assetService.deleteMany({ where: { assetId: id } });
        if (serviceIds.length > 0) {
          await tx.assetService.createMany({
            data: serviceIds.map((serviceId: string) => ({
              assetId: id,
              serviceId,
            })),
          });
        }
      }

      if (contractIds !== undefined) {
        await tx.assetContract.deleteMany({ where: { assetId: id } });
        if (contractIds.length > 0) {
          await tx.assetContract.createMany({
            data: contractIds.map((contractId: string) => ({
              assetId: id,
              contractId,
            })),
          });
        }
      }

      if (licenseIds !== undefined) {
        await tx.assetLicense.deleteMany({ where: { assetId: id } });
        if (licenseIds.length > 0) {
          await tx.assetLicense.createMany({
            data: licenseIds.map((licenseId: string) => ({
              assetId: id,
              licenseId,
            })),
          });
        }
      }

      // Log lifecycle status change in transaction
      if (statusChanged) {
        await tx.assetLifecycleLog.create({
          data: {
            assetId: id,
            previousStatus: existing.lifecycleStatus,
            newStatus: data.lifecycleStatus!,
            changedByUserId: updatedBy,
          },
        });
      }

      return updatedAsset;
    });

    // Record entity history for update (status-like field is lifecycleStatus)
    await recordUpdateHistory({
      entityType: 'Asset',
      entityId: id,
      oldData: toHistoryData(existing as any),
      newData: toHistoryData(result as any),
      statusField: 'lifecycleStatus',
      actorId: updatedBy,
    });

    return this.getById(result.id);
  }

  // ==========================================
  // Archive (soft-delete) — Admin only
  // ==========================================

  async archive(id: string, archivedBy?: string, reason?: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    if ((existing as any).archivedAt || existing.isArchived) {
      throw new AppError('Asset is already archived', 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          lifecycleStatus: 'decommissioned', // Force lifecycle to decommissioned on archive
        } as any,
      });

      // Log lifecycle change in transaction
      if (existing.lifecycleStatus !== 'decommissioned') {
        await tx.assetLifecycleLog.create({
          data: {
            assetId: id,
            previousStatus: existing.lifecycleStatus,
            newStatus: 'decommissioned',
            changedByUserId: archivedBy,
            reason: `Archived${reason ? ': ' + reason : ''}`,
          },
        });
      }
    });

    // Audit log for archiving
    if (archivedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: archivedBy,
        action: 'ASSET_ARCHIVE',
        entityType: 'Asset',
        entityId: id,
        details: `Archived asset: ${existing.name} (${existing.displayId})${reason ? ': ' + reason : ''}`,
      });
    }

    // Record entity history for delete (archive)
    await recordDeleteHistory({
      entityType: 'Asset',
      entityId: id,
      actorId: archivedBy,
    });

    return { success: true, archivedAt: new Date() };
  }

  // ==========================================
  // Restore (un-archive) — Admin only
  // ==========================================

  async restore(id: string, restoredBy?: string, reason?: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    if (!(existing as any).archivedAt && !existing.isArchived) {
      throw new AppError('Asset is not archived', 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: {
          isArchived: false,
          archivedAt: null,
          lifecycleStatus: 'planned', // Reset to planned on restore
        } as any,
      });

      // Log lifecycle change in transaction
      await tx.assetLifecycleLog.create({
        data: {
          assetId: id,
          previousStatus: existing.lifecycleStatus,
          newStatus: 'planned',
          changedByUserId: restoredBy,
          reason: `Restored${reason ? ': ' + reason : ''}`,
        },
      });
    });

    // Audit log for restore
    if (restoredBy) {
      await auditService.logEventStandalone(prisma, {
        userId: restoredBy,
        action: 'ASSET_RESTORE',
        entityType: 'Asset',
        entityId: id,
        details: `Restored asset: ${existing.name} (${existing.displayId})${reason ? ': ' + reason : ''}`,
      });
    }

    return { success: true };
  }

  // ==========================================
  // Delete (legacy — delegates to archive)
  // ==========================================

  async delete(id: string, deletedBy?: string) {
    return this.archive(id, deletedBy);
  }

  // ==========================================
  // Lifecycle Transition (AST-030) — validates transitions in transaction
  // ==========================================

  async transitionLifecycle(
    id: string,
    newStatus: string,
    userId?: string,
    reason?: string,
  ) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    // Validate transition is allowed
    const allowedTransitions = LIFECYCLE_TRANSITIONS[existing.lifecycleStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new AppError(
        `Invalid lifecycle transition from '${existing.lifecycleStatus}' to '${newStatus}'. Allowed: ${allowedTransitions.join(', ')}`,
        409,
      );
    }

    await prisma.$transaction(async (tx) => {
      // Update asset status in transaction
      const updateData: any = {
        lifecycleStatus: newStatus,
        updatedBy: userId,
      };

      // If transitioning to disposed/destroyed, set disposal fields if provided
      if ((newStatus === 'disposed' || newStatus === 'destroyed') && reason) {
        updateData.disposalDate = new Date();
        updateData.disposalMethod = reason;
        updateData.disposalResponsible = userId ?? null;
      }

      await tx.asset.update({
        where: { id },
        data: updateData,
      });

      // Log lifecycle change in transaction
      await tx.assetLifecycleLog.create({
        data: {
          assetId: id,
          previousStatus: existing.lifecycleStatus,
          newStatus,
          changedByUserId: userId,
          reason,
        },
      });
    });

    // Audit log for lifecycle transition
    if (userId) {
      await auditService.logEventStandalone(prisma, {
        userId,
        action: 'ASSET_LIFECYCLE_TRANSITION',
        entityType: 'Asset',
        entityId: id,
        details: `Lifecycle transition: ${existing.lifecycleStatus} → ${newStatus}${reason ? ': ' + reason : ''}`,
        oldValue: { lifecycleStatus: existing.lifecycleStatus },
        newValue: { lifecycleStatus: newStatus },
      });
    }

    return this.getById(id);
  }

  // ==========================================
  // Disposal Proof (AST-031) — record disposal evidence
  // ==========================================

  async setDisposalProof(
    id: string,
    disposalDate: Date,
    disposalMethod: string,
    disposalResponsible: string,
    userId?: string,
  ) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Asset not found', 404);
    }

    // Only allow disposal proof on decommissioned/disposed/destroyed assets
    const allowedStatuses = ['decommissioned', 'disposed', 'destroyed'];
    if (!allowedStatuses.includes(existing.lifecycleStatus)) {
      throw new AppError(
        `Cannot set disposal proof for asset in status '${existing.lifecycleStatus}'. Must be decommissioned, disposed, or destroyed.`,
        409,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id },
        data: {
          disposalDate,
          disposalMethod,
          disposalResponsible,
          updatedBy: userId,
        },
      });

      // Log in lifecycle log with disposal evidence
      await tx.assetLifecycleLog.create({
        data: {
          assetId: id,
          previousStatus: existing.lifecycleStatus,
          newStatus: 'disposed',
          changedByUserId: userId,
          reason: `Disposal proof recorded: ${disposalMethod}`,
          disposalEvidence: JSON.stringify({
            disposalDate,
            disposalMethod,
            disposalResponsible,
          }),
        },
      });
    });

    // Audit log for disposal proof
    if (userId) {
      await auditService.logEventStandalone(prisma, {
        userId,
        action: 'ASSET_DISPOSAL_PROOF',
        entityType: 'Asset',
        entityId: id,
        details: `Disposal proof recorded for ${existing.name}: method=${disposalMethod}, responsible=${disposalResponsible}`,
      });
    }

    return this.getById(id);
  }

  // ==========================================
  // Relations
  // ==========================================

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

  // ==========================================
  // Asset Types
  // ==========================================

  async getAssetTypes() {
    return prisma.assetType.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
      include: { subtypes: { where: { isArchived: false }, orderBy: { name: 'asc' } } } as any,
    });
  }

  async createAssetSubtype(assetTypeId: string, data: { name: string; description?: string; inventoryEnabled?: boolean; inventoryPattern?: string }, createdBy?: string) {
    void createdBy;
    const type = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
    if (!type) throw new AppError('Asset type not found', 404);
    return (prisma as any).assetSubtype.create({
      data: { assetTypeId, name: data.name, description: data.description, inventoryEnabled: data.inventoryEnabled, inventoryPattern: data.inventoryPattern },
    });
  }

  async generateInventoryPreview(assetTypeId: string, assetSubtypeId?: string) {
    return prisma.$transaction(async (tx: any) => {
      const config = await this.resolveInventoryConfig(tx, assetTypeId, assetSubtypeId);
      if (!config.enabled || !config.pattern) return { enabled: false, nextInventoryNumber: null };
      const sequence = config.owner === 'subtype' && config.subtype ? config.subtype.inventoryNextSequence : config.assetType.inventoryNextSequence;
      return { enabled: true, pattern: config.pattern, nextInventoryNumber: this.formatInventoryNumber(config.pattern, sequence) };
    });
  }

  // ==========================================
  // Lifecycle Logs (AST-030)
  // ==========================================

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

  // ==========================================
  // Incomplete Assets (AST-032 + AST-034)
  // ==========================================

  async findIncompleteAssets() {
    const now = new Date();

    const [withoutOwner, withoutCriticality, withoutAuditStatus, endOfSupportPassed, endOfLifePassed, endOfSalePassed] = await Promise.all([
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
      prisma.asset.findMany({
        where: {
          isArchived: false,
          criticality: 'low',
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true, criticality: true,
        },
      }),
      prisma.asset.findMany({
        where: {
          isArchived: false,
          lastDetectedAt: null,
        },
        select: {
          id: true, name: true, displayId: true, assetTypeId: true, dataSource: true,
        },
      }),
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
      endOfSupportPassed: endOfSupportPassed.map(a => ({ ...a, issue: 'end_of_support_passed' as const })),
      endOfLifePassed: endOfLifePassed.map(a => ({ ...a, issue: 'end_of_life_passed' as const })),
      endOfSalePassed: endOfSalePassed.map(a => ({ ...a, issue: 'end_of_sale_passed' as const })),
    };
  }

  // ==========================================
  // Responsibility Confirmation (AST-033)
  // ==========================================

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
