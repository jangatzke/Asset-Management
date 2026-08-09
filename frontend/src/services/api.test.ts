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

test('operations API exposes typed lifecycle endpoints without generic JSON form contracts', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { phase6Api } = await import('./api');

  await phase6Api.completeTraining('assignment-1', { score: 90, result: 'passed' });
  await phase6Api.enterMetricValue({ metricId: 'metric-1', value: 4.5, source: 'manual' });
  await phase6Api.runReport({ module: 'metricValues', format: 'csv' });

  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/training-assignments/assignment-1/complete', { score: 90, result: 'passed' });
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/metric-values', { metricId: 'metric-1', value: 4.5, source: 'manual' });
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/reports/run', { module: 'metricValues', format: 'csv' });
});

test('supplier API uses dedicated workflow endpoints without raw relationship IDs in UI callers', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { supplierApi } = await import('./api');

  await supplierApi.getDetail('supplier-1');
  await supplierApi.createAssessment('supplier-1', { assessorId: 'user-1', questionnaire: { security: 'yes' }, findings: [{ title: 'Missing evidence', severity: 'medium' }], actions: [] });
  await supplierApi.addContract('supplier-1', { contractId: 'contract-1' });
  await supplierApi.addRisk('supplier-1', { riskId: 'risk-1' });
  await supplierApi.createCapa('supplier-1', { title: 'Collect evidence' });

  expect(mockedApi.get).toHaveBeenCalledWith('/isms-operations/suppliers/supplier-1/detail');
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/suppliers/supplier-1/assessments', expect.objectContaining({ assessorId: 'user-1' }));
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/suppliers/supplier-1/contracts', { contractId: 'contract-1' });
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/suppliers/supplier-1/risks', { riskId: 'risk-1' });
  expect(mockedApi.post).toHaveBeenCalledWith('/isms-operations/corrective-actions/from-source', { sourceType: 'supplier', sourceId: 'supplier-1', data: { title: 'Collect evidence' } });
});

test('actionCenterApi sends typed filters to the server-side Action Center endpoint', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { actionCenterApi } = await import('./api');

  await actionCenterApi.list({ scope: 'mine', urgency: 'critical', page: 2, limit: 10 });

  expect(mockedApi.get).toHaveBeenCalledWith('/action-center', {
    params: { scope: 'mine', urgency: 'critical', page: 2, limit: 10 },
  });
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

test('incidentApi exposes the deadline recalculation endpoint used by incident detail', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { incidentApi } = await import('./api');

  await incidentApi.getById('incident-789');
  await incidentApi.recalculateDeadlines('incident-789');

  expect(mockedApi.get).toHaveBeenCalledWith('/incidents/incident-789');
  expect(mockedApi.post).toHaveBeenCalledWith('/incidents/incident-789/recalculate-deadlines');
});

test('nis2Api exposes typed read endpoints and guided workflow requests', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { nis2Api } = await import('./api');

  await nis2Api.listActiveQuestionnaires();
  await nis2Api.listAssessments();
  await nis2Api.getAssessment('assessment-1');
  await nis2Api.listRegistrations();
  await nis2Api.getRegistration('registration-1');
  await nis2Api.createAssessment({ questionnaireVersion: '1.0', answers: { sector: 'energy', employeeCount: 75, annualRevenueMillionEur: 12, criticalService: true } });

  expect(mockedApi.get).toHaveBeenCalledWith('/nis2/questionnaires/active');
  expect(mockedApi.get).toHaveBeenCalledWith('/nis2/assessments');
  expect(mockedApi.get).toHaveBeenCalledWith('/nis2/assessments/assessment-1');
  expect(mockedApi.get).toHaveBeenCalledWith('/nis2/registrations');
  expect(mockedApi.get).toHaveBeenCalledWith('/nis2/registrations/registration-1');
  expect(mockedApi.post).toHaveBeenCalledWith('/nis2/assessments', expect.objectContaining({ questionnaireVersion: '1.0' }));
});

test('actionCenterApi sends typed filters to the server-side Action Center endpoint', async () => {
  resetApiTestState();
  const mockedApi = installAxiosMock();
  const { actionCenterApi } = await import('./api');

  await actionCenterApi.list({ scope: 'mine', urgency: 'critical', page: 2, limit: 10 });

  expect(mockedApi.get).toHaveBeenCalledWith('/action-center', {
    params: { scope: 'mine', urgency: 'critical', page: 2, limit: 10 },
  });
});
