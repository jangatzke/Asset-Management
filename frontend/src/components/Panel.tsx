/**
 * Lightweight content panel (Stage 8 / MT-5) — the single card surface for
 * dashboard sections, settings groups and modals. Tailwind-only, semantic
 * tokens; no MUI. Titles use `text-h3`, body content is consumer-provided.
 */

import React from 'react';

type PanelProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Actions rendered on the right side of the header (buttons, links). */
  actions?: React.ReactNode;
  /** Optional footer strip, separated by a subtle top border. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Render as `<section>` (default) or plain `<div>`. */
  as?: 'section' | 'div';
};

/** Elevated surface card with an optional title/description/actions header. */
export const Panel: React.FC<PanelProps> = ({
  title,
  description,
  actions,
  footer,
  children,
  className,
  as = 'section',
}) => {
  const Tag = as;
  const hasHeader = Boolean(title || description || actions);

  return (
    <Tag
      aria-label={typeof title === 'string' ? title : undefined}
      className={`rounded-lg border border-border-subtle bg-surface-default p-card-pad shadow-e1 ${className ?? ''}`.trim()}
    >
      {hasHeader ? (
        <header className="mb-3 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="text-h3 text-text-primary">{title}</h2> : null}
            {description ? <p className="text-body2 text-text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
      {footer ? (
        <footer className="mt-3 border-t border-border-subtle pt-3">{footer}</footer>
      ) : null}
    </Tag>
  );
};
