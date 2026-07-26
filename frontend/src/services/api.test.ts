import { vi, beforeEach } from 'vitest';
import { setAccessToken } from '../store/accessToken';

function installAxiosMock() {
  const handlers = { request: undefined as any, response: undefined as any };
  const instance: any = vi.fn(async (config: any) => ({ status: 200, config }));
  instance.interceptors = {
    request: { use: vi.fn((fn) => { handlers.request = fn; }) },
    response: { use: vi.fn((_ok, fail) => { handlers.response = fail; }) },
  };
  instance.post = vi.fn(async () => ({ data: { token: 'fresh-token' } }));
  instance.__handlers = handlers;

  vi.doMock('axios', () => ({ default: { create: vi.fn(() => instance) } }));
  return instance;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  setAccessToken('expired-token');
});

test('api refresh interceptor retries after successful refresh exactly once and shares concurrent refresh', async () => {
  const mockedApi = installAxiosMock();
  await import('./api');

  const error = (url: string) => ({
    response: { status: 401 },
    config: { url, headers: {}, _retry: false },
  });

  await Promise.all([
    mockedApi.__handlers.response(error('/assets')),
    mockedApi.__handlers.response(error('/risks')),
  ]);

  expect(mockedApi.post).toHaveBeenCalledTimes(1);
  expect(mockedApi.post).toHaveBeenCalledWith('/auth/refresh');
  expect(mockedApi).toHaveBeenCalledTimes(2);
  expect(mockedApi.mock.calls[0][0]._retry).toBe(true);
  expect(mockedApi.mock.calls[0][0].headers.Authorization).toBe('Bearer fresh-token');
});
