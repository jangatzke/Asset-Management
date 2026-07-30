/// <reference types="vitest" />
import { paginatedTotal } from './Dashboard';

test('paginatedTotal reads totals from paginated backend responses', () => {
  expect(paginatedTotal({ data: [{ id: 'asset-1' }], pagination: { total: 42 } })).toBe(42);
  expect(paginatedTotal({ data: [], total: '7' })).toBe(7);
});

test('paginatedTotal falls back to returned row count for non-paginated responses', () => {
  expect(paginatedTotal({ data: [{ id: 'one' }, { id: 'two' }] })).toBe(2);
  expect(paginatedTotal({})).toBe(0);
});
