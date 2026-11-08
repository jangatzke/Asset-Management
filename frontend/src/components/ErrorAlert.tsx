/**
 * Reusable inline error surface for pages and admin views.
 *
 * Centralizes the `role="alert"` styling and — when a page keeps the structured
 * `ApiErrorInfo` (rather than a pre-formatted string) — renders the correlation
 * ID as a separate, selectable line. Pages that only store a string can use
 * `formatApiError` from `utils/apiError` and pass the result as `message`.
 */
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
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
  const classes =
    className ??
    'flex items-start gap-3 rounded-lg border border-status-critical-fg/30 bg-status-critical-bg p-4 text-status-critical-fg';

  return (
    <div role="alert" className={classes} data-testid="error-alert">
      <ExclamationCircleIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-body2">{text}</p>
        {referenceId && (
          <p className="mt-1 font-mono text-caption opacity-90" data-testid="error-reference-id">
            {referenceLabel(referenceTemplate, referenceId)}
          </p>
        )}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-h3">
          {dismissLabel ?? 'Dismiss'}
        </button>
      )}
    </div>
  );
}

export default ErrorAlert;
