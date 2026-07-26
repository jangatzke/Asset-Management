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
  instance.post = vi.fn(async () => ({ data: { token: 'fresh-token' } }));
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
