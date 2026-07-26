import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { organizationApi, userSearchApi } from './api';

vi.mock('axios', () => {
  const instance: any = vi.fn(async (config: any) => ({ status: 200, config }));
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  instance.get = vi.fn(async (url: string, config?: any) => ({ data: {}, url, config }));
  instance.post = vi.fn(async (url: string, data?: any) => ({ data: {}, url, requestData: data }));
  return { default: { create: vi.fn(() => instance) } };
});

describe('Phase 5 API bug fixes', () => {
  const mockedApi = api as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses organization unit endpoint for organization picker API', async () => {
    await organizationApi.listUnits({ q: 'prod', limit: 20 });

    expect(mockedApi.get).toHaveBeenCalledWith('/organization/units', { params: { q: 'prod', limit: 20 } });
    expect(mockedApi.get).not.toHaveBeenCalledWith('/users/search?q=prod');
  });

  it('keeps user search API separate from organization unit API', async () => {
    await userSearchApi.search('prod');

    expect(mockedApi.get).toHaveBeenCalledWith('/users/search?q=prod');
  });
});
