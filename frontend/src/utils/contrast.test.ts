/// <reference types="vitest" />
import {
  WCAG_AA_TEXT_LARGE,
  WCAG_AA_TEXT_NORMAL,
  WCAG_AA_NON_TEXT,
  contrastRatio,
  relativeLuminance,
  meetsWcagAa,
  extractDarkTextClasses,
} from './contrast';
import designTokens from '../styles/design-tokens.json';
import {
  badgeCritical,
  badgeHigh,
  badgeLow,
  badgeMedium,
  badgeStateActive,
  badgeStateClosed,
  buttonDanger,
  buttonPrimary,
  iconButtonEdit,
  iconButtonView,
  iconButtonHistory,
  iconButtonDanger,
  inputField,
} from '../styles/tokens';

const WHITE = '#ffffff';

/** Assert WCAG AA with a descriptive failure message (no second expect arg). */
const assertWcag = (label: string, foreground: string, background: string, threshold = WCAG_AA_TEXT_NORMAL) => {
  const ratio = contrastRatio(foreground, background);
  if (ratio < threshold) {
    throw new Error(`${label}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1 (needs >= ${threshold})`);
  }
};

describe('contrast utility (WCAG 2.1 relative luminance)', () => {
  it('computes relative luminance for pure black and white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('computes contrast ratio independent of argument order', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('expands shorthand hex notation', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5);
  });

  it('rejects malformed colors instead of silently passing', () => {
    expect(() => relativeLuminance('not-a-color')).toThrow();
  });
});

/** Dark surfaces used by the list pages and card surfaces (Tailwind gray scale). */
const DARK_SURFACES = {
  pageGray900: '#111827',
  cardGray800: '#1f2937',
  hoverGray700: '#374151',
};

describe('dark-mode icon-button token contrast', () => {
  const iconTokens = { iconButtonEdit, iconButtonView, iconButtonHistory, iconButtonDanger };

  it.each(Object.entries(iconTokens))('%s clears WCAG AA text contrast on all dark surfaces', (name, token) => {
    const darkClasses = extractDarkTextClasses(token);
    expect(darkClasses.length).toBeGreaterThanOrEqual(2);

    for (const { className, hex } of darkClasses) {
      for (const [surfaceName, surfaceHex] of Object.entries(DARK_SURFACES)) {
        assertWcag(`${name} ${className} on ${surfaceName}`, hex, surfaceHex);
      }
    }
  });
});

describe('dark-mode badge token contrast', () => {
  const badges = {
    badgeCritical,
    badgeHigh,
    badgeMedium,
    badgeLow,
    badgeStateActive,
    badgeStateClosed,
  };

  it.each(Object.entries(badges))('%s dark: text colors clear WCAG AA on dark gray surfaces', (name, token) => {
    const darkClasses = extractDarkTextClasses(token);
    expect(darkClasses.length).toBeGreaterThanOrEqual(1);
    for (const { className, hex } of darkClasses) {
      assertWcag(`${name} ${className} on gray-800`, hex, DARK_SURFACES.cardGray800);
    }
  });

  // Solid buttons keep `text-white` in both modes; verify against the fill.
  it.each([
    ['buttonPrimary', buttonPrimary, '#2563eb'],
    ['buttonPrimary hover', buttonPrimary, '#1d4ed8'],
    ['buttonDanger', buttonDanger, '#dc2626'],
    ['buttonDanger hover', buttonDanger, '#b91c1c'],
  ])('%s white label clears WCAG AA on its dark-mode fill', (name, token, fill) => {
    expect(token).toContain('text-white');
    assertWcag(`${name} white`, WHITE, fill);
  });
});

describe('dark-mode form-control tokens', () => {
  it('inputField dark text clears WCAG AA on its gray-700 input background', () => {
    const darkClasses = extractDarkTextClasses(inputField);
    expect(darkClasses.length).toBeGreaterThanOrEqual(1);
    for (const { className, hex } of darkClasses) {
      assertWcag(`inputField ${className} on gray-700`, hex, DARK_SURFACES.hoverGray700);
    }
  });
});

