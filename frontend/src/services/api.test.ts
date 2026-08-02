/// <reference types="vitest" />
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
  instance.post = vi.fn(async () => ({ data: { token: 'fresh-token' } }));
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
  setAccessToken('expired-token');
}

test('api refresh interceptor retries after successful refresh exactly once and shares concurrent refresh', async () => {
  resetApiTestState();
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

test('authApi.refresh and 401 interceptor share the same refresh request', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { authApi } = await import('./api');

  const error = {
    response: { status: 401 },
    config: { url: '/assets', headers: {}, _retry: false },
  };

  const [refreshResponse] = await Promise.all([
    authApi.refresh(),
    mockedApi.__handlers.response(error),
  ]);

  expect(mockedApi.post).toHaveBeenCalledTimes(1);
  expect(mockedApi.post).toHaveBeenCalledWith('/auth/refresh');
  expect(refreshResponse).toEqual({ data: { token: 'fresh-token' } });
  expect(mockedApi).toHaveBeenCalledTimes(1);
  expect(mockedApi.mock.calls[0][0].headers.Authorization).toBe('Bearer fresh-token');
});

test('phase 6 API client methods accept shared DTO contract types for target resources', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { assetApi, controlApi, incidentApi, riskApi } = await import('./api');

  const asset: Parameters<typeof assetApi.create>[0] = { name: 'Core Router', assetTypeId: '11111111-1111-4111-8111-111111111111' };
  const risk: Parameters<typeof riskApi.create>[0] = {
    title: 'Datacenter outage',
    description: 'Primary datacenter unavailable',
    possibleImpact: 'Customer-facing service outage',
    likelihood: 3,
    impact: 4,
    assessorId: 'security-user',
    riskOwnerId: 'risk-owner',
    nextReviewDate: new Date('2026-12-31T00:00:00.000Z'),
    justification: 'Phase 6 contract test',
  };
  const control: Parameters<typeof controlApi.create>[0] = {
    catalogId: 'iso27001',
    catalogVersion: '2022',
    title: 'Backup monitoring',
    description: 'Monitor backup job status',
    controlGoal: 'Detect failed backups',
  };
  const incident: Parameters<typeof incidentApi.create>[0] = {
    title: 'Ransomware alert',
    description: 'EDR detected ransomware behavior',
    detectionTime: new Date('2026-07-26T10:00:00.000Z'),
    knowledgeTime: new Date('2026-07-26T10:05:00.000Z'),
    incidentManagerId: 'incident-manager',
  };

  await assetApi.create(asset);
  await riskApi.create(risk);
  await controlApi.create(control);
  await incidentApi.create(incident);

  expect(mockedApi.post).toHaveBeenCalledWith('/assets', asset);
  expect(mockedApi.post).toHaveBeenCalledWith('/risks', risk);
  expect(mockedApi.post).toHaveBeenCalledWith('/controls', control);
  expect(mockedApi.post).toHaveBeenCalledWith('/incidents', incident);
});

test('integration API clients use backend-mounted admin integration routes', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { proxmoxApi, vmwareApi } = await import('./api');

  await proxmoxApi.getCredentials();
  await proxmoxApi.getServers();
  await proxmoxApi.testConnection('server-1');
  await vmwareApi.getCredentials();
  await vmwareApi.getServers();

  expect(mockedApi.get).toHaveBeenCalledWith('/admin/proxmox/credentials');
  expect(mockedApi.get).toHaveBeenCalledWith('/admin/proxmox/servers');
  expect(mockedApi.post).toHaveBeenCalledWith('/admin/proxmox/servers/server-1/test-connection');
  expect(mockedApi.get).toHaveBeenCalledWith('/admin/vmware/credentials');
  expect(mockedApi.get).toHaveBeenCalledWith('/admin/vmware/vcenters');
});

test('admin database API client uses protected database endpoints with multipart import', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { adminApi } = await import('./api');
  const file = new File(['{}'], 'backup.json', { type: 'application/json' });

  await adminApi.getDatabaseConfig();
  await adminApi.exportDatabase();
  await adminApi.importDatabase(file, 'dryRun');
  await adminApi.importDatabase(file, 'append');
  await adminApi.importDatabase(file, 'replace');

  expect(mockedApi.get).toHaveBeenCalledWith('/admin/database/config');
  expect(mockedApi.get).toHaveBeenCalledWith('/admin/database/export', { responseType: 'blob' });
  expect(mockedApi.post).toHaveBeenCalledWith('/admin/database/import', expect.any(FormData), {
    params: { mode: 'replace', dryRun: 'true' },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  expect(mockedApi.post).toHaveBeenCalledWith('/admin/database/import', expect.any(FormData), {
    params: { mode: 'append', dryRun: undefined },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  expect(mockedApi.post).toHaveBeenCalledWith('/admin/database/import', expect.any(FormData), {
    params: { mode: 'replace', dryRun: undefined },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
});

test('incidentApi.history calls correct endpoint with optional filters', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { incidentApi } = await import('./api');

  await incidentApi.history('incident-123', { action: 'UPDATE', limit: 20, offset: 10 });

  expect(mockedApi.get).toHaveBeenCalledWith('/incidents/incident-123/history', {
    params: { action: 'UPDATE', limit: 20, offset: 10 },
  });
});

test('incidentApi.history without params uses defaults', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { incidentApi } = await import('./api');

  await incidentApi.history('incident-456');

  expect(mockedApi.get).toHaveBeenCalledWith('/incidents/incident-456/history', {
    params: undefined,
  });
});
