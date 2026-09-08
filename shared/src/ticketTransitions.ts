/**
 * ITIL 4 ticket status transition matrices (single source of truth).
 *
 * Each ticket type has its own state machine:
 *   incident         ‒ new → under_investigation | contained → resolved; reopen: resolved → new
 *   service_request  ‒ new → in_progress | pending | on_hold → fulfilled; reopen: fulfilled → new
 *   problem          ‒ new → investigating → identified → workaround → resolved; reopen: resolved → investigating
 *   change           ‒ draft → assessment → approval → approved → in_progress → implemented → reviewing → closed; reopen: closed → in_progress
 *
 * Reopen transitions follow ITIL 4: resolved/fulfilled/closed tickets can be
 * re-opened when the problem recurs or new information arrives. The /close
 * endpoint transitions to CLOSE_TARGET_STATUS per type.
 *
 * This module is consumed by:
 *   - backend:  statusTransition.ts  (validateTransition under 'tickets:<type>' keys)
 *   - frontend: TicketDetail.tsx / ticketStatusHelpers (status-transition buttons)
 *
 * Keep in sync with the backend transition matrix. If you change a transition
 * here, rebuild the shared package (`cd shared && npm run build`) so the
 * backend picks up the change via its `shared` dependency.
 */

import { INCIDENT_TRANSITIONS } from './incidentTransitions';
import type { TicketType, TicketUrgency, TicketImpact, TicketPriority } from './types/ticket';

/** Allowed target statuses for each non-terminal status, per ticket type. */
export const TICKET_TRANSITIONS: Readonly<Record<TicketType, Readonly<Record<string, readonly string[]>>>> = {
  // The incident state machine is copied from INCIDENT_TRANSITIONS (the NIS2
  // automaton itself must stay untouched) and extended with an ITIL 4 reopen.
  incident: {
    ...INCIDENT_TRANSITIONS,
    resolved: ['new'],
  },
  service_request: {
    new: ['in_progress', 'pending', 'on_hold', 'fulfilled', 'cancelled'],
    in_progress: ['pending', 'on_hold', 'fulfilled', 'cancelled'],
    pending: ['in_progress', 'on_hold', 'fulfilled', 'cancelled'],
    on_hold: ['in_progress', 'fulfilled', 'cancelled'],
    // ITIL 4 reopen: request re-evaluation after fulfilment
    fulfilled: ['new'],
    // 'cancelled' is terminal ‒ intentionally absent
  },
  problem: {
    new: ['investigating', 'resolved', 'cancelled'],
    investigating: ['identified', 'resolved', 'cancelled'],
    identified: ['workaround', 'resolved', 'cancelled'],
    workaround: ['resolved', 'cancelled'],
    // ITIL 4 reopen: problem recurred after resolution
    resolved: ['investigating'],
    // 'cancelled' is terminal ‒ intentionally absent
  },
  change: {
    draft: ['assessment', 'closed', 'cancelled'],
    assessment: ['approval', 'rejected', 'closed', 'cancelled'],
    approval: ['approved', 'rejected', 'closed', 'cancelled'],
    approved: ['in_progress', 'closed', 'cancelled'],
    in_progress: ['implemented', 'closed', 'cancelled'],
    implemented: ['reviewing', 'closed'],
    reviewing: ['closed', 'in_progress'],
    // ITIL 4 reopen: rollback / re-implementation after closure
    closed: ['in_progress'],
    // 'rejected' and 'cancelled' are terminal ‒ intentionally absent
  },
};

/**
 * Status a ticket is moved to when closed via the gated /close endpoint,
 * per ticket type. Each target is a valid transition target from every
 * active status of its type (see TICKET_TRANSITIONS above).
 */
export const CLOSE_TARGET_STATUS: Readonly<Record<TicketType, string>> = {
  incident: 'resolved',
  service_request: 'fulfilled',
  problem: 'resolved',
  change: 'closed',
};

/** Initial status a newly created ticket starts in, per type. */
export const INITIAL_TICKET_STATUS: Readonly<Record<TicketType, string>> = {
  incident: 'new',
  service_request: 'new',
  problem: 'new',
  change: 'draft',
};

/**
 * Status a closed ticket reopens to, per type. Mirrors the first outgoing
 * transition of each type's closed/fulfilled/resolved target so a ticket can
 * always return to an active working state after being closed.
 *
 * - incident → resolved → new (ITIL 4 reopen)
 * - service_request → fulfilled → new
 * - problem → resolved → investigating
 * - change → closed → in_progress
 */
export const REOPEN_TARGET_STATUS: Readonly<Record<TicketType, string>> = {
  incident: 'new',
  service_request: 'new',
  problem: 'investigating',
  change: 'in_progress',
};

/**
 * Return the list of allowed target statuses for a ticket type/status pair.
 * Returns an empty array for terminal or unknown statuses.
 *
 * The `closed` status is anomalous for IT ticket types: the gated /close
 * endpoint moves a ticket into each type's terminal state via CLOSE_TARGET_STATUS
 * (e.g. problem → `resolved`), so a ticket should normally never sit in the
 * literal `closed` status. When it does (e.g. legacy or externally-created data),
 * the reopen button still offers `investigating`/`new`/`in_progress`, so we
 * special-case `closed` here and return that type's reopen target as the only
 * allowed transition. This keeps `closed` terminal for UI purposes (the close
 * button stays hidden) while allowing a ticket to actually be reopened.
 */
export function getAllowedTicketTransitions(type: TicketType, currentStatus: string): string[] {
  const matrix = TICKET_TRANSITIONS[type];
  if (currentStatus === 'closed') return [REOPEN_TARGET_STATUS[type]];
  const targets = matrix?.[currentStatus];
  return targets ? Array.from(targets) : [];
}

/** A status is terminal when the matrix has no outgoing transitions for it. */
export function isTerminalTicketStatus(type: TicketType, status: string): boolean {
  const matrix = TICKET_TRANSITIONS[type];
  return !matrix[status];
}

/** All known statuses for a ticket type (matrix keys + targets + initial status). */
export function getKnownTicketStatuses(type: TicketType): string[] {
  const matrix = TICKET_TRANSITIONS[type];
  const statuses = new Set<string>([INITIAL_TICKET_STATUS[type]]);
  for (const [from, targets] of Object.entries(matrix)) {
    statuses.add(from);
    for (const target of targets) statuses.add(target);
  }
  return Array.from(statuses);
}

// ==========================================
// ITIL priority matrix
// ==========================================

const PRIORITY_MATRIX: Readonly<Record<TicketImpact, Readonly<Record<TicketUrgency, TicketPriority>>>> = {
  critical: { critical: 'critical', high: 'critical', medium: 'critical', low: 'high' },
  high: { critical: 'critical', high: 'critical', medium: 'high', low: 'medium' },
  medium: { critical: 'critical', high: 'high', medium: 'medium', low: 'low' },
  low: { critical: 'high', high: 'medium', medium: 'low', low: 'low' },
};

/**
 * Derive the ticket priority from urgency and impact using the ITIL priority matrix.
 *
 * | Priority    | Urgency High | Urgency Medium | Urgency Low |
 * |-------------|--------------|----------------|-------------|
 * | Impact High   | Critical | High   | Medium |
 * | Impact Medium | High   | Medium | Low    |
 * | Impact Low    | Medium | Low    | Low    |
 */
export function computePriority(urgency: TicketUrgency, impact: TicketImpact): TicketPriority {
  return PRIORITY_MATRIX[impact][urgency];
}
