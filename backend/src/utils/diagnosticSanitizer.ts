/**
 * Diagnostic text redaction shared by admin diagnostics endpoints.
 *
 * The email-gateway rule (AGENTS.md) is that mailbox addresses and
 * authentication diagnostics must never reach clients. The same rule applies
 * to JobRun `error` blobs, which may embed SMTP/IMAP/Exchange failures. This
 * module keeps a single implementation so both surfaces stay consistent.
 */

const MAILBOX_ADDRESS_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Fragments that indicate credentials / auth diagnostics leaking into a status
// string (e.g. "AUTHENTICATIONFAILED", "LOGIN failed", OAuth error codes).
const AUTH_ERROR_PATTERN =
  /\b(?:AUTH(?:ENTICATION)?[A-Za-z]*\s*(?:FAILED|failure)?|LOGIN\s*(?:FAILED|failed|invalid)|invalid[ _-]?(?:credentials?|grant|client|token)|OAuth2?\s*(?:error|failure|failed)|(?:access|refresh|client)[ _-]?(?:token|secret)\b|MSAL[A-Za-z]*Error|imapflow\s*error)\b/gi;

/**
 * Redact mailbox addresses and authentication-error fragments from diagnostic
 * strings before returning them to clients. Free-form strings (status messages,
 * error blobs) are the only places these can appear; they are redacted rather
 * than passed through verbatim.
 */
export function sanitizeDiagnosticText(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Global regexes: replace() (not test()) is used so the `lastIndex`
  // state does not leak between calls or skip later matches.
  return value
    .replace(MAILBOX_ADDRESS_PATTERN, '[redacted-address]')
    .replace(AUTH_ERROR_PATTERN, '[redacted-auth-error]');
}

export { MAILBOX_ADDRESS_PATTERN, AUTH_ERROR_PATTERN };
