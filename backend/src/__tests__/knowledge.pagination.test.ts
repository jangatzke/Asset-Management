/**
 * Knowledge list pagination (improvement #9).
 *
 * Proves that `GET /knowledge` follows the locked primary-list contract
 * (decision D1):
 *
 *   { data, pagination: { page, limit, total, totalPages } }
 *
 * plus the additive `X-Total-Count` header taken from `pagination.total`.
 * Unlike `list.pagination.headers.test.ts` (which mocks the validation
 * middleware), this suite uses the real `validateQuery` middleware so invalid
 * pagination input is exercised end-to-end.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

/** Envelope whose page slice is shorter than the filtered total. */
const envelope = (pageLength: number, total: number, page = 1, limit = 20) => ({
  data: Array.from({ length: pageLength }, (_, index) => ({ id: `article-${index}`, title: `Article ${index}` })),
  pagination: {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  },
});

const mockKnowledgeService = {
  list: jest.fn(() => Promise.resolve(envelope(2, 7))),
};

jest.mock('../services/knowledge.service', () => ({ knowledgeService: mockKnowledgeService }));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  authorize: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  AuthRequest: {},
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityWrite: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  authorizeEntityDelete: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  requirePermission: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
}));

// Only the database is mocked; `validateQuery` stays real on purpose.
jest.mock('../config/database', () => ({ prisma: {} }));

import { knowledgeRouter } from '../routes/knowledge.routes';

const app = express();
app.use(express.json());
app.use('/knowledge', knowledgeRouter);

describe('GET /knowledge pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKnowledgeService.list.mockImplementation(() => Promise.resolve(envelope(2, 7)));
  });

  it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
    const response = await request(app).get('/knowledge');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 7, totalPages: 1 });
    expect(response.headers['x-total-count']).toBe('7');
    // Header carries the filtered total, not the page slice length.
    expect(response.headers['x-total-count']).not.toBe('2');
  });

  it('applies the documented page/limit defaults when query params are omitted', async () => {
    await request(app).get('/knowledge');

    expect(mockKnowledgeService.list).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('parses page and limit into numbers and forwards them to the service', async () => {
    mockKnowledgeService.list.mockResolvedValueOnce(envelope(2, 7, 3, 2));

    const response = await request(app).get('/knowledge?page=3&limit=2');

    expect(response.status).toBe(200);
    expect(mockKnowledgeService.list).toHaveBeenCalledWith({ page: 3, limit: 2 });
    expect(response.body.pagination).toEqual({ page: 3, limit: 2, total: 7, totalPages: 4 });
    expect(response.headers['x-total-count']).toBe('7');
  });

  it('forwards the existing filters without dropping pagination', async () => {
    await request(app).get('/knowledge?search=patch&category=incident&status=published&tag=windows');

    expect(mockKnowledgeService.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      search: 'patch',
      category: 'incident',
      status: 'published',
      tag: 'windows',
    });
  });

  it('forwards relatedEntityId alongside pagination', async () => {
    await request(app).get('/knowledge?page=2&limit=10&relatedEntityId=asset-1');

    expect(mockKnowledgeService.list).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      relatedEntityId: 'asset-1',
    });
  });

  it('returns the empty page with X-Total-Count 0 when nothing matches', async () => {
    mockKnowledgeService.list.mockResolvedValueOnce(envelope(0, 0));

    const response = await request(app).get('/knowledge?search=unmatched-query');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    expect(response.headers['x-total-count']).toBe('0');
  });

  it('rejects limit above the allowed maximum with 400 and Zod details', async () => {
    const response = await request(app).get('/knowledge?limit=500');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'limit' })]),
    );
    expect(mockKnowledgeService.list).not.toHaveBeenCalled();
  });

  it('rejects non-numeric page values with 400', async () => {
    const response = await request(app).get('/knowledge?page=abc');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockKnowledgeService.list).not.toHaveBeenCalled();
  });

  it('rejects limit=0 with 400', async () => {
    const response = await request(app).get('/knowledge?limit=0');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockKnowledgeService.list).not.toHaveBeenCalled();
  });

  it('rejects an unknown category with 400', async () => {
    const response = await request(app).get('/knowledge?category=not-a-category');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockKnowledgeService.list).not.toHaveBeenCalled();
  });
});
