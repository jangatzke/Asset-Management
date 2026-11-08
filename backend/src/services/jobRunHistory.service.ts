/**
 * Improvement #10: admin-visible JobRun history.
 *
 * Read-only diagnostics surface over the existing `job_runs` table populated by
 * `executeTrackedJob` (see jobRunner.service.ts). There is NO schema change and
 * no write path here.
 *
 * Safety rules (AGENTS.md / email-gateway rule):
 *  - The raw `data` column (job payload / logs) is never selected or returned.
 *    Free-form payloads can embed mailbox, SMTP or Exchange diagnostics.
 *  - `error` is the only free-form field that leaves the backend; it is run
 *    through the shared diagnostic sanitizer and length-bounded.
 *
 * Pagination follows the locked D1 envelope `{ data, pagination }`; the route
 * emits `X-Total-Count` from `pagination.total` via setPaginationHeader.
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResult } from '../utils/pagination';
import { sanitizeDiagnosticText } from '../utils/diagnosticSanitizer';

type AnyDatabase = Record<string, any>;

/** Statuses written by executeTrackedJob / webhookQueue. */
export const JOB_RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SUMMARY_WINDOW_HOURS = 24;
const MAX_SUMMARY_WINDOW_HOURS = 24 * 30;
/** Upper bound on distinct job ids scanned for the last-run summary. */
const SUMMARY_JOB_LIMIT = 50;
/** Upper bound on returned error text; keeps the response payload small. */
const MAX_ERROR_LENGTH = 2000;

/** Fields exposed to clients. `data` is deliberately absent. */
const JOB_RUN_SELECT = {
  id: true,
  jobId: true,
  jobType: true,
  status: true,
  workerId: true,
  scheduledAt: true,
  startedAt: true,
  finishedAt: true,
  attempt: true,
  error: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface JobRunListItem {
  id: string;
  jobId: string;
  jobType: string;
  status: string;
  workerId: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempt: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRunSummary {
  generatedAt: string;
  windowHours: number;
  totalRecentRuns: number;
  statusCounts: Record<string, number>;
  jobs: JobRunListItem[];
}

export interface JobRunFilters {
  jobId?: string;
  jobTypes: string[];
  statuses: string[];
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
  order: 'asc' | 'desc';
}

export interface JobRunSummaryOptions {
  windowHours: number;
  now?: Date;
}

/** Read a single query value (Express can hand back string[]). */
function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const candidate = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    return typeof candidate === 'string' ? candidate.trim() : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
}

/** Split a comma-separated filter value into a trimmed, de-duplicated list. */
function parseCsv(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const parts = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(parts));
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(`Invalid ${label}: expected an integer between ${min} and ${max}`, 400);
  }
  return parsed;
}

