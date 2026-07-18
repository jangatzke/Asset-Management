/**
 * Central Audit Log Service (P0-08)
 *
 * Provides immutable audit logging for all security-relevant operations.
 * Audit entries are written within the same DB transaction as business data,
 * ensuring consistency and preventing orphaned audit records.
 */

import { PrismaClient } from '@prisma/client';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
import { Request } from 'express';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'CREATE_FIRST_ADMIN'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_ROLE_ASSIGN'
  | 'USER_ROLE_REMOVE'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'ROLE_DELETE'
  | 'GROUP_CREATE'
  | 'GROUP_UPDATE'
  | 'GROUP_DELETE'
  | 'ASSET_CREATE'
  | 'ASSET_UPDATE'
  | 'ASSET_DELETE'
  | 'RISK_CREATE'
  | 'RISK_UPDATE'
  | 'RISK_DELETE'
  | 'CONTROL_CREATE'
  | 'CONTROL_UPDATE'
  | 'CONTROL_DELETE'
  | 'INCIDENT_CREATE'
  | 'INCIDENT_UPDATE'
  | 'INCIDENT_DELETE'
  | 'CONFIG_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'READ_SENSITIVE';

export interface AuditEventParams {
  userId: string;
  userName?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: string;
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AuditService {
  /**
   * Log an audit event within a Prisma transaction.
   * This is the primary method for writing immutable audit records.
   */
  public async logEvent(
    tx: any, // Prisma transaction client (Omit<PrismaClient, ...>)
    params: AuditEventParams & { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ?? undefined,
        oldValue: (params.oldValue as any) ?? undefined,
        newValue: (params.newValue as any) ?? undefined,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    });
  }

  /**
   * Log an audit event outside a transaction (standalone).
   */
  public async logEventStandalone(
    prisma: PrismaClient,
    params: AuditEventParams & { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ?? undefined,
        oldValue: (params.oldValue as any) ?? undefined,
        newValue: (params.newValue as any) ?? undefined,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    });
  }

  /**
   * Extract IP address and user agent from an Express request.
   */
  public static extractRequestInfo(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip ?? undefined,
      userAgent: req.get('User-Agent') ?? undefined,
    };
  }

  /**
   * Query audit log entries with filtering and pagination.
   */
  public async queryAuditLog(
    prisma: PrismaClient,
    filters: {
      userId?: string;
      entityType?: string;
      action?: string;
      from?: Date;
      to?: Date;
    },
    page: number = 1,
    pageSize: number = 50,
  ) {
    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) (where.timestamp as any).gte = filters.from;
      if (filters.to) (where.timestamp as any).lte = filters.to;
    }

    const skip = (page - 1) * pageSize;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { entries, total, page, pageSize };
  }

  /**
   * Export audit log as JSON (full dataset with optional filters).
   */
  public async exportAuditLog(
    prisma: PrismaClient,
    filters?: {
      userId?: string;
      entityType?: string;
      action?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const where: Record<string, unknown> = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.action) where.action = filters.action;
    if (filters?.from || filters?.to) {
      where.timestamp = {};
      if (filters.from) (where.timestamp as any).gte = filters.from;
      if (filters.to) (where.timestamp as any).lte = filters.to;
    }

    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    return entries;
  }

  /**
   * Export audit log as CSV string.
   */
  public async exportAuditLogAsCSV(
    prisma: PrismaClient,
    filters?: {
      userId?: string;
      entityType?: string;
      action?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const entries = await this.exportAuditLog(prisma, filters);

    const headers = [
      'id',
      'timestamp',
      'userId',
      'userName',
      'action',
      'entityType',
      'entityId',
      'details',
      'ipAddress',
      'userAgent',
    ];

    const csvLines = [headers.join(',')];

    for (const entry of entries) {
      const row = headers.map((h) => {
        const val = (entry as any)[h] ?? '';
        // Escape commas and quotes in values
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      });
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }
}

export const auditService = new AuditService();
