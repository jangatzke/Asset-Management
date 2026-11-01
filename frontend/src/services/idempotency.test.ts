/// <reference types="vitest" />
/**
 * Phase 1.3 (D2) — Idempotency-Key request interceptor.
 *
 * Exercises the interceptor handler captured from the freshly imported api
 * module: exactly the core mutation routes get a key, reads and auth do not.
 */
import { setAccessToken } from '../store/accessToken';

declare const vi: typeof import('vitest').vi;

function installAxiosMock() {
  const handlers = { request: undefined as any, response: undefined as any };
  const instance: any = vi.fn(async (config: any) => ({ status: 200, config }));
  instance.interceptors = {
    request: { use: vi.fn((fn: unknown) => { handlers.request = fn; }) },
    response: { use: vi.fn((_ok: unknown, fail: unknown) => { handlers.response = fail; }) },
  };
  instance.get = vi.fn(async () => ({ data: {} }));
  instance.post = vi.fn(async () => ({ data: {} }));
  instance.put = vi.fn(async () => ({ data: {} }));
  instance.patch = vi.fn(async () => ({ data: {} }));
  instance.delete = vi.fn(async () => ({ data: {} }));
  instance.__handlers = handlers;

  vi.doMock('axios', () => ({ default: { create: vi.fn(() => instance) } }));
  return instance;
}

function resetApiTestState() {
  vi.resetModules();
  vi.clearAllMocks();
  setAccessToken('valid-token');
}

async function loadRequestInterceptor() {
  const mockedApi = installAxiosMock();
  await import('./api');
  if (typeof mockedApi.__handlers.request !== 'function') {
    throw new Error('request interceptor was not registered');
  }
  return mockedApi.__handlers.request;
}

const makeConfig = (method: string, url: string): any => ({
  method,
  url,
  headers: {},
});

const KEY_HEADER = 'Idempotency-Key';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Idempotency-Key request interceptor (D2)', () => {
  test('POST /assets/bulk-archive receives an Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('post', '/assets/bulk-archive'));

    expect(config.headers[KEY_HEADER]).toBeDefined();
    expect(config.headers[KEY_HEADER]).toMatch(UUID_PATTERN);
  });

  test('POST /tickets receives an Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('post', '/tickets'));

    expect(config.headers[KEY_HEADER]).toMatch(UUID_PATTERN);
  });

  test('PUT /risks/:id and DELETE /incidents/:id receive a key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    expect(interceptor(makeConfig('put', '/risks/risk-1')).headers[KEY_HEADER]).toMatch(UUID_PATTERN);
    expect(interceptor(makeConfig('delete', '/incidents/incident-1')).headers[KEY_HEADER]).toMatch(UUID_PATTERN);
  });

  test('GET /assets receives no Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('get', '/assets'));

    expect(config.headers[KEY_HEADER]).toBeUndefined();
  });

  test('POST /auth/login receives no Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('post', '/auth/login'));

    expect(config.headers[KEY_HEADER]).toBeUndefined();
  });

  test('GET /tickets and HEAD/OPTIONS requests receive no key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    expect(interceptor(makeConfig('get', '/tickets')).headers[KEY_HEADER]).toBeUndefined();
    expect(interceptor(makeConfig('head', '/assets')).headers[KEY_HEADER]).toBeUndefined();
    expect(interceptor(makeConfig('options', '/assets')).headers[KEY_HEADER]).toBeUndefined();
  });

  test('POST bulk-archive routes under tickets/risks/controls/incidents receive an Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    for (const url of ['/tickets/bulk-archive', '/risks/bulk-archive', '/controls/bulk-archive', '/incidents/bulk-archive']) {
      const config = interceptor(makeConfig('post', url));
      expect(config.headers[KEY_HEADER]).toMatch(UUID_PATTERN);
    }
  });

  test('POST /tickets/bulk-transition receives an Idempotency-Key', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('post', '/tickets/bulk-transition'));

    expect(config.headers[KEY_HEADER]).toMatch(UUID_PATTERN);
  });

  test('the key stays stable when the 401 refresh retry reuses the same config object', async () => {
    resetApiTestState();
    const interceptor = await loadRequestInterceptor();

    const config = interceptor(makeConfig('post', '/tickets'));
    const firstKey = config.headers[KEY_HEADER];

    // The response interceptor retries with api(originalRequest) — the exact
    // same config object passes through the request interceptor again.
    const retriedConfig = interceptor(config);

    expect(retriedConfig).toBe(config);
    expect(retriedConfig.headers[KEY_HEADER]).toBe(firstKey);
  });
});
