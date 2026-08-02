const auditCreate = jest.fn();

jest.mock('../services/audit.service', () => ({
  auditService: { logEventStandalone: jest.fn(async (_db: any, event: any) => auditCreate(event)) },
}));

jest.mock('@prisma/client', () => ({
  Prisma: {
    dmmf: {
      datamodel: {
        models: [{ name: 'User' }, { name: 'Role' }],
      },
    },
  },
}));

jest.mock('../config/database', () => ({ prisma: {} }));

import { DatabaseBackupService, PORTABLE_BACKUP_FORMAT } from '../services/databaseBackup.service';

describe('DatabaseBackupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports portable JSON without configuration secrets', async () => {
    const db: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'a@example.com', passwordHash: 'hash-secret', mfaSecret: 'totp-secret' }]) },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'system_admin' }]) },
    };

    const payload = await new DatabaseBackupService(db).exportPortable('admin', 'postgresql');

    expect(payload.format).toBe(PORTABLE_BACKUP_FORMAT);
    expect(payload.tables.User).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(payload)).not.toContain('password=');
    expect(JSON.stringify(payload)).not.toContain('hash-secret');
    expect(JSON.stringify(payload)).not.toContain('totp-secret');
    expect(payload.metadata.checksum).toHaveLength(64);
  });

  it('validates and imports portable JSON in replace mode', async () => {
    const tx: any = {
      user: { deleteMany: jest.fn(), createMany: jest.fn() },
      role: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const db: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]) },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'r1' }]) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const service = new DatabaseBackupService(db);
    const payload = await service.exportPortable('admin', 'postgresql');
    const result = await service.importPortable(payload, { userId: 'admin' });

    expect(result.rowCounts).toEqual({ User: 1, Role: 1 });
    expect(tx.role.deleteMany).toHaveBeenCalled();
    expect(tx.user.createMany).toHaveBeenCalledWith({ data: [{ id: 'u1' }], skipDuplicates: true });
  });

  it('rejects tampered backups', async () => {
    const db: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]) },
      role: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new DatabaseBackupService(db);
    const payload = await service.exportPortable('admin', 'postgresql');
    (payload.tables.User as any[]).push({ id: 'u2' });

    await expect(service.importPortable(payload)).rejects.toThrow('Backup checksum verification failed');
  });
});
