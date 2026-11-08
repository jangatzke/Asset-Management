import { useI18n } from '../context/I18nContext';

/** Localized fallback UI rendered by the global ErrorBoundary. */
export function ErrorFallback({ error }: { error: Error | null }) {
  const { t } = useI18n();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-surface-canvas p-6">
      <div className="max-w-md w-full bg-surface-default rounded-lg shadow-e2 p-8 text-center border border-border-subtle">
        <div className="mx-auto w-16 h-16 bg-status-critical-bg rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-status-critical-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 2c.77-.833 1.964-.833 2.732 0L13.732 14.5c-.77.833-1.964.833-2.732 0L4.01 4.5c-.77-.833.186-2.5 1.732-2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {t('errorBoundary.title')}
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          {t('errorBoundary.description')}
        </p>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-4 text-left">
            <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
              {t('errorBoundary.errorDetails')}
            </summary>
            <pre className="mt-2 p-3 bg-surface-sunken rounded text-xs text-left overflow-auto max-h-40 text-text-primary">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            {t('errorBoundary.reload')}
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-surface-hover hover:bg-surface-raised text-text-primary text-sm font-medium rounded-md transition-colors border border-border-subtle"
          >
            {t('errorBoundary.goBack')}
          </button>
        </div>
      </div>
    </div>
  );
}