describe('WCAG AA thresholds for large text and non-text UI', () => {
  it('large text threshold is 3:1', () => {
    expect(WCAG_AA_TEXT_LARGE).toBe(3);
    expect(meetsWcagAa('#60a5fa', '#1f2937', WCAG_AA_TEXT_LARGE)).toBe(true);
  });

  it('focus ring color clears non-text 3:1 against the dark canvas surface', () => {
    // focus-visible outline uses primary-500 (#3b82f6) on gray-900 viewport.
    expect(contrastRatio('#3b82f6', '#111827')).toBeGreaterThanOrEqual(3);
  });
});

/* ---------------------------------------------------------------------------
 * Stage 9 / MT-9: semantic design-token contrast matrix.
 *
 * Every pair below is asserted directly against design-tokens.json (the single
 * source of truth) so a token regression fails the suite even if no component
 * uses the value yet. Text pairs require WCAG AA 4.5:1, UI/edge pairs 3:1.
 * ------------------------------------------------------------------------- */

const STATUS_KINDS = ['critical', 'warn', 'ok', 'info', 'idle'] as const;
type Mode = 'light' | 'dark';
const SURFACE_KEYS = ['surface-default', 'surface-sunken'] as const;
const ALL_SURFACES = ['surface-canvas', 'surface-default', 'surface-sunken', 'surface-hover'] as const;

describe('semantic token contrast (design-tokens.json)', () => {
  it.each(STATUS_KINDS)('%s badge fg/bg clears WCAG AA text contrast in light mode', (kind) => {
    const pair = designTokens.semantic.light.status[kind];
    assertWcag(`light ${kind} fg on bg`, pair.fg, pair.bg);
  });

  it.each(STATUS_KINDS)('%s badge fg/bg clears WCAG AA text contrast in dark mode', (kind) => {
    const pair = designTokens.semantic.dark.status[kind];
    assertWcag(`dark ${kind} fg on bg`, pair.fg, pair.bg);
  });

  it.each<['light' | 'dark']>([['light'], ['dark']])(
    'text-muted clears WCAG AA on surface-default and surface-sunken (%s)',
    (mode) => {
      const s = designTokens.semantic[mode as Mode];
      for (const surface of SURFACE_KEYS) {
        assertWcag(`${mode} text-muted on ${surface}`, s['text-muted'], s[surface]);
      }
    },
  );

  it.each<['light' | 'dark']>([['light'], ['dark']])(
    'border-subtle and border-strong clear the non-text 3:1 threshold on all surfaces (%s)',
    (mode) => {
      const s = designTokens.semantic[mode as Mode];
      for (const surface of ALL_SURFACES) {
        assertWcag(`${mode} border-subtle on ${surface}`, s['border-subtle'], s[surface], WCAG_AA_NON_TEXT);
        assertWcag(`${mode} border-strong on ${surface}`, s['border-strong'], s[surface], WCAG_AA_NON_TEXT);
      }
    },
  );

  it('brand-600 link text clears WCAG AA on the light surface-default', () => {
    // Links use bg/text primary-600 (#2563eb) which is identical to the
    // light focus-ring token; assert against the real surface instead.
    const s = designTokens.semantic.light;
    assertWcag('brand-600 link on surface-default', '#2563eb', s['surface-default']);
  });

  it.each<['light' | 'dark']>([['light'], ['dark']])(
    'focus-ring clears the non-text 3:1 threshold on both surfaces (%s)',
    (mode) => {
      const s = designTokens.semantic[mode as Mode];
      for (const surface of SURFACE_KEYS) {
        assertWcag(`${mode} focus-ring on ${surface}`, s['focus-ring'], s[surface], WCAG_AA_NON_TEXT);
      }
    },
  );
});
