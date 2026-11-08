/**
 * Transient-error classification used by job/confirmation retries.
 *
 * Retries are ONLY safe for failures that can legitimately succeed on a second
 * attempt: database connection/reset/timeout, IMAP network/socket errors and
 * SMTP transport/timeout errors. Deterministic failures (validation, business
 * rules, authentication, unique-constraint conflicts) must fail fast.
 *
 * The classifier is intentionally conservative: an error is transient only if
 * it has a known retryable code or a network/transport-shaped message.
 */

export interface ErrorLike {
  code?: unknown;
  message?: unknown;
  name?: string;
  statusCode?: number;
  isOperational?: boolean;
}

/** Prisma + Node/nodemailer/imapflow retryable codes. */
const TRANSIENT_ERROR_CODES = new Set([
  // Prisma database connectivity / pool / deadlock
  'P1001', // can't reach database server
  'P1002', // database timeout
  'P1008', // operations timed out
  'P1017', // server closed the connection
  'P2024', // pool timeout
  'P2034', // transaction conflict / deadlock
  // Node network / TLS socket
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNECTION',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'ESOCKET',
  'EPROTO',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EADDRNOTAVAIL',
]);

/** Deterministic codes that are never retried even if the message looks noisy. */
const DETERMINISTIC_ERROR_CODES = new Set([
  'EAUTH', // SMTP authentication rejected
  'EARLYCONNECTION', // server did not advertise capabilities
  'P2002', // unique constraint
  'P2025', // record not found
  'P2014', // relation violation
]);

const TRANSIENT_MESSAGE_PATTERNS: RegExp[] = [
  /\b(?:econnreset|econnrefused|econnection|etimedout|eai_again|enetunreach|ehostunreach|epipe|esocket|eproto)\b/i,
  /\b(?:connection|socket|stream)\s+(?:reset|refused|closed|terminated|lost|timed?\s*out|hang\s*up|ended)\b/i,
  /\b(?:timed?\s*out|timeout)\b[^\n]{0,80}\b(?:connect|connection|socket|database|db|smtp|imap)\b/i,
  /\b(?:database|db|prisma)\b[^\n]{0,80}\b(?:connection|connect|timeout|unavailable|reset|lost)\b/i,
  /\b(?:imap|smtp)\b[^\n]{0,80}\b(?:connect|socket|network|timeout|timed?\s*out|not available|temporary failure)\b/i,
  /temporary failure in name resolution/i,
  /\bfailed to (?:connect|establish|resolve)\b/i,
];

function asErrorLike(error: unknown): ErrorLike {
  return (error ?? {}) as ErrorLike;
}

/**
 * Returns true when `error` is a transient infrastructure failure that is safe
 * to retry. Deterministic business/validation errors return false.
 */
export function isTransientError(error: unknown): boolean {
  const err = asErrorLike(error);
  const code = typeof err.code === 'string' ? err.code.toUpperCase() : '';
  const message = typeof err.message === 'string' ? err.message : '';

  if (code && DETERMINISTIC_ERROR_CODES.has(code)) return false;

  // AppError-style operational failures: 4xx is a caller/business decision.
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
    return false;
  }

  if (code && TRANSIENT_ERROR_CODES.has(code)) return true;

  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Exponential backoff with full-jitter for one retry attempt.
 *
 * `failedAttempt` is the 1-based attempt that just failed; the delay is used
 * before the next attempt. The exponential value is capped, then jittered into
 * [50%, 100%] of the capped value so cluster workers do not retry in lock-step.
 */
export function computeBackoffDelay(
  failedAttempt: number,
  baseBackoffMs: number,
  maxBackoffMs: number,
  rand: () => number = Math.random,
): number {
  const exponent = Math.max(0, failedAttempt - 1);
  const capped = Math.min(maxBackoffMs, baseBackoffMs * 2 ** exponent);
  const jitterFactor = 0.5 + Math.max(0, Math.min(1, rand())) * 0.5;
  return Math.floor(capped * jitterFactor);
}
