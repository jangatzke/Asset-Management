/**
 * Read-path pagination header helper (Phase 1.1, decision D1).
 *
 * Primary and sub-resource list routes return the locked envelope
 *
 *   { data, pagination: { page, limit, total, totalPages } }
 *
 * and expose the full match count additively via `X-Total-Count`. The value
 * is taken from `pagination.total` — never from `data.length`, which only
 * reflects the current page and can differ from the filtered total.
 *
 * The helper deliberately accepts an optional pagination object so a route
 * that returns a bare array (no envelope) cannot accidentally emit a
 * page-length header. No imports beyond the Express type are used, so the
 * helper stays free of cyclic dependencies.
 */
import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T = unknown> {
  data: T[];
  pagination: PaginationMeta;
}

export function setPaginationHeader(
  res: Response,
  result: { pagination?: { total?: number } } | null | undefined,
): void {
  const total = result?.pagination?.total;
  if (typeof total === 'number' && Number.isFinite(total)) {
    res.setHeader('X-Total-Count', String(total));
  }
}
