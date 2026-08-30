/**
 * Ticket System Backfill & Seed Script
 *
 * 1. Seeds the four ITIL ticket type configurations (incident, service_request,
 *    problem, change) with per-priority SLA policies.
 * 2. Seeds a starter service catalog (request types).
 * 3. Backfills a generic Ticket row for every existing Incident that does not
 *    yet have one, links incident.ticketId, and mirrors the incident's affected
 *    assets into the generic TicketAsset junction.
 *
 * Idempotent: re-running will not duplicate tickets, type configs, or catalog
 * items (upserts on unique keys; incidents are skipped when already linked).
 *
 * Usage: npm run db:seed:tickets   (backend workspace)
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Ticket type configurations (extensible types + SLA policy)
// ---------------------------------------------------------------------------

const SLA_POLICY = {
  byPriority: {
    low: { resolutionHours: 120, firstResponseHours: 24 },
    medium: { resolutionHours: 48, firstResponseHours: 8 },
    high: { resolutionHours: 24, firstResponseHours: 4 },
    critical: { resolutionHours: 4, firstResponseHours: 1 },
  },
};

const TICKET_TYPE_CONFIGS: Array<{
  type: string;
  label: string;
  description: string;
  defaultPriority: string;
  slaPolicy: object;
}> = [
  {
    type: 'incident',
    label: 'Incident',
    description: 'Unplanned interruption to a service or reduction in service quality (ITIL incident management).',
    defaultPriority: 'medium',
    slaPolicy: SLA_POLICY,
  },
  {
    type: 'service_request',
    label: 'Service Request',
    description: 'Standardized request for a service (ITIL request fulfillment), fulfilled from the service catalog.',
    defaultPriority: 'medium',
    slaPolicy: SLA_POLICY,
  },
  {
    type: 'problem',
    label: 'Problem',
    description: 'Root-cause investigation of one or more incidents (ITIL problem management).',
    defaultPriority: 'low',
    slaPolicy: SLA_POLICY,
  },
  {
    type: 'change',
    label: 'Change',
    description: 'Controlled modification to an asset or service (ITIL change enablement).',
    defaultPriority: 'medium',
    slaPolicy: SLA_POLICY,
  },
];

async function seedTicketTypeConfigs(): Promise<void> {
  console.log('\n📋 Seeding ticket type configurations:');
  for (const cfg of TICKET_TYPE_CONFIGS) {
    await prisma.ticketTypeConfig.upsert({
      where: { type: cfg.type },
      create: {
        type: cfg.type,
        label: cfg.label,
        description: cfg.description,
        enabled: true,
        defaultPriority: cfg.defaultPriority,
        slaPolicy: cfg.slaPolicy as any,
      },
      update: {
        label: cfg.label,
        description: cfg.description,
        enabled: true,
      },
    });
    console.log(`  ✓ ticket_type_config: ${cfg.type}`);
  }
}

// ---------------------------------------------------------------------------
// Service catalog (request types for request fulfillment)
// ---------------------------------------------------------------------------

const SERVICE_CATALOG_ITEMS: Array<{
  code: string;
  name: string;
  description: string;
  ticketType: string;
  fulfillment: object;
}> = [
  {
    code: 'SR-ACCESS',
    name: 'Access Request',
    description: 'Request for access to a system, application, or asset.',
    ticketType: 'service_request',
    fulfillment: { requestedBy: 'employee', approverRole: 'it_manager', slaHours: 24 },
  },
  {
    code: 'SR-HARDWARE',
    name: 'Hardware Request',
    description: 'Request for new or replacement hardware (laptop, monitor, peripheral).',
    ticketType: 'service_request',
    fulfillment: { requestedBy: 'employee', approverRole: 'it_manager', slaHours: 72 },
  },
  {
    code: 'SR-SOFTWARE',
    name: 'Software / License Request',
    description: 'Request for software installation or a software license.',
    ticketType: 'service_request',
    fulfillment: { requestedBy: 'employee', approverRole: 'it_manager', slaHours: 48 },
  },
  {
    code: 'SR-PASSWORD',
    name: 'Password Reset',
    description: 'Self-service or agent-assisted password reset.',
    ticketType: 'service_request',
    fulfillment: { requestedBy: 'employee', approverRole: 'service_desk_agent', slaHours: 4 },
  },
  {
    code: 'SR-ACCOUNT',
    name: 'New User Account',
    description: 'Provisioning of a new user account and initial access.',
    ticketType: 'service_request',
    fulfillment: { requestedBy: 'it', approverRole: 'it_manager', slaHours: 24 },
  },
];

async function seedServiceCatalog(): Promise<void> {
  console.log('\n📋 Seeding service catalog items:');
  for (const item of SERVICE_CATALOG_ITEMS) {
    await prisma.serviceCatalogItem.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        description: item.description,
        ticketType: item.ticketType,
        fulfillment: item.fulfillment as any,
        enabled: true,
      },
      update: {
        name: item.name,
        description: item.description,
        enabled: true,
      },
    });
    console.log(`  ✓ service_catalog_item: ${item.code}`);
  }
}

// ---------------------------------------------------------------------------
// Incident backfill: create a generic Ticket for each unlinked Incident
// ---------------------------------------------------------------------------

async function backfillIncidents(): Promise<void> {
  console.log('\n🔁 Backfilling incidents into the generic ticket table:');

  const incidents = await prisma.incident.findMany({
    where: { ticketId: null },
    include: { incidentAssets: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`  Found ${incidents.length} incident(s) without a linked ticket.`);

  let created = 0;
  for (const incident of incidents) {
    const newTicket = await prisma.$transaction(async (tx) => {
      // Defensive re-check inside the transaction: skip if now linked.
      const current = await tx.incident.findUnique({
        where: { id: incident.id },
        select: { ticketId: true },
      });
      if (current?.ticketId) {
        return null;
      }

      // Allocate a display ID atomically.
      const counter = await tx.displayIdCounter.upsert({
        where: { entityType: 'Ticket' },
        create: { entityType: 'Ticket', sequence: 1 },
        update: { sequence: { increment: 1 } },
      });
      const displayId = `TCKT-${String(counter.sequence).padStart(4, '0')}`;

      const ticket = await tx.ticket.create({
        data: {
          displayId,
          type: 'incident',
          title: incident.title,
          description: incident.description,
          status: incident.status,
          priority: incident.severity,
          urgency: incident.severity,
          impact: incident.severity,
          requesterId: incident.reporterId,
          assigneeId: incident.incidentManagerId,
          managerId: incident.incidentManagerId,
          openedAt: incident.detectionTime,
          closedAt: incident.closedAt,
          closedBy: incident.closedBy,
          isArchived: incident.isArchived,
          createdAt: incident.createdAt,
          createdBy: incident.createdBy,
        },
      });

      // Mirror affected assets into the generic junction.
      for (const ia of incident.incidentAssets) {
        await tx.ticketAsset.create({
          data: { ticketId: ticket.id, assetId: ia.assetId },
        });
      }

      // Link the incident to its ticket.
      await tx.incident.update({
        where: { id: incident.id },
        data: { ticketId: ticket.id },
      });

      return ticket;
    });

    if (newTicket) {
      created += 1;
      console.log(`  ✓ ${incident.displayId} -> ${newTicket.displayId} (ticket ${newTicket.id.slice(0, 8)}...)`);
    }
  }

  console.log(`  Backfilled ${created} incident(s).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🎫 Starting ticket system seed/backfill\n');
  try {
    await seedTicketTypeConfigs();
    await seedServiceCatalog();
    await backfillIncidents();
    console.log('\n✅ Ticket system seed/backfill completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Ticket system seed/backfill failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
