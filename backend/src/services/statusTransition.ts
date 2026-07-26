/**
 * Status Transition Automaton — Phase 7
 *
 * Central registry of allowed status transitions for all Phase-6 entities.
 * Each entity has a transition matrix: allowedTransitions[entityType][fromStatus] = Set<toStatus>.
 * Transitions not in the matrix are rejected with a machine-readable reason code.
 */

export type TransitionMatrix = Record<string, Record<string, Set<string>>>;

/**
 * Reason codes returned by validateTransition for diagnostic purposes.
 */
export enum TransitionReason {
  OK = 'transition_allowed',
  INVALID_FROM = 'invalid_source_status',
  INVALID_TO = 'invalid_target_status',
  NOT_ALLOWED = 'transition_not_in_matrix',
  REQUIRES_JUSTIFICATION = 'justification_required_for_transition',
}

/**
 * Result of a transition validation.
 */
export interface TransitionValidationResult {
  allowed: boolean;
  reason: TransitionReason;
  message?: string;
  allowedTargets?: string[];
}

// ==========================================
// Corrective Action transitions
// open -> in_progress | deferred | cancelled
// in_progress -> completed | deferred
// completed -> reopened (requires justification)
// deferred -> open | cancelled
// closed is terminal (no outgoing transitions)
// ==========================================
const correctiveActionTransitions: Record<string, Set<string>> = {
  open: new Set(['in_progress', 'deferred', 'cancelled']),
  in_progress: new Set(['completed', 'deferred']),
  completed: new Set(['reopened']),
  deferred: new Set(['open', 'cancelled']),
  reopened: new Set(['in_progress']),
};

// ==========================================
// Audit Finding transitions
// open -> in_progress | deferred | cancelled
// in_progress -> completed | deferred
// deferred -> open | cancelled
// completed is terminal
// ==========================================
const auditFindingTransitions: Record<string, Set<string>> = {
  open: new Set(['in_progress', 'deferred', 'cancelled']),
  in_progress: new Set(['completed', 'deferred']),
  deferred: new Set(['open', 'cancelled']),
};

// ==========================================
// BIA transitions
// draft -> under_review | archived
// under_review -> approved | rejected
// approved / rejected / archived are terminal
// ==========================================
const biaTransitions: Record<string, Set<string>> = {
  draft: new Set(['under_review', 'archived']),
  under_review: new Set(['approved', 'rejected']),
};

// ==========================================
// BCP transitions (same as BIA)
// ==========================================
const bcpTransitions: Record<string, Set<string>> = {
  draft: new Set(['under_review', 'archived']),
  under_review: new Set(['approved', 'rejected']),
};

// ==========================================
// BCP Exercise transitions
// scheduled -> in_progress | cancelled
// in_progress -> completed
// cancelled / completed are terminal
// ==========================================
const bcpExerciseTransitions: Record<string, Set<string>> = {
  scheduled: new Set(['in_progress', 'cancelled']),
  in_progress: new Set(['completed']),
};

// ==========================================
// Supplier Assessment transitions (same as BIA)
// ==========================================
const supplierAssessmentTransitions: Record<string, Set<string>> = {
  draft: new Set(['under_review', 'archived']),
  under_review: new Set(['approved', 'rejected']),
};

// ==========================================
// Training Assignment transitions
// assigned -> in_progress | overdue | cancelled
// in_progress -> completed | overdue
// overdue -> assigned | completed | expired
// completed / expired / cancelled are terminal
// ==========================================
const trainingAssignmentTransitions: Record<string, Set<string>> = {
  assigned: new Set(['in_progress', 'overdue', 'cancelled']),
  in_progress: new Set(['completed', 'overdue']),
  overdue: new Set(['assigned', 'completed', 'expired']),
};

// ==========================================
// Training Course transitions
// draft -> active | archived
// active -> archived
// archived is terminal
// ==========================================
const trainingCourseTransitions: Record<string, Set<string>> = {
  draft: new Set(['active', 'archived']),
  active: new Set(['archived']),
};

// ==========================================
// Supplier transitions
// active -> inactive | archived
// inactive -> active | archived
// archived is terminal
// ==========================================
const supplierTransitions: Record<string, Set<string>> = {
  active: new Set(['inactive', 'archived']),
  inactive: new Set(['active', 'archived']),
};

// ==========================================
// Management Review transitions (same as BIA)
// ==========================================
const managementReviewTransitions: Record<string, Set<string>> = {
  draft: new Set(['under_review', 'archived']),
  under_review: new Set(['approved', 'rejected']),
};

