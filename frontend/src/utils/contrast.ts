/**
 * WCAG contrast helpers used by the Phase 2.6 dark-mode audit.
 *
 * Deliberately dependency-free: `relativeLuminance`/`contrastRatio` implement
 * the WCAG 2.1 definition (relative luminance + (L1 + 0.05)/(L2 + 0.05)) so the
 * audit does not need axe-core / jest-axe in the dependency tree.
 */

/** WCAG AA thresholds. */
export const WCAG_AA_TEXT_NORMAL = 4.5;
export const WCAG_AA_TEXT_LARGE = 3;
export const WCAG_AA_NON_TEXT = 3;

const normalizeHex = (value: string): string => {
  const hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (hex.length !== 6) {
    throw new Error(`Unsupported color value: ${value}`);
  }
  return `#${hex}`;
};

const channelToLinear = (channel: number): number => channel / 255 <= 0.04045
  ? (channel / 255) / 12.92
  : ((channel / 255 + 0.055) / 1.055) ** 2.4;

/** WCAG 2.1 relative luminance for an sRGB hex color. */
export const relativeLuminance = (hex: string): number => {
  const normalized = normalizeHex(hex);
  const channels = [normalized.slice(1, 3), normalized.slice(3, 5), normalized.slice(5, 7)]
    .map((part) => parseInt(part, 16))
    .map(channelToLinear);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** Contrast ratio between two sRGB hex colors, in the range 1..21. */
export const contrastRatio = (foreground: string, background: string): number => {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

/** True when the pair clears the requested WCAG AA threshold. */
export const meetsWcagAa = (
  foreground: string,
  background: string,
  threshold: number = WCAG_AA_TEXT_NORMAL,
): boolean => contrastRatio(foreground, background) >= threshold;

/**
 * Palette values used by the semantic tokens. Mirrors the Tailwind scales in
 * `tailwind.config.js` plus the neutral gray scale; keeping the hex values here
 * lets the audit run without importing the Tailwind config into jsdom.
 */
export const PALETTE: Record<string, string> = {
  'primary-100': '#dbeafe',
  'primary-200': '#bfdbfe',
  'primary-300': '#93c5fd',
  'primary-400': '#60a5fa',
  'primary-500': '#3b82f6',
  'primary-600': '#2563eb',
  'primary-700': '#1d4ed8',
  'primary-800': '#1e40af',
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'warning-200': '#fde68a',
  'warning-300': '#fcd34d',
  'warning-400': '#fbbf24',
  'success-200': '#a7f3d0',
  'success-300': '#6ee7b7',
  'success-400': '#34d399',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'danger-200': '#fecaca',
  'danger-300': '#fca5a5',
  'danger-400': '#f87171',
  'danger-600': '#dc2626',
  'danger-800': '#991b1b',
  'white': '#ffffff',
};

/** Resolve a Tailwind color class such as `text-primary-300` to a hex value. */
export const resolveTailwindColorClass = (className: string): string => {
  const match = className.match(/^(?:text|bg|border)-(.+)$/);
  if (!match) {
    throw new Error(`Unsupported Tailwind color class: ${className}`);
  }
  const key = match[1];
  const value = PALETTE[key];
  if (!value) {
    throw new Error(`No palette entry for ${key}`);
  }
  return value;
};

export type DarkTextClass = { className: string; hex: string };

/**
 * Extract every dark-mode text color from a token string, e.g.
 * `dark:text-primary-400 dark:hover:text-primary-300` yields both classes.
 */
export const extractDarkTextClasses = (token: string): DarkTextClass[] => {
  const matches = token.match(/\bdark:(?:hover:)?text-(?:[a-z]+-\d+|white|black)\b/g) ?? [];
  return matches.map((match) => {
    const className = match.replace(/^dark:(?:hover:)?/, '');
    const hex = className === 'text-white'
      ? PALETTE.white
      : className === 'text-black'
        ? '#000000'
        : resolveTailwindColorClass(className);
    return { className, hex };
  });
};
