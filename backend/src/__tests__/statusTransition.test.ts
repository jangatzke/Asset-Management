/**
 * Status Transition Automaton Tests — Phase 7
 */

import {
  validateTransition,
  getAllowedTransitions,
  getAllKnownStatuses,
  isTerminalStatus,
  TransitionReason,
} from '../services/statusTransition';
import { INCIDENT_TRANSITIONS } from 'shared';

describe('Status Transition Automaton', () => {
  describe('Incident transitions', () => {
    it('allows new -> under_investigation, contained, and resolved', () => {
      expect(getAllowedTransitions('incidents', 'new').sort()).toEqual(['contained', 'resolved', 'under_investigation']);
      expect(validateTransition('incidents', 'new', 'under_investigation').allowed).toBe(true);
      expect(validateTransition('incidents', 'new', 'contained').allowed).toBe(true);
      expect(validateTransition('incidents', 'new', 'resolved').allowed).toBe(true);
    });

    it('allows under_investigation -> new, contained, and resolved', () => {
      expect(getAllowedTransitions('incidents', 'under_investigation').sort()).toEqual(['contained', 'new', 'resolved']);
      expect(validateTransition('incidents', 'under_investigation', 'new').allowed).toBe(true);
      expect(validateTransition('incidents', 'under_investigation', 'contained').allowed).toBe(true);
      expect(validateTransition('incidents', 'under_investigation', 'resolved').allowed).toBe(true);
    });

    it('allows contained -> under_investigation and resolved but NOT new (UI parity with backend)', () => {
      expect(getAllowedTransitions('incidents', 'contained').sort()).toEqual(['resolved', 'under_investigation']);
      expect(getAllowedTransitions('incidents', 'contained')).not.toContain('new');
      expect(validateTransition('incidents', 'contained', 'under_investigation').allowed).toBe(true);
      expect(validateTransition('incidents', 'contained', 'resolved').allowed).toBe(true);
      expect(validateTransition('incidents', 'contained', 'new').allowed).toBe(false);
      expect(validateTransition('incidents', 'contained', 'new').reason).toBe(TransitionReason.NOT_ALLOWED);
    });

    it('rejects transitions from the terminal resolved status', () => {
      expect(getAllowedTransitions('incidents', 'resolved')).toEqual([]);
      expect(isTerminalStatus('incidents', 'resolved')).toBe(true);
      expect(validateTransition('incidents', 'resolved', 'new').allowed).toBe(false);
    });

    it('treats closed as unreachable via the transition automaton (gated close endpoint only)', () => {
      expect(getAllowedTransitions('incidents', 'closed')).toEqual([]);
      expect(validateTransition('incidents', 'new', 'closed').allowed).toBe(false);
    });

    it('mirrors the shared INCIDENT_TRANSITIONS matrix (single source of truth)', () => {
      const sharedKeys = Object.keys(INCIDENT_TRANSITIONS).sort();
      expect(sharedKeys).toEqual(['contained', 'new', 'under_investigation']);
      for (const fromStatus of Object.keys(INCIDENT_TRANSITIONS)) {
        const sharedTargets = (INCIDENT_TRANSITIONS[fromStatus] as readonly string[]).slice().sort();
        expect(getAllowedTransitions('incidents', fromStatus).sort()).toEqual(sharedTargets);
      }
      expect(getAllowedTransitions('incidents', 'resolved')).toEqual([]);
      expect(getAllowedTransitions('incidents', 'closed')).toEqual([]);
    });
  });

  describe('Corrective Action transitions', () => {
    it('allows open -> in_progress', () => {
      const result = validateTransition('correctiveActions', 'open', 'in_progress');
      expect(result.allowed).toBe(true);
    });

    it('allows open -> deferred', () => {
      const result = validateTransition('correctiveActions', 'open', 'deferred');
      expect(result.allowed).toBe(true);
    });

    it('allows in_progress -> completed', () => {
      const result = validateTransition('correctiveActions', 'in_progress', 'completed');
      expect(result.allowed).toBe(true);
    });

    it('requires justification for completed -> reopened', () => {
      let result = validateTransition('correctiveActions', 'completed', 'reopened', {});
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(TransitionReason.REQUIRES_JUSTIFICATION);

      result = validateTransition('correctiveActions', 'completed', 'reopened', { justification: 'Found new evidence' });
      expect(result.allowed).toBe(true);
    });

    it('rejects open -> completed directly', () => {
      const result = validateTransition('correctiveActions', 'open', 'completed');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(TransitionReason.NOT_ALLOWED);
    });

    it('rejects closed as source (terminal)', () => {
      const result = validateTransition('correctiveActions', 'closed', 'in_progress');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(TransitionReason.INVALID_FROM);
    });
  });

  describe('Audit Finding transitions', () => {
    it('allows open -> in_progress', () => {
      const result = validateTransition('auditFindings', 'open', 'in_progress');
      expect(result.allowed).toBe(true);
    });

    it('allows in_progress -> completed', () => {
      const result = validateTransition('auditFindings', 'in_progress', 'completed');
      expect(result.allowed).toBe(true);
    });

    it('rejects open -> completed directly', () => {
      const result = validateTransition('auditFindings', 'open', 'completed');
      expect(result.allowed).toBe(false);
    });
  });

  describe('BIA transitions', () => {
    it('allows draft -> under_review', () => {
      const result = validateTransition('bias', 'draft', 'under_review');
      expect(result.allowed).toBe(true);
    });

    it('allows under_review -> approved', () => {
      const result = validateTransition('bias', 'under_review', 'approved');
      expect(result.allowed).toBe(true);
    });

    it('allows under_review -> rejected', () => {
      const result = validateTransition('bias', 'under_review', 'rejected');
      expect(result.allowed).toBe(true);
    });

    it('rejects draft -> approved directly', () => {
      const result = validateTransition('bias', 'draft', 'approved');
      expect(result.allowed).toBe(false);
    });

    it('marks approved as terminal', () => {
      expect(isTerminalStatus('bias', 'approved')).toBe(true);
    });
  });

  describe('BCP transitions', () => {
    it('allows draft -> under_review', () => {
      const result = validateTransition('bcps', 'draft', 'under_review');
      expect(result.allowed).toBe(true);
    });

    it('rejects unknown entity type', () => {
      const result = validateTransition('unknownEntity', 'foo', 'bar');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(TransitionReason.INVALID_FROM);
    });
  });

  describe('BCP Exercise transitions', () => {
    it('allows scheduled -> in_progress', () => {
      const result = validateTransition('bcpExercises', 'scheduled', 'in_progress');
      expect(result.allowed).toBe(true);
    });

    it('allows in_progress -> completed', () => {
      const result = validateTransition('bcpExercises', 'in_progress', 'completed');
      expect(result.allowed).toBe(true);
    });

    it('allows scheduled -> cancelled', () => {
      const result = validateTransition('bcpExercises', 'scheduled', 'cancelled');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Training Assignment transitions', () => {
    it('allows assigned -> in_progress', () => {
      const result = validateTransition('trainingAssignments', 'assigned', 'in_progress');
      expect(result.allowed).toBe(true);
    });

    it('allows in_progress -> completed', () => {
      const result = validateTransition('trainingAssignments', 'in_progress', 'completed');
      expect(result.allowed).toBe(true);
    });

    it('allows assigned -> overdue', () => {
      const result = validateTransition('trainingAssignments', 'assigned', 'overdue');
      expect(result.allowed).toBe(true);
    });

    it('allows overdue -> completed', () => {
      const result = validateTransition('trainingAssignments', 'overdue', 'completed');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Supplier transitions', () => {
    it('allows active -> inactive', () => {
      const result = validateTransition('suppliers', 'active', 'inactive');
      expect(result.allowed).toBe(true);
    });

    it('allows inactive -> active', () => {
      const result = validateTransition('suppliers', 'inactive', 'active');
      expect(result.allowed).toBe(true);
    });

    it('allows active -> archived', () => {
      const result = validateTransition('suppliers', 'active', 'archived');
      expect(result.allowed).toBe(true);
    });

    it('marks archived as terminal', () => {
      expect(isTerminalStatus('suppliers', 'archived')).toBe(true);
    });
  });

  describe('Utility functions', () => {
    it('returns allowed transitions for correctiveActions from open', () => {
      const allowed = getAllowedTransitions('correctiveActions', 'open');
      expect(allowed).toContain('in_progress');
      expect(allowed).toContain('deferred');
      expect(allowed).toContain('cancelled');
    });

    it('returns all known statuses for correctiveActions', () => {
      const statuses = getAllKnownStatuses('correctiveActions');
      expect(statuses).toContain('open');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('deferred');
      expect(statuses).toContain('cancelled');
      expect(statuses).toContain('reopened');
    });

    it('returns empty for unknown entity type', () => {
      expect(getAllowedTransitions('unknownEntity', 'foo')).toEqual([]);
      expect(getAllKnownStatuses('unknownEntity')).toEqual([]);
    });
  });
});
