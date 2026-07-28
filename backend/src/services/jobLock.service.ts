/**
 * Phase 10 / P1-F: Durable Job Lease Service
 *
 * Provides cluster-safe background job leasing without session-scoped database locks.
 * Leases are owned by explicit worker ids, expire after crashes, and are safe when
 * Prisma uses a pooled connection for each operation.
 */

import { prisma } from '../config/database';

export interface JobLeaseRecord {
  id: string;
  jobName: string;
  ownerId: string;
  leaseUntil: Date;
  heartbeatAt: Date;
  acquiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_JOB_LEASE_MS = 10 * 60 * 1000;

function addMilliseconds(value: Date, milliseconds: number): Date {
  return new Date(value.getTime() + milliseconds);
}

export function getJobLeaseName(jobId: string): string {
  return `phase10_lease_${jobId}`;
}

export async function acquireJobLease(
  jobName: string,
  ownerId: string,
  leaseMs = DEFAULT_JOB_LEASE_MS,
  now = new Date(),
): Promise<JobLeaseRecord | null> {
  const leaseUntil = addMilliseconds(now, leaseMs);

  try {
    const rows = await prisma.$queryRaw<JobLeaseRecord[]>`
      INSERT INTO "job_leases" (
        "jobName",
        "ownerId",
        "leaseUntil",
        "heartbeatAt",
        "acquiredAt",
        "updatedAt"
      )
      VALUES (${jobName}, ${ownerId}, ${leaseUntil}, ${now}, ${now}, ${now})
      ON CONFLICT ("jobName") DO UPDATE
      SET
        "ownerId" = EXCLUDED."ownerId",
        "leaseUntil" = EXCLUDED."leaseUntil",
        "heartbeatAt" = EXCLUDED."heartbeatAt",
        "acquiredAt" = EXCLUDED."acquiredAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "job_leases"."leaseUntil" <= ${now}
         OR "job_leases"."ownerId" = ${ownerId}
      RETURNING
        "id",
        "jobName",
        "ownerId",
        "leaseUntil",
        "heartbeatAt",
        "acquiredAt",
        "createdAt",
        "updatedAt"
    `;

    const lease = rows[0] ?? null;
    return lease?.ownerId === ownerId && lease.leaseUntil > now ? lease : null;
  } catch {
    return null;
  }
}

export async function heartbeatJobLease(
  jobName: string,
  ownerId: string,
  leaseMs = DEFAULT_JOB_LEASE_MS,
  now = new Date(),
): Promise<boolean> {
  const leaseUntil = addMilliseconds(now, leaseMs);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "job_leases"
    SET
      "leaseUntil" = ${leaseUntil},
      "heartbeatAt" = ${now},
      "updatedAt" = ${now}
    WHERE "jobName" = ${jobName}
      AND "ownerId" = ${ownerId}
      AND "leaseUntil" > ${now}
    RETURNING "id"
  `;

  return rows.length === 1;
}

export async function releaseJobLease(
  jobName: string,
  ownerId: string,
  now = new Date(),
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "job_leases"
    SET
      "leaseUntil" = ${now},
      "updatedAt" = ${now}
    WHERE "jobName" = ${jobName}
      AND "ownerId" = ${ownerId}
      AND "leaseUntil" > ${now}
    RETURNING "id"
  `;

  return rows.length === 1;
}
