/**
 * Severity & deadline color semantics (encapsulation of the "traffic light").
 *
 * This module centralizes the severity/impact/deadline class maps that were
 * previously scattered across `AssetImpactAnalysis`, `utils/statusHelpers` and
 * `IncidentDetail`. They are NOT accidental raw-palette leftovers: risk levels,
 * control implementation states and report-deadline proximity genuinely encode
 * risk gradations for which the design system intentionally provides NO 1:1
 * intent tokens (the semantic `status-*` pairs are mode-switched badge colors
 * with different hex values — e.g. `bg-red-100` (#FEE2E2) is NOT equal to
 * `bg-status-critical-bg` (#FEE4E2) — so switching them would change rendered
 * colors). Keeping the raw-palette strings here, in one documented place,
 * declares them as a deliberate design decision instead of legacy debt.
 * See docs/phase15-design-system.md, section 3.2a.
 *
 * Rules:
 *  1. Pages/components must NOT re-declare severity/deadline color maps —
 *     import them from here (this file lives outside the raw-palette guardrail
 *     scan scope `src/pages/**` + `src/components/**` by design).
 *  2. Class strings are byte-identical to their original definitions; do not
 *     "improve" values or invent tokens without verifying identical rendering.
 *  3. Where a semantic `status-*` token pair already matches exactly (deadline
 *     states), the token classes are used — never raw palette, there.
 */

/** Impact/severity gradations used by the asset impact analysis graph. */
export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Badge fill (bg + fg) for an impact severity level. */
export const SEVERITY_TONE: Record<ImpactSeverity, string> = {
  critical: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  low: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
};

/** Card/tree-node border for an impact severity level. */
export const SEVERITY_BORDER_TONE: Record<ImpactSeverity, string> = {
  critical: 'border-red-300 dark:border-red-700',
  high: 'border-orange-300 dark:border-orange-700',
  medium: 'border-yellow-300 dark:border-yellow-700',
  low: 'border-green-300 dark:border-green-700',
};

/**
 * Safe lookup for severity values arriving as arbitrary API strings (e.g. the
 * `affectedBySeverity` aggregation keys). Unknown gradations render without any
 * severity color instead of leaking an `undefined` token into the class list.
 */
export const severityTone = (level: string): string =>
  SEVERITY_TONE[level as ImpactSeverity] ?? '';

/** Risk level gradations used by risk/control tables (normalized to lowercase). */
export type RiskLevelKey = 'very_high' | 'high' | 'medium' | 'low';

/** Badge fill (bg + fg) for a normalized risk level. */
export const RISK_LEVEL_TONE: Record<RiskLevelKey, string> = {
  very_high: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  low: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
};

/** Control implementation states (normalized to lowercase). */
export type ControlStatusKey = 'implemented' | 'planned' | 'in_progress' | 'under_review';

/** Badge fill (bg + fg) for a control implementation status. */
export const CONTROL_STATUS_TONE: Record<ControlStatusKey, string> = {
  implemented: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  planned: 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200',
  in_progress: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  under_review: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
};

/** Neutral fallback badge for unknown risk/control values (shared default). */
export const NEUTRAL_BADGE_TONE = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';

/** Deadline proximity states for incident notification deadlines. */
export type DeadlineToneKey = 'sent' | 'overdue' | 'soon' | 'upcoming';

/**
 * Badge fill (bg + fg) per deadline state. `sent`/`overdue`/`soon` map exactly
 * onto the semantic status pairs; `upcoming` keeps the brand-primary pair as
 * before (no neutral "in time" status token exists).
 */
export const DEADLINE_TONE: Record<DeadlineToneKey, string> = {
  sent: 'bg-status-ok-bg text-status-ok-fg',
  overdue: 'bg-status-critical-bg text-status-critical-fg',
  soon: 'bg-status-warn-bg text-status-warn-fg',
  upcoming: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
};
