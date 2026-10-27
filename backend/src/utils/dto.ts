/**
 * Lean serialization helpers for core services (ISSUE-7 / Subtask 3).
 *
 * Core READ/CREATE/UPDATE paths previously returned raw Prisma model
 * instances (`return asset`), leaking internal and credential-like fields
 * straight to `res.json(...)` routes. These helpers produce a shallow
 * structural copy with secret fields removed recursively — so nested
 * includes (e.g. embedded user-like relations in asset/ticket responses)
 * are redacted too.
 *
 * Reference for the redaction set: databaseBackup.service.ts
 * (SECRET_FIELD_NAMES). Fields actively consumed by the frontend
 * (`createdBy`, `updatedBy`, ids, relational structures) are preserved.
 *
 * Abwägung (performance): Zod response-parsing was deliberately NOT
 * applied on hot list paths — a recursive deep-copy + key check is
 * O(fields) with zero allocations beyond the copy, while a Zod parse per
 * row would add measurable cost on paginated lists (limit up to 100).
 * Shared Zod DTOs are therefore only used on input validation (existing
 * behavior), not as runtime response contracts.
 */

/** Credential-like field names that must never reach API consumers. */
const SECRET_FIELD_NAMES = new Set([
  'passwordHash',
  'mfaSecret',
  'mfaPendingSecret',
  'clientSecret',
  'clientSecretRef',
  'encryptedPassword',
  'accessTokenHash',
  'accessTokenSalt',
  'apiTokenHash',
  'connectorSecret',
  'secret',
]);

/** mfa* secrets not covered by the exact-name set (e.g. mfaRecoveryCodes). */
const SECRET_FIELD_PREFIXES = ['mfa'];

const MAX_SERIALIZATION_DEPTH = 12;

function isSecretKey(key: string): boolean {
  if (SECRET_FIELD_NAMES.has(key)) return true;
  return SECRET_FIELD_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function redact(value: unknown, depth: number): unknown {
  if (depth > MAX_SERIALIZATION_DEPTH) return value;
  if (!value || typeof value !== 'object') return value;
  // Dates and JSON-aware value types (Prisma Decimal, Buffer) keep their
  // own serialization contract — copying them structurally would corrupt
  // their JSON representation downstream.
  if (value instanceof Date || typeof (value as { toJSON?: unknown }).toJSON === 'function') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const source = value as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(source)) {
    if (isSecretKey(key)) {
      // Omit the key entirely (JSON.stringify would drop undefined values
      // anyway, but omission keeps deep-equality and property assertions
      // on serialized responses correct).
      continue;
    }
    copy[key] = redact(current, depth + 1);
  }
  return copy;
}

/**
 * Deep structural copy of an entity (or list/pagination envelope) with all
 * credential-like fields removed entirely.
 *
 * Generic in: generic out — the returned object satisfies the same
 * `Record<string, unknown>`-compatible shape as the input; the single
 * `Record<string, unknown>` cast inside `redact` is the documented
 * internal traversal boundary.
 */
export function serializeEntity<T>(entity: T): T {
  // Prisma findUnique results are `Model | null` at call sites; the traversal
  // in `redact` passes null/undefined through unchanged, so the generic in:
  // generic out contract holds (null in → null out).
  return redact(entity, 0) as T;
}

/**
 * Omit listed keys (shallow) from an object, keeping the original shape.
 * Used where a service must drop top-level internals explicitly.
 */
export function omit<T extends object, K extends keyof T>(entity: T, keys: readonly K[]): Omit<T, K> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity as Record<string, unknown>)) {
    if (!keys.includes(key as K)) result[key] = value;
  }
  return result as Omit<T, K>;
}

/**
 * Pick listed keys (shallow) from an object into a new object.
 */
export function pick<T extends object, K extends keyof T>(entity: T, keys: readonly K[]): Pick<T, K> {
  const result: Record<string, unknown> = {};
  const source = entity as Record<string, unknown>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(entity, key)) {
      result[key as string] = source[key as string];
    }
  }
  return result as Pick<T, K>;
}

/**
 * Serialize a paginated envelope: `{ data, pagination }` shapes keep their
 * structure while every element of `data` (and any additional array
 * properties, e.g. asset `sourceRelations`/`targetRelations` slices) is
 * redacted. Pagination metadata itself is primitive-only and passed through.
 */
export function serializeEnvelope<T>(envelope: T): T {
  return serializeEntity(envelope);
}
