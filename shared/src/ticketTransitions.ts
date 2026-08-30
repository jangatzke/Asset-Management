/**
 * ITIL 4 ticket status transition matrices (single source of truth).
 *
 * Each ticket type has its own state machine:
 *   incident         ‒ reuses INCIDENT_TRANSITIONS verbatim (NIS2 behavior preserved)
 *   service_request  ‒ new → in_progress | pending | on_hold | cancelled
 *   problem          ‒ new → investigating → identified → workaround → resolved
 *   change           ‒ draft → assessment → approval → approved → in_progress → implemented → reviewing → closed
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
  // The incident state machine is reused verbatim to preserve NIS2 behavior.
  incident: INCIDENT_TRANSITIONS,
  service_request: {
    new: ['in_progress', 'pending', 'on_hold', 'cancelled'],
    in_progress: ['pending', 'on_hold', 'fulfilled', 'cancelled'],
    pending: ['in_progress', 'on_hold', 'cancelled'],
    on_hold: ['in_progress', 'cancelled'],
    // 'fulfilled' and 'cancelled' are terminal ‒ intentionally absent
  },
  problem: {
    new: ['investigating', 'cancelled'],
    investigating: ['identified', 'cancelled'],
    identified: ['workaround', 'resolved', 'cancelled'],
    workaround: ['resolved', 'cancelled'],
    // 'resolved' is terminal; 'closed' only via the gated /close endpoint
  },
  change: {
    draft: ['assessment', 'cancelled'],
    assessment: ['approval', 'rejected', 'cancelled'],
    approval: ['approved', 'rejected', 'cancelled'],
    approved: ['in_progress', 'cancelled'],
    in_progress: ['implemented', 'cancelled'],
    implemented: ['reviewing', 'closed'],
    reviewing: ['closed', 'in_progress'],
    // 'closed', 'rejected' and 'cancelled' are terminal ‒ intentionally absent
  },
};

/** Initial status a newly created ticket starts in, per type. */
export const INITIAL_TICKET_STATUS: Readonly<Record<TicketType, string>> = {
  incident: 'new',
  service_request: 'new',
  problem: 'new',
  change: 'draft',
};

/**
 * Return the list of allowed target statuses for a ticket type/status pair.
 * Returns an empty array for terminal or unknown statuses.
 */
export function getAllowedTicketTransitions(type: TicketType, currentStatus: string): string[] {
  const matrix = TICKET_TRANSITIONS[type];
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
  high: { high: 'critical', medium: 'high', low: 'medium' },
  medium: { high: 'high', medium: 'medium', low: 'low' },
  low: { high: 'medium', medium: 'low', low: 'low' },
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
