/**
 * Display-ID Service
 *
 * Generates unique, sequential display IDs per entity type.
 * Format: PREFIX-NNNN (e.g., ASSET-0001, RISK-0001, CTRL-0001, INCI-0001, USR-0001)
 *
 * Uses DisplayIdCounter table for atomic counter management within transactions.
 */

import { PrismaClient } from '@prisma/client';

// Service functions

/**
 * Generate the next display ID for a given entity type.
 * Must be called within a Prisma transaction for atomicity.
 *
 * @param tx - Prisma transaction client
 * @param entityType - Entity type (e.g., "Asset", "Risk", "Control")
 * @returns Display ID string (e.g., "ASSET-0001")
 */
export async function nextDisplayId(tx: any, entityType: string): Promise<string> {
  const prefix = PREFIX_MAP[entityType] ?? entityType.toUpperCase().substring(0, 4);
  
  // Upsert counter: increment sequence atomically
  const counter = await tx.displayIdCounter.upsert({
    where: { entityType },
    create: { entityType, sequence: 1 },
    update: { sequence: { increment: 1 } },
  });

  const seq = counter.sequence;
  const padded = String(seq).padStart(PAD_LENGTH, '0');
  return `${prefix}-${padded}`;
}

/**
 * Generate display ID outside a transaction (for non-transactional operations).
 */
export async function nextDisplayIdStandalone(prisma: PrismaClient, entityType: string): Promise<string> {
  return prisma.$transaction(async (tx) => nextDisplayId(tx, entityType));
}

 /**
  * Reset counter for a given entity type (admin operation).
 */
 export async function resetDisplayIdCounter(prisma: any, entityType: string): Promise<void> {
   await prisma.displayIdCounter.updateMany({
     where: { entityType },
     data: { sequence: 0 },
   });
 }

 /**
  * Get current sequence number for an entity type.
 */
 export async function getCurrentSequence(prisma: any, entityType: string): Promise<number> {
   const counter = await prisma.displayIdCounter.findUnique({
     where: { entityType },
   });
   return counter?.sequence ?? 0;
 }

 /**
  * Map entity type to its display prefix.
 */
 export function getDisplayPrefix(entityType: string): string {
   return PREFIX_MAP[entityType] ?? entityType.toUpperCase().substring(0, 4);
 }

 // Configuration
 const PREFIX_MAP: Record<string, string> = {
   Asset: 'ASSET',
   Risk: 'RISK',
   Control: 'CTRL',
   Incident: 'INCI',
   User: 'USR',
   Contract: 'CTR',
   License: 'LIC',
   BusinessProcess: 'PROC',
   Document: 'DOC',
   CostPlan: 'CPLAN',
   CostPlanItem: 'CPI',
   Ticket: 'TCKT',
 };

 const PAD_LENGTH = 4;

 export const displayIdService = {
   nextDisplayId,
   nextDisplayIdStandalone,
   resetDisplayIdCounter,
   getCurrentSequence,
   getDisplayPrefix,
 };
