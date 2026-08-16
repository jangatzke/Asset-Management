/**
 * Incident status transition matrix (single source of truth).
 *
 * Workflow states and allowed transitions:
 *   new                  → under_investigation | contained | resolved
 *   under_investigation  → new                 | contained | resolved
 *   contained            → under_investigation | resolved
 *   resolved             → (terminal, no outgoing transitions)
 *   closed               → (terminal, only reachable via the gated /close endpoint)
 *
 * This matrix is consumed by:
 *   - backend:  statusTransition.ts  (validateTransition, getAllowedTransitions, isTerminalStatus)
 *   - frontend: IncidentDetail.tsx   (status-transition dropdown)
 *
 * Keep in sync with the backend transition matrix. If you change a transition
 * here, rebuild the shared package (`cd shared && npm run build`) so the
 * backend picks up the change via its `shared` dependency.
 */

/** Allowed target statuses for each non-terminal incident status. */
export const INCIDENT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  new: ['under_investigation', 'contained', 'resolved'],
  under_investigation: ['new', 'contained', 'resolved'],
  contained: ['under_investigation', 'resolved'],
  // 'resolved' is terminal — intentionally absent (no outgoing transitions)
  // 'closed'  is terminal — intentionally absent (only reachable via /close)
};

/**
 * Return the list of allowed target statuses for a given current incident status.
 * Returns an empty array for terminal or unknown statuses.
 */
export function getAllowedIncidentTransitions(currentStatus: string): string[] {
  const targets = INCIDENT_TRANSITIONS[currentStatus];
  return targets ? Array.from(targets) : [];
}
