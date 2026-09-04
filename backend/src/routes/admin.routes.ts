import { NextFunction, Response, Router } from 'express';
import fs from 'fs/promises';
import os from 'os';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { adminService } from '../services/admin.service';
import { reminderService } from '../services/reminder.service';
import { getReminderScheduler } from '../services/reminder.scheduler';
import { emailGatewayService } from '../services/emailGateway.service';
import { getEmailGatewayScheduler } from '../services/emailGateway.scheduler';
import { fiscalYearService } from '../services/fiscalYear.service';
import { prisma } from '../config/database';
import { getSafeDatabaseConfig } from '../config/database';
import { auditService, AuditService } from '../services/audit.service';
import { auditIntegrityService } from '../services/auditIntegrity.service';
import { databaseBackupService, PortableBackupPayload } from '../services/databaseBackup.service';
import { ticketService } from '../services/ticket.service';

export const adminRouter = Router();

// Backups are streamed to a file on disk (not held in memory) to avoid DoS
// via memory exhaustion from large uploads. A 50 MB cap is generous for the
// JSON portable-backup format while keeping the exposure bounded.
const BACKUP_MAX_FILE_SIZE = Number(process.env.BACKUP_MAX_FILE_SIZE_MB || 50) * 1024 * 1024;
const uploadBackup = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, _file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `backup-import-${unique}.json`);
    },
  }),
  limits: { fileSize: BACKUP_MAX_FILE_SIZE },
});

