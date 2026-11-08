/**
 * Icon strategy (Stage 9 / MT-7) — single source of truth for icon usage.
 *
 * RULES (binding for every new or touched screen):
 *  1. ONE library: `@heroicons/react/24/outline` is the default icon set for
 *     all Tailwind screens and shared components.
 *  2. MUI icons (`@mui/icons-material`) are only allowed inside genuine MUI
 *     modules where the MUI component API makes swapping impractical
 *     (documented exceptions live next to the import). Tailwind-only pages
 *     must NOT import MUI icons.
 *  3. NO emoji or text-character icons (✚ ✔ ✖ ⚙ ⚠ …). Plain-text arrows that
 *     are part of flowing content (e.g. "A → B" in a diff line) are allowed;
 *     anything that acts as a control affordance must be a real icon.
 *  4. Every icon is either decorative (`aria-hidden="true"` next to a visible
 *     text label / `title`) or meaningful (gets an `aria-label`). Never both,
 *     never neither.
 *
 * SIZE STEPS — exactly four sizes are allowed; pick the nearest semantic step:
 *   inline  16px → `h-4 w-4`  inside buttons, table rows, chips, menu items
 *   control 20px → `h-5 w-5`  standalone toolbar controls, form adornments
 *   header  24px → `h-6 w-6`  page/section headers, nav entries
 *   empty   28px → `h-7 w-7`  empty-state and error-state illustrations
 */

/** Tailwind size classes per semantic icon step. */
export const ICON_SIZES = {
  /** Inside buttons/table rows/chips (16px). */
  inline: 'h-4 w-4',
  /** Standalone toolbar controls, form adornments (20px). */
  control: 'h-5 w-5',
  /** Page/section headers, navigation entries (24px). */
  header: 'h-6 w-6',
  /** Empty-state/error-state illustrations (28px). */
  empty: 'h-7 w-7',
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/** Square hit-area classes matching each icon step (icon + comfortable padding). */
const HIT_AREAS: Record<IconSize, string> = {
  inline: 'h-8 w-8',
  control: 'h-9 w-9',
  header: 'h-10 w-10',
  empty: 'h-12 w-12',
};

/**
 * Shared class recipe for icon-only buttons. Includes a visible
 * `focus-visible:ring-2` focus ring (required by the row-action accessibility
 * guard) and semantic surface/hover tokens — no raw grays.
 *
 * Usage: `<button className={iconButtonClass('inline')} aria-label={...}><XIcon className={ICON_SIZES.inline} aria-hidden="true" /></button>`
 */
export const iconButtonClass = (size: IconSize = 'inline'): string =>
  `inline-flex ${HIT_AREAS[size]} items-center justify-center rounded-md border border-transparent bg-transparent text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset`;
