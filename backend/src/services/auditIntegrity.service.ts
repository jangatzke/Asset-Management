/**
 * Audit Log Integrity Service (Phase 9)
 *
 * Provides hash-chain integrity verification for tamper-evident audit logging.
 * Each AuditLog entry carries a monotonically increasing `sequence`, a SHA-256
 * `previousHash` pointing to the prior entry's `entryHash`, and its own
 * self-contained `entryHash`.  The chain is deterministic: given the same
 * sequence of events, every participant computes identical hashes.
 */

import type { PrismaClient } from '@prisma/client';
export {
  buildCanonicalString,
  canonicalize,
  computeEntryHash,
  sha256hex,
} from './auditCanonical.service';
import { computeEntryHash } from './auditCanonical.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityResult {
  valid: boolean;
  brokenAtSequence?: number;
  totalEntries: number;
  lastVerifiedSequence?: number;
  details?: string;
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

  const entries = await _prisma.auditLog.findMany({
    orderBy: { sequence: 'asc' },
  });

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let prevHash = ''; // genesis: first entry's previousHash should be empty string or null
  let expectedSeq = fromSeq;
  let lastVerifiedSeq = 0;

  for (const raw of entries) {
    const seq = raw.sequence;

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
    const storedPrevHash = raw.previousHash ?? '';
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
      userId: raw.userId ?? '',
      userName: raw.userName ?? null,
      action: raw.action ?? '',
      entityType: raw.entityType ?? '',
      entityId: raw.entityId ?? '',
      details: raw.details ?? null,
      oldValue: raw.oldValue ?? null,
      newValue: raw.newValue ?? null,
      previousHash: storedPrevHash,
    });

    if (computed !== (raw.entryHash ?? '')) {
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
  const entries = await _prisma.auditLog.findMany({
    where: { sequence: { gte: checkpointSequence } },
    orderBy: { sequence: 'asc' },
  });

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let prevHash = checkpointHash;
  const firstSeq = entries[0].sequence;

  // Verify the first entry links back to the checkpoint
  const storedPrevHash = entries[0].previousHash ?? '';
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
      userId: raw.userId ?? '',
      userName: raw.userName ?? null,
      action: raw.action ?? '',
      entityType: raw.entityType ?? '',
      entityId: raw.entityId ?? '',
      details: raw.details ?? null,
      oldValue: raw.oldValue ?? null,
      newValue: raw.newValue ?? null,
      previousHash: prevHash,
    });

    if (computed !== (raw.entryHash ?? '')) {
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
