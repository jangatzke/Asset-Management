/**
 * Improvement #10: `/admin/job-runs` route + service tests.
 *
 * Covers:
 *  - non-admin denial (403) on both job-run endpoints
 *  - locked `{ data, pagination }` envelope + `X-Total-Count`
 *  - job name / job type / status / time-window filtering (validated + applied)
 *  - payload/log redaction: raw `data` never returned, `error` sanitized
 *  - compact last-run summary (status counts + newest row per job)
 *  - correlation ID header preserved on error responses
 */
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler';
import { correlationId } from '../middleware/correlationId';

const jobRunStore = {
  findMany: jest.fn(),
  count: jest.fn(),
  groupBy: jest.fn(),
  findFirst: jest.fn(),
};

jest.mock('../config/database', () => ({
  prisma: { jobRun: jobRunStore },
  getSafeDatabaseConfig: jest.fn(),
}));

jest.mock('../services/admin.service', () => ({ adminService: {} }));
jest.mock('../services/reminder.service', () => ({ reminderService: {} }));
jest.mock('../services/reminder.scheduler', () => ({ getReminderScheduler: jest.fn() }));
jest.mock('../services/fiscalYear.service', () => ({ fiscalYearService: {} }));
jest.mock('../services/emailGateway.service', () => ({ emailGatewayService: {} }));
jest.mock('../services/emailGateway.scheduler', () => ({ getEmailGatewayScheduler: jest.fn() }));
jest.mock('../services/audit.service', () => ({ auditService: {}, AuditService: {} }));
jest.mock('../services/auditIntegrity.service', () => ({ auditIntegrityService: {} }));
jest.mock('../services/databaseBackup.service', () => ({ databaseBackupService: {} }));
jest.mock('../services/ticket.service', () => ({ ticketService: {} }));
jest.mock('../services/sla.service', () => ({ slaService: {} }));
jest.mock('../services/sla.scheduler', () => ({ getSlaScheduler: jest.fn() }));
jest.mock('../services/navigationConfig.service', () => ({ navigationConfigService: {} }));
jest.mock('../services/navigationView.service', () => ({ navigationViewService: {} }));
jest.mock('../services/ai.service', () => ({ aiService: {} }));
jest.mock('../services/ai.scheduler', () => ({ getAiAssistantScheduler: jest.fn() }));

let adminAllowed = true;
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'admin-actor-id';
    next();
  },
}));
jest.mock('../middleware/entityAuth', () => ({
  requireAdminAccess: (_req: any, res: any, next: any) => {
    if (!adminAllowed) {
      res.status(403).json({ success: false, error: { message: 'Admin access required', code: 'FORBIDDEN' } });
      return;
    }
    next();
  },
}));

import { adminRouter } from '../routes/admin.routes';
import { parseJobRunListQuery } from '../services/jobRunHistory.service';

const app = express();
app.use(express.json());
app.use(correlationId);
app.use(adminRouter);
app.use(errorHandler);

const baseRun = {
  id: 'run-1',
  jobId: 'intune-full-sync',
  jobType: 'sync',
  status: 'completed',
  workerId: 'worker-a',
  scheduledAt: new Date('2026-11-07T09:00:00.000Z'),
  startedAt: new Date('2026-11-07T09:00:01.000Z'),
  finishedAt: new Date('2026-11-07T09:02:00.000Z'),
  attempt: 1,
  error: null,
  createdAt: new Date('2026-11-07T09:00:00.000Z'),
  updatedAt: new Date('2026-11-07T09:02:00.000Z'),
  // Free-form payload/log column that must never be selected or returned.
  data: '{"smtpPassword":"smtp-secret-value","mailbox":"ops@example.com"}',
};

