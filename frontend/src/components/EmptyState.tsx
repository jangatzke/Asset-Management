import { ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';

interface EmptyStateProps {
  /** i18n key for the heading (falls back to `title`). */
  titleKey?: string;
  title?: string;
  /** i18n key for the description (falls back to `description`). */
  descriptionKey?: string;
  description?: string;
  /** Optional illustration / leading icon. */
  icon?: ReactNode;
  /** Optional call-to-action button rendered below the description. */
  action?: ReactNode;
  /** Optional fallback content rendered when no message is present. */
  children?: ReactNode;
}

/**
 * Reusable empty-state block for pages with no data.
 * Renders an icon, heading, description and an optional action button.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  titleKey,
  title,
  descriptionKey,
  description,
  icon,
  action,
  children,
}) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400">
        {icon ?? <ExclamationTriangleIcon aria-hidden="true" className="h-7 w-7" />}
      </div>
      {title || titleKey ? (
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {title ?? t(titleKey ?? '')}
        </h3>
      ) : null}
      {description || descriptionKey ? (
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
          {description ?? t(descriptionKey ?? '')}
        </p>
      ) : null}
      {action}
      {children}
    </div>
  );
};
