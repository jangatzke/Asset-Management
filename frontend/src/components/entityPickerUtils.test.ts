/**
 * Tests for the entityPickerUtils helpers.
 *
 * `vi` is provided globally by vitest via globals: true in vite.config.ts.
 */
import { mapEntityToPickerResult, hasMorePages } from './entityPickerUtils';

describe('mapEntityToPickerResult', () => {
  it('maps entity objects to picker result format', () => {
    const rawItems = [
      { id: '1', displayId: 'USR-1', name: 'User One' },
      { id: '2', legalName: 'Supplier A' },
      { id: '3', title: 'Control X' },
    ];

    const results = rawItems.map((item) => mapEntityToPickerResult(item));

    expect(results[0]).toEqual({ id: '1', label: 'USR-1 - User One' });
    expect(results[1]).toEqual({ id: '2', label: 'Supplier A' });
    expect(results[2]).toEqual({ id: '3', label: 'Control X' });
  });

  it('prefers legalName over name for suppliers', () => {
    const item = { id: 'sup-1', legalName: 'Acme Corp', name: 'acme-corp-uuid' };
    expect(mapEntityToPickerResult(item)).toEqual({ id: 'sup-1', label: 'Acme Corp' });
  });

  it('uses displayId with title when no name is present', () => {
    const item = { id: 'c-1', displayId: 'CTL-7', title: 'Control X' };
    expect(mapEntityToPickerResult(item)).toEqual({ id: 'c-1', label: 'CTL-7 - Control X' });
  });

  it('falls back to email for users without displayId/name', () => {
    const item = { id: 'u-1', email: 'jane@example.com' };
    expect(mapEntityToPickerResult(item)).toEqual({ id: 'u-1', label: 'jane@example.com' });
  });

  it('falls back to the id when no label field exists', () => {
    const item = { id: 'legacy-42' };
    expect(mapEntityToPickerResult(item)).toEqual({ id: 'legacy-42', label: 'legacy-42' });
  });

  it('accepts displayId format labels', () => {
    const result = mapEntityToPickerResult({ id: 'usr-1', displayId: 'USR-1', name: 'John Doe' });
    expect(result.id).toBe('usr-1');
    expect(result.label).toBe('USR-1 - John Doe');
  });
});

describe('hasMorePages', () => {
  it('returns false when all items have been fetched (total known)', () => {
    expect(hasMorePages(50, 20, 50)).toBe(false);
  });

  it('returns true when the last page is full but more items remain (total known)', () => {
    // 40 of 50 fetched, page size 20: there is a second page left.
    expect(hasMorePages(40, 20, 50)).toBe(true);
  });

  it('handles the exact-multiple case correctly (total is a multiple of limit)', () => {
    // 40 of 40 fetched in pages of 20: no further page, even though the
    // last page was full.
    expect(hasMorePages(40, 20, 40)).toBe(false);
  });

  it('falls back to page-full heuristic when no total is available', () => {
    expect(hasMorePages(20, 20, undefined)).toBe(true);
    expect(hasMorePages(7, 20, undefined)).toBe(false);
  });

  it('handles empty results', () => {
    expect(hasMorePages(0, 20, 0)).toBe(false);
    expect(hasMorePages(0, 20, undefined)).toBe(false);
  });
});
