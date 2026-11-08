/**
 * Design tokens — BARREL (LT-1, Stage 10a).
 *
 * Layering (single source of truth: ./design-tokens.json):
 *   tokenData.ts  L0 — loads design-tokens.json once + TypeScript types
 *   palette.ts    L1 — primitives, semanticTokens(mode), sem(), statusPair()
 *   typography.ts L1 — typography scale, fontStack, fontSizeUtilities
 *   space.ts      L1 — spacing, layoutRhythm, control heights
 *   motion.ts     L1 — durations/easings (instant/fast/normal/slow, ease-standard …)
 *   recipes.ts    L2 — Tailwind class-string recipes (buttonPrimary, metricCard, …)
 *
 * This file contains NO definitions — it only re-exports the layers so that all
 * historical imports (`import { buttonPrimary } from '../styles/tokens'`) keep
 * working unchanged. New code may import the specific layer module directly.
 *
 * Usage:
 *   import { buttonPrimary, badgeCritical } from '../styles/tokens';
 *   <button className={buttonPrimary}>Save</button>
 *   <span className={badgeCritical}>critical</span>
 *
 * GUARD NOTE (rowActionAccessibility.test.ts): the shared icon-button recipe
 * `export const iconButtonBase` — including its focus ring classes
 * `focus:ring-2 focus:ring-primary-500` — is defined verbatim in ./recipes.ts
 * and re-exported below; this barrel must keep re-exporting it.
 */

/* --- L0: raw token data + types ------------------------------------------ */
export {
  tokens,
  designTokens,
  radius,
  shadows,
} from './tokenData';
export type {
  ColorMode,
  StatusKind,
  PrimitiveScale,
  PrimitivePalette,
  StatusPair,
  SemanticTokenSet,
  SemanticTokens,
  SemanticColorName,
  TypographyEntry,
  TypographyScale,
  RadiusScale,
  ShadowScale,
  MotionScale,
  SpacingScale,
  DesignTokenDocument,
} from './tokenData';

/* --- L1: palette ---------------------------------------------------------- */
export { primitives, semanticTokens, sem, statusPair } from './palette';

/* --- L1: typography ------------------------------------------------------- */
export { typography, fontStack, fontSizeUtilities } from './typography';

/* --- L1: space ------------------------------------------------------------ */
export {
  spacing,
  layoutRhythm,
  pageGutter,
  sectionGap,
  cardPad,
  controlHeightStandard,
  controlHeightCompact,
} from './space';

/* --- L1: motion ----------------------------------------------------------- */
export { motion } from './motion';

/* --- L2: component recipes ------------------------------------------------ */
export {
  buttonPrimary,
  buttonSecondary,
  buttonDanger,
  iconButtonBase,
  iconButtonEdit,
  iconButtonView,
  iconButtonHistory,
  iconButtonDanger,
  badgeCritical,
  badgeHigh,
  badgeMedium,
  badgeLow,
  badgeStateActive,
  badgeStateClosed,
  inputField,
  selectField,
  focusRing,
  cardSurface,
  metricCard,
} from './recipes';
