/**
 * MetricCard (Stage 8 / MT-6) — the single KPI card for dashboards and
 * summary strips. Panel-like surface, muted caption label, large tabular value,
 * optional trend indicator and optional drilldown link. Tailwind-only,
 * semantic tokens; no MUI, no raw palette, no `dark:` variants needed.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

export type MetricTone = 'neutral' | 'ok' | 'warn' | 'critical' | 'info';

type MetricCardProps = {
  /** Small uppercase label above the value. */
  label: React.ReactNode;
  /** The headline number/value (rendered with `tabular-nums`). */
  value: React.ReactNode;
  /** Optional secondary line below the value. */
  hint?: React.ReactNode;
  /** Optional trend indicator (arrow + optional label). */
  trend?: { direction: 'up' | 'down' | 'flat'; label?: string };
  /** Optional decorative icon in the top-right corner. */
  icon?: React.ReactNode;
  /** When set, the whole card becomes a router link (drilldown). */
  href?: string;
  /** Semantic accent for the value/trend color. Defaults to neutral. */
  tone?: MetricTone;
};

const surfaceClass =
  'block rounded-lg border border-border-subtle bg-surface-default p-card-pad shadow-e1';

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas';

const toneValueClass: Record<MetricTone, string> = {
  neutral: 'text-text-primary',
  ok: 'text-status-ok-fg',
  warn: 'text-status-warn-fg',
  critical: 'text-status-critical-fg',
  info: 'text-status-info-fg',
};

const trendClass = {
  up: 'text-status-ok-fg',
  down: 'text-status-critical-fg',
  flat: 'text-text-muted',
} as const;

const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'flat' }) => {
  const cls = 'h-4 w-4 shrink-0';
  if (direction === 'up') return <ArrowTrendingUpIcon aria-hidden="true" className={cls} />;
  if (direction === 'down') return <ArrowTrendingDownIcon aria-hidden="true" className={cls} />;
  return <MinusIcon aria-hidden="true" className={cls} />;
};

/**
 * KPI card. Renders as a plain card, or as a `<Link>` when `href` is given
 * (whole card clickable, keyboard-focusable ring). No hover-translate motion —
 * enterprise calm per the Stage 7 motion guideline.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  hint,
  trend,
  icon,
  href,
  tone = 'neutral',
}) => {
  const inner = (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-caption text-text-muted">{label}</span>
        {icon ? <span className="shrink-0 text-text-muted" aria-hidden="true">{icon}</span> : null}
      </div>
      <span className={`text-display tabular-nums ${toneValueClass[tone]}`}>{value}</span>
      {trend ? (
        <span className={`inline-flex items-center gap-1 text-body2 ${trendClass[trend.direction]}`}>
          <TrendIcon direction={trend.direction} />
          {trend.label ? <span>{trend.label}</span> : null}
        </span>
      ) : null}
      {hint ? <span className="text-body2 text-text-muted">{hint}</span> : null}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className={`${surfaceClass} ${focusClass}`}>
        {inner}
      </Link>
    );
  }

  return <div className={surfaceClass}>{inner}</div>;
};