function parseDateFilter(value: unknown, label: string): Date | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${label}: expected an ISO-8601 date`, 400);
  }
  return parsed;
}

/**
 * Normalize raw query params into a validated filter. Throws AppError(400) for
 * malformed dates, unknown statuses, and out-of-range pagination so a mistyped
 * admin filter fails loudly instead of silently returning an empty page.
 */
export function parseJobRunListQuery(raw: Record<string, unknown> = {}): JobRunFilters {
  const statuses = parseCsv(firstString(raw.status));
  const unknownStatuses = statuses.filter(
    (status) => !JOB_RUN_STATUSES.includes(status as (typeof JOB_RUN_STATUSES)[number]),
  );
  if (unknownStatuses.length > 0) {
    throw new AppError(
      `Invalid status filter: ${unknownStatuses.join(', ')}. Allowed: ${JOB_RUN_STATUSES.join(', ')}`,
      400,
    );
  }

  const from = parseDateFilter(raw.from, 'from');
  const to = parseDateFilter(raw.to, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw new AppError('Invalid time window: from must be before or equal to to', 400);
  }

  const order = firstString(raw.order)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    jobId: firstString(raw.jobId),
    jobTypes: parseCsv(firstString(raw.jobType)),
    statuses,
    from,
    to,
    page: parseBoundedInt(raw.page, 1, 1, 10_000, 'page'),
    limit: parseBoundedInt(raw.limit, DEFAULT_LIMIT, 1, MAX_LIMIT, 'limit'),
    order,
  };
}

/** Same validation for the summary window (hours). */
export function parseJobRunSummaryQuery(raw: Record<string, unknown> = {}): JobRunSummaryOptions {
  return {
    windowHours: parseBoundedInt(
      raw.windowHours,
      DEFAULT_SUMMARY_WINDOW_HOURS,
      1,
      MAX_SUMMARY_WINDOW_HOURS,
      'windowHours',
    ),
  };
}

function buildWhere(filters: JobRunFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.jobId) where.jobId = filters.jobId;
  if (filters.jobTypes.length > 0) where.jobType = { in: filters.jobTypes };
  if (filters.statuses.length > 0) where.status = { in: filters.statuses };
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.gte = filters.from;
    if (filters.to) createdAt.lte = filters.to;
    where.createdAt = createdAt;
  }
  return where;
}

/**
 * Redact and bound the free-form error string. Payload/log fields never pass
 * through here — they are not selected by JOB_RUN_SELECT in the first place.
 */
export function toJobRunListItem(row: Record<string, any>): JobRunListItem {
  const sanitized = sanitizeDiagnosticText(row.error);
  const error =
    sanitized && sanitized.length > MAX_ERROR_LENGTH
      ? `${sanitized.slice(0, MAX_ERROR_LENGTH)} …[truncated]`
      : sanitized;

  return {
    id: row.id,
    jobId: row.jobId,
    jobType: row.jobType,
    status: row.status,
    workerId: row.workerId ?? null,
    scheduledAt: row.scheduledAt ?? null,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    attempt: typeof row.attempt === 'number' ? row.attempt : 0,
    error: error ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function resolveDb(db?: AnyDatabase): AnyDatabase {
  return db ?? (prisma as unknown as AnyDatabase);
}

/**
 * Paginated JobRun history. Returns the locked `{ data, pagination }` envelope;
 * the route adds `X-Total-Count` from `pagination.total`.
 */
export async function listJobRuns(
  filters: JobRunFilters,
  db?: AnyDatabase,
): Promise<PaginatedResult<JobRunListItem>> {
  const database = resolveDb(db);
  const where = buildWhere(filters);
  const skip = (filters.page - 1) * filters.limit;

  const [rows, total] = await Promise.all([
    database.jobRun.findMany({
      where,
      orderBy: { createdAt: filters.order },
      skip,
      take: filters.limit,
      select: JOB_RUN_SELECT,
    }),
    database.jobRun.count({ where }),
  ]);

  return {
    data: rows.map(toJobRunListItem),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}

/**
 * Compact "last run per job" summary plus windowed status counts.
 *
 * The job list is derived from a bounded groupBy (newest job ids first), so the
 * query stays O(jobs) regardless of the run volume. Status counts are computed
 * over `windowHours` (default 24h) and only use indexed columns
 * (`createdAt`, `status`).
 */
export async function getJobRunSummary(
  options: JobRunSummaryOptions,
  db?: AnyDatabase,
): Promise<JobRunSummary> {
  const database = resolveDb(db);
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - options.windowHours * 60 * 60 * 1000);

  const [statusGroups, jobGroups] = await Promise.all([
    database.jobRun.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    database.jobRun.groupBy({
      by: ['jobId'],
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: SUMMARY_JOB_LIMIT,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let totalRecentRuns = 0;
  for (const group of statusGroups) {
    const count = Number(group?._count?._all ?? 0);
    if (Number.isFinite(count) && count > 0) {
      statusCounts[group.status] = count;
      totalRecentRuns += count;
    }
  }

  const latestRows = await Promise.all(
    jobGroups.map((group: Record<string, any>) =>
      database.jobRun.findFirst({
        where: { jobId: group.jobId },
        orderBy: { createdAt: 'desc' },
        select: JOB_RUN_SELECT,
      }),
    ),
  );

  return {
    generatedAt: now.toISOString(),
    windowHours: options.windowHours,
    totalRecentRuns,
    statusCounts,
    jobs: latestRows.filter((row: Record<string, any> | null) => row !== null).map(toJobRunListItem),
  };
}
