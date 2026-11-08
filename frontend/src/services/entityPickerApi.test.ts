/// <reference types="vitest" />
/**
 * entityPickerApi tests.
 *
 * Proves:
 *  - every entity type hits its dedicated list endpoint with the expected
 *    search parameter (`search` for list services, `q` for users/org units)
 *  - user search goes to `/users/owners` and filters inactive accounts
 *  - labels are human-readable (name + email for users, displayId/title/name)
 *  - pagination metadata drives `hasMore`
 *  - `entitySearchEndpoint` returns the resolved options for EntitySearchSelect
 *  - `fetchEntityResult` hydrates a single user via `/users/:id`
 */
import { fetchEntities, entitySearchEndpoint, fetchEntityResult } from './entityPickerApi';

declare const vi: typeof import('vitest').vi;

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./api', () => {
  const api = { get: (...args: unknown[]) => mockGet(...args) };
  return { default: api, __esModule: true };
});

beforeEach(() => {
  mockGet.mockReset();
});

describe('fetchEntities', () => {
  it('searches active users via /users/owners with the q parameter', async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: 'u-1', name: 'Alice Admin', email: 'alice@example.com', isActive: true },
        { id: 'u-2', name: 'Bob Inactive', email: 'bob@example.com', isActive: false },
      ],
    });

    const result = await fetchEntities('user', 'ali', 1, 20);

    expect(mockGet).toHaveBeenCalledWith('/users/owners', {
      params: { q: 'ali', page: 1, limit: 20 },
    });
    expect(result.items).toEqual([
      { id: 'u-1', label: 'Alice Admin (alice@example.com)' },
    ]);
  });

  it('excludes inactive users even when the endpoint returns them', async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: 'u-1', name: 'Active User', isActive: true },
        { id: 'u-2', name: 'Inactive User', isActive: false },
      ],
    });

    const result = await fetchEntities('user', 'user', 1, 20);

    expect(result.items.map((item) => item.id)).toEqual(['u-1']);
  });

  it('falls back to e-mail when a user has no name', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'u-3', email: 'only@example.com', isActive: true }],
    });

    const result = await fetchEntities('user', 'only', 1, 20);

    expect(result.items[0].label).toBe('only@example.com');
  });

  it('uses the search parameter for asset lookups', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'a-1', displayId: 'AST-001', name: 'Core Router' }],
    });

    const result = await fetchEntities('asset', 'router', 1, 20);

    expect(mockGet).toHaveBeenCalledWith('/assets', {
      params: { search: 'router', page: 1, limit: 20 },
    });
    expect(result.items).toEqual([{ id: 'a-1', label: 'AST-001 - Core Router' }]);
  });

  it('uses the q parameter for organization units', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'org-1', name: 'IT Operations' }],
    });

    const result = await fetchEntities('organizationUnit', 'IT', 1, 20);

    expect(mockGet).toHaveBeenCalledWith('/organization/units', {
      params: { q: 'IT', page: 1, limit: 20 },
    });
    expect(result.items).toEqual([{ id: 'org-1', label: 'IT Operations' }]);
  });

  it('reads paginated payloads from the data wrapper and computes hasMore from the total', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [{ id: 'c-1', title: 'Access Control' }],
        pagination: { total: 5, page: 1, limit: 1, totalPages: 5 },
      },
    });

    const result = await fetchEntities('control', 'access', 1, 1);

    expect(result.items).toEqual([{ id: 'c-1', label: 'Access Control' }]);
    expect(result.hasMore).toBe(true);
  });

  it('reports hasMore=false when the received items reach the pagination total', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [{ id: 'c-1', title: 'Access Control' }],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });

    const result = await fetchEntities('control', 'access', 1, 20);

    expect(result.hasMore).toBe(false);
  });
});

describe('entitySearchEndpoint', () => {
  it('returns resolved options through the shared search adapter', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 'u-1', name: 'Alice Admin', email: 'alice@example.com', isActive: true }],
    });

    const search = entitySearchEndpoint('user');
    const items = await search('alice');

    expect(items).toEqual([{ id: 'u-1', label: 'Alice Admin (alice@example.com)' }]);
  });

  it('short-circuits empty queries without issuing a request', async () => {
    const search = entitySearchEndpoint('asset');

    expect(await search('')).toEqual([]);
    expect(await search('   ')).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('fetchEntityResult', () => {
  it('hydrates a single user via /users/:id, not the owner search route', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'u-1', name: 'Alice Admin', email: 'alice@example.com' },
    });

    const result = await fetchEntityResult('user', 'u-1');

    expect(mockGet).toHaveBeenCalledWith('/users/u-1');
    expect(result).toEqual({ id: 'u-1', label: 'Alice Admin (alice@example.com)' });
  });

  it('returns null when the detail request fails', async () => {
    mockGet.mockRejectedValue(new Error('not found'));

    await expect(fetchEntityResult('user', 'missing')).resolves.toBeNull();
  });

  it('returns null for empty ids', async () => {
    await expect(fetchEntityResult('user', '')).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
