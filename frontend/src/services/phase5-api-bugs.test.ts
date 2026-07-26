/// <reference types="vitest" />
declare const vi: typeof import('vitest').vi;

function installAxiosMock() {
  const instance: any = vi.fn(async (config: any) => ({ status: 200, config }));
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  instance.get = vi.fn(async (url: string, config?: any) => ({ data: {}, url, config }));
  instance.post = vi.fn(async (url: string, data?: any) => ({ data: {}, url, requestData: data }));

  vi.doMock('axios', () => ({ default: { create: vi.fn(() => instance) } }));
  return instance;
}

function resetApiTestState() {
  vi.resetModules();
  vi.clearAllMocks();
}

test('Phase 5 API bug fixes use organization unit endpoint for organization picker API', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { organizationApi } = await import('./api');

  await organizationApi.listUnits({ q: 'prod', limit: 20 });

  expect(mockedApi.get).toHaveBeenCalledWith('/organization/units', { params: { q: 'prod', limit: 20 } });
  expect(mockedApi.get).not.toHaveBeenCalledWith('/users/search?q=prod');
});

test('Phase 5 API bug fixes keep user search API separate from organization unit API', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { userSearchApi } = await import('./api');

  await userSearchApi.search('prod');

  expect(mockedApi.get).toHaveBeenCalledWith('/users/search?q=prod');
});