// ==========================================
// Security Objective transitions
// planned -> in_progress | cancelled
// in_progress -> completed | cancelled
// completed / cancelled are terminal
// ==========================================
const securityObjectiveTransitions: Record<string, Set<string>> = {
  planned: new Set(['in_progress', 'cancelled']),
  in_progress: new Set(['completed', 'cancelled']),
};

// Build the full matrix
export const transitionMatrix: TransitionMatrix = {
  correctiveActions: { ...correctiveActionTransitions },
  auditFindings: { ...auditFindingTransitions },
  bias: { ...biaTransitions },
  bcps: { ...bcpTransitions },
  bcpExercises: { ...bcpExerciseTransitions },
  supplierAssessments: { ...supplierAssessmentTransitions },
  trainingAssignments: { ...trainingAssignmentTransitions },
  trainingCourses: { ...trainingCourseTransitions },
  suppliers: { ...supplierTransitions },
  managementReviews: { ...managementReviewTransitions },
  securityObjectives: { ...securityObjectiveTransitions },
};

/**
 * Validate a status transition for a given entity type.
 */
export function validateTransition(
  entityType: string,
  fromStatus: string,
  toStatus: string,
  data?: Record<string, unknown>,
): TransitionValidationResult {
  const entityMatrix = transitionMatrix[entityType];

  if (!entityMatrix) {
    return {
      allowed: false,
      reason: TransitionReason.INVALID_FROM,
      message: `Unknown entity type: ${entityType}`,
    };
  }

  // Check if fromStatus exists in the matrix (or is a new/unknown status — allow pass-through for unknown from)
  const allowedTargets = entityMatrix[fromStatus];

  if (!allowedTargets) {
    // If fromStatus is not defined, it's either terminal or invalid
    const allKnownStates = Object.keys(entityMatrix);
    return {
      allowed: false,
      reason: TransitionReason.INVALID_FROM,
      message: `Source status "${fromStatus}" is not valid for ${entityType}`,
      allowedTargets: allKnownStates,
    };
  }

  // Check if toStatus is in the allowed set
  if (!allowedTargets.has(toStatus)) {
    return {
      allowed: false,
      reason: TransitionReason.NOT_ALLOWED,
      message: `Transition from "${fromStatus}" to "${toStatus}" is not allowed for ${entityType}`,
      allowedTargets: Array.from(allowedTargets),
    };
  }

  // Check if justification is required for specific transitions
  const requiresJustification = isJustificationRequired(entityType, fromStatus, toStatus);
  if (requiresJustification && !data?.justification) {
    return {
      allowed: false,
      reason: TransitionReason.REQUIRES_JUSTIFICATION,
      message: `Transition from "${fromStatus}" to "${toStatus}" requires a justification`,
      allowedTargets: Array.from(allowedTargets),
    };
  }

  return {
    allowed: true,
    reason: TransitionReason.OK,
    allowedTargets: Array.from(allowedTargets),
  };
}

/**
 * Check if a specific transition requires justification.
 */
function isJustificationRequired(entityType: string, fromStatus: string, toStatus: string): boolean {
  // CAPA: completed -> reopened requires justification
  if (entityType === 'correctiveActions' && fromStatus === 'completed' && toStatus === 'reopened') {
    return true;
  }

  return false;
}

/**
 * Get all allowed transitions for a given entity type and current status.
 */
export function getAllowedTransitions(entityType: string, fromStatus: string): string[] {
  const entityMatrix = transitionMatrix[entityType];
  if (!entityMatrix || !entityMatrix[fromStatus]) {
    return [];
  }
  return Array.from(entityMatrix[fromStatus]);
}

/**
 * Get all known statuses for a given entity type.
 */
export function getAllKnownStatuses(entityType: string): string[] {
  const entityMatrix = transitionMatrix[entityType];
  if (!entityMatrix) {
    return [];
  }
  // Collect all unique states (both keys and values)
  const states = new Set<string>(Object.keys(entityMatrix));
  for (const targets of Object.values(entityMatrix)) {
    for (const t of targets) {
      states.add(t);
    }
  }
  return Array.from(states).sort();
}

/**
 * Check if a status is terminal (no outgoing transitions defined).
 */
export function isTerminalStatus(entityType: string, status: string): boolean {
  const entityMatrix = transitionMatrix[entityType];
  if (!entityMatrix) {
    return true; // Unknown entities are treated as terminal
  }
  // A status is terminal if it has no outgoing transitions defined
  return !entityMatrix[status] || entityMatrix[status].size === 0;
}
