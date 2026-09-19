import crypto from 'crypto';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

type AnyObject = Record<string, any>;

const PASSWORD_PLACEHOLDERS = new Set(['', '********', '••••••••', '__KEEP_EXISTING__']);
const CLOSED_TICKET_STATUSES = ['closed', 'cancelled', 'fulfilled', 'resolved', 'implemented', 'rejected'];
export interface SlaConfigUpdate {
  enabled?: boolean;
  intervalMinutes?: number;
  notifyAssignee?: boolean;
  notifyManager?: boolean;
  notifyEmail?: boolean;
  escalationLevels?: number[];
  escalationDelayMinutes?: number;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpRejectUnauthorized?: boolean;
}

/**
 * SLA breach escalation service (ITIL: escalation policy).
 *
 * Mirrors the reminder subsystem: a single row in `sla_configs` holds the
 * policy, a cluster-safe scheduler drives periodic scans, every escalation is
 * recorded in `sla_escalation_logs` (idempotent per ticket/breach/level) and
 * mirrored into `ticket_escalations` + tamper-evident ticket history.
 */
export class SlaService {
  private sanitizeConfig(config: AnyObject | null) {
    if (!config) return null;
    const { smtpPassword: _smtpPassword, ...safe } = config;
    return {
      ...safe,
      smtpPasswordConfigured: Boolean(config.smtpPassword),
    };
  }

  private async ensureConfig() {
    const existing = await (prisma as any).slaConfig.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return (prisma as any).slaConfig.create({ data: { enabled: false, intervalMinutes: 60, escalationDelayMinutes: 30 } });
  }

  async getConfig() {
    return this.sanitizeConfig(await this.ensureConfig());
  }

