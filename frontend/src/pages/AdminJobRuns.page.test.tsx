/**
 * Page-level tests for the job-run history admin page.
 *
 * Only `jobRunsAdminApi` and i18n are mocked; the real PaginationControls and
 * ErrorAlert components are exercised. The tests cover load, empty, error and
 * filter/pagination behaviour plus the permission gate.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush, setAuthUser, resetAuthUser } from '../test/renderWithProviders';
import AdminJobRuns from './AdminJobRuns';

vi.mock('../context/I18nContext', () => {
  const t = (key: string, params?: Record<string, string | number>) => {
    if (!params) return key;
    return Object.entries(params).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), key);
  };
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const jobRunsAdminApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
}));

vi.mock('../services/api', () => ({ jobRunsAdminApi: jobRunsAdminApiMock }));

const runFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  jobId: 'reminder-scheduler',
  jobType: 'reminder',
  status: 'completed',
  workerId: 'worker-1',
  scheduledAt: '2026-11-06T08:00:00.000Z',
  startedAt: '2026-11-06T08:00:02.000Z',
  finishedAt: '2026-11-06T08:00:04.000Z',
  attempt: 1,
  error: null,
  createdAt: '2026-11-06T08:00:00.000Z',
  updatedAt: '2026-11-06T08:00:04.000Z',
  ...overrides,
});

const summaryFixture = {
  generatedAt: '2026-11-07T12:00:00.000Z',
  windowHours: 24,
  totalRecentRuns: 3,
  statusCounts: { completed: 2, failed: 1 },
  jobs: [
    runFixture(),
    runFixture({ id: 'run-2', jobId: 'ticket-email-gateway', jobType: 'email-gateway', status: 'failed', error: 'SMTP timeout' }),
  ],
};

function renderPage() {
  return renderWithProviders(<AdminJobRuns />);
}

beforeEach(() => {
  setAuthUser({
    id: 'u-1',
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Admin',
    roles: ['system_admin'],
    permissions: ['administration.access'],
  });
  jobRunsAdminApiMock.list.mockResolvedValue({
    data: {
      data: [runFixture()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  });
  jobRunsAdminApiMock.summary.mockResolvedValue({ data: summaryFixture });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetAuthUser();
  localStorage.clear();
});

describe('AdminJobRuns page', () => {
  it('loads the run window and summary, rendering rows and status counts', async () => {
    renderPage();
    await flush();

    expect(jobRunsAdminApiMock.list).toHaveBeenCalledWith({ page: 1, limit: 20, order: 'desc' });
    expect(jobRunsAdminApiMock.summary).toHaveBeenCalledWith(24);

    expect(screen.getByRole('heading', { name: 'jobRuns.title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'jobRuns.historyTitle' })).toBeInTheDocument();

    const rows = Array.from(document.querySelectorAll('tbody tr'));
    expect(rows.some((row) => row.textContent?.includes('reminder-scheduler'))).toBe(true);

    const counts = screen.getByTestId('job-runs-status-counts');
    expect(counts).toHaveTextContent('completed: 2');
    expect(counts).toHaveTextContent('failed: 1');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the empty state when no runs match', async () => {
    jobRunsAdminApiMock.list.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    });
    jobRunsAdminApiMock.summary.mockResolvedValue({
      data: { ...summaryFixture, totalRecentRuns: 0, statusCounts: {}, jobs: [] },
    });

    renderPage();
    await flush();

    expect(screen.getByText('jobRuns.empty')).toBeInTheDocument();
    expect(screen.getByText('jobRuns.noSummary')).toBeInTheDocument();
  });
it('surfaces the correlation reference ID on load failures', async () => {
  jobRunsAdminApiMock.list.mockRejectedValue({
    response: { status: 500, headers: { 'x-correlation-id': 'corr-9' }, data: { error: { message: 'boom' } } },
  });

  renderPage();
  await flush();

  // The page stores the pre-formatted string, so the reference ID is part of
  // the alert text rather than a separate structured element.
  expect(screen.getByTestId('error-alert')).toHaveTextContent('boom');
  expect(screen.getByTestId('error-alert')).toHaveTextContent('corr-9');
});

  it('applies filters with the ISO window and resets to page one', async () => {
    renderPage();
    await flush();

    fireEvent.change(screen.getByLabelText('jobRuns.jobId'), { target: { value: 'reminder-scheduler' } });
    fireEvent.change(screen.getByLabelText('jobRuns.jobType'), { target: { value: 'reminder' } });
    fireEvent.change(screen.getByLabelText('jobRuns.status'), { target: { value: 'failed' } });
    fireEvent.change(screen.getByLabelText('jobRuns.from'), { target: { value: '2026-11-01T00:00' } });
    fireEvent.change(screen.getByLabelText('jobRuns.order'), { target: { value: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: 'jobRuns.applyFilters' }));

    await waitFor(() => expect(jobRunsAdminApiMock.list).toHaveBeenCalledTimes(2));

    const lastCall = jobRunsAdminApiMock.list.mock.calls[1][0];
    expect(lastCall).toMatchObject({
      jobId: 'reminder-scheduler',
      jobType: 'reminder',
      status: 'failed',
      page: 1,
      limit: 20,
      order: 'asc',
    });
    expect(typeof lastCall.from).toBe('string');
    expect(lastCall.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('clears filters and reloads the unfiltered window', async () => {
    renderPage();
    await flush();

    fireEvent.change(screen.getByLabelText('jobRuns.jobId'), { target: { value: 'gateway' } });
    fireEvent.click(screen.getByRole('button', { name: 'jobRuns.applyFilters' }));
    await waitFor(() => expect(jobRunsAdminApiMock.list).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'jobRuns.resetFilters' }));
    await waitFor(() => expect(jobRunsAdminApiMock.list).toHaveBeenCalledTimes(3));

    expect(jobRunsAdminApiMock.list.mock.calls[2][0]).toEqual({ page: 1, limit: 20, order: 'desc' });
  });

  it('changes the summary window and paginates the history', async () => {
    renderPage();
    await flush();

    fireEvent.change(screen.getByLabelText('jobRuns.windowHours'), { target: { value: '168' } });
    await waitFor(() => expect(jobRunsAdminApiMock.summary).toHaveBeenLastCalledWith(168));

    jobRunsAdminApiMock.list.mockResolvedValue({
      data: { data: [runFixture({ id: 'run-3' })], pagination: { page: 2, limit: 10, total: 21, totalPages: 3 } },
    });
    fireEvent.change(screen.getByLabelText('jobRuns.pageSize'), { target: { value: '10' } });
    await waitFor(() => expect(jobRunsAdminApiMock.list.mock.calls.some((call) => call[0]?.limit === 10)).toBe(true));

    expect(screen.queryByRole('button', { name: 'common.back' })).toBeInTheDocument();
  });

  it('blocks the view for users without administration access', async () => {
    setAuthUser({
      id: 'u-2',
      email: 'user@example.com',
      firstName: 'Sam',
      lastName: 'User',
      roles: ['employee'],
      permissions: ['assets.read'],
    });

    renderPage();
    await flush();

    expect(screen.getByText('jobRuns.noAccess')).toBeInTheDocument();
    expect(jobRunsAdminApiMock.list).not.toHaveBeenCalled();
    expect(jobRunsAdminApiMock.summary).not.toHaveBeenCalled();
  });

  it('uses the legacy role fallback when no permission list is present', async () => {
    setAuthUser({
      id: 'u-3',
      email: 'admin@example.com',
      firstName: 'Ada',
      lastName: 'Admin',
      roles: ['system_admin'],
    });

    renderPage();
    await flush();

    expect(jobRunsAdminApiMock.list).toHaveBeenCalled();
  });
});
