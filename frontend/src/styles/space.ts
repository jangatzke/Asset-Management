/**
 * Layer 1 — space (LT-1, Stage 10a).
 *
 * Spacing base unit (4px), the Stage 6a layout rhythm constants and the QW-6
 * control-height conventions. The numeric values live in `design-tokens.json`
 * (`spacing.*`); Tailwind exposes them as `px-page-gutter` / `gap-section-gap`
 * / `p-card-pad` utilities via tailwind.config.js. Use these helpers instead of
 * hardcoding gutters/paddings per page.
 */

import { tokens } from './tokenData';

/** Base spacing unit (px) and Stage 6a layout constants (pageGutter/sectionGap/cardPad). */
export const spacing = tokens.spacing;

/**
 * Tailwind class fragments for the Stage 6a layout rhythm. The values come from
 * `design-tokens.json` (`spacing.pageGutter` etc.) and are registered as
 * utilities in tailwind.config.js (`px-page-gutter`, `gap-section-gap`,
 * `p-card-pad`). Use these instead of hardcoding gutters per page.
 */
export const layoutRhythm = {
  /** Desktop page gutter; combine with `px-4 sm:px-6` for smaller viewports. */
  pageGutterX: 'lg:px-page-gutter',
  /** Vertical rhythm between top-level page sections (PageShell flex gap). */
  sectionGapY: 'gap-section-gap',
  /** Inner padding of cards/panels. */
  cardPad: 'p-card-pad',
} as const;

/** Desktop page gutter in px (Tailwind utility: `px-page-gutter`). */
export const pageGutter = tokens.spacing.pageGutter;

/** Vertical gap between top-level page sections in px (Tailwind utility: `gap-section-gap`). */
export const sectionGap = tokens.spacing.sectionGap;

/** Inner padding of cards/panels in px (Tailwind utility: `p-card-pad`). */
export const cardPad = tokens.spacing.cardPad;

/* --- Control heights (QW-6) ---------------------------------------------- */

/**
 * Explicit control-height conventions replacing the removed global
 * `min-height: 2.75rem` base rule. Apply via recipes/utilities only — never
 * reintroduce a global selector for control heights.
 * Standard form controls and action buttons: 36px (2.25rem).
 */
export const controlHeightStandard = 'min-h-[2.25rem]';

/** Compact controls (icon buttons, toolbar chips): 32px (2rem). */
export const controlHeightCompact = 'min-h-[2rem]';
