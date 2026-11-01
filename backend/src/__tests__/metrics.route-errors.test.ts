import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../middleware/errorHandler';
import { register } from '../middleware/metrics';

/**
 * Phase 1.4b (D3): the per-route error counter is incremented only from the
 * central error path, and only for status >= 500. Values are read from the
 * Prometheus text exposition so the assertions stay independent of prom-client
 * internal data shapes.
 */

interface MockResponse {
  statusCode: number;
  body: unknown;
  status: jest.Mock<Response>;
  json: jest.Mock<Response>;
  set: jest.Mock<Response>;
}

function makeRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this as unknown as Response;
    }),
    json: jest.fn(function (this: MockResponse, payload: unknown) {
      this.body = payload;
      return this as unknown as Response;
    }),
    set: jest.fn(function (this: MockResponse) {
      return this as unknown as Response;
    }),
  };
  return res;
}

/** Sum the counter for a given route/method pair from the text exposition. */
async function routeErrorCount(route: string, method: string): Promise<number> {
  const text = await register.metrics();
  const lines = text.split('\n').filter((line) => line.startsWith('http_route_errors_total{'));
  let total = 0;
  for (const line of lines) {
    const labels = line.slice(line.indexOf('{') + 1, line.indexOf('}'));
    const matchesRoute = labels.includes(`route="${route}"`);
    const matchesMethod = labels.includes(`method="${method}"`);
    if (!matchesRoute || !matchesMethod) continue;
    const value = parseFloat(line.slice(line.lastIndexOf(' ') + 1));
    if (!Number.isNaN(value)) total += value;
  }
  return total;
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('http_route_errors_total', () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  test('a 500 path increments the route error counter', async () => {
    const req = {
      method: 'POST',
      path: '/api/v1/assets',
      url: '/api/v1/assets',
    } as unknown as Request;
    const res = makeRes();

    // Operational 500 avoids the intentional console.error for non-operational
    // errors while exercising the same error path.
    errorHandler(new AppError('boom', 500), req, res as unknown as Response, jest.fn() as NextFunction);
    await flush();

    expect(res.statusCode).toBe(500);
    expect(await routeErrorCount('/api/v1/assets', 'POST')).toBe(1);
  });

  test('a successful 200 path does not increment the route error counter', async () => {
    const req = {
      method: 'GET',
      path: '/api/v1/assets',
      url: '/api/v1/assets',
    } as unknown as Request;
    const res = makeRes();

    // A plain successful route: the error handler is never invoked.
    res.status(200);
    await flush();

    expect(res.statusCode).toBe(200);
    expect(await routeErrorCount('/api/v1/assets', 'GET')).toBe(0);
  });

  test('4xx errors do not increment the route error counter (no double counting)', async () => {
    const req = {
      method: 'GET',
      path: '/api/v1/assets',
      url: '/api/v1/assets',
    } as unknown as Request;
    const res = makeRes();

    errorHandler(new AppError('missing', 404), req, res as unknown as Response, jest.fn() as NextFunction);
    await flush();

    expect(res.statusCode).toBe(404);
    expect(await routeErrorCount('/api/v1/assets', 'GET')).toBe(0);
  });

  test('the counter is exposed in the metrics text output', async () => {
    const text = await register.metrics();
    expect(text).toContain('# HELP http_route_errors_total');
    expect(text).toContain('# TYPE http_route_errors_total counter');
    expect(text).toContain('service="asset-management-backend"');
  });
});