describe('Improvement #10: admin job-runs routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminAllowed = true;
    jobRunStore.findMany.mockResolvedValue([baseRun]);
    jobRunStore.count.mockResolvedValue(42);
    jobRunStore.groupBy.mockResolvedValue([]);
    jobRunStore.findFirst.mockResolvedValue(null);
  });

  it('denies non-admin callers with 403 on both job-run endpoints', async () => {
    adminAllowed = false;
    const list = await request(app).get('/job-runs');
    const summary = await request(app).get('/job-runs/summary');
    expect(list.status).toBe(403);
    expect(summary.status).toBe(403);
  });

  it('returns the locked envelope and X-Total-Count from pagination.total', async () => {
    const response = await request(app).get('/job-runs?page=2&limit=10');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toEqual({ page: 2, limit: 10, total: 42, totalPages: 5 });
    expect(response.headers['x-total-count']).toBe('42');
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('never exposes the raw job payload/log column', async () => {
    const response = await request(app).get('/job-runs');

    expect(response.status).toBe(200);
    const [row] = response.body.data;
    expect(row).not.toHaveProperty('data');
    expect(JSON.stringify(response.body)).not.toContain('smtp-secret-value');
    expect(JSON.stringify(response.body)).not.toContain('ops@example.com');
  });

  it('redacts mailbox addresses and auth-error fragments from the error text', async () => {
    const rawError =
      'IMAP auth failed for ops@example.com: AUTHENTICATIONFAILED with access token smtp-secret-value';
    jobRunStore.findMany.mockResolvedValue([{ ...baseRun, status: 'failed', error: rawError }]);

    const response = await request(app).get('/job-runs');

    expect(response.status).toBe(200);
    const [row] = response.body.data;
    expect(row.error).toContain('[redacted-address]');
    expect(row.error).toContain('[redacted-auth-error]');
    expect(row.error).not.toContain('ops@example.com');
    expect(row.error).not.toMatch(/AUTHENTICATIONFAILED/i);
  });

  it('bounds a very long error string so the response stays small', async () => {
    jobRunStore.findMany.mockResolvedValue([{ ...baseRun, status: 'failed', error: 'x'.repeat(5000) }]);

    const response = await request(app).get('/job-runs');

    const [row] = response.body.data;
    expect(row.error.length).toBeLessThan(2100);
    expect(row.error).toContain('[truncated]');
  });

  it('applies job id, job type, status and time-window filters', async () => {
    const response = await request(app).get(
      '/job-runs?jobId=ticket-email-gateway&jobType=sync,email-gateway&status=completed,failed&from=2026-11-01T00:00:00.000Z&to=2026-11-07T23:59:59.000Z&order=asc',
    );

    expect(response.status).toBe(200);
    const args = jobRunStore.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      jobId: 'ticket-email-gateway',
      jobType: { in: ['sync', 'email-gateway'] },
      status: { in: ['completed', 'failed'] },
      createdAt: {
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lte: new Date('2026-11-07T23:59:59.000Z'),
      },
    });
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
    expect(jobRunStore.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('rejects an unknown status filter with a structured 400', async () => {
    const response = await request(app)
      .get('/job-runs?status=exploded')
      .set('X-Correlation-Id', 'corr-job-1');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('Invalid status filter');
    expect(response.headers['x-correlation-id']).toBe('corr-job-1');
  });

  it('rejects malformed dates and inverted windows with a structured 400', async () => {
    const badDate = await request(app).get('/job-runs?from=not-a-date');
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.message).toContain('Invalid from');

    const inverted = await request(app).get('/job-runs?from=2026-11-08T00:00:00.000Z&to=2026-11-01T00:00:00.000Z');
    expect(inverted.status).toBe(400);
    expect(inverted.body.error.message).toContain('Invalid time window');
  });

  it('clamps pagination defaults and rejects out-of-range limits', async () => {
    const defaults = parseJobRunListQuery({});
    expect(defaults.page).toBe(1);
    expect(defaults.limit).toBe(20);
    expect(defaults.order).toBe('desc');

    const tooBig = await request(app).get('/job-runs?limit=1000');
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.message).toContain('Invalid limit');
  });

  it('returns the compact last-run-per-job summary with windowed status counts', async () => {
    jobRunStore.groupBy.mockImplementation((args: any) => {
      if (args.by.includes('status')) {
        return Promise.resolve([
          { status: 'completed', _count: { _all: 12 } },
          { status: 'failed', _count: { _all: 2 } },
        ]);
      }
      return Promise.resolve([
        { jobId: 'intune-full-sync', _max: { createdAt: new Date('2026-11-07T09:00:00.000Z') } },
        { jobId: 'ticket-email-gateway', _max: { createdAt: new Date('2026-11-07T08:00:00.000Z') } },
      ]);
    });
    jobRunStore.findFirst
      .mockResolvedValueOnce(baseRun)
      .mockResolvedValueOnce({ ...baseRun, id: 'run-2', jobId: 'ticket-email-gateway', jobType: 'email-gateway', status: 'failed', error: 'LOGIN failed' });

    const response = await request(app).get('/job-runs/summary?windowHours=24');

    expect(response.status).toBe(200);
    expect(response.body.windowHours).toBe(24);
    expect(response.body.totalRecentRuns).toBe(14);
    expect(response.body.statusCounts).toEqual({ completed: 12, failed: 2 });
    expect(response.body.jobs).toHaveLength(2);
    expect(response.body.jobs[1].error).toContain('[redacted-auth-error]');
    expect(response.body.jobs[0]).not.toHaveProperty('data');
    expect(response.headers['x-total-count']).toBeUndefined();
  });

  it('rejects an out-of-range summary window', async () => {
    const response = await request(app).get('/job-runs/summary?windowHours=999');
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Invalid windowHours');
  });
});
