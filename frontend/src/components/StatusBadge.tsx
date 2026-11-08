import { ReactNode } from 'react';
import { statusBadgeClass, type StatusKind } from '../utils/statusHelpers';

/**
 * Semantic status badge.
 *
 * Provides a single, consistent palette across the app so color meaning is
 * stable: red = critical/high, amber = medium, green = low/active/closed.
 * Never reuse red to mean "closed".
 *
 * Stage 4 (QW-5): the color pairs now come from the central `statusBadgeClass`
 * helper (semantic status tokens) instead of per-kind raw-palette maps, so every
 * badge switches automatically with the active color mode.
 *
 * Props:
 *  - `kind`: 'criticality' | 'state' | 'priority' | 'custom'
 *  - `value`: the raw enum value (e.g. 'critical', 'active', 'closed')
 *  - `label`: accessible/display label. When omitted the value is shown.
 */

export interface StatusBadgeProps {
  kind: 'criticality' | 'state' | 'priority' | 'custom';
  value: string;
  label?: string;
  /** Optional extra aria-label for screen readers. */
  ariaLabel?: string;
  children?: ReactNode;
}

/** Shared pill shape (colors come from statusBadgeClass). */
const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold';

const criticalityKinds: Record<string, StatusKind> = {
  low: 'ok',
  medium: 'info',
  high: 'warn',
  critical: 'critical',
};

const priorityKinds: Record<string, StatusKind> = {
  low: 'idle',
  medium: 'info',
  high: 'warn',
  critical: 'critical',
};

const stateKinds: Record<string, StatusKind> = {
  active: 'ok',
  in_progress: 'warn',
  under_investigation: 'warn',
  identified: 'info',
  assessed: 'info',
  treatment_planned: 'warn',
  treatment_in_progress: 'warn',
  resolved: 'ok',
  fulfilled: 'ok',
  closed: 'idle',
};

function resolveKind(kind: StatusBadgeProps['kind'], value: string): StatusKind {
  switch (kind) {
    case 'criticality':
      return criticalityKinds[value] ?? 'info';
    case 'priority':
      return priorityKinds[value] ?? 'info';
    case 'state':
      return stateKinds[value] ?? 'idle';
    default:
      return 'idle';
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ kind, value, label, ariaLabel, children }) => {
  const text = label ?? value;

  return (
    <span className={`${badgeBase} ${statusBadgeClass(resolveKind(kind, value))}`} aria-label={ariaLabel}>
      {children ?? text}
    </span>
  );
};

export default StatusBadge;
