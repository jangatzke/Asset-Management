/**
 * Centralized extraction of API error information.
 *
 * The backend emits a single error envelope (see `backend/src/middleware/errorHandler.ts`
 * and `backend/src/middleware/validation.ts`):
 *
 *   { success: false, error: { message, code?, details?: [{ field, message }] } }
 *
 * All pages should use `extractApiError` instead of ad-hoc `messageFrom` chains so
 * validation details can be mapped onto form fields consistently.
 */

export interface ApiErrorInfo {
  /** Human-readable message for toasts / error banners. */
  message: string;
  /** Stable machine-readable code (e.g. VALIDATION_ERROR, NOT_FOUND) when present. */
  code?: string;
  /** Field-level messages keyed by field path, for inline form errors. */
  fieldErrors: Record<string, string>;
}

export function extractApiError(error: unknown, fallback: string): ApiErrorInfo {
  const response = (error as { response?: { data?: unknown } })?.response?.data as
    | { error?: unknown }
    | undefined;
  const errorObject = response?.error as
    | { message?: string; code?: string; details?: Array<{ field?: string; message?: string }> }
    | string
    | undefined;

  const message =
    (typeof errorObject === 'string' ? errorObject : errorObject?.message) ??
    (error as { message?: string })?.message ??
    fallback;

  const code = typeof errorObject === 'object' ? errorObject?.code : undefined;

  const fieldErrors: Record<string, string> = {};
  if (typeof errorObject === 'object' && Array.isArray(errorObject.details)) {
    for (const detail of errorObject.details) {
      if (detail?.field && detail?.message && !(detail.field in fieldErrors)) {
        fieldErrors[detail.field] = detail.message;
      }
    }
  }

  return { message, code, fieldErrors };
}
