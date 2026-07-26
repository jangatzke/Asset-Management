import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { setAccessToken } from '../store/accessToken';

vi.mock('axios', () => {
  const handlers = { request: undefined as any, response: undefined as any };
  const instance: any = vi.fn(async (config: any) => ({ status: 200, config }));
  instance.interceptors = {
    request: { use: vi.fn((fn) => { handlers.request = fn; }) },
    response: { use: vi.fn((_ok, fail) => { handlers.response = fail; }) },
  };
  instance.post = vi.fn(async () => ({ data: { token: 'fresh-token' } }));
  instance.__handlers = handlers;
  return { default: { create: vi.fn(() => instance) } };
});

describe('api refresh interceptor', () => {
  const mockedApi = api as any;

  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('expired-token');
  });

  it('retries a request after successful refresh exactly once and shares concurrent refresh', async () => {
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
});