  async updateConfig(data: SlaConfigUpdate, userId = 'system') {
    const existing = await this.ensureConfig();
    const updateData: AnyObject = {};
    if (data.enabled !== undefined) updateData.enabled = Boolean(data.enabled);
    if (data.intervalMinutes !== undefined) {
      const interval = Number(data.intervalMinutes);
      if (!Number.isInteger(interval) || interval < 5 || interval > 10080) throw new AppError('Interval must be between 5 and 10080 minutes', 400);
      updateData.intervalMinutes = interval;
      updateData.nextRunAt = new Date(Date.now() + interval * 60 * 1000);
    }
    if (data.notifyAssignee !== undefined) updateData.notifyAssignee = Boolean(data.notifyAssignee);
    if (data.notifyManager !== undefined) updateData.notifyManager = Boolean(data.notifyManager);
    if (data.notifyEmail !== undefined) updateData.notifyEmail = Boolean(data.notifyEmail);
    if (data.escalationLevels !== undefined) {
      const levels = Array.isArray(data.escalationLevels) ? data.escalationLevels : [];
      const parsed = levels.map((l) => Number(l)).filter((l) => Number.isInteger(l) && l > 0);
      if (parsed.length === 0) throw new AppError('At least one escalation level is required', 400);
      updateData.escalationLevels = parsed;
    }
    if (data.escalationDelayMinutes !== undefined) {
      const delay = Number(data.escalationDelayMinutes);
      if (!Number.isInteger(delay) || delay < 1 || delay > 10080) throw new AppError('Escalation delay must be between 1 and 10080 minutes', 400);
      updateData.escalationDelayMinutes = delay;
    }
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

    const updated = await (prisma as any).slaConfig.update({ where: { id: existing.id }, data: updateData });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'SlaConfig',
      entityId: updated.id,
      details: 'Updated SLA escalation policy',
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
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'SlaConfig', entityId: config.id, details: 'Verified SLA escalation SMTP settings' });
    return { ok: true, message: 'SMTP connection verified' };
  }

  /**
   * Determine the highest escalation level a breach has reached based on how
   * long it has been overdue. A breach reaches level L when it has been open
   * for at least `escalationDelayMinutes * L`.
   */
  private determineLevel(overdueMinutes: number, levels: number[], delayMinutes: number): number {
    let level = 0;
    for (const l of levels) {
      if (overdueMinutes >= delayMinutes * l) level = Math.max(level, l);
    }
    return level;
  }

  /**
   * Scan all open tickets for SLA breaches and create escalation records for
   * any (ticket, breachType, level) triple that has not been recorded yet.
   * Idempotent: safe to run repeatedly.
   */
  async scanBreach(userId = 'system') {
    const config = await this.ensureConfig();
    const runId = crypto.randomUUID();
    const levels = Array.isArray(config.escalationLevels) ? config.escalationLevels : [1, 2, 3];
    const delayMinutes = config.escalationDelayMinutes ?? 30;
    const shouldEmail = Boolean(config.notifyEmail);
    const transporter = shouldEmail ? this.buildTransport(config) : null;

    const now = new Date();
    const tickets = await (prisma as any).ticket.findMany({
      where: {
        isArchived: false,
        status: { notIn: CLOSED_TICKET_STATUSES },
        OR: [
          { firstResponseAt: null, firstResponseDueAt: { not: null, lte: now } },
          { resolutionDueAt: { not: null, lte: now } },
        ],
      },
      select: {
        id: true,
        displayId: true,
        type: true,
        title: true,
        status: true,
        priority: true,
        firstResponseAt: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
        assigneeId: true,
        managerId: true,
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        manager: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const ticket of tickets) {
      const breaches: Array<{ breachType: string; dueAt: Date | null }> = [];
      if (ticket.firstResponseAt == null && ticket.firstResponseDueAt != null) {
        breaches.push({ breachType: 'firstResponse', dueAt: ticket.firstResponseDueAt });
      }
      if (ticket.resolutionDueAt != null) {
        breaches.push({ breachType: 'resolution', dueAt: ticket.resolutionDueAt });
      }

      for (const breach of breaches) {
        if (breach.dueAt == null) continue;
        const overdueMinutes = Math.floor((now.getTime() - new Date(breach.dueAt).getTime()) / 60000);
        const maxLevel = this.determineLevel(overdueMinutes, levels, delayMinutes);
        if (maxLevel < 1) continue; // not overdue enough to trigger the first escalation

        for (let level = 1; level <= maxLevel; level++) {
          const already = await (prisma as any).slaEscalationLog.findFirst({ where: { ticketId: ticket.id, breachType: breach.breachType, level } });
          if (already) {
            skipped += 1;
            continue;
          }

          // Escalate to the manager once we move past level 1 (if enabled).
          const escalateToManager = level > 1 && config.notifyManager;
          const target = escalateToManager ? ticket.manager : ticket.assignee;
          const escalateTo = escalateToManager ? ticket.managerId : ticket.assigneeId;

          let sentVia = 'in-app';
          if (target?.email) sentVia = shouldEmail ? 'email' : 'in-app';
          else sentVia = 'none';

          const escalationId = crypto.randomUUID();
          const baseLog = { runId, ticketId: ticket.id, breachType: breach.breachType, level, escalatedTo: escalateTo, createdAt: now };
          try {
            await (prisma as any).ticketEscalation.create({
              data: {
                ticketId: ticket.id,
                escalationType: 'sla_breach',
                level,
                reason: `SLA ${breach.breachType} breach (level ${level}) on ${ticket.displayId}`,
                dueAt: breach.dueAt,
                escalatedTo: escalateTo,
                createdBy: userId,
              },
            });
            await (prisma as any).slaEscalationLog.create({
              data: {
                ticketId: ticket.id,
                escalationId,
                breachType: breach.breachType,
                level,
                escalatedTo: escalateTo,
                escalatedToType: 'user',
                sentVia,
                status: sentVia === 'none' ? 'skipped' : 'sent',
              },
            });
            await (prisma as any).ticketHistoryEntry.create({
              data: {
                ticketId: ticket.id,
                action: 'TICKET_ESCALATE',
                summary: `SLA ${breach.breachType} escalated to level ${level}`,
                actorId: userId,
                actorName: 'SLA Escalation',
              },
            });

            if (sentVia === 'email' && target?.email && transporter) {
              try {
                await transporter.sendMail({
                  from: config.smtpUser ?? undefined,
                  to: target.email,
                  subject: `[SLA Escalation] ${ticket.displayId} ${breach.breachType} breach (level ${level})`,
                  text: `Ticket ${ticket.displayId} "${ticket.title}" (${ticket.type}) has breached its ${breach.breachType} SLA at escalation level ${level}.\nStatus: ${ticket.status}\nPriority: ${ticket.priority}\nDue: ${new Date(breach.dueAt).toISOString()}\n\nPlease review in the ticket detail view.`,
                });
                sent += 1;
              } catch (error: any) {
                failed += 1;
                await (prisma as any).slaEscalationLog.update({ where: { id: escalationId }, data: { status: 'failed', errorMessage: String(error?.message ?? error).slice(0, 1000) } });
                results.push({ ...baseLog, escalationId, status: 'failed' });
                continue;
              }
            } else {
              sent += 1;
            }

            results.push({ ...baseLog, escalationId, status: sentVia === 'none' ? 'skipped' : 'sent' });
          } catch (error: any) {
            failed += 1;
            results.push({ ...baseLog, escalationId, status: 'failed', errorMessage: String(error?.message ?? error).slice(0, 1000) });
          }
        }
      }
    }

    if (transporter) { try { await transporter.close(); } catch { /* ignore */ } }

    const nextRunAt = new Date(Date.now() + (config.intervalMinutes ?? 60) * 60 * 1000);
    await (prisma as any).slaConfig.update({
      where: { id: config.id },
      data: {
        lastRunAt: now,
        nextRunAt,
        lastRunStatus: failed > 0 ? 'completed_with_errors' : 'completed',
        lastRunMessage: `${results.length} escalated, ${sent} sent, ${skipped} already handled, ${failed} failed`,
      },
    });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'SLA_ESCALATION_RUN',
      entityType: 'SlaRun',
      entityId: runId,
      details: `SLA escalation scan: ${results.length} escalated, ${sent} sent, ${skipped} already handled, ${failed} failed`,
    });

    return { runId, escalated: results.length, sent, skipped, failed, results, nextRunAt };
  }

  async listLogs(limit = 50) {
    return (prisma as any).slaEscalationLog.findMany({
      take: Number(limit) || 50,
      orderBy: { createdAt: 'desc' },
      include: { ticket: { select: { displayId: true, type: true, title: true, status: true } } },
    });
  }
}

export const slaService = new SlaService();