adminRouter.get('/database/config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(getSafeDatabaseConfig());
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/database/export', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const payload = await databaseBackupService.exportPortable(req.userId ?? 'system');
    const fileName = `asset-management-portable-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/database/import', authenticate, requireAdminAccess, uploadBackup.single('backup'), async (req: AuthRequest, res, next) => {
  const uploadedPath: string | undefined = req.file?.path;
  try {
    let rawPayload: string;
    if (uploadedPath) {
      // Read from the temp file on disk (bounded by the multer size limit).
      rawPayload = await fs.readFile(uploadedPath, 'utf8');
    } else {
      rawPayload = JSON.stringify(req.body?.backup ?? req.body);
    }
    const payload = JSON.parse(rawPayload) as PortableBackupPayload;
    const result = await databaseBackupService.importPortable(payload, {
      mode: req.query.mode === 'append' || req.body?.mode === 'append' ? 'append' : 'replace',
      dryRun: req.query.dryRun === 'true' || req.body?.dryRun === true || req.body?.dryRun === 'true',
      userId: req.userId ?? 'system',
    });
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    // Ensure cleanup of the uploaded temp file, regardless of outcome.
    // Using async/await instead of fire-and-forget to ensure the file is
    // cleaned up even if an error occurred, and to avoid unhandled rejection warnings.
    if (uploadedPath) {
      try {
        await fs.unlink(uploadedPath);
      } catch {
        // Ignore cleanup errors — the OS will eventually reclaim the temp file.
      }
    }
  }
});

adminRouter.get('/auth-settings', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await adminService.getAuthSettings());
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/auth-settings', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await adminService.updateAuthSettings(req.body, req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/ticket-types', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await ticketService.listTypeConfigs());
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/ticket-types/:type', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await ticketService.updateTypeConfig(req.params.type, req.body, req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/fiscal-year-config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const years = await fiscalYearService.listSelectableYears();
    res.json({ config: years.config, current: years.current, next: years.next });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/fiscal-year-config', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const before = await fiscalYearService.getConfig();
    const config = await fiscalYearService.updateConfig(req.body, req.userId);
    await auditService.logEventStandalone(prisma as any, {
      userId: req.userId ?? 'system',
      action: 'CONFIG_CHANGE',
      entityType: 'FiscalYearConfig',
      entityId: config.id,
      details: 'Fiscal-year configuration changed',
      oldValue: { startMonth: before.startMonth, startDay: before.startDay, timezone: before.timezone },
      newValue: { startMonth: config.startMonth, startDay: config.startDay, timezone: config.timezone },
      ...AuditService.extractRequestInfo(req),
    });
    const years = await fiscalYearService.listSelectableYears();
    res.json({ config, current: years.current, next: years.next });
  } catch (error) {
    next(error);
  }
});

// ---- Reminder Automation / SMTP Settings ----

adminRouter.get('/reminders/config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await reminderService.getConfig());
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/reminders/config', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const config = await reminderService.updateConfig(req.body, req.userId ?? 'system');
    await getReminderScheduler()?.restart();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/reminders/test-smtp', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await reminderService.testSmtp(req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/reminders/run-now', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await reminderService.runAllDue(req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/reminders/logs', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    res.json(await reminderService.listLogs(Number(req.query.limit ?? 50)));
  } catch (error) {
    next(error);
  }
});

// ---- Ticket E-mail Gateway (IMAP / Exchange OAuth2 / SMTP) ----

adminRouter.get('/email-gateway/config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await emailGatewayService.getConfig());
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/email-gateway/config', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const config = await emailGatewayService.updateConfig(req.body, req.userId ?? 'system');
    await getEmailGatewayScheduler()?.restart();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/email-gateway/test-inbound', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await emailGatewayService.testInbound());
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/email-gateway/test-smtp', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await emailGatewayService.testSmtp());
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/email-gateway/poll-now', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await emailGatewayService.pollInbound(req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/email-gateway/status', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await emailGatewayService.lastPollStatus());
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/email-gateway/messages', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    res.json(await emailGatewayService.listMessages(Number(req.query.limit ?? 50)));
  } catch (error) {
    next(error);
  }
});


// ---- User Management ----

adminRouter.get('/users', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const users = await adminService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.json(user);
    }
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.createUser(req.body, req.userId!);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.userId!);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:id/change-password', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    await adminService.changePassword(req.params.id, req.body.newPassword, req.userId!);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:id/mfa/reset', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await adminService.resetMfa(req.params.id, req.userId!));
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:id/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const user = await adminService.assignRoles(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ---- Role Management ----

adminRouter.get('/roles', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const roles = await adminService.getAvailableRoles();
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/roles/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    res.json(await adminService.getRoleById(req.params.id));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const role = await adminService.createRole(req.body, req.userId);
    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/roles/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const role = await adminService.updateRole(req.params.id, req.body, req.userId);
    res.json(role);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/roles/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteRole(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---- Group Management ----

adminRouter.get('/groups', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const groups = await adminService.listGroups();
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/groups', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const group = await adminService.createGroup(req.body);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const group = await adminService.updateGroup(req.params.id, req.body);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/groups/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteGroup(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id/users', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    await adminService.assignUsersToGroup(req.params.id, req.body);
    res.json({ message: 'Users assigned to group successfully' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/groups/:id/roles', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    // `roles` is canonical; accept the historical `roleIds` payload during
    // client rollout without weakening the route's authorization contract.
    const roles = req.body?.roles ?? req.body?.roleIds;
    await adminService.assignRolesToGroup(req.params.id, { roles });
    res.json({ message: 'Roles assigned to group successfully' });
  } catch (error) {
    next(error);
  }
});

// ---- OIDC Configuration ----

adminRouter.get('/oidc/config', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const config = await adminService.getOidcConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/oidc/config', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const config = await adminService.updateOidcConfig(req.body);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ---- Asset Type Management ----

adminRouter.get('/asset-types', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const types = await adminService.listAssetTypes();
    res.json(types);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/asset-types', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.createAssetType(req.body);
    res.status(201).json(type);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/asset-types/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.updateAssetType(req.params.id, req.body);
    res.json(type);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/asset-types/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteAssetType(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/asset-types/:id/archive', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const type = await adminService.archiveAssetType(req.params.id);
    res.json(type);
  } catch (error) {
    next(error);
  }
});

// ---- Business Process Management (RSK-010) ----

adminRouter.get('/business-processes', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const processes = await adminService.listBusinessProcesses();
    res.json(processes);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/business-processes/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const process = await adminService.getBusinessProcessById(req.params.id);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/business-processes', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const process = await adminService.createBusinessProcess(req.body);
    res.status(201).json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/business-processes/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const process = await adminService.updateBusinessProcess(req.params.id, req.body);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/business-processes/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.deleteBusinessProcess(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---- Organization Unit Management ----

adminRouter.get('/organization-units', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const units = await adminService.listOrganizationUnits(includeArchived);
    res.json(units);
  } catch (error) {
    next(error);
  }
});

// Picker/search endpoint must be registered before /organization-units/:id.
adminRouter.get('/organization-units/search', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(Number(req.query.limit ?? 50), 50) || 50;
    const units = await adminService.searchOrganizationUnits(q, limit);
    res.json({ data: units.map((u) => ({ id: u.id, label: u.name, name: u.name })) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/organization-units/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const unit = await adminService.getOrganizationUnitById(req.params.id);
    res.json(unit);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/organization-units', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const unit = await adminService.createOrganizationUnit(req.body, req.userId!);
    res.status(201).json(unit);
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/organization-units/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const unit = await adminService.updateOrganizationUnit(req.params.id, req.body, req.userId!);
    res.json(unit);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/organization-units/:id/archive', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.archiveOrganizationUnit(req.params.id, req.userId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/organization-units/:id/restore', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await adminService.restoreOrganizationUnit(req.params.id, req.userId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---- Audit Log Integrity Check (Phase 9) ----

/**
 * GET /admin/audit-integrity?fromSequence=0
 * Returns hash-chain integrity status without leaking secrets.
 */
adminRouter.get('/audit-integrity', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const fromSeq = Number(req.query.fromSequence ?? 1);
    const result = await auditIntegrityService.verify(prisma, { fromSequence: isNaN(fromSeq) ? 1 : fromSeq });
    // Only return safe fields — no hashes or raw data
    res.json({
      valid: result.valid,
      totalEntries: result.totalEntries,
      lastVerifiedSequence: result.lastVerifiedSequence,
      details: result.details ?? undefined,
    });
  } catch (error) {
    next(error);
  }
});
