import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockAdminService = {
  createRole: jest.fn(),
  updateRole: jest.fn(),
};

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'admin-actor-id';
    next();
  },
}));

jest.mock('../middleware/entityAuth', () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/admin.service', () => ({ adminService: mockAdminService }));
jest.mock('../services/reminder.service', () => ({ reminderService: {} }));
jest.mock('../services/reminder.scheduler', () => ({ getReminderScheduler: jest.fn() }));
jest.mock('../services/fiscalYear.service', () => ({ fiscalYearService: {} }));
jest.mock('../config/database', () => ({ prisma: {}, getSafeDatabaseConfig: jest.fn() }));
jest.mock('../services/audit.service', () => ({ auditService: {}, AuditService: {} }));
jest.mock('../services/auditIntegrity.service', () => ({ auditIntegrityService: {} }));
jest.mock('../services/databaseBackup.service', () => ({ databaseBackupService: {} }));

import { adminRouter } from '../routes/admin.routes';

const app = express();
app.use(express.json());
app.use(adminRouter);

describe('admin role audit actor propagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the authenticated actor ID to createRole', async () => {
    const payload = { name: 'audit-role', permissionNames: ['assets.read'] };
    mockAdminService.createRole.mockResolvedValue({ id: 'role-1', ...payload } as never);

    await request(app).post('/roles').send(payload).expect(201);

    expect(mockAdminService.createRole).toHaveBeenCalledWith(payload, 'admin-actor-id');
  });

  it('passes the authenticated actor ID to updateRole', async () => {
    const payload = { description: 'Updated role' };
    mockAdminService.updateRole.mockResolvedValue({ id: 'role-1', ...payload } as never);

    await request(app).put('/roles/role-1').send(payload).expect(200);

    expect(mockAdminService.updateRole).toHaveBeenCalledWith('role-1', payload, 'admin-actor-id');
  });
});
