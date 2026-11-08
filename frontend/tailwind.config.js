/**
 * Tailwind configuration — Stage 1 of the visual modernization (QW-1).
 *
 * SINGLE SOURCE OF TRUTH: ./src/styles/design-tokens.json
 * The same file is imported by src/styles/tokens.ts and src/theme/buildMuiTheme.ts.
 * Do NOT add raw hex values in this file; primitives live in the JSON only.
 *
 * DARK-MODE MECHANISM (documented, pick ONE — this is it):
 *   Semantic tokens are exposed to Tailwind as `rgb(var(--color-*) / <alpha-value>)`.
 *   src/index.css defines every --color-* variable as an "R G B" triplet in :root
 *   and overrides the triplets under `.dark` (DarkModeContext toggles that class).
 *   Therefore utilities like `bg-surface-default` or `text-text-primary` switch
 *   color automatically with the active mode — no `dark:` variants needed for
 *   semantic tokens. Primitive scales (brand-*, critical-*, …) stay static hex and
 *   are only meant for one-off needs; prefer semantic tokens in new code.
 *
 *   Generated utility names (nested color keys flatten with dashes):
 *     bg-surface-default / bg-surface-canvas / bg-surface-hover
 *     border-border-subtle / border-border-strong
 *     text-text-primary / text-text-secondary / text-text-muted
 *     bg-status-critical-bg + text-status-critical-fg (badge pairs)
 *     outline-focus-ring, ring-focus-ring-offset
 *
 * @type {import('tailwindcss').Config} */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** @type {import('./src/styles/design-tokens.json')} */
const tokens = require('./src/styles/design-tokens.json');

/** Wrap a CSS-variable triplet (--color-*) so Tailwind supports /opacity modifiers. */
const semantic = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ---- Primitives (raw hex, only from design-tokens.json) ----------
        // Legacy aliases kept for existing pages/recipes (QW-3 will migrate them).
        // Values are byte-identical to the previous config; default Tailwind
        // colors (gray-*, purple-*, …) stay untouched so classes like
        // `dark:bg-gray-700` keep working.
        primary: tokens.primitives.brand,
        danger: tokens.primitives.critical,
        warning: tokens.primitives.warn,
        success: tokens.primitives.ok,
        brand: tokens.primitives.brand,
        critical: tokens.primitives.critical,
        warn: tokens.primitives.warn,
        ok: tokens.primitives.ok,
        info: tokens.primitives.info,

        // ---- Semantic tokens (mode-switchable via CSS variables) ---------
        surface: {
          canvas: semantic('surface-canvas'),
          default: semantic('surface-default'),
          sunken: semantic('surface-sunken'),
          hover: semantic('surface-hover'),
          raised: semantic('surface-raised'),
          disabled: semantic('surface-disabled'),
        },
        border: {
          subtle: semantic('border-subtle'),
          strong: semantic('border-strong'),
        },
        text: {
          primary: semantic('text-primary'),
          secondary: semantic('text-secondary'),
          muted: semantic('text-muted'),
        },
        status: {
          critical: { bg: semantic('status-critical-bg'), fg: semantic('status-critical-fg') },
          warn: { bg: semantic('status-warn-bg'), fg: semantic('status-warn-fg') },
          ok: { bg: semantic('status-ok-bg'), fg: semantic('status-ok-fg') },
          info: { bg: semantic('status-info-bg'), fg: semantic('status-info-fg') },
          idle: { bg: semantic('status-idle-bg'), fg: semantic('status-idle-fg') },
        },
        'focus-ring': semantic('focus-ring'),
        'focus-ring-offset': semantic('focus-ring-offset'),
      },

      // ---- Typography -----------------------------------------------------
      fontFamily: {
        sans: [tokens.typography.fontFamily.sans],
        mono: [tokens.typography.fontFamily.mono],
      },
      // Tailwind fontSize tuple: [size, { lineHeight, letterSpacing }]
      fontSize: Object.fromEntries(
        Object.entries(tokens.typography.scale).map(([name, t]) => [
          name,
          [t.size, { lineHeight: t.lineHeight, letterSpacing: t.letterSpacing }],
        ]),
      ),

      // ---- Radius (BUGFIX: was the invalid key `radius`, never applied) --
      borderRadius: { ...tokens.radius },

      // ---- Elevation ------------------------------------------------------
      boxShadow: { ...tokens.shadows },

      // ---- Motion ---------------------------------------------------------
      transitionDuration: { ...tokens.motion.duration },
      transitionTimingFunction: { ...tokens.motion.easing },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        // Stage 6a layout constants from design-tokens.json (px -> rem).
        // Used by PageShell for gutter/rhythm: px-page-gutter, gap-section-gap, p-card-pad.
        'page-gutter': `${tokens.spacing.pageGutter / 16}rem`,
        'section-gap': `${tokens.spacing.sectionGap / 16}rem`,
        'card-pad': `${tokens.spacing.cardPad / 16}rem`,
      },
    },
  },
  plugins: [],
};
