/**
 * Chart language (Stage 10b / LT-4).
 *
 * A small, framework-free visual vocabulary for the numbers and charts that
 * already exist in the app (bar tracks on Dashboard/RiskAggregation, sparklines
 * and trend indicators on KriDashboard, legends/axes on ControlCoverageMatrix).
 * No chart library is introduced — these are just documented Tailwind class
 * builders over the semantic design tokens so every page encodes data the same
 * way and Dark Mode keeps working through token switching.
 *
 * Rules (see docs/phase15-design-system.md, section "Chart-Sprache"):
 *  1. Max. 3 series per chart. If a chart would need more, aggregate or split
 *     it — do not extend the palette.
 *  2. Series order/priority: `primary` -> `info` -> `warn`. `critical` is only
 *     used for genuine alarms (breaches, uncovered critical items), never as a
 *     decorative third color. `ok`/`idle` are reserved for "all good"/"no data"
 *     states in status-style charts.
 *  3. No rainbow palettes: every series color comes from the semantic tone map
 *     below (`chartSeriesTone`), tracks are always `chartTrackClass`.
 *  4. Axis labels use `chartAxisLabelClass`, rendered values use
 *     `chartValueClass` (tabular-nums keeps columns aligned).
 *  5. Charts need a text alternative: give the chart container `role="img"` +
 *     `aria-label` or render an sr-only/table fallback of the underlying data
 *     (e.g. the KRI trend icons keep their translated sr-only labels).
 */

/** Semantic tones a chart series may use — mirrors StatusKind plus 'primary'. */
export type ChartTone = 'primary' | 'ok' | 'warn' | 'critical' | 'info' | 'idle';

/**
 * Documented default series order (Rule 1/2): first series `primary`, then
 * `info`, then `warn`. `critical` is appended only for actual alarm series.
 */
export const CHART_SERIES_ORDER: readonly ChartTone[] = ['primary', 'info', 'warn'];

/** Maximum number of series per chart (Rule 1). */
export const MAX_CHART_SERIES = 3;

/**
 * Solid fill classes for a chart series (bars, segments, sparkline strokes via
 * `chartSeriesTextTone`). Uses the semantic status foregrounds so Dark Mode
 * switches through tokens — no raw palette anywhere.
 */
export const chartSeriesTone = (tone: ChartTone): string => {
  switch (tone) {
    case 'primary': return 'bg-primary-600';
    case 'ok': return 'bg-status-ok-fg';
    case 'warn': return 'bg-status-warn-fg';
    case 'critical': return 'bg-status-critical-fg';
    case 'info': return 'bg-status-info-fg';
    default: return 'bg-status-idle-fg';
  }
};

/** Text/`currentColor` variant of `chartSeriesTone` for SVG strokes and icons. */
export const chartSeriesTextTone = (tone: ChartTone): string => {
  switch (tone) {
    case 'primary': return 'text-primary-600';
    case 'ok': return 'text-status-ok-fg';
    case 'warn': return 'text-status-warn-fg';
    case 'critical': return 'text-status-critical-fg';
    case 'info': return 'text-status-info-fg';
    default: return 'text-status-idle-fg';
  }
};

/** Neutral track/track background behind any bar or progress series. */
export const chartTrackClass = 'bg-surface-sunken';

/** Axis, tick and legend labels: caption typography in the muted foreground. */
export const chartAxisLabelClass = 'text-caption text-text-muted';

/** Rendered numeric values: body text in the primary foreground, aligned digits. */
export const chartValueClass = 'text-body2 text-text-primary tabular-nums';

/** Gridlines / axis rules against the card surface. */
export const chartGridClass = 'border-border-subtle';

/** Floating tooltip surfaces (used when charts grow native tooltips). */
export const chartTooltipClass =
  'rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-caption text-text-primary shadow-e3';
