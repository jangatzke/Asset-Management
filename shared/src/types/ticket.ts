// ITIL 4 ticket system types
//
// Generic ticket container shared by all ticket types (incident, service_request,
// problem, change). Type-specific data lives in the extension interfaces
// (Problem, Change, ServiceRequest) plus the existing Incident interface.
// Per-type state machines live in ../ticketTransitions.ts (single source of truth).

import type { Incident } from './incident';

// ==========================================
// Ticket types & levels
// ==========================================

/** ITIL 4 ticket types supported by the generic ticket container. */
export type TicketType = 'incident' | 'service_request' | 'problem' | 'change';

/** All supported ticket types (stable order for UI pickers). */
export const TICKET_TYPES: readonly TicketType[] = ['incident', 'service_request', 'problem', 'change'];

/** Shared low/medium/high/critical level scale (priority, urgency, impact, risk). */
export type TicketLevel = 'low' | 'medium' | 'high' | 'critical';

export type TicketPriority = TicketLevel;
export type TicketUrgency = TicketLevel;
export type TicketImpact = TicketLevel;

// Per-type status values (the transition matrices in ticketTransitions.ts are
// the single source of truth for which transitions are allowed).
export type IncidentTicketStatus = 'new' | 'under_investigation' | 'contained' | 'resolved' | 'closed';
export type ServiceRequestTicketStatus = 'new' | 'in_progress' | 'pending' | 'on_hold' | 'fulfilled' | 'cancelled';
export type ProblemTicketStatus = 'new' | 'investigating' | 'identified' | 'workaround' | 'resolved' | 'cancelled';
export type ChangeTicketStatus = 'draft' | 'assessment' | 'approval' | 'approved' | 'rejected' | 'in_progress' | 'implemented' | 'reviewing' | 'closed' | 'cancelled';

/** Union of every status value across all ticket types. */
export type TicketStatus = IncidentTicketStatus | ServiceRequestTicketStatus | ProblemTicketStatus | ChangeTicketStatus;

/** Cross-ticket link types (ITIL incident ⇄ problem ⇄ change, duplicates). */
export type TicketLinkType = 'caused_by_problem' | 'resolved_by_change' | 'related_incident' | 'duplicate_of';

export const TICKET_LINK_TYPES: readonly TicketLinkType[] = ['caused_by_problem', 'resolved_by_change', 'related_incident', 'duplicate_of'];

/** Per-ticket history actions (AUD-001 pattern, mirrors IncidentHistoryAction). */
export type TicketHistoryAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGN' | 'COMMENT' | 'CLOSE' | 'ESCALATE' | 'LINK';

// ==========================================
// Core ticket
// ==========================================

/** Generic ITIL ticket (the `tickets` base table). */
export interface Ticket {
  id: string;
  displayId: string;
  type: TicketType;
  title: string;
  description?: string;
  status: string;
  priority: TicketPriority;
  urgency: TicketUrgency;
  impact: TicketImpact;

  // Requester / ownership (ITIL: requester, assigned engineer, manager)
  requesterId?: string;
  assigneeId?: string;
  managerId?: string;

  // SLA (target from priority + type policy; breach detection)
  slaTargetAt?: Date;
  firstResponseAt?: Date;
  firstResponseDueAt?: Date;
  resolutionDueAt?: Date;
  slaBreachedAt?: Date;

  // Lifecycle
  openedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  closedBy?: string;
  version: number;
  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/** Asset link (all ticket types). */
export interface TicketAsset {
  ticketId: string;
  assetId: string;
  createdAt: Date;
}

/** Comment / update on a ticket (internal notes vs. user-visible). */
export interface TicketComment {
  id: string;
  ticketId: string;
  authorId?: string;
  body: string;
  /** true = internal agent note, hidden from the requester. */
  isInternal: boolean;
  createdAt: Date;
}

/** Cross-ticket link (ITIL incident ⇄ problem ⇄ change, duplicates). */
export interface TicketLink {
  id: string;
  fromTicketId: string;
  toTicketId: string;
  linkType: TicketLinkType;
  createdAt: Date;
}

/** Per-ticket tamper-evident history trail (AUD-001 pattern). */
export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  action: TicketHistoryAction;
  fieldChanges?: Record<string, { old?: unknown; new?: unknown } | unknown>[];
  summary?: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ==========================================
// SLA & type configuration
// ==========================================

/** SLA targets (in hours) for a single priority level. */
export interface TicketSlaTarget {
  resolutionHours: number;
  firstResponseHours: number;
}

/** SLA policy of a ticket type: targets per priority level. */
export interface TicketSlaPolicy {
  byPriority: Partial<Record<TicketPriority, TicketSlaTarget>>;
}

/** Ticket type configuration (extensible types + SLA policy). */
export interface TicketTypeConfig {
  id: string;
  type: TicketType;
  label: string;
  description?: string;
  enabled: boolean;
  slaPolicy?: TicketSlaPolicy;
  defaultPriority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Service catalog
// ==========================================

/** Fulfillment configuration of a service catalog item. */
export interface ServiceFulfillmentConfig {
  requestedBy?: 'employee' | 'it';
  approverRole?: string;
  slaHours?: number;
}

/** Service catalog item (request fulfillment: catalog items / request types). */
export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  ticketType: TicketType;
  fulfillment?: ServiceFulfillmentConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Type-specific extensions
// ==========================================

/** ITIL problem management extension (1:1 with Ticket, type='problem'). */
export interface Problem {
  id: string;
  ticketId: string;
  rootCause?: string;
  workaround?: string;
  permanentFix?: string;
  /** Denormalized convenience; canonical links live in TicketLink. */
  relatedIncidentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ChangeType = 'standard' | 'normal' | 'emergency';

/** ITIL change enablement extension (1:1 with Ticket, type='change'). */
export interface Change {
  id: string;
  ticketId: string;
  changeType: ChangeType;
  riskLevel: TicketLevel;
  cabApproved: boolean;
  cabApprovedBy?: string;
  cabApprovedAt?: Date;
  implementationPlan?: string;
  rollbackPlan?: string;
  backoutDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FulfillmentStatus = 'pending' | 'in_fulfillment' | 'delivered' | 'rejected';

/** ITIL request fulfillment extension (1:1 with Ticket, type='service_request'). */
export interface ServiceRequest {
  id: string;
  ticketId: string;
  catalogItemId?: string;
  fulfillmentStatus: FulfillmentStatus;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Detail view (core + extension + relations)
// ==========================================

/**
 * Full ticket detail payload returned by GET /tickets/:id.
 * Only the extension matching `ticket.type` is populated.
 */
export interface TicketDetail {
  ticket: Ticket;
  incident?: Incident;
  problem?: Problem;
  change?: Change;
  serviceRequest?: ServiceRequest;
  assets: TicketAsset[];
  links: TicketLink[];
  /** Allowed next statuses from the shared transition matrix. */
  transitions: string[];
}
