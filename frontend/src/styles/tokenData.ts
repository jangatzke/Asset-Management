/**
 * Layer 0 — raw design-token data (LT-1, Stage 10a).
 *
 * This is the ONLY module that imports `design-tokens.json`. Every other token
 * layer (palette / typography / space / motion / recipes) and the MUI theme
 * builder consume the typed accessors exported here. The barrel `tokens.ts`
 * re-exports everything for backward compatibility with existing imports.
 *
 * SINGLE SOURCE OF TRUTH: `./design-tokens.json`. Do not define values here.
 */

import designTokensJson from './design-tokens.json';

/* --- Types --------------------------------------------------------------- */

export type ColorMode = 'light' | 'dark';

/** Status intents used by the semantic status pairs. */
export type StatusKind = 'critical' | 'warn' | 'ok' | 'info' | 'idle';

/** A 50–900 primitive color ramp (raw hex values). */
export type PrimitiveScale = Record<string, string>;

/** Raw palette primitives — the only place raw hex is allowed. */
export interface PrimitivePalette {
  brand: PrimitiveScale;
  critical: PrimitiveScale;
  warn: PrimitiveScale;
  ok: PrimitiveScale;
  info: PrimitiveScale;
  neutral: PrimitiveScale;
}

/** Background/foreground pair for a status badge (hex values). */
export interface StatusPair {
  bg: string;
  fg: string;
}

/** Semantic tokens for one color mode. */
export interface SemanticTokenSet {
  'surface-canvas': string;
  'surface-default': string;
  'surface-sunken': string;
  'surface-hover': string;
  'surface-raised': string;
  'surface-disabled': string;
  'border-subtle': string;
  'border-strong': string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;
  'focus-ring': string;
  'focus-ring-offset': string;
  status: Record<StatusKind, StatusPair>;
}

/** Semantic tokens for both color modes. */
export interface SemanticTokens {
  light: SemanticTokenSet;
  dark: SemanticTokenSet;
}

/** Names of the semantic surface/border/text/focus tokens resolvable via `sem()`. */
export type SemanticColorName =
  | 'surface-canvas'
  | 'surface-default'
  | 'surface-sunken'
  | 'surface-hover'
  | 'surface-raised'
  | 'surface-disabled'
  | 'border-subtle'
  | 'border-strong'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'focus-ring'
  | 'focus-ring-offset';

/** One entry of the shared typography scale. */
export interface TypographyEntry {
  size: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing: string;
}

/** Shared type scale (Tailwind fontSize tuples + MUI variants). */
export interface TypographyScale {
  fontFamily: { sans: string; mono: string };
  scale: Record<'display' | 'h1' | 'h2' | 'h3' | 'body1' | 'body2' | 'caption', TypographyEntry>;
}

/** Border-radius scale. */
export interface RadiusScale {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/** Elevation scale e0–e3. */
export interface ShadowScale {
  e0: string;
  e1: string;
  e2: string;
  e3: string;
}

/** Motion durations and easings. */
export interface MotionScale {
  duration: Record<'instant' | 'fast' | 'normal' | 'slow', string>;
  easing: Record<'standard' | 'decelerate' | 'accelerate', string>;
}

/** Spacing base unit + Stage 6a layout constants. */
export interface SpacingScale {
  unit: number;
  pageGutter: number;
  sectionGap: number;
  cardPad: number;
}

/** The full raw token document (as defined by design-tokens.json). */
export interface DesignTokenDocument {
  primitives: PrimitivePalette;
  semantic: SemanticTokens;
  typography: TypographyScale;
  radius: RadiusScale;
  shadows: ShadowScale;
  motion: MotionScale;
  spacing: SpacingScale;
}

/* --- Typed accessors ------------------------------------------------------ */

/** Full raw token document (primitives, semantic, typography, radius, shadows, motion). */
export const tokens: DesignTokenDocument = designTokensJson as unknown as DesignTokenDocument;

/** Alias kept for internal consumers of this layer. */
export const designTokens = tokens;

/** Border-radius scale (sm/md/lg/xl). Raw scale — prefer Tailwind `rounded-*` classes. */
export const radius = tokens.radius;

/** Elevation scale e0–e3. Raw values — use via Tailwind shadow utilities / MUI theme only. */
export const shadows = tokens.shadows;
