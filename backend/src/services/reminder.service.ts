import crypto from 'crypto';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { PHASE6_MODEL_MAP } from './phase6.resources';

type AnyObject = Record<string, any>;

export interface ReminderConfigUpdate {
  enabled?: boolean;
  intervalMinutes?: number;
  lookAheadDays?: number;
  reminderFromEmail?: string | null;
  reminderSubjectPrefix?: string;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpRejectUnauthorized?: boolean;
}

const PASSWORD_PLACEHOLDERS = new Set(['', '********', '••••••••', '__KEEP_EXISTING__']);
const CLOSED_STATUSES = ['completed', 'closed', 'cancelled', 'approved'];

export class ReminderService {
  private sanitizeConfig(config: AnyObject | null) {
    if (!config) return null;
    const { smtpPassword: _smtpPassword, ...safe } = config;
    return {
      ...safe,
      smtpPasswordConfigured: Boolean(config.smtpPassword),
    };
  }

  private async ensureConfig() {
    const existing = await (prisma as any).reminderConfig.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return (prisma as any).reminderConfig.create({ data: { enabled: false, intervalMinutes: 1440, lookAheadDays: 0 } });
  }

  async getConfig() {
    return this.sanitizeConfig(await this.ensureConfig());
  }

  async updateConfig(data: ReminderConfigUpdate, userId = 'system') {
    const existing = await this.ensureConfig();
    const updateData: AnyObject = {};
    if (data.enabled !== undefined) updateData.enabled = Boolean(data.enabled);
    if (data.intervalMinutes !== undefined) {
      const interval = Number(data.intervalMinutes);
      if (!Number.isInteger(interval) || interval < 5 || interval > 10080) throw new AppError('Interval must be between 5 and 10080 minutes', 400);
      updateData.intervalMinutes = interval;
      updateData.nextRunAt = new Date(Date.now() + interval * 60 * 1000);
    }
    if (data.lookAheadDays !== undefined) {
      const days = Number(data.lookAheadDays);
      if (!Number.isInteger(days) || days < 0 || days > 365) throw new AppError('Look-ahead must be between 0 and 365 days', 400);
      updateData.lookAheadDays = days;
    }
    if (data.reminderFromEmail !== undefined) updateData.reminderFromEmail = data.reminderFromEmail || null;
    if (data.reminderSubjectPrefix !== undefined) updateData.reminderSubjectPrefix = data.reminderSubjectPrefix || '[ISMS Reminder]';
    if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost || null;
    if (data.smtpPort !== undefined) {
      const port = Number(data.smtpPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AppError('SMTP port must be between 1 and 65535', 400);
      updateData.smtpPort = port;
    }
    if (data.smtpSecure !== undefined) updateData.smtpSecure = Boolean(data.smtpSecure);
    if (data.smtpUser !== undefined) updateData.smtpUser = data.smtpUser || null;
    if (data.smtpPassword !== undefined && !PASSWORD_PLACEHOLDERS.has(String(data.smtpPassword))) updateData.smtpPassword = data.smtpPassword;
    if (data.smtpRejectUnauthorized !== undefined) updateData.smtpRejectUnauthorized = Boolean(data.smtpRejectUnauthorized);
    updateData.updatedBy = userId;

    const updated = await (prisma as any).reminderConfig.update({ where: { id: existing.id }, data: updateData });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'ReminderConfig',
      entityId: updated.id,
      details: 'Updated reminder automation and SMTP settings',
      oldValue: this.sanitizeConfig(existing) as any,
      newValue: this.sanitizeConfig(updated) as any,
    });
    return this.sanitizeConfig(updated);
  }

  private buildTransport(config: AnyObject) {
    if (!config.smtpHost) throw new AppError('SMTP host is not configured', 400);
    const options: SMTPTransport.Options = {
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: Boolean(config.smtpSecure),
      tls: { rejectUnauthorized: config.smtpRejectUnauthorized !== false, minVersion: 'TLSv1.2' },
    };
    if (config.smtpUser || config.smtpPassword) options.auth = { user: config.smtpUser ?? '', pass: config.smtpPassword ?? '' };
    return nodemailer.createTransport(options);
  }

  async testSmtp(userId = 'system') {
    const config = await this.ensureConfig();
    const transporter = this.buildTransport(config);
    await transporter.verify();
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'ReminderConfig', entityId: config.id, details: 'Verified reminder SMTP settings' });
    return { ok: true, message: 'SMTP connection verified' };
  }

  private getRecipientId(item: AnyObject) {
    return item.ownerId ?? item.assigneeId ?? item.userId ?? item.responsibleUserId ?? item.assessorId ?? item.reviewerId ?? null;
  }

  private getTitle(item: AnyObject) {
    return item.title ?? item.name ?? item.legalName ?? item.displayId ?? item.id;
  }

  private async resolveRecipient(userId: string | null) {
    if (!userId) return null;
    return (prisma as any).user.findUnique({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true } });
  }

  async collectDueItems(resource: string, lookAheadDays = 0) {
    const config = PHASE6_MODEL_MAP[resource];
    if (!config) throw new AppError(`Unsupported Phase 6 resource: ${resource}`, 404);
    if (!config.dueField) throw new AppError('Resource has no due-date field', 400);
    const dueLimit = new Date(Date.now() + lookAheadDays * 24 * 60 * 60 * 1000);
    const items = await (prisma as any)[config.delegate].findMany({
      where: { [config.dueField]: { lte: dueLimit }, status: { notIn: CLOSED_STATUSES } },
      orderBy: { [config.dueField]: 'asc' },
    });
    return items.map((item: AnyObject) => ({
      resource,
      entityType: config.entityType,
      id: item.id,
      title: this.getTitle(item),
      dueDate: item[config.dueField!],
      ownerId: this.getRecipientId(item),
      escalation: new Date(item[config.dueField!]).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000,
    }));
  }

  async runForResource(resource: string, userId = 'system', options: { sendEmail?: boolean; lookAheadDays?: number } = {}) {
    const config = await this.ensureConfig();
    const runId = crypto.randomUUID();
    const dueItems = await this.collectDueItems(resource, options.lookAheadDays ?? config.lookAheadDays ?? 0);
    const shouldSend = options.sendEmail ?? false;
    const transporter = shouldSend ? this.buildTransport(config) : null;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of dueItems) {
      const user = await this.resolveRecipient(item.ownerId);
      const subject = `${config.reminderSubjectPrefix ?? '[ISMS Reminder]'} ${item.entityType} due: ${item.title}`;
      const baseLog = { runId, resource: item.resource, entityType: item.entityType, entityId: item.id, recipientEmail: user?.email ?? null, recipientUserId: user?.id ?? item.ownerId, subject, dueDate: item.dueDate };
      if (!shouldSend) {
        skipped += 1;
        await (prisma as any).reminderDeliveryLog.create({ data: { ...baseLog, status: 'generated' } });
        continue;
      }
      if (!user?.email) {
        skipped += 1;
        await (prisma as any).reminderDeliveryLog.create({ data: { ...baseLog, status: 'skipped', errorMessage: 'No recipient email resolved' } });
        continue;
      }
      try {
        await transporter!.sendMail({
          from: config.reminderFromEmail ?? config.smtpUser ?? undefined,
          to: user.email,
          subject,
          text: `ISMS reminder\n\n${item.entityType}: ${item.title}\nResource: ${item.resource}\nDue date: ${new Date(item.dueDate).toISOString()}\nEscalation: ${item.escalation ? 'yes' : 'no'}\n\nPlease review this item in /isms-operations.`,
        });
        sent += 1;
        await (prisma as any).reminderDeliveryLog.create({ data: { ...baseLog, status: 'sent', sentAt: new Date() } });
      } catch (error: any) {
        failed += 1;
        await (prisma as any).reminderDeliveryLog.create({ data: { ...baseLog, status: 'failed', errorMessage: String(error?.message ?? error).slice(0, 1000) } });
      }
    }

    await auditService.logEventStandalone(prisma, { userId, action: 'REVIEW_TASK_CREATE', entityType: 'ReminderRun', entityId: runId, details: `Reminder run for ${resource}: ${dueItems.length} due, ${sent} sent, ${skipped} skipped, ${failed} failed` });
    return { runId, count: dueItems.length, sent, skipped, failed, reminders: dueItems };
  }

  async runAllDue(userId = 'system') {
    const config = await this.ensureConfig();
    const resources = Object.entries(PHASE6_MODEL_MAP).filter(([, value]) => value.dueField).map(([key]) => key);
    let total = 0; let sent = 0; let skipped = 0; let failed = 0;
    const results = [];
    for (const resource of resources) {
      const result = await this.runForResource(resource, userId, { sendEmail: true, lookAheadDays: config.lookAheadDays ?? 0 });
      total += result.count; sent += result.sent; skipped += result.skipped; failed += result.failed; results.push(result);
    }
    const nextRunAt = new Date(Date.now() + (config.intervalMinutes ?? 1440) * 60 * 1000);
    await (prisma as any).reminderConfig.update({ where: { id: config.id }, data: { lastRunAt: new Date(), nextRunAt, lastRunStatus: failed > 0 ? 'completed_with_errors' : 'completed', lastRunMessage: `${total} due, ${sent} sent, ${skipped} skipped, ${failed} failed` } });
    return { total, sent, skipped, failed, results, nextRunAt };
  }

  async listLogs(limit = 50) {
    return (prisma as any).reminderDeliveryLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 200) });
  }
}

export const reminderService = new ReminderService();
