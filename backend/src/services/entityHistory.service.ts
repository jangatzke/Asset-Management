/**
 * Generic Entity History Service (AUDIT-001 extension)
 *
 * Provides traceable, append-only history recording for non-incident entities:
 * Asset, Risk, Control, Contract, License, Process.
 *
 * One save = one summarized entry per entity operation.
 */

import { prisma } from '../config/database';

export type EntityHistoryAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export interface EntityHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: EntityHistoryAction;
  fieldChanges?: Record<string, unknown>;
  summary?: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface GetEntityHistoryQuery {
  action?: EntityHistoryAction;
  limit?: number;
  offset?: number;
}

type HistoryActorContext = {
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
};

// Fields to ignore when diffing (internal/noisy/default)
const IGNORED_FIELDS = new Set([
  'id',
  'displayId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'isArchived',
  // Relation arrays/objects that are resolved separately and not meaningful as simple diffs
]);

/**
 * Record a single summarized history entry for an entity operation.
 */
export async function recordEntityHistory(params: {
  entityType: string;
  entityId: string;
  action: EntityHistoryAction;
  summary: string;
  fieldChanges?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const historyEntry = (prisma as any).entityHistoryEntry;
  if (!historyEntry) {
    console.warn('EntityHistoryService.recordEntityHistory: entityHistoryEntry model not available on prisma client');
    return;
  }

  const actorName = params.actorName ?? await resolveActorName(params.actorId);

  await historyEntry.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      fieldChanges: params.fieldChanges || {},
      actorId: params.actorId || null,
      actorName: actorName || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });
}

/**
 * Get the change history for a specific entity.
 * Returns entries in chronological order (ascending by createdAt).
 */
export async function getEntityHistory(
  entityType: string,
  entityId: string,
  query: GetEntityHistoryQuery = {}
): Promise<EntityHistoryEntry[]> {
  const { action, limit = 100, offset = 0 } = query;

  const historyEntry = (prisma as any).entityHistoryEntry;
  if (!historyEntry) {
    console.warn('EntityHistoryService.getEntityHistory: entityHistoryEntry model not available on prisma client');
    return [];
  }

  const where: any = { entityType, entityId };
  if (action) {
    where.action = action;
  }

  const entries = await historyEntry.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
  });

  return entries as EntityHistoryEntry[];
}

/**
 * Resolve actor name from available user data.
 * Tries to look up the User record by actorId; falls back gracefully.
 */
