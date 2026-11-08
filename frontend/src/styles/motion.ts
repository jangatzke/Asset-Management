/**
 * Layer 1 — motion (LT-1, Stage 10a).
 *
 * Motion durations and easings from `design-tokens.json` (`motion.*`). The keys
 * are exactly as in the JSON: durations `instant`/`fast`/`normal`/`slow`
 * (0ms/120ms/200ms/300ms) and easings `standard`/`decelerate`/`accelerate`.
 * Tailwind registers them as `duration-*` / `ease-*` utilities; the reduced
 * motion override lives in index.css and must stay.
 *
 * MOTION RULE (MT-8): hover/focus feedback uses calm elevation/color changes —
 * NO `translate-y`/lift transforms on cards or rows.
 */

import { tokens } from './tokenData';

/** Motion durations and easings. */
export const motion = tokens.motion;
