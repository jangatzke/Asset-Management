import { ReactNode } from 'react';
import { InboxIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';

interface EmptyStateProps {
  /** i18n key for the heading (falls back to `title`). */
  titleKey?: string;
  title?: string;
  /** i18n key for the description (falls back to `description`). */
  descriptionKey?: string;
  description?: string;
  /** Visual variant: neutral "no data" by default, warning triangle when set. */
  variant?: 'default' | 'warning';
  /** Optional illustration / leading icon (overrides the variant default). */
  icon?: ReactNode;
  /** Optional call-to-action button rendered below the description. */
  action?: ReactNode;
  /** Optional fallback content rendered when no message is present. */
  children?: ReactNode;
}

/**
 * Reusable empty-state block for pages with no data.
 * Renders an icon, heading, description and an optional action button.
 * The default icon is a neutral "inbox" glyph; the warning triangle is only
 * used when the consumer explicitly requests `variant="warning"`.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  titleKey,
  title,
  descriptionKey,
  description,
  variant = 'default',
  icon,
  action,
  children,
}) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-6 py-16 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover ${
          variant === 'warning' ? 'text-status-warn-fg' : 'text-text-muted'
        }`}
      >
        {icon ??
          (variant === 'warning' ? (
            <ExclamationTriangleIcon aria-hidden="true" className="h-7 w-7" />
          ) : (
            <InboxIcon aria-hidden="true" className="h-7 w-7" />
          ))}
      </div>
      {title || titleKey ? (
        <h3 className="text-h3 text-text-primary">
          {title ?? t(titleKey ?? '')}
        </h3>
      ) : null}
      {description || descriptionKey ? (
        <p className="max-w-md text-body2 text-text-secondary">
          {description ?? t(descriptionKey ?? '')}
        </p>
      ) : null}
      {action}
      {children}
    </div>
  );
};
