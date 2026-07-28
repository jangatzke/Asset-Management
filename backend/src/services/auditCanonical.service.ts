import { createHash } from 'crypto';

export interface CanonicalAuditData {
  sequence: number;
  timestampISO: string;
  userId: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  oldValue: unknown;
  newValue: unknown;
  previousHash: string;
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return normalizeJsonValue(JSON.parse(value.toString('utf8')));
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = normalizeJsonValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

export function buildCanonicalString(data: CanonicalAuditData): string {
  return [
    String(data.sequence),
    data.timestampISO,
    data.userId ?? '',
    data.userName ?? '',
    data.action,
    data.entityType,
    data.entityId,
    data.details ?? '',
    canonicalize(data.oldValue),
    canonicalize(data.newValue),
    data.previousHash,
  ].join('|');
}

export function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeEntryHash(data: CanonicalAuditData): string {
  return sha256hex(buildCanonicalString(data));
}
