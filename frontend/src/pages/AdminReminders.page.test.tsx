/**
 * Page-level tests for the reminder automation admin page.
 *
 * Only `reminderAdminApi` and i18n are mocked. The real useLocalSort,
 * SortableTh and DataTableShell components are exercised. The tests cover the
 * load/empty/error states, the write-only SMTP password handling (empty
 * passwords must never be sent, typed passwords must be sent exactly once),
 * the SMTP connectivity check and the manual run summary.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush } from '../test/renderWithProviders';
import AdminReminders from './AdminReminders';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const reminderAdminApiMock = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  testSmtp: vi.fn(),
  runNow: vi.fn(),
  logs: vi.fn(),
}));

vi.mock('../services/api', () => ({ reminderAdminApi: reminderAdminApiMock }));

const configFixture = {
  id: 'rem-1',
  enabled: true,
  intervalMinutes: 30,
  lookAheadDays: 7,
  reminderFromEmail: 'isms@example.com',
  reminderSubjectPrefix: '[ISMS Alert]',
  smtpHost: 'smtp.example.com',
  smtpPort: 2525,
  smtpSecure: false,
  smtpUser: 'mailer',
  smtpPasswordConfigured: true,
  smtpRejectUnauthorized: true,
  lastRunAt: '2026-11-01T09:00:00.000Z',
  nextRunAt: '2026-11-02T09:00:00.000Z',
  lastRunStatus: 'success',
  lastRunMessage: '3 reminders sent',
};

const logsFixture = [
  {
    id: 'log-1',
    createdAt: '2026-11-02T10:00:00.000Z',
    runId: 'run-2',
    resource: 'Contracts',
    entityType: 'contract',
    entityId: 'c-1',
    recipientEmail: null,
    status: 'failed',
    errorMessage: 'SMTP timeout',
    dueDate: null,
  },
  {
    id: 'log-2',
    createdAt: '2026-11-01T10:00:00.000Z',
    runId: 'run-1',
    resource: 'Assets',
    entityType: 'asset',
    entityId: 'a-1',
    recipientEmail: 'ops@example.com',
    status: 'sent',
    errorMessage: null,
    dueDate: '2026-11-08T00:00:00.000Z',
  },
];

function logRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('tbody tr')) as HTMLElement[];
}

beforeEach(() => {
  reminderAdminApiMock.getConfig.mockResolvedValue({ data: configFixture });
  reminderAdminApiMock.logs.mockResolvedValue({ data: logsFixture });
  reminderAdminApiMock.updateConfig.mockResolvedValue({ data: { ...configFixture, intervalMinutes: 45 } });
  reminderAdminApiMock.testSmtp.mockResolvedValue({ data: { ok: true } });
  reminderAdminApiMock.runNow.mockResolvedValue({ data: { total: 5, sent: 3, skipped: 1, failed: 1 } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AdminReminders page', () => {
  it('loads configuration and logs, rendering the newest log first', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    expect(reminderAdminApiMock.getConfig).toHaveBeenCalledTimes(1);
    expect(reminderAdminApiMock.logs).toHaveBeenCalledWith(50);

    expect(screen.getByRole('heading', { name: 'reminders.title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'reminders.automation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'reminders.smtpSettings' })).toBeInTheDocument();

    expect(screen.getByLabelText('reminders.intervalMinutes')).toHaveValue(30);
    expect(screen.getByLabelText('reminders.lookAheadDays')).toHaveValue(7);
    expect(screen.getByLabelText('reminders.subjectPrefix')).toHaveValue('[ISMS Alert]');
    expect(screen.getByLabelText('reminders.enableReminders')).toBeChecked();

    expect(screen.getByLabelText('reminders.smtpHost')).toHaveValue('smtp.example.com');
    expect(screen.getByLabelText('reminders.port')).toHaveValue(2525);
    expect(screen.getByLabelText('reminders.fromEmail')).toHaveValue('isms@example.com');
    expect(screen.getByLabelText('reminders.smtpPassword')).toHaveValue('');
    expect(screen.getByPlaceholderText('********')).toBeInTheDocument();
    expect(screen.getByText(/reminders.lastRun/)).toHaveTextContent('success');
    expect(screen.getByText(/reminders.lastRun/)).toHaveTextContent('3 reminders sent');

    const rows = logRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Contracts');
    expect(rows[0]).toHaveTextContent('failed');
    expect(rows[0]).toHaveTextContent('SMTP timeout');
    expect(rows[1]).toHaveTextContent('Assets');
    expect(rows[1]).toHaveTextContent('ops@example.com');
    expect(rows[1]).toHaveTextContent('sent');
  });

  it('renders the loading state before configuration resolves', () => {
    reminderAdminApiMock.getConfig.mockImplementation(() => new Promise(() => undefined));
    reminderAdminApiMock.logs.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<AdminReminders />);

    expect(screen.getByText('reminders.loading')).toBeInTheDocument();
  });

  it('surfaces the server error message when loading fails', async () => {
    reminderAdminApiMock.getConfig.mockRejectedValue({
      response: { data: { error: 'Reminder service unreachable' } },
    });

    renderWithProviders(<AdminReminders />);
    await flush();

    expect(screen.getByText('Reminder service unreachable')).toBeInTheDocument();
  });

  it('saves configuration without sending an empty SMTP password', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    fireEvent.change(screen.getByLabelText('reminders.intervalMinutes'), { target: { value: '45' } });
    fireEvent.click(screen.getByLabelText('reminders.useImplicitTLS'));
    fireEvent.click(screen.getByLabelText('reminders.validateTLS'));

    fireEvent.click(screen.getByRole('button', { name: 'reminders.saveSettings' }));

    await waitFor(() => {
      expect(reminderAdminApiMock.updateConfig).toHaveBeenCalledTimes(1);
    });
    const payload = reminderAdminApiMock.updateConfig.mock.calls[0][0];
    expect(payload.intervalMinutes).toBe(45);
    expect(payload.smtpSecure).toBe(true);
    expect(payload.smtpRejectUnauthorized).toBe(false);
    expect(Object.keys(payload)).not.toContain('smtpPassword');
    expect(screen.getByText(/Reminder automation settings saved/)).toBeInTheDocument();
  });

  it('sends a typed SMTP password exactly once and warns it is not returned', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    fireEvent.change(screen.getByLabelText('reminders.smtpPassword'), { target: { value: 'smtp-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'reminders.saveSettings' }));

    await waitFor(() => {
      expect(reminderAdminApiMock.updateConfig).toHaveBeenCalledTimes(1);
    });
    expect(reminderAdminApiMock.updateConfig.mock.calls[0][0].smtpPassword).toBe('smtp-secret');
    expect(screen.getByText(/SMTP password was not returned by the API/)).toBeInTheDocument();
    expect(screen.getByLabelText('reminders.smtpPassword')).toHaveValue('');
  });

  it('reports a successful SMTP connectivity check', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'reminders.testSmtp' }));

    await waitFor(() => {
      expect(screen.getByText('SMTP connection verified successfully.')).toBeInTheDocument();
    });
    expect(reminderAdminApiMock.testSmtp).toHaveBeenCalledTimes(1);
    expect(reminderAdminApiMock.updateConfig).not.toHaveBeenCalled();
  });

  it('shows the manual run summary and reloads the log afterwards', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'reminders.runNow' }));

    await waitFor(() => {
      expect(screen.getByText('Reminder run completed: 5 due, 3 sent, 1 skipped, 1 failed.')).toBeInTheDocument();
    });
    expect(reminderAdminApiMock.runNow).toHaveBeenCalledTimes(1);
    expect(reminderAdminApiMock.logs).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when no reminder log entries exist', async () => {
    reminderAdminApiMock.logs.mockResolvedValue({ data: [] });

    renderWithProviders(<AdminReminders />);
    await flush();

    expect(within(screen.getByRole('table')).getByText('reminders.noLogEntries')).toBeInTheDocument();
    expect(logRows()).toHaveLength(1);
  });

  it('sorts the log table through the sortable column header', async () => {
    renderWithProviders(<AdminReminders />);
    await flush();

    const resourceHeader = screen.getByRole('button', { name: 'reminders.resource' });
    expect(resourceHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(resourceHeader);
    await flush();

    expect(screen.getByRole('button', { name: 'reminders.resource' })).toHaveAttribute('aria-sort', 'ascending');
    expect(logRows()[0]).toHaveTextContent('Assets');
  });
});
