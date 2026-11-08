/**
 * PageShell — single page-content landmark (Stage 6a, MT-1).
 *
 * Renders exactly ONE `<main id="main-content">` landmark per page. This is the
 * target of the skip-link in `Layout.tsx`; therefore pages must NOT render their
 * own `<main>` anymore. PageShell owns the outer page frame:
 *
 *  - responsive gutter (`px-4 sm:px-6 lg:px-page-gutter` — the large breakpoint
 *    value comes from the Stage-6a `spacing.pageGutter` layout token, exposed as
 *    the `lg:px-page-gutter` utility via tailwind.config.js),
 *  - vertical rhythm (`py-6 lg:py-8` plus `flex flex-col gap-section-gap` so
 *    direct child sections get a consistent gap from the `spacing.sectionGap`
 *    token),
 *  - a max-width per `width` variant (default: full app width up to 2200px,
 *    narrow: `max-w-3xl` (768px) readability cap for forms/prose, wide:
 *    `max-w-[2400px]` for dense tables and workspaces). Layout never caps
 *    itself — PageShell is the single width instance.
 *
 * PADDING VARIANTS (Stage 6a): Layout.tsx wraps the route outlet in a neutral
 * `<div>` that keeps a BASE padding (`px-4 sm:px-6 lg:px-8 py-8`) without any
 * max-width as a transitional fallback for pages that do not use PageShell yet.
 * Horizontal centering is owned by `mx-auto` alone: Layout never caps itself,
 * so the width cap (`max-w-*`) can be smaller than the parent and only
 * `mx-auto` centers it. Negative x-margins (`-mx-*`) have the same specificity
 * as `mx-auto` but win on source order in the generated CSS, so they would
 * override it and pin the capped block to the left edge — therefore there is
 * NO horizontal negative-margin compensation.
 * Keine Negative-Margin-Kompensation — `mx-auto` ist die Zentrierung;
 * Layout-Padding und `page-gutter` dürfen sich addieren (32 + 32 = 64 px bei `lg`).
 * The vertical base padding of the fallback box is still cancelled with `-my-8`
 * against `py-8`, so the vertical rhythm stays visually identical.
 *
 * Styling uses semantic tokens + layout tokens only — no raw palette values.
 * Navigation (sidebar/top-bar/breadcrumb) is intentionally NOT part of this
 * component (Stage 6b).
 */
import * as React from 'react';

export type PageShellProps = {
  children: React.ReactNode;
  /**
   * Content width — the ONLY width instance in the app (Layout never caps itself):
   * - `default`: full available app width up to 2200px (detail/overview pages)
   * - `narrow`: 768px readability cap for forms/prose (max-w-3xl)
   * - `wide`: 2400px for tables/workload/matrix workspaces
   */
  width?: 'default' | 'narrow' | 'wide';
  /** Skip the vertical padding (e.g. when a PageHeader or full-bleed area connects directly). */
  noPadding?: boolean;
  /** Additional classes merged onto the `<main>` element. */
  className?: string;
};

/** Max-width per width variant — kept in sync with the PageShell JSDoc. */
const WIDTH_CLASSES: Record<NonNullable<PageShellProps['width']>, string> = {
  default: 'max-w-[2200px]',
  narrow: 'max-w-3xl',
  wide: 'max-w-[2400px]',
};

function PageShell({ children, width = 'default', noPadding = false, className = '' }: PageShellProps) {
  return (
    <main
      id="main-content"
      role="main"
      className={[
        'mx-auto w-full',
        WIDTH_CLASSES[width],
        // Vertical-only compensation of the Layout fallback `py-8` (keeps the
        // vertical rhythm visually identical). NO `-mx-*`: negative x-margins
        // override `mx-auto` and break centering (see header).
        '-my-8',
        // Gutter: small steps hardcoded per breakpoint convention; the desktop
        // value is the pageGutter layout token (lg:px-page-gutter).
        'px-4 sm:px-6 lg:px-page-gutter',
        noPadding ? '' : 'py-6 lg:py-8',
        // Consistent vertical rhythm between direct child sections (sectionGap token).
        'flex flex-col gap-section-gap',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </main>
  );
}

PageShell.displayName = 'PageShell';

export default PageShell;
