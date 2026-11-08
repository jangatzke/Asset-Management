/**
 * Layer 2 — component recipes (LT-1, Stage 10a).
 *
 * Tailwind class-string recipes for shared UI patterns. These strings are the
 * ONLY place where utility classes with semantic token names (`primary-*`,
 * `danger-*`, `focus-ring-offset-*`) and the documented legacy grays are
 * composed; pages/components import these constants instead of writing DIY
 * class strings (enforced by scripts/check-design-tokens.cjs).
 *
 * The class strings below are byte-identical to their historical definitions in
 * tokens.ts — do not "improve" them, the contrast tests assert on them.
 */

import { controlHeightStandard, controlHeightCompact } from './space';

/* --- Buttons ------------------------------------------------------------- */

/** Primary action button (Create / Save / Update). */
export const buttonPrimary =
  `inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-normal ease-standard hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset disabled:opacity-50 ${controlHeightStandard}`;

/** Secondary / ghost action button (Cancel, secondary actions). */
export const buttonSecondary =
  `inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors duration-normal ease-standard hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset ${controlHeightStandard}`;

/** Destructive action button (Delete). */
export const buttonDanger =
  `inline-flex items-center justify-center gap-2 rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-normal ease-standard hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset disabled:opacity-50 ${controlHeightStandard}`;

/* --- Icon action buttons (list rows) ------------------------------------- */

// MT-9: the ring offset uses the semantic focus-ring-offset token (mode-switchable via
// CSS variables in index.css), so no raw `dark:` gray is needed anymore.
export const iconButtonBase =
  `inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors duration-fast ease-standard hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset dark:hover:bg-gray-700 ${controlHeightCompact}`;

// Dark-mode shades are chosen to clear WCAG AA (>= 4.5:1) against both the
// resting row background (gray-800/gray-900) and the hover background
// (dark:hover:bg-gray-700 from iconButtonBase). See utils/contrast.test.ts.
export const iconButtonEdit = `${iconButtonBase} text-primary-600 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200`;
export const iconButtonView = `${iconButtonBase} text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200`;
export const iconButtonHistory = `${iconButtonBase} text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-200`;
export const iconButtonDanger = `${iconButtonBase} text-danger-600 hover:text-danger-800 dark:text-danger-300 dark:hover:text-danger-200`;

/* --- Status / criticality badges ----------------------------------------- */
/**
 * Stable palette: red = critical/high, amber = medium/in-progress,
 * green = low/active/closed. Never reuse red to mean "closed".
 */
export const badgeCritical =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-danger-100 text-danger-800 dark:bg-danger-950 dark:text-danger-200';
export const badgeHigh =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-warning-100 text-warning-800 dark:bg-warning-950 dark:text-warning-200';
export const badgeMedium =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-200';
export const badgeLow =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-950 dark:text-success-200';

/** Lifecycle / workflow state badge (active = green, closed = slate). */
export const badgeStateActive =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-success-100 text-success-800 dark:bg-success-950 dark:text-success-200';
export const badgeStateClosed =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

/* --- Form controls ------------------------------------------------------- */
export const inputField =
  `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${controlHeightStandard}`;

export const selectField =
  `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${controlHeightStandard}`;

/* --- Keyboard focus ------------------------------------------------------ */

/**
 * Explicit focus ring for composite widgets (currently the AssetGraph
 * viewport). Reuses the primary accent token instead of new hex values and is
 * additive to the global `:focus-visible` outline in index.css.
 */
export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset';

/* --- Layout primitives --------------------------------------------------- */
export const cardSurface =
  'bg-white dark:bg-gray-800 rounded-lg shadow';
// MT-8: card lift replaced by a calm elevation change (no translate transform).
export const metricCard =
  'block bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition duration-normal ease-standard hover:shadow-e2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset';