export async function resolveActorName(actorId?: string): Promise<string | undefined> {
  if (!actorId) return undefined;
  try {
    const user = await (prisma as any).user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (user) {
      const parts = [user.firstName, user.lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : user.email || undefined;
    }
  } catch {
    // User model may not be available or query failed — fall back to actorId only
  }
  return undefined;
}

/**
 * Compute field-level diff between old and new entity snapshots.
 * Returns a normalized fieldChanges object with only semantically changed fields.
 */
export function computeFieldDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  // Collect all keys from both objects (skip ignored fields)
  const allKeys = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ]);

  for (const key of Array.from(allKeys).sort()) {
    if (IGNORED_FIELDS.has(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Skip if both are undefined/null/empty array/object in a semantically equivalent way
    if (oldVal === undefined && newVal === undefined) continue;
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    changes[key] = { old: oldVal, new: newVal };
  }

  return changes;
}

/**
 * Keep entity service history wiring concise while ensuring every persisted scalar
 * field from the fetched snapshots is eligible for diffing.
 */
export function toHistoryData<T extends Record<string, unknown>>(data: T | null | undefined): Record<string, unknown> {
  if (!data) return {};
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (Array.isArray(value)) continue;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

/**
 * Build a human-readable summary for an UPDATE/STATUS_CHANGE operation.
 */
export function buildUpdateSummary(
  action: EntityHistoryAction,
  statusField: string | null,
  previousStatus: unknown,
  newStatus: unknown,
  changedFields: string[]
): string {
  if (action === 'CREATE') return ''; // CREATE summary is handled by caller

  const statusChanged = previousStatus !== undefined && previousStatus !== newStatus;

  if (statusChanged && changedFields.length > 0) {
    // Combined: status change + other field changes → one STATUS_CHANGE entry
    const nonStatusFields = changedFields.filter((f) => f !== statusField);
    let summary = `Status changed from ${String(previousStatus)} to ${String(newStatus)}`;
    if (nonStatusFields.length > 0) {
      summary += `; updated fields: ${nonStatusFields.join(', ')}`;
    }
    return summary;
  }

  if (statusChanged && action === 'STATUS_CHANGE') {
    return `Status changed from ${String(previousStatus)} to ${String(newStatus)}`;
  }

  if (changedFields.length > 0) {
    return `Updated fields: ${changedFields.join(', ')}`;
  }

  return '';
}

/**
 * Record history for an UPDATE operation with automatic diff computation.
 * Returns the action type that was recorded ('STATUS_CHANGE' or 'UPDATE').
 */
export async function recordUpdateHistory(params: {
  entityType: string;
  entityId: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  statusField: string | null; // e.g. 'lifecycleStatus', 'status', or null
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ action: EntityHistoryAction; summary: string }> {
  const { entityType, entityId, oldData, newData, statusField, ...rest } = params;

  // Compute semantic diff of all changed fields (excluding status field for now)
  const rawDiff = computeFieldDiff(oldData, newData);
  const changedFieldNames = Object.keys(rawDiff);

  if (changedFieldNames.length === 0) {
    return { action: 'UPDATE', summary: '' }; // No actual changes
  }

  const oldStatus = statusField ? oldData[statusField] : undefined;
  const newStatus = statusField ? newData[statusField] : undefined;
  const statusChanged = oldStatus !== undefined && oldStatus !== newStatus;

  let action: EntityHistoryAction;
  let summary: string;
  let fieldChanges: Record<string, unknown>;

  if (statusChanged) {
    action = 'STATUS_CHANGE';
    // Build combined diff: include status fields + other changed fields
    const combinedDiff: Record<string, unknown> = {};
    
    if (statusField) {
      combinedDiff['oldStatus'] = oldStatus;
      combinedDiff['newStatus'] = newStatus;
    }

    for (const [key, value] of Object.entries(rawDiff)) {
      if (key !== statusField) {
        combinedDiff[key] = value;
      }
    }

    summary = buildUpdateSummary(action, statusField, oldStatus, newStatus, changedFieldNames);
    fieldChanges = combinedDiff;
  } else {
    action = 'UPDATE';
    // Only include actual changed fields (exclude status if unchanged)
    const filteredDiff: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawDiff)) {
      if (key !== statusField || !statusChanged) {
        filteredDiff[key] = value;
      }
    }
    summary = buildUpdateSummary(action, null, oldStatus, newStatus, changedFieldNames);
    fieldChanges = filteredDiff;
  }

  await recordEntityHistory({
    entityType,
    entityId,
    action,
    summary: summary || `Updated ${entityType.toLowerCase()}`,
    fieldChanges,
    ...rest,
  });

  return { action, summary };
}

/**
 * Record history for a CREATE operation.
 */
export async function recordCreateHistory(params: {
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
} & HistoryActorContext): Promise<void> {
  const { entityType, entityId, data, ...actorContext } = params;
  const titleField = data['title'] ?? data['name'] ?? null;
  const titleStr = typeof titleField === 'string' && titleField ? `: ${titleField}` : '';

  await recordEntityHistory({
    entityType,
    entityId,
    action: 'CREATE',
    summary: `Created ${entityType}${titleStr}`,
    fieldChanges: {}, // CREATE entries typically don't need full diff
    ...actorContext,
  });
}

/**
 * Record history for a DELETE operation.
 */
export async function recordDeleteHistory(params: {
  entityType: string;
  entityId: string;
} & HistoryActorContext): Promise<void> {
  const { entityType, entityId, ...actorContext } = params;

  await recordEntityHistory({
    entityType,
    entityId,
    action: 'DELETE',
    summary: `Deleted ${entityType}`,
    fieldChanges: {},
    ...actorContext,
  });
}
