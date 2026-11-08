/**
 * PageHeader — reusable page header landmark (Stage 3, QW-4).
 *
 * Provides a consistent `<header>` for list pages: H1 (`text-h1` from the
 * Stage-1 typography scale), optional description (`text-body2`,
 * `text-text-secondary`), a right-aligned actions slot (stacked below the
 * title on mobile), optional breadcrumbs (caption level with an accessible
 * navigation landmark and `aria-current="page"` on the last entry) and an
 * optional tabs slot rendered underneath.
 *
 * Styling uses semantic tokens only (`text-text-*`, `outline-focus-ring`,
 * `ring-focus-ring-offset`); all visible strings must be passed in as props
 * (i18n happens at the call site). This component is NOT `<main>` — that
 * landmark stays with Layout/PageShell (Stage 6).
 */
import * as React from 'react';
import { Link } from 'react-router-dom';

export interface PageHeaderBreadcrumb {
  /** Visible label of the breadcrumb entry. */
  label: React.ReactNode;
  /** Optional route; when set the entry renders as a react-router `Link`. */
  to?: string;
  /** Optional click handler; when set (and no `to`) the entry renders as a button. */
  onClick?: () => void;
}

export interface PageHeaderProps {
  /** Page title, rendered as the single H1 of the page header. Required. */
  title: React.ReactNode;
  /** Optional short description below the title. */
  description?: React.ReactNode;
  /** Actions (buttons etc.), right-aligned on desktop, stacked below on mobile. */
  actions?: React.ReactNode;
  /** Optional breadcrumb trail; the last entry is marked `aria-current="page"`. */
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Optional slot rendered below the header row (e.g. tabs). */
  tabs?: React.ReactNode;
  /** Additional classes merged onto the outer `header` element. */
  className?: string;
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring focus-visible:ring-2 focus-visible:ring-focus-ring-offset';

/**
 * Breadcrumb trail with an accessible navigation landmark. Exported separately
 * (Stage 6b, MT-3) so detail pages that keep their own header markup can
 * render the same trail without duplicating the component API. Renders nothing
 * for an empty item list.
 */
export function PageBreadcrumbs({ items }: { items: PageHeaderBreadcrumb[] }) {
  if (!items || items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-caption text-text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="inline-flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="select-none">
                  /
                </span>
              )}
              {isLast ? (
                <span aria-current="page" className="text-text-secondary">
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className={`transition-colors hover:text-text-primary ${FOCUS_RING}`}>
                  {item.label}
                </Link>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`transition-colors hover:text-text-primary ${FOCUS_RING}`}
                >
                  {item.label}
                </button>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Breadcrumb trail with an accessible navigation landmark. */
function Breadcrumbs({ items }: { items: PageHeaderBreadcrumb[] }) {
  return <PageBreadcrumbs items={items} />;
}

/**
 * Reusable page header with title, description, actions, breadcrumbs and an
 * optional tabs slot. See module JSDoc for token/typography usage.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <header className={className}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {description && <p className="mt-1 text-body2 text-text-secondary">{description}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
      {tabs && <div className="mt-3">{tabs}</div>}
    </header>
  );
}

PageHeader.displayName = 'PageHeader';

export default PageHeader;
