import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { nextDisplayId } from './displayId.service';

type JsonObject = Record<string, unknown>;
const db = prisma as any;

export interface ImportAssetRecord {
  sourceRecordId: string;
  data: JsonObject & {
    name?: string;
    assetTypeId?: string;
    serialNumber?: string | null;
    externalId?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    description?: string | null;
    networkAddresses?: Array<{ address: string; type?: string; primary?: boolean }>;
  };
}

export interface ExecuteImportInput {
  integrationSourceId: string;
  dryRun?: boolean;
  records: ImportAssetRecord[];
  staleStrategy?: 'none' | 'mark';
}

interface ImportStatistics {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  skipped: number;
  stale: number;
  errors: number;
}

const IMPORTABLE_ASSET_FIELDS = [
  'name',
  'description',
  'assetTypeId',
  'subType',
  'manufacturer',
  'model',
  'serialNumber',
  'externalId',
  'organizationUnitId',
  'locationId',
  'technicalOperatorId',
  'businessOwnerId',
  'informationSecurityResponsibleId',
  'lifecycleStatus',
  'confidentialityNeed',
  'integrityNeed',
  'availabilityNeed',
  'dataProtectionRelevance',
  'criticality',
  'complianceRelevance',
] as const;

export class ImportService {
  async createSource(data: { name: string; type: string; config?: JsonObject; isActive?: boolean }, userId?: string) {
    const source = await db.integrationSource.create({
      data: {
        name: data.name,
        type: data.type,
        config: (data.config ?? {}) as any,
        isActive: data.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await auditService.logEventStandalone(prisma as any, {
      userId: userId ?? 'system',
      action: 'IMPORT_SOURCE_CREATE',
      entityType: 'IntegrationSource',
      entityId: source.id,
      newValue: source as any,
    });

    return source;
  }

  async updateSource(id: string, data: { name?: string; type?: string; config?: JsonObject; isActive?: boolean }, userId?: string) {
    const existing = await db.integrationSource.findUnique({ where: { id } });
    if (!existing) throw new AppError('Integration source not found', 404);

    const updated = await db.integrationSource.update({
      where: { id },
      data: { ...data, config: data.config as any, updatedBy: userId },
    });

    await auditService.logEventStandalone(prisma as any, {
      userId: userId ?? 'system',
      action: 'IMPORT_SOURCE_UPDATE',
      entityType: 'IntegrationSource',
      entityId: id,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return updated;
  }

  async listSources() {
    return db.integrationSource.findMany({ orderBy: { name: 'asc' } });
  }

  async listRuns(integrationSourceId?: string) {
    return db.importRun.findMany({
      where: integrationSourceId ? { integrationSourceId } : {},
      orderBy: { startedAt: 'desc' },
      include: { integrationSource: true },
    });
  }

  async getRun(id: string) {
    const run = await db.importRun.findUnique({
      where: { id },
      include: { integrationSource: true, records: true, conflicts: true },
    });
    if (!run) throw new AppError('Import run not found', 404);
    return run;
  }

  async execute(input: ExecuteImportInput, userId?: string) {
    const source = await db.integrationSource.findUnique({ where: { id: input.integrationSourceId } });
    if (!source) throw new AppError('Integration source not found', 404);
    if (!source.isActive) throw new AppError('Integration source is inactive', 409);

    const stats: ImportStatistics = { total: input.records.length, created: 0, updated: 0, unchanged: 0, conflicts: 0, skipped: 0, stale: 0, errors: 0 };

    return db.$transaction(async (tx: any) => {
      const run = await tx.importRun.create({
        data: {
          integrationSourceId: source.id,
          dryRun: input.dryRun ?? false,
          status: input.dryRun ? 'dry_run' : 'running',
          statistics: stats as any,
          createdBy: userId,
        },
      });

      await auditService.logEvent(tx, {
        userId: userId ?? 'system',
        action: input.dryRun ? 'IMPORT_DRY_RUN' : 'IMPORT_RUN_START',
        entityType: 'ImportRun',
        entityId: run.id,
        newValue: { integrationSourceId: source.id, total: input.records.length, dryRun: input.dryRun ?? false },
      });

      const seenAssetIds = new Set<string>();
      const results = [];

      for (const record of input.records) {
        const sourceHash = this.hash(record.data);
        const target = await this.findMatchingAsset(tx, record.data);
        if (target?.id) seenAssetIds.add(target.id);

        const locks = target?.id ? await this.getActiveLocks(tx, target.id) : new Set<string>();
        const { updates, conflicts, unchanged } = target
          ? await this.evaluateUpdate(tx, source.id, target, record.data, locks)
          : { updates: this.pickImportableFields(record.data), conflicts: [], unchanged: false };

        let status = 'unchanged';
        let action = 'none';
        let assetId = target?.id;

        if (conflicts.length > 0) {
          status = 'conflict';
          action = 'conflict';
          stats.conflicts += conflicts.length;
        } else if (!target) {
          status = 'created';
          action = 'create';
          stats.created += 1;
        } else if (unchanged || Object.keys(updates).length === 0) {
          status = 'unchanged';
          action = 'none';
          stats.unchanged += 1;
        } else {
          status = 'updated';
          action = 'update';
          stats.updated += 1;
        }

        if (!input.dryRun && status === 'created') {
          const displayId = await nextDisplayId(tx, 'Asset');
          const created = await tx.asset.create({
            data: {
              ...updates,
              displayId,
              name: updates.name ?? record.data.name ?? `Imported ${record.sourceRecordId}`,
              assetTypeId: updates.assetTypeId ?? record.data.assetTypeId,
              dataSource: source.name,
              lastDetectedAt: new Date(),
              createdBy: userId,
              updatedBy: userId,
              isArchived: false,
              archivedAt: null,
            },
          });
          assetId = created.id;
          seenAssetIds.add(created.id);
          await this.syncNetworkAddresses(tx, created.id, record.data.networkAddresses);
          await this.writeProvenance(tx, created.id, source.id, run.id, record.sourceRecordId, updates, userId);
        }

        if (!input.dryRun && target && status === 'updated') {
          await tx.asset.update({
            where: { id: target.id },
            data: { ...updates, dataSource: source.name, lastDetectedAt: new Date(), updatedBy: userId },
          });
          await this.syncNetworkAddresses(tx, target.id, record.data.networkAddresses);
          await this.writeProvenance(tx, target.id, source.id, run.id, record.sourceRecordId, updates, userId);
        }

        const importRecord = await tx.importRecord.create({
          data: {
            importRunId: run.id,
            sourceRecordId: record.sourceRecordId,
            sourceHash,
            sourceData: record.data as any,
            targetAssetId: assetId,
            status,
            action,
            message: conflicts.length ? 'Conflicts require manual resolution' : undefined,
          },
        });

        for (const conflict of conflicts) {
          await tx.importConflict.create({
            data: { ...conflict, importRunId: run.id, importRecordId: importRecord.id, assetId } as any,
          });
        }

        results.push({ sourceRecordId: record.sourceRecordId, targetAssetId: assetId, status, action, conflicts, updates });
      }

      if (!input.dryRun && input.staleStrategy === 'mark') {
        const stale = await tx.asset.updateMany({
          where: { dataSource: source.name, id: { notIn: Array.from(seenAssetIds) }, isArchived: false },
          data: { status: 'stale', updatedBy: userId },
        });
        stats.stale = stale.count ?? 0;
      }

      const finalStatus = input.dryRun ? 'dry_run' : stats.conflicts > 0 ? 'completed_with_conflicts' : 'completed';
      const completed = await tx.importRun.update({
        where: { id: run.id },
        data: { status: finalStatus, endedAt: new Date(), statistics: stats as any },
      });

      await auditService.logEvent(tx, {
        userId: userId ?? 'system',
        action: 'IMPORT_RUN_COMPLETE',
        entityType: 'ImportRun',
        entityId: run.id,
        newValue: { status: finalStatus, statistics: stats as any },
      });

      return { run: completed, statistics: stats, records: results };
    });
  }

  async lockField(assetId: string, fieldName: string, lockedBy: string, reason?: string) {
    const lock = await db.fieldLock.upsert({
      where: { assetId_fieldName: { assetId, fieldName } },
      update: { isActive: true, reason, lockedBy, lockedAt: new Date() },
      create: { assetId, fieldName, reason, lockedBy, isActive: true },
    });
    await auditService.logEventStandalone(prisma as any, { userId: lockedBy, action: 'IMPORT_FIELD_LOCK', entityType: 'FieldLock', entityId: lock.id, newValue: lock as any });
    return lock;
  }

  async unlockField(assetId: string, fieldName: string, userId: string) {
    const lock = await db.fieldLock.update({
      where: { assetId_fieldName: { assetId, fieldName } },
      data: { isActive: false },
    });
    await auditService.logEventStandalone(prisma as any, { userId, action: 'IMPORT_FIELD_UNLOCK', entityType: 'FieldLock', entityId: lock.id, newValue: lock as any });
    return lock;
  }

  async setSourcePriority(integrationSourceId: string, fieldName: string, priority: number) {
    return db.sourcePriority.upsert({
      where: { integrationSourceId_fieldName: { integrationSourceId, fieldName } },
      update: { priority },
      create: { integrationSourceId, fieldName, priority },
    });
  }

  async resolveConflict(id: string, resolution: string, resolvedBy: string) {
    const conflict = await db.importConflict.update({
      where: { id },
      data: { status: 'resolved', resolution, resolvedBy, resolvedAt: new Date() },
    });
    await auditService.logEventStandalone(prisma as any, { userId: resolvedBy, action: 'IMPORT_CONFLICT_RESOLVE', entityType: 'ImportConflict', entityId: id, newValue: conflict as any });
    return conflict;
  }

  private async findMatchingAsset(tx: any, data: ImportAssetRecord['data']) {
    if (data.serialNumber) {
      const bySerial = await tx.asset.findFirst({ where: { serialNumber: data.serialNumber, isArchived: false } });
      if (bySerial) return bySerial;
    }
    if (data.externalId) {
      const byExternal = await tx.asset.findFirst({ where: { externalId: data.externalId, isArchived: false } });
      if (byExternal) return byExternal;
    }
    const mac = data.networkAddresses?.find((entry) => entry.type === 'mac')?.address;
    if (mac) {
      const address = await tx.networkAddress.findFirst({ where: { address: mac }, include: { asset: true } });
      return address?.asset ?? null;
    }
    return null;
  }

  private async getActiveLocks(tx: any, assetId: string) {
    const locks = await tx.fieldLock.findMany({ where: { assetId, isActive: true } });
    return new Set<string>(locks.map((lock: any) => lock.fieldName));
  }

  private async evaluateUpdate(tx: any, sourceId: string, target: any, data: JsonObject, locks: Set<string>) {
    const updates: JsonObject = {};
    const conflicts: JsonObject[] = [];
    const incoming = this.pickImportableFields(data);

    for (const [fieldName, incomingValue] of Object.entries(incoming)) {
      if (locks.has(fieldName)) continue;
      const existingValue = target[fieldName];
      if (this.equal(existingValue, incomingValue)) continue;

      const winner = await this.chooseWinner(tx, target.id, fieldName, sourceId, existingValue, incomingValue);
      if (winner === 'incoming') updates[fieldName] = incomingValue;
      if (winner === 'conflict') conflicts.push({ fieldName, existingValue, incomingValue, winningValue: null, status: 'open' });
    }

    return { updates, conflicts, unchanged: Object.keys(updates).length === 0 && conflicts.length === 0 };
  }

  private async chooseWinner(tx: any, assetId: string, fieldName: string, incomingSourceId: string, existingValue: unknown, incomingValue: unknown) {
    const provenance = await tx.fieldProvenance.findUnique({ where: { assetId_fieldName: { assetId, fieldName } } });
    if (!provenance) return 'conflict';
    const priorities = await tx.sourcePriority.findMany({ where: { fieldName, integrationSourceId: { in: [incomingSourceId, provenance.integrationSourceId] } } });
    const priorityOf = (sourceId: string) => priorities.find((p: any) => p.integrationSourceId === sourceId)?.priority ?? 100;
    const incomingPriority = priorityOf(incomingSourceId);
    const existingPriority = priorityOf(provenance.integrationSourceId);
    if (incomingPriority < existingPriority) return 'incoming';
    if (incomingPriority > existingPriority) return 'existing';
    return this.equal(existingValue, incomingValue) ? 'existing' : 'conflict';
  }

  private pickImportableFields(data: JsonObject) {
    return IMPORTABLE_ASSET_FIELDS.reduce((result, fieldName) => {
      if (Object.prototype.hasOwnProperty.call(data, fieldName) && data[fieldName] !== undefined) result[fieldName] = data[fieldName];
      return result;
    }, {} as JsonObject);
  }

  private async writeProvenance(tx: any, assetId: string, integrationSourceId: string, importRunId: string, sourceRecordId: string, updates: JsonObject, setBy?: string) {
    for (const [fieldName, value] of Object.entries(updates)) {
      await tx.fieldProvenance.upsert({
        where: { assetId_fieldName: { assetId, fieldName } },
        update: { integrationSourceId, importRunId, sourceRecordId, value: value as any, setAt: new Date(), setBy },
        create: { assetId, fieldName, integrationSourceId, importRunId, sourceRecordId, value: value as any, setBy },
      });
    }
  }

  private async syncNetworkAddresses(tx: any, assetId: string, addresses?: ImportAssetRecord['data']['networkAddresses']) {
    if (!addresses) return;
    await tx.networkAddress.deleteMany({ where: { assetId } });
    if (addresses.length === 0) return;
    await tx.networkAddress.createMany({ data: addresses.map((entry) => ({ assetId, address: entry.address, type: entry.type ?? 'ipv4', primary: entry.primary ?? false })) });
  }

  private hash(data: unknown) {
    return crypto.createHash('sha256').update(JSON.stringify(data, Object.keys(data as any).sort())).digest('hex');
  }

  private equal(left: unknown, right: unknown) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
}

export const importService = new ImportService();
