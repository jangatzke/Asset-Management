import { ReactNode } from 'react';

/**
 * Semantic status badge.
 *
 * Provides a single, consistent palette across the app so color meaning is
 * stable: red = critical/high, amber = medium, green = low/active/closed.
 * Never reuse red to mean "closed".
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

type BadgeClass = string;

const criticalityClasses: Record<string, BadgeClass> = {
  low: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-800 dark:text-white',
  medium: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-white',
  high: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  critical: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-danger-100 text-danger-800 dark:bg-danger-800 dark:text-white',
};

const priorityClasses: Record<string, BadgeClass> = {
  low: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  medium: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-white',
  high: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  critical: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-danger-100 text-danger-800 dark:bg-danger-800 dark:text-white',
};

const stateClasses: Record<string, BadgeClass> = {
  active: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-800 dark:text-white',
  in_progress: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  under_investigation: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  identified: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-white',
  assessed: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-white',
  treatment_planned: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  treatment_in_progress: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-800 dark:text-white',
  resolved: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-800 dark:text-white',
  fulfilled: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-800 dark:text-white',
  closed: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  default: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

function resolveClasses(kind: StatusBadgeProps['kind'], value: string): BadgeClass {
  switch (kind) {
    case 'criticality':
      return criticalityClasses[value] ?? criticalityClasses.medium;
    case 'priority':
      return priorityClasses[value] ?? priorityClasses.medium;
    case 'state':
      return stateClasses[value] ?? stateClasses.default;
    case 'custom':
      return '';
    default:
      return '';
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ kind, value, label, ariaLabel, children }) => {
  const classes = resolveClasses(kind, value);
  const text = label ?? value;

  return (
    <span
      className={`${classes} ${classes ? 'gap-1' : 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
      aria-label={ariaLabel}
    >
      {children ?? text}
    </span>
  );
};

export default StatusBadge;
