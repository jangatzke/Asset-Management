/**
 * Reusable inline error surface for pages and admin views.
 *
 * Centralizes the `role="alert"` styling and — when a page keeps the structured
 * `ApiErrorInfo` (rather than a pre-formatted string) — renders the correlation
 * ID as a separate, selectable line. Pages that only store a string can use
 * `formatApiError` from `utils/apiError` and pass the result as `message`.
 */
import type { ApiErrorInfo } from '../utils/apiError';

export interface ErrorAlertProps {
  /** Raw error for the envelope-derived message + reference ID. */
  error?: ApiErrorInfo | null;
  /** Pre-formatted message (e.g. `formatApiError(...)`), used when no `error` is given. */
  message?: string | null;
  /**
   * Optional localized label template containing `{id}` (e.g. `common.referenceId`).
   * Kept explicit so this component does not depend on the i18n context.
   */
  referenceTemplate?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

function referenceLabel(template: string | undefined, referenceId: string): string {
  if (!template) return `Ref: ${referenceId}`;
  return template.includes('{id}') ? template.replace('{id}', referenceId) : `${template}: ${referenceId}`;
}

export function ErrorAlert({
  error,
  message,
  referenceTemplate,
  onDismiss,
  dismissLabel,
  className,
}: ErrorAlertProps) {
  const text = message ?? error?.message ?? '';
  if (!text) return null;

  const referenceId = error?.referenceId;
  const classes = className ?? 'rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100';

  return (
    <div role="alert" className={classes} data-testid="error-alert">
      <span>{text}</span>
      {referenceId && (
        <p className="mt-1 font-mono text-xs opacity-90" data-testid="error-reference-id">
          {referenceLabel(referenceTemplate, referenceId)}
        </p>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-2 font-semibold">
          {dismissLabel ?? 'Dismiss'}
        </button>
      )}
    </div>
  );
}

export default ErrorAlert;
