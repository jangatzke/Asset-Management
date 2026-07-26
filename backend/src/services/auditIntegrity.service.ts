/**
 * Audit Log Integrity Service (Phase 9)
 *
 * Provides hash-chain integrity verification for tamper-evident audit logging.
 * Each AuditLog entry carries a monotonically increasing `sequence`, a SHA-256
 * `previousHash` pointing to the prior entry's `entryHash`, and its own
 * self-contained `entryHash`.  The chain is deterministic: given the same
 * sequence of events, every participant computes identical hashes.
 */

import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical fields used for hash computation. Must match schema order exactly. */
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

export interface IntegrityResult {
  valid: boolean;
  brokenAtSequence?: number;
  totalEntries: number;
  lastVerifiedSequence?: number;
  details?: string;
}

// ---------------------------------------------------------------------------
// Canonicalization helpers
// ---------------------------------------------------------------------------

/**
 * Produce a stable JSON string from any JSON-serialisable value.
 * - Objects/arrays are serialized with sorted keys and no whitespace.
 * - `undefined` is treated as `null`.
 */
export function canonicalize(value: unknown): string {
  // Handle null/undefined first
  if (value === null || value === undefined) return 'null';

  // Prisma returns Buffer for some JSON fields; convert to serialisable first
  if (typeof value === 'string' && value.startsWith('<Buffer')) {
    try { value = JSON.parse(value); } catch { /* ignore */ }
  }
  if (Buffer.isBuffer(value)) {
    value = JSON.parse(value.toString());
  }

  // For objects (not arrays), sort keys for deterministic output
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return JSON.stringify(sorted);
  }

  if (Array.isArray(value)) {
    return '[' + (value as unknown[]).map(canonicalize).join(',') + ']';
  }

  // Handle BigInt safely
  if (typeof value === 'bigint') return value.toString();

  return JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
}

/**
 * Build the deterministic canonical string that feeds into SHA-256.
 * Fields are concatenated with a pipe delimiter inside a single flat string;
 * order is fixed by the CanonicalAuditData interface.
 */
export function buildCanonicalString(data: CanonicalAuditData): string {
  const parts = [
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
  ];
  return parts.join('|');
}

/** Compute SHA-256 hex digest of a string. */
export function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute the entry hash for a given set of canonical audit data.
 */
