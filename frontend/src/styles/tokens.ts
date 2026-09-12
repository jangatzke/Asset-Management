/**
 * Semantic design tokens for the frontend.
 *
 * Centralizes color/spacing/radius usage so the app keeps a consistent look
 * without scattering raw Tailwind color literals (e.g. `bg-blue-600`) across
 * pages. Import these strings instead of hard-coding palette values.
 *
 * Usage:
 *   import { buttonPrimary, badgeCritical } from '../styles/tokens';
 *   <button className={buttonPrimary}>Save</button>
 *   <span className={badgeCritical}>critical</span>
 */

/* --- Buttons ------------------------------------------------------------- */

/** Primary action button (Create / Save / Update). */
export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50';

/** Secondary / ghost action button (Cancel, secondary actions). */
export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';

/** Destructive action button (Delete). */
export const buttonDanger =
  'inline-flex items-center justify-center gap-2 rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50';

/* --- Icon action buttons (list rows) ------------------------------------- */

export const iconButtonBase =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';

export const iconButtonEdit = `${iconButtonBase} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`;
export const iconButtonView = `${iconButtonBase} text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300`;
export const iconButtonHistory = `${iconButtonBase} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`;
export const iconButtonDanger = `${iconButtonBase} text-danger-600 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300`;

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
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500';

export const selectField =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500';

/* --- Layout primitives --------------------------------------------------- */
export const cardSurface =
  'bg-white dark:bg-gray-800 rounded-lg shadow';
export const metricCard =
  'block bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';
