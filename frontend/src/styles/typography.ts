/**
 * Layer 1 — typography (LT-1, Stage 10a).
 *
 * The shared type scale from `design-tokens.json` (`typography.*`). Tailwind
 * consumes the same JSON via tailwind.config.js and the MUI theme builder maps
 * these entries to its variants — this module is the typed accessor for TS
 * consumers only. Values must never be redefined here.
 *
 * NOTE: numeric data (IDs, counters, SLA clocks) should use tabular figures —
 * apply `font-variant-numeric: tabular-nums` via the Tailwind utility
 * `tabular-nums` on the element, not by inventing a new font stack.
 */

import { tokens } from './tokenData';

/** Typography scale shared with the MUI theme and Tailwind fontSize config. */
export const typography = tokens.typography;

/** Font stacks (sans/mono) — identical to what Tailwind/MUI receive. */
export const fontStack = tokens.typography.fontFamily;

/**
 * Names of the shared scale entries. These are also the keys registered as
 * Tailwind `text-*` utilities in tailwind.config.js; use the utility classes
 * (`text-display`, `text-h1`, …) instead of referencing this array at runtime.
 */
export const fontSizeUtilities = Object.keys(tokens.typography.scale) as Array<
  keyof typeof tokens.typography.scale
>;