export function computeEntryHash(data: CanonicalAuditData): string {
  const canonical = buildCanonicalString(data);
  return sha256hex(canonical);
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

/**
 * Verify the entire hash-chain from sequence 1 (or the first available) to
 * the latest entry.  Returns `{ valid: true }` when every link checks out,
 * or `{ valid: false, brokenAtSequence, details }` on the first anomaly.
 */
export async function verifyIntegrity(
  _prisma: PrismaClient,
  options?: { fromSequence?: number }
): Promise<IntegrityResult> {
  const fromSeq = options?.fromSequence ?? 1;

  // Fetch all entries ordered by sequence ascending (raw SQL via global pg)
  // Note: We use a simple approach since Prisma.sql doesn't support plain strings directly
  const sql = `SELECT * FROM audit_logs ORDER BY "sequence" ASC`;
  const entries = await (_prisma as any).$queryRawUnsafe(sql);

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let prevHash = ''; // genesis: first entry's previousHash should be empty string or null
  let expectedSeq = fromSeq;
  let lastVerifiedSeq = 0;

  for (const raw of entries) {
    const seq = Number(raw.sequence);

    if (seq < expectedSeq) {
      // Duplicate or out-of-order — skip but note
      continue;
    }

    if (seq !== expectedSeq && seq !== fromSeq) {
      return {
        valid: false,
        brokenAtSequence: seq,
        totalEntries: entries.length,
        lastVerifiedSequence: lastVerifiedSeq,
        details: `Missing sequence gap at ${expectedSeq}`,
      };
    }

    // previousHash must match the hash of the preceding entry (or be empty/null for first)
    const storedPrevHash = raw.previous_hash ?? '';
    if (storedPrevHash !== prevHash && seq > fromSeq) {
      return {
        valid: false,
        brokenAtSequence: seq,
        totalEntries: entries.length,
        lastVerifiedSequence: lastVerifiedSeq,
        details: `Broken chain link at sequence ${seq}: previousHash mismatch`,
      };
    }

    // Recompute entryHash and compare
    const computed = computeEntryHash({
      sequence: seq,
      timestampISO: new Date(raw.timestamp).toISOString(),
      userId: raw.user_id ?? '',
      userName: raw.user_name ?? null,
      action: raw.action ?? '',
      entityType: raw.entity_type ?? '',
      entityId: raw.entity_id ?? '',
      details: raw.details ?? null,
      oldValue: raw.old_value ? JSON.parse(raw.old_value) : null,
      newValue: raw.new_value ? JSON.parse(raw.new_value) : null,
      previousHash: storedPrevHash,
    });

    if (computed !== (raw.entry_hash ?? '')) {
      return {
        valid: false,
        brokenAtSequence: seq,
        totalEntries: entries.length,
        lastVerifiedSequence: lastVerifiedSeq,
        details: `Hash mismatch at sequence ${seq}`,
      };
    }

    prevHash = computed;
    expectedSeq = seq + 1;
    lastVerifiedSeq = seq;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    lastVerifiedSequence: lastVerifiedSeq,
  };
}

// ---------------------------------------------------------------------------
// Checkpoint helpers (optional low-risk)
// ---------------------------------------------------------------------------

/**
 * Create an audit checkpoint at the current chain head.
 */
export async function createCheckpoint(
  prisma: PrismaClient,
  sequence: number,
  hash: string,
  externalReference?: string
): Promise<void> {
  await (prisma as any).auditCheckpoint.upsert({
    where: { sequence },
    update: { hash, externalReference: externalReference ?? undefined },
    create: {
      id: crypto.randomUUID(),
      sequence,
      hash,
      externalReference: externalReference ?? undefined,
    },
  });
}

/**
 * Verify integrity starting from a known checkpoint.
 */
export async function verifyFromCheckpoint(
  _prisma: PrismaClient,
  checkpointSequence: number,
  checkpointHash: string
): Promise<IntegrityResult> {
  const entries = await (_prisma as any).$queryRawUnsafe(
    `SELECT * FROM audit_logs WHERE "sequence" >= ${checkpointSequence} ORDER BY "sequence" ASC`
  );

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let prevHash = checkpointHash;
  const firstSeq = entries[0].sequence;

  // Verify the first entry links back to the checkpoint
  const storedPrevHash = entries[0].previous_hash ?? '';
  if (storedPrevHash !== prevHash) {
    return {
      valid: false,
      brokenAtSequence: Number(firstSeq),
      totalEntries: entries.length,
      details: `Checkpoint link mismatch at sequence ${firstSeq}`,
    };
  }

  // Walk the chain from checkpoint
  let lastVerifiedSeq = Number(firstSeq) - 1;
  for (const raw of entries) {
    const seq = Number(raw.sequence);
    const computed = computeEntryHash({
      sequence: seq,
      timestampISO: new Date(raw.timestamp).toISOString(),
      userId: raw.user_id ?? '',
      userName: raw.user_name ?? null,
      action: raw.action ?? '',
      entityType: raw.entity_type ?? '',
      entityId: raw.entity_id ?? '',
      details: raw.details ?? null,
      oldValue: raw.old_value ? JSON.parse(raw.old_value) : null,
      newValue: raw.new_value ? JSON.parse(raw.new_value) : null,
      previousHash: prevHash,
    });

    if (computed !== (raw.entry_hash ?? '')) {
      return {
        valid: false,
        brokenAtSequence: seq,
        totalEntries: entries.length,
        lastVerifiedSequence: lastVerifiedSeq,
        details: `Hash mismatch at sequence ${seq}`,
      };
    }

    prevHash = computed;
    lastVerifiedSeq = seq;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    lastVerifiedSequence: lastVerifiedSeq,
  };
}

// ---------------------------------------------------------------------------
// Convenience class wrapper (optional)
// ---------------------------------------------------------------------------

export class AuditIntegrityService {
  /**
   * Verify the full hash-chain integrity.
   */
  async verify(
    prisma: PrismaClient,
    options?: { fromSequence?: number }
  ): Promise<IntegrityResult> {
    return verifyIntegrity(prisma, options);
  }

  /**
   * Create a checkpoint at the current chain head.
   */
  async createCheckpoint(
    prisma: PrismaClient,
    sequence: number,
    hash: string,
    externalReference?: string
  ): Promise<void> {
    return createCheckpoint(prisma, sequence, hash, externalReference);
  }

  /**
   * Verify from a known checkpoint.
   */
  async verifyFromCheckpoint(
    prisma: PrismaClient,
    checkpointSequence: number,
    checkpointHash: string
  ): Promise<IntegrityResult> {
    return verifyFromCheckpoint(prisma, checkpointSequence, checkpointHash);
  }
}

export const auditIntegrityService = new AuditIntegrityService();
