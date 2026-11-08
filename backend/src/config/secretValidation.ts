/**
 * Startup secret hygiene for production deployments.
 *
 * `.env.example` now uses explicit `<generate-with-openssl ...>` placeholders.
 * A deployment that copies the example file verbatim must fail fast in
 * production instead of running with a well-known, non-secret value.
 *
 * Scope: production only. Development and test runtimes keep their existing
 * behaviour (generated dev fallback for JWT_SECRET, test fixtures, etc.), so this
 * module must never be invoked from the test bootstrap assertion path.
 */

/** Values that are placeholders from `.env.example` or otherwise well-known. */
const PLACEHOLDER_VALUES = new Set([
  'your-super-secret-jwt-key-change-in-production',
  'your-32-byte-encryption-key-here!!',
  'your-32-byte-encryption-key-here',
  'change-me',
  'changeme',
  'replace-me',
  'replaceme',
  'example-secret',
  'placeholder',
  'secret',
  'password',
]);

/** Secrets checked on startup (name in env → minimum acceptable length). */
const REQUIRED_SECRETS: Array<{ name: string; minLength: number }> = [
  { name: 'JWT_SECRET', minLength: 32 },
  { name: 'VMWARE_ENCRYPTION_KEY', minLength: 32 },
];

/**
 * Returns `true` when the value is an unresolved `<generate-with-openssl ...>`
 * marker, a known placeholder, or absent. Empty values are not treated as
 * placeholders here — presence is a separate concern (health checks / the
 * credential encryption service already fail closed on missing keys).
 */
export function isPlaceholderSecret(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^<generate-with-openssl[^>]*>$/i.test(trimmed)) return true;
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

export interface SecretValidationResult {
  ok: boolean;
  violations: string[];
}

/**
 * Validate production secrets strictly. `NODE_ENV` must be read from the passed
 * environment so the check can be unit-tested without touching the real
 * process environment.
 */
export function validateProductionSecrets(env: NodeJS.ProcessEnv = process.env): SecretValidationResult {
  if (env.NODE_ENV !== 'production') return { ok: true, violations: [] };

  const violations: string[] = [];
  for (const { name, minLength } of REQUIRED_SECRETS) {
    const raw = env[name];
    if (typeof raw !== 'string' || raw.trim() === '') {
      violations.push(`${name} is not set.`);
      continue;
    }
    const value = raw.trim();
    if (isPlaceholderSecret(value)) {
      violations.push(
        `${name} still contains a placeholder value. Generate a real secret with "openssl rand -hex ${Math.ceil(minLength / 2)}".`,
      );
      continue;
    }
    if (value.length < minLength) {
      violations.push(`${name} is shorter than ${minLength} characters.`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Fail-fast assertion invoked during backend startup in production mode.
 * Development/test runtimes are skipped entirely.
 */
export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const { ok, violations } = validateProductionSecrets(env);
  if (ok) return;
  const message = [
    '[config] Refusing to start with unsafe production secrets:',
    ...violations.map((violation) => `  - ${violation}`),
    'Set real values in the deployment environment (never commit them) before starting the backend.',
  ].join('\n');
  console.error(message);
  throw new Error(message);
}
