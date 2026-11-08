/**
 * Layer 1 — palette (LT-1, Stage 10a).
 *
 * Primitive color ramps and the mode-resolved semantic colors. This module only
 * exposes COLOR VALUES / status pairs — no Tailwind class-string assembly
 * (that lives in `recipes.ts`; badge CLASS helpers stay in
 * `utils/statusHelpers.ts`). Raw hex values are defined exclusively in
 * `design-tokens.json` (`primitives.*`); pages must never import this layer.
 */

import { tokens } from './tokenData';
import type { ColorMode, SemanticColorName, StatusKind, StatusPair } from './tokenData';

/* --- Primitive palette ---------------------------------------------------- */

/** Primitive palette. Only source of raw hex values — do not use directly in pages. */
export const primitives = tokens.primitives;

/* --- Semantic colors ------------------------------------------------------ */

/** Semantic tokens for one color mode. */
export const semanticTokens = (mode: ColorMode) => tokens.semantic[mode];

/** Convenience: resolve a semantic surface/border/text/focus token for a mode. */
export const sem = (mode: ColorMode, name: SemanticColorName) => tokens.semantic[mode][name];

/** Status badge pair (bg/fg) for a mode. */
export const statusPair = (mode: ColorMode, status: StatusKind): StatusPair =>
  tokens.semantic[mode].status[status];
