/**
 * Phase 1.5 registry integrity test.
 *
 * Proves that the route registry in [`routeRegistry.ts`](backend/src/openapi/routeRegistry.ts:1)
 * mirrors every router mount in [`index.ts`](backend/src/index.ts:224):
 *  - every `app.use('/api/v1/<prefix>', ...Router)` prefix has a registry entry;
 *  - the registry contains no duplicate prefixes;
 *  - the registry does not list prefixes that are not registered in index.ts.
 *
 * The prefixes are parsed from the `index.ts` source rather than hard-coded, so
 * the test fails as soon as a new router is mounted without a registry update.
 */
import fs from 'fs';
import path from 'path';
import { ROUTE_REGISTRY } from '../openapi/routeRegistry';

function readRegisteredPrefixes(): Set<string> {
  const indexPath = path.resolve(__dirname, '..', 'index.ts');
  const source = fs.readFileSync(indexPath, 'utf8');
  const prefixes = new Set<string>();
  const mountRegex = /app\.use\(\s*'\/api\/v1\/([^']+)'/;
  for (const line of source.split(/\r?\n/)) {
    const match = mountRegex.exec(line);
    if (!match) continue;
    if (!/\w+Router\b/.test(line)) continue;
    prefixes.add(match[1]);
  }
  return prefixes;
}

describe('Phase 1.5 route registry', () => {
  const registeredPrefixes = readRegisteredPrefixes();

  it('parses at least the known router mounts from index.ts', () => {
    expect(registeredPrefixes.size).toBeGreaterThan(0);
    expect(registeredPrefixes.has('assets')).toBe(true);
    expect(registeredPrefixes.has('service-accounts/auth')).toBe(true);
  });

  it('has a registry entry for every registered /api/v1 prefix', () => {
    const registryPrefixes = ROUTE_REGISTRY.map((entry) => entry.path.replace('/api/v1/', ''));
    const missing = [...registeredPrefixes].filter((prefix) => !registryPrefixes.includes(prefix));
    expect(missing).toEqual([]);
  });

  it('lists no registry prefix that is not registered in index.ts', () => {
    const registryPrefixes = ROUTE_REGISTRY.map((entry) => entry.path.replace('/api/v1/', ''));
    const unknown = registryPrefixes.filter((prefix) => !registeredPrefixes.has(prefix));
    expect(unknown).toEqual([]);
  });

  it('contains no duplicate paths', () => {
    const paths = ROUTE_REGISTRY.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('records provenance fields for every entry', () => {
    for (const entry of ROUTE_REGISTRY) {
      expect(entry.path.startsWith('/api/v1/')).toBe(true);
      expect(typeof entry.module).toBe('string');
      expect(entry.module.length).toBeGreaterThan(0);
      expect(typeof entry.authenticated).toBe('boolean');
      expect(typeof entry.hasEtag).toBe('boolean');
      expect(typeof entry.hasIdempotency).toBe('boolean');
      expect(typeof entry.notes).toBe('string');
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('marks etag and idempotency only where index.ts or the router file mounts them', () => {
    const etagPrefixes = ROUTE_REGISTRY.filter((entry) => entry.hasEtag).map((entry) => entry.path);
    expect(etagPrefixes).toEqual([
      '/api/v1/assets',
      '/api/v1/risks',
      '/api/v1/controls',
      '/api/v1/incidents',
      '/api/v1/tickets',
      '/api/v1/search',
    ]);
    const idempotencyPrefixes = ROUTE_REGISTRY.filter((entry) => entry.hasIdempotency).map((entry) => entry.path);
    expect(idempotencyPrefixes.sort()).toEqual([
      '/api/v1/admin',
      '/api/v1/assets',
      '/api/v1/contracts',
      '/api/v1/controls',
      '/api/v1/documents',
      '/api/v1/incidents',
      '/api/v1/isms-operations',
      '/api/v1/licenses',
      '/api/v1/phase6',
      '/api/v1/risks',
      '/api/v1/service-accounts',
      '/api/v1/tickets',
      '/api/v1/treatments',
      '/api/v1/webhooks',
    ].sort());
  });
});
