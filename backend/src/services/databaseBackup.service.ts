import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export const PORTABLE_BACKUP_FORMAT = 'asset-management-portable-json-v1' as const;

export interface PortableBackupPayload {
  format: typeof PORTABLE_BACKUP_FORMAT;
  exportedAt: string;
  sourceProvider: string;
  schemaModels: string[];
  tables: Record<string, unknown[]>;
  metadata: {
    rowCounts: Record<string, number>;
    checksum: string;
  };
}

function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getModelNames(): string[] {
  const models = ((Prisma as any).dmmf?.datamodel?.models ?? []) as Array<{ name: string }>;
  return models.map((model) => model.name);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === 'object' && !Array.isArray(current) && !(current instanceof Date)) {
      return Object.keys(current).sort().reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (current as Record<string, unknown>)[key];
        return acc;
      }, {});
    }
    return current;
  });
}

function checksumPayload(payload: Omit<PortableBackupPayload, 'metadata'> & { metadata: { rowCounts: Record<string, number> } }): string {
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

const SECRET_FIELD_NAMES = new Set([
  'passwordHash',
  'mfaSecret',
  'mfaPendingSecret',
  'clientSecret',
  'clientSecretRef',
  'encryptedPassword',
  'accessTokenHash',
  'accessTokenSalt',
  'secret',
]);

function redactRowSecrets(row: unknown): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row) || row instanceof Date) return row;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    copy[key] = SECRET_FIELD_NAMES.has(key) ? null : value;
  }
  return copy;
}

export class DatabaseBackupService {
  constructor(private readonly db: any = prisma) {}

  async exportPortable(userId = 'system', provider = process.env.DB_PROVIDER ?? 'postgresql'): Promise<PortableBackupPayload> {
    const modelNames = getModelNames();
    const tables: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};

    for (const modelName of modelNames) {
      const delegate = this.db[delegateName(modelName)];
      if (!delegate?.findMany) continue;
      const rows = (await delegate.findMany()).map(redactRowSecrets);
      tables[modelName] = rows;
      rowCounts[modelName] = rows.length;
    }

    const basePayload = {
      format: PORTABLE_BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      sourceProvider: provider,
      schemaModels: Object.keys(tables),
      tables,
      metadata: { rowCounts },
    };

    const payload: PortableBackupPayload = {
      ...basePayload,
      metadata: { ...basePayload.metadata, checksum: checksumPayload(basePayload) },
    };

    await auditService.logEventStandalone(this.db, {
      userId,
      action: 'DATABASE_PORTABLE_EXPORT',
      entityType: 'DatabaseBackup',
      entityId: payload.metadata.checksum,
      details: `Portable database export with ${Object.keys(tables).length} models`,
      newValue: { format: payload.format, rowCounts: payload.metadata.rowCounts, checksum: payload.metadata.checksum } as any,
    });

    return payload;
  }

  async importPortable(payload: PortableBackupPayload, options: { mode?: 'replace' | 'append'; dryRun?: boolean; userId?: string } = {}) {
    if (!payload || payload.format !== PORTABLE_BACKUP_FORMAT) {
      throw new AppError('Unsupported database backup format', 400);
    }

    const { checksum, ...metadataWithoutChecksum } = payload.metadata;
    const expectedChecksum = checksumPayload({ ...payload, metadata: metadataWithoutChecksum });
    if (checksum !== expectedChecksum) {
      throw new AppError('Backup checksum verification failed', 400);
    }

    const mode = options.mode ?? 'replace';
    const modelNames = payload.schemaModels.filter((modelName) => Array.isArray(payload.tables[modelName]));
    const rowCounts: Record<string, number> = {};

    for (const modelName of modelNames) {
      rowCounts[modelName] = payload.tables[modelName].length;
    }

    if (!options.dryRun) {
      await this.db.$transaction(async (tx: any) => {
        if (mode === 'replace') {
          for (const modelName of [...modelNames].reverse()) {
            const delegate = tx[delegateName(modelName)];
            if (delegate?.deleteMany) await delegate.deleteMany({});
          }
        }

        for (const modelName of modelNames) {
          const rows = payload.tables[modelName];
          if (!rows.length) continue;
          const delegate = tx[delegateName(modelName)];
          if (!delegate?.createMany) continue;
          await delegate.createMany({ data: rows, skipDuplicates: true });
        }
      });
    }

    await auditService.logEventStandalone(this.db, {
      userId: options.userId ?? 'system',
      action: options.dryRun ? 'DATABASE_PORTABLE_IMPORT_DRY_RUN' : 'DATABASE_PORTABLE_IMPORT',
      entityType: 'DatabaseBackup',
      entityId: payload.metadata.checksum,
      details: `Portable database import ${options.dryRun ? 'validated' : 'completed'} in ${mode} mode`,
      newValue: { format: payload.format, mode, dryRun: !!options.dryRun, rowCounts } as any,
    });

    return { format: payload.format, mode, dryRun: !!options.dryRun, rowCounts, checksum: payload.metadata.checksum };
  }
}

export const databaseBackupService = new DatabaseBackupService();
