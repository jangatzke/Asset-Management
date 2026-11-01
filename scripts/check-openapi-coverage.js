#!/usr/bin/env node
/**
 * OpenAPI coverage drift check (Phase 1.5, adjusted scope).
 *
 * This script is the CI gate that keeps [`docs/api/openapi.yaml`](docs/api/openapi.yaml:1)
 * honest about the routers actually mounted in [`backend/src/index.ts`](backend/src/index.ts:224).
 *
 * Sources of truth:
 * - Registered prefixes are parsed from `app.use('/api/v1/<prefix>', <...Router>)`
 *   lines in `backend/src/index.ts`. Only mounts whose arguments reference a
 *   `...Router` variable count, so middleware-only mounts such as the auth rate
 *   limiter are ignored.
 * - Documented prefixes are parsed from the two-space-indented path keys of
 *   `docs/api/openapi.yaml` using a regex over `^  /[^ ]+:` lines (the file is
 *   hand-maintained YAML; no YAML parser dependency is added).
 *
 * Rules:
 * - A registered prefix with no documented path under it is reported as `missing`
 *   and fails the check with exit code 1 — unless the prefix has an allowlist
 *   entry in `docs/openapi-coverage-allowlist.json`, in which case it is reported
 *   as a known gap (warning only).
 * - A documented path whose prefix is not registered is reported as `extra`
 *   (warning; it does not fail the build). Server-root endpoints `/health`,
 *   `/health/live`, `/health/ready` and `/metrics` are documented on purpose but
 *   are not registered under `/api/v1`, so they are excluded explicitly.
 * - The registry file `backend/src/openapi/routeRegistry.ts` must list exactly the
 *   prefixes mounted in `index.ts`; a mismatch fails the check.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Optional fixture overrides for the failure-mode test: --index=<file> --spec=<file>. */
function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const INDEX_FILE = argValue('index') || path.join(ROOT, 'backend', 'src', 'index.ts');
const SPEC_FILE = argValue('spec') || path.join(ROOT, 'docs', 'api', 'openapi.yaml');
const ALLOWLIST_FILE = argValue('allowlist') || path.join(ROOT, 'docs', 'openapi-coverage-allowlist.json');

/** Prefixes registered at the server root; documented but outside `/api/v1`. */
const SERVER_ROOT_PATHS = ['/health', '/health/live', '/health/ready', '/metrics'];

function readRegisteredPrefixes() {
  const source = fs.readFileSync(INDEX_FILE, 'utf8');
  const prefixes = new Map();
  const mountRegex = /app\.use\(\s*'\/api\/v1\/([^']+)'/;
  for (const line of source.split(/\r?\n/)) {
    const match = mountRegex.exec(line);
    if (!match) continue;
    // Only count mounts that reference a router variable; middleware-only mounts
    // (e.g. the auth rate limiter) do not own a route prefix.
    if (!/\w+Router\b/.test(line)) continue;
    prefixes.set(match[1], true);
  }
  return new Set(prefixes.keys());
}

function readDocumentedPaths() {
  const source = fs.readFileSync(SPEC_FILE, 'utf8');
  const documented = new Set();
  const pathRegex = /^ {2}\/[^ ]+:/gm;
  let match;
  while ((match = pathRegex.exec(source)) !== null) {
    documented.add(match[0].replace(/^ {2}/, '').replace(/:$/, '').trim());
  }
  return documented;
}

function readRegistryPrefixes() {
  const registryFile = path.join(ROOT, 'backend', 'src', 'openapi', 'routeRegistry.ts');
  const source = fs.readFileSync(registryFile, 'utf8');
  const pathRegex = /path:\s*'\/api\/v1\/([^']+)'/g;
  const paths = [];
  let match;
  while ((match = pathRegex.exec(source)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return new Map();
  const entries = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'));
  const map = new Map();
  for (const entry of entries.allowlist ?? []) {
    map.set(entry.prefix, entry);
  }
  return map;
}

/** Strip the `/api/v1/` prefix and return the first segment(s) for matching. */
function stripApiPrefix(docPath) {
  if (docPath.startsWith('/api/v1/')) return docPath.slice('/api/v1/'.length);
  return docPath.replace(/^\//, '');
}

/** Longest registered prefix that owns the documented path, or undefined. */
function findOwningPrefix(docPath, registeredPrefixes) {
  const relative = stripApiPrefix(docPath);
  let best;
  for (const prefix of registeredPrefixes) {
    if (relative === prefix || relative.startsWith(prefix + '/')) {
      if (!best || prefix.length > best.length) best = prefix;
    }
  }
  return best;
}

function main() {
  const registered = readRegisteredPrefixes();
  const documented = readDocumentedPaths();
  const registryPrefixes = readRegistryPrefixes();
  const allowlist = readAllowlist();

  const errors = [];
  const warnings = [];

  // Registry must mirror index.ts exactly.
  const registrySet = new Set(registryPrefixes);
  const duplicateRegistry = registryPrefixes.filter((p, i) => registryPrefixes.indexOf(p) !== i);
  if (duplicateRegistry.length > 0) {
    errors.push(`Registry contains duplicate prefixes: ${[...new Set(duplicateRegistry)].join(', ')}`);
  }
  for (const prefix of registered) {
    if (!registrySet.has(prefix)) {
      errors.push(`Registered prefix missing from route registry: ${prefix}`);
    }
  }
  for (const prefix of registrySet) {
    if (!registered.has(prefix)) {
      errors.push(`Route registry lists a prefix that is not registered in index.ts: ${prefix}`);
    }
  }

  // Coverage per registered prefix.
  const documentedOwned = new Set();
  const missing = [];
  for (const docPath of documented) {
    const owner = findOwningPrefix(docPath, registered);
    if (owner) documentedOwned.add(owner);
  }
  for (const prefix of registered) {
    if (!documentedOwned.has(prefix)) {
      if (allowlist.has(prefix)) {
        const reason = allowlist.get(prefix).reason || 'no reason recorded';
        warnings.push(`KNOWN GAP: ${prefix} has no documented path (allowlisted: ${reason})`);
      } else {
        missing.push(prefix);
      }
    }
  }

  // Extra documented paths outside the registered prefixes.
  const extra = [];
  for (const docPath of documented) {
    const isServerRoot = SERVER_ROOT_PATHS.some(
      (rootPath) => docPath === rootPath || docPath.startsWith(rootPath + '/'),
    );
    if (isServerRoot) continue;
    if (!findOwningPrefix(docPath, registered)) extra.push(docPath);
  }

  if (missing.length > 0) {
    errors.push(`Missing documented paths for registered modules: ${missing.map((p) => `/api/v1/${p}`).join(', ')}`);
  }

  console.log('OpenAPI coverage check (Phase 1.5)');
  console.log(`  registered prefixes : ${registered.size}`);
  console.log(`  registry entries    : ${registryPrefixes.length}`);
  console.log(`  documented paths    : ${documented.size}`);
  console.log(`  allowlisted gaps    : ${allowlist.size}`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (extra.length > 0) {
    console.log('\nExtra documented paths (not registered under /api/v1):');
    for (const docPath of extra) console.log(`  - ${docPath}`);
    console.log('  (warning only; documented-but-unregistered paths do not fail the check)');
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const error of errors) console.log(`  - ${error}`);
    console.log('\nOpenAPI coverage check FAILED.');
    process.exit(1);
  }

  console.log('\nOpenAPI coverage check PASSED.');
  process.exit(0);
}

main();
