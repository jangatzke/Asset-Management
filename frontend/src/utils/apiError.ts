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
  /** Correlation ID from X-Correlation-Id, for support correlation with backend logs. */
  referenceId?: string;
}

/** Response header names emitted by the backend correlation-ID middleware. */
const CORRELATION_ID_HEADERS = ['x-correlation-id', 'X-Correlation-Id'];

/**
 * Robustly read the correlation ID from an axios error.
 * Axios normalizes response header keys to lowercase, but tests and proxies may
 * hand back the canonical `X-Correlation-Id` spelling, so both are checked.
 * `AxiosHeaders.get()` is used when available (case-insensitive by design).
 */
function readCorrelationId(error: unknown): string | undefined {
  const rawHeaders = (error as { response?: { headers?: unknown } })?.response?.headers;
  if (!rawHeaders) return undefined;

  // AxiosHeaders instances expose a case-insensitive `get()`.
  const axiosHeaders = rawHeaders as { get?: (name: string) => unknown };
  if (typeof axiosHeaders.get === 'function') {
    for (const name of CORRELATION_ID_HEADERS) {
      const value = axiosHeaders.get(name);
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }

  // Plain-object fallback, including a case-insensitive scan for safety.
  const headers = rawHeaders as Record<string, unknown>;
  for (const name of CORRELATION_ID_HEADERS) {
    const direct = headers[name];
    if (typeof direct === 'string' && direct.length > 0) return direct;
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    const fromKey = key ? headers[key] : undefined;
    if (typeof fromKey === 'string' && fromKey.length > 0) return fromKey;
  }

  return undefined;
}

/**
 * Compose the user-facing toast/banner text.
 * Appends the localized reference label (template must contain `{id}`) so support
 * can quote the correlation ID. Kept as text so it is copyable via normal selection.
 */
export function formatToastMessage(info: ApiErrorInfo, referenceTemplate: string): string {
  if (!info.referenceId) return info.message;
  const label = referenceTemplate.includes('{id}')
    ? referenceTemplate.replace('{id}', info.referenceId)
    : `${referenceTemplate}: ${info.referenceId}`;
  return `${info.message} (${label})`;
}

export function extractApiError(error: unknown, fallback: string): ApiErrorInfo {
  const response = (error as { response?: { data?: unknown } })?.response?.data as
    | { error?: unknown }
    | undefined;
  const errorObject = response?.error as
    | { message?: string; code?: string; details?: Array<{ field?: string; message?: string }> }
    | string
    | undefined;

  const referenceId = readCorrelationId(error);

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

  return { message, code, fieldErrors, referenceId };
}
