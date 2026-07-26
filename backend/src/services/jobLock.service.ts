/**
 * Phase 10: PostgreSQL Advisory Lock Service
 *
 * Provides cluster-safe locking for background jobs using PostgreSQL advisory locks.
 * Uses `pg_try_advisory_lock` (non-blocking) so workers skip instead of queueing.
 */

import { prisma } from '../config/database';

/**
 * Attempt to acquire a cluster-wide advisory lock by text key.
 * Returns true if the lock was acquired, false otherwise.
 */
export async function tryAcquireAdvisoryLock(lockKey: string): Promise<boolean> {
  const query = 'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired';
  const result = await prisma.$queryRawUnsafe(query, lockKey);

  // $queryRawUnsafe returns an array; extract the first row's "acquired" field.
  const rows = result as Array<Record<string, unknown>>;
  const raw = rows.length > 0 ? rows[0]?.acquired : false;
  return raw === true || raw === 't';
}

/**
 * Release a previously acquired advisory lock by text key.
 * Returns true if the lock was released (was held), false otherwise.
 */
export async function releaseAdvisoryLock(lockKey: string): Promise<boolean> {
  try {
    const query = 'SELECT pg_advisory_unlock(hashtext($1)) AS released';
    const result = await prisma.$queryRawUnsafe(query, lockKey);

    const rows = result as Array<Record<string, unknown>>;
    const raw = (rows?.length ?? 0) > 0 ? rows[0]?.released : false;
    return raw === true || raw === 't';
  } catch {
    // If release fails for any reason, return false rather than throwing.
    return false;
  }
}

/**
 * Generate a deterministic lock key from a job identifier.
 */
export function getLockKey(jobId: string): string {
  return `phase10_lock_${jobId}`;
}
