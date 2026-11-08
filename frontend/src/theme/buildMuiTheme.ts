/**
 * Builds the single global MUI theme (Stage 1: QW-2).
 *
 * ALL values come from ../styles/design-tokens.json via the typed adapter in
 * ../styles/tokens.ts — do NOT introduce raw hex literals here. The same token
 * file feeds tailwind.config.js and (as mirrored CSS variables) index.css, so
 * MUI admin screens and Tailwind domain pages always show identical colors,
 * type scale, radius and elevation.
 */
import { createTheme, type Theme } from '@mui/material/styles';
import { primitives, semanticTokens, radius, shadows, typography, motion, spacing as spacingUnit } from '../styles/tokens';

const brand = primitives.brand;
const critical = primitives.critical;
const warn = primitives.warn;
const ok = primitives.ok;
const info = primitives.info;

/** Build a MUI color palette entry from a primitive scale, tuned per mode. */
const paletteEntry = (scale: typeof brand, darkMode: boolean) => ({
  main: darkMode ? scale['400'] : scale['600'],
  light: scale['300'],
  dark: scale['700'],
  // White labels clear WCAG AA on the *-600 fills; dark canvas clears on *-400.
  contrastText: darkMode ? semanticTokens('dark')['surface-canvas'] : '#ffffff',
});

/** CSS px value from the shared radius scale. */
const r = (key: keyof typeof radius) => radius[key];

/** MUI expects a 25-entry shadows array; map our e0–e3 elevation onto it. */
const buildShadows = (): Theme['shadows'] => {
  const levels: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    if (i === 0) levels.push(shadows.e0);
    else if (i <= 5) levels.push(shadows.e1); // low cards, chips
    else if (i <= 12) levels.push(shadows.e2); // menus, popovers
    else levels.push(shadows.e3); // dialogs, overlays
  }
  return levels as Theme['shadows'];
};

const scale = typography.scale;
/** Shared helper: turn a token step into MUI variant CSS. */
const variant = (step: (typeof scale)[keyof typeof scale], tabular = false) => ({
  fontSize: step.size,
  lineHeight: step.lineHeight,
  fontWeight: step.fontWeight,
  ...(step.letterSpacing !== 'normal' ? { letterSpacing: step.letterSpacing } : {}),
  // Headings/numbers align in tables and metric grids (Stage 3+ relies on this).
  ...(tabular ? { fontVariantNumeric: 'tabular-nums' } : {}),
});

/**
 * Build the shared MUI theme for the given color mode.
 * `display` is exposed as an extra typography variant (cast below) so admin
 * screens can use `<Typography variant="display">`; unknown keys are ignored by
 * MUI at runtime but survive in the theme object.
 */
export const buildMuiTheme = (darkMode: boolean): Theme => {
  const mode = darkMode ? 'dark' : 'light';
  const s = semanticTokens(mode);

  return createTheme({
    palette: {
      mode,
      primary: paletteEntry(brand, darkMode),
      secondary: paletteEntry(info, darkMode),
      error: paletteEntry(critical, darkMode),
      warning: paletteEntry(warn, darkMode),
      success: paletteEntry(ok, darkMode),
      info: paletteEntry(info, darkMode),
      background: { default: s['surface-canvas'], paper: s['surface-default'] },
      divider: s['border-subtle'],
      text: { primary: s['text-primary'], secondary: s['text-secondary'], disabled: s['text-muted'] },
    },

    typography: {
      fontFamily: typography.fontFamily.sans,
      htmlFontSize: 16,
      // Exact scale from design-tokens.json (see tokens.ts `typography`).
      h1: variant(scale.display, true), // display step: 28/36 · 600
      h2: variant(scale.h1, true), // h1 step: 20/28 · 600
      h3: variant(scale.h2), // h2 step: 16/24 · 600
      h4: variant(scale.h3), // h3 step: 14/20 · 600
      body1: variant(scale.body1), // 14/20 · 400
      body2: variant(scale.body2), // 13/18
      caption: variant(scale.caption), // 11/16 · 600 + letterSpacing
      button: { fontSize: scale.body1.size, fontWeight: 500, textTransform: 'none' },
      // Extra runtime-only variant (stripped by the Theme type at compile time).
      display: variant(scale.display, true),
    } as unknown as Theme['typography'],

    shape: { borderRadius: 8 },
    spacing: spacingUnit.unit,
    shadows: buildShadows(),

    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: r('md'),
            transitionDuration: motion.duration.fast,
            '&:focus-visible': {
              outline: `2px solid ${s['focus-ring']}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: r('sm') },
          notchedOutline: { borderColor: s['border-strong'] },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 1 },
        styleOverrides: {
          // e1 shadow (from the shadows array) + hairline border instead of a
          // hard drop shadow, so cards stay readable on the canvas surface.
          root: { border: `1px solid ${s['border-subtle']}` },
          outlined: { border: `1px solid ${s['border-strong']}` },
        },
      },
      MuiDialog: {
        styleOverrides: {
          // Unified dialog look (Stage 7 / MT-4): radius lg, hairline border,
          // surface-default fill; elevation 24 already maps to e3 via shadows.
          paper: {
            borderRadius: r('lg'),
            border: `1px solid ${s['border-subtle']}`,
            backgroundColor: s['surface-default'],
            color: s['text-primary'],
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          // h3 step (14/20 · 600) — matches the Tailwind Dialog title.
          root: { ...variant(scale.h3), color: s['text-primary'], padding: '16px 24px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '16px 24px' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          // Right-aligned actions, same rhythm as the Tailwind Dialog footer.
          root: { padding: '16px 24px', gap: 8 },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: r('md'), boxShadow: shadows.e2 },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { fontSize: scale.body1.size, minHeight: 36 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { borderRadius: r('sm'), fontSize: scale.caption.size, fontWeight: 500 },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: r('sm'), textTransform: 'none' } },
      },
      MuiTableHead: {
        styleOverrides: { root: { backgroundColor: s['surface-sunken'] } },
      },
      MuiTableRow: {
        styleOverrides: {
          // Row hover matches the Tailwind list rows (`hover:bg-surface-hover`).
          root: {
            transition: `background-color ${motion.duration.fast} ${motion.easing.standard}`,
            '&:hover': { backgroundColor: s['surface-hover'] },
            '&:last-child td, &:last-child th': { borderBottom: 0 },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          // Caption typography + token border instead of the previous
          // #f9fafb / #374151 hardcodes.
          head: {
            ...variant(scale.caption),
            color: s['text-secondary'],
            borderBottom: `1px solid ${s['border-subtle']}`,
          },
          body: {
            fontSize: scale.body2.size,
            borderBottom: `1px solid ${s['border-subtle']}`,
          },
        },
      },
    },
  });
};
