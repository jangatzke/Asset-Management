/**
 * Page-level tests for TicketDetail.
 *
 * Conventions follow the other page tests:
 *  - the i18n mock returns the key itself (`t(key) === key`)
 *  - react-router-dom is replaced with a param/navigate stub plus a plain
 *    `<a href>` Link stub
 *  - the ticket API is mocked with module-level spies wrapped in `vi.mock`
 *    so assertions can observe the exact payloads the page sends
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush, resetAuthUser } from '../test/renderWithProviders';
import TicketDetail from './TicketDetail';
import { useAuthStore } from '../store/auth';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const { route, navigateMock } = vi.hoisted(() => ({
  route: { ticketId: 't-1' },
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal: () => Promise<typeof import('react-router-dom')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ ticketId: route.ticketId }),
    useNavigate: () => navigateMock,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// The entity picker is exercised indirectly: each render exposes a clickable
// "pick:" trigger that invokes the same onChange/onValuesChange contract the
// real component uses.
vi.mock('../components/EntityPicker', () => ({
  default: (props: {
    labelKey: string;
    multiple?: boolean;
    onChange?: (value: { id: string; label: string }) => void;
    onValuesChange?: (values: Array<{ id: string; label: string }>) => void;
  }) => {
    const pickId =
      props.labelKey === 'tickets.detail.linkRisk'
        ? 'r-9'
        : props.labelKey === 'tickets.detail.attachAsset'
          ? 'asset-9'
          : 'u-2';
    return (
      <div>
        <span>{props.labelKey}</span>
        <button
          type="button"
          onClick={() =>
            props.multiple
              ? props.onValuesChange?.([{ id: 'asset-9', label: 'Laptop' }])
              : props.onChange?.({ id: pickId, label: props.labelKey })
          }
        >
          {`pick:${props.labelKey}`}
        </button>
      </div>
    );
  },
}));

const ticketApiMock = vi.hoisted(() => ({
  getById: vi.fn(),
  getAssets: vi.fn(),
  history: vi.fn(),
  changeStatus: vi.fn(),
  update: vi.fn(),
  changeType: vi.fn(),
  updateProblem: vi.fn(),
  updateChange: vi.fn(),
  linkRisk: vi.fn(),
  unlinkRisk: vi.fn(),
  comment: vi.fn(),
  requesterComment: vi.fn(),
  close: vi.fn(),
  assign: vi.fn(),
  addAssets: vi.fn(),
  removeAssets: vi.fn(),
  convertFromIncident: vi.fn(),
}));

vi.mock('../services/api', () => ({ ticketApi: ticketApiMock }));

function incidentTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    displayId: 'INC-0001',
    type: 'incident',
    title: 'Ransomware alert',
    description: 'Hosts encrypted on the file server',
    status: 'new',
    priority: 'high',
    urgency: 'high',
    impact: 'high',
    estimatedEffortUnits: 4,
    resolutionDueAt: null,
    updatedAt: '2025-01-01T00:00:00.000Z',
    assignee: { id: 'u-2', email: 'alex@example.com', firstName: 'Alex', lastName: 'Smith' },
    requester: { id: 'u-1', email: 'jan@example.com', firstName: 'Jan', lastName: 'Doe' },
    comments: [
      {
        id: 'c-1',
        body: 'Initial triage done',
        isInternal: true,
        createdAt: '2025-01-02T10:00:00.000Z',
        authorName: 'Alex Smith',
      },
    ],
    ...overrides,
  };
}

const assetContext = {
  ticketId: 't-1',
  assets: [
    {
      id: 'ta-1',
      assetId: 'asset-1',
      asset: {
        id: 'asset-1',
        displayId: 'AST-0001',
        name: 'File server',
        assetType: { id: 'at-1', name: 'Server' },
        manufacturer: 'Dell',
        status: 'in_use',
      },
    },
  ],
};

function setUser(roles: string[], permissions: string[] = [], id = 'u-1') {
  useAuthStore.setState({
    user: {
      id,
      email: `${id}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      roles,
      permissions,
    },
    isAuthenticated: true,
    isLoading: false,
  });
}

async function renderDetail() {
  renderWithProviders(<TicketDetail />);
  await flush();
}

beforeEach(() => {
  setUser(['service_desk_agent']);
  ticketApiMock.getById.mockResolvedValue({ data: incidentTicket() });
  ticketApiMock.getAssets.mockResolvedValue({ data: assetContext });
  ticketApiMock.history.mockResolvedValue({
    data: {
      data: [
        { id: 'h-1', action: 'created', summary: 'Ticket opened', createdAt: '2025-01-01T09:00:00.000Z' },
      ],
    },
  });
  ticketApiMock.changeStatus.mockResolvedValue({ data: {} });
  ticketApiMock.update.mockResolvedValue({ data: {} });
  ticketApiMock.changeType.mockResolvedValue({ data: {} });
  ticketApiMock.updateProblem.mockResolvedValue({ data: {} });
  ticketApiMock.updateChange.mockResolvedValue({ data: {} });
  ticketApiMock.linkRisk.mockResolvedValue({ data: {} });
  ticketApiMock.unlinkRisk.mockResolvedValue({ data: {} });
  ticketApiMock.comment.mockResolvedValue({ data: {} });
  ticketApiMock.requesterComment.mockResolvedValue({ data: {} });
  ticketApiMock.close.mockResolvedValue({ data: {} });
  ticketApiMock.assign.mockResolvedValue({ data: {} });
  ticketApiMock.addAssets.mockResolvedValue({ data: {} });
  ticketApiMock.removeAssets.mockResolvedValue({ data: {} });
  ticketApiMock.convertFromIncident.mockResolvedValue({ data: { id: 't-2' } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  localStorage.clear();
  resetAuthUser();
});

describe('TicketDetail page', () => {
  it('loads the ticket with assets and renders header metadata, comments and SLA state', async () => {
    await renderDetail();

    expect(ticketApiMock.getById).toHaveBeenCalledWith('t-1');
    expect(ticketApiMock.getAssets).toHaveBeenCalledWith('t-1');
    expect(screen.getByRole('heading', { name: /INC-0001.*Ransomware alert/ })).toBeInTheDocument();
    expect(screen.getByText('Hosts encrypted on the file server')).toBeInTheDocument();
    expect(screen.getByText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByText('tickets.detail.notConfigured')).toBeInTheDocument();
    expect((screen.getByLabelText('tickets.detail.estimatedEffortHint') as HTMLInputElement).value).toBe('4');

    const comment = screen.getByText('Initial triage done').closest('article');
    expect(comment).not.toBeNull();
    expect(within(comment as HTMLElement).getByText(/tickets\.detail\.internalWorkNote/)).toBeInTheDocument();
    expect(within(comment as HTMLElement).getByText(/tickets\.detail\.by Alex Smith/)).toBeInTheDocument();
  });

  it('renders the loading placeholder until the ticket request settles', async () => {
    ticketApiMock.getById.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<TicketDetail />);

    expect(screen.getByText('tickets.detail.loading')).toBeInTheDocument();
  });

  it('shows the failure state with a back link and the server error message', async () => {
    ticketApiMock.getById.mockRejectedValue({
      response: { data: { error: { message: 'Ticket not found' } } },
    });

    await renderDetail();

    expect(screen.getByRole('alert')).toHaveTextContent('Ticket not found');
    expect(screen.getByRole('link', { name: /navigation\.tickets/ })).toHaveAttribute('href', '/tickets');
  });

  it('gates write, close and conversion controls for users without ITIL roles', async () => {
    setUser(['employee'], ['tickets.read']);

    await renderDetail();

    expect(screen.queryByLabelText('tickets.detail.status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'tickets.detail.closeTicket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'tickets.detail.convertToProblem' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'tickets.detail.assign' })).toBeNull();
    expect(screen.queryByPlaceholderText('tickets.detail.updatePlaceholder')).toBeNull();
    expect(screen.getByText('tickets.status.new')).toBeInTheDocument();
    // The requester (the signed-in user) may still add a follow-up note.
    expect(screen.getByPlaceholderText('tickets.detail.requesterCommentPlaceholder')).toBeInTheDocument();
  });

  it('changes the ticket status through the transition select', async () => {
    await renderDetail();

    fireEvent.change(screen.getByLabelText('tickets.detail.status'), { target: { value: 'contained' } });

    await waitFor(() => {
      expect(ticketApiMock.changeStatus).toHaveBeenCalledWith('t-1', { status: 'contained' });
    });
  });

  it('updates priority and estimated effort with the expected payloads', async () => {
    await renderDetail();

    fireEvent.change(screen.getByLabelText('tickets.detail.priority'), { target: { value: 'critical' } });
    await waitFor(() => {
      expect(ticketApiMock.update).toHaveBeenCalledWith('t-1', { priority: 'critical' });
    });

    const effort = screen.getByLabelText('tickets.detail.estimatedEffortHint');
    fireEvent.change(effort, { target: { value: '7' } });
    fireEvent.blur(effort);
    await waitFor(() => {
      expect(ticketApiMock.update).toHaveBeenCalledWith('t-1', { estimatedEffortUnits: 7 });
    });
  });

  it('saves the problem extension fields', async () => {
    ticketApiMock.getById.mockResolvedValue({
      data: incidentTicket({
        displayId: 'PRB-0001',
        type: 'problem',
        status: 'investigating',
        problem: { rootCause: '', workaround: 'Use failover', permanentFix: '' },
      }),
    });

    await renderDetail();

    expect(screen.getByRole('heading', { name: 'tickets.detail.problemDetailsTitle' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('tickets.detail.rootCauseLabel'), {
      target: { value: 'Missing patch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.saveExtension' }));

    await waitFor(() => {
      expect(ticketApiMock.updateProblem).toHaveBeenCalledWith('t-1', {
        rootCause: 'Missing patch',
        workaround: 'Use failover',
        permanentFix: '',
      });
    });
  });

  it('lists change risk links and unlinks a risk from the change extension', async () => {
    ticketApiMock.getById.mockResolvedValue({
      data: incidentTicket({
        displayId: 'CHG-0001',
        type: 'change',
        status: 'draft',
        change: {
          changeType: 'standard',
          riskLevel: 'low',
          cabApproved: false,
          implementationPlan: '',
          rollbackPlan: '',
          riskLinks: [
            { id: 'rl-1', risk: { id: 'r-1', displayId: 'RSK-0001', title: 'Legacy TLS', status: 'open' } },
          ],
        },
      }),
    });

    await renderDetail();

    expect(screen.getByRole('heading', { name: 'tickets.detail.changeDetailsTitle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /RSK-0001.*Legacy TLS/ })).toHaveAttribute('href', '/risks/r-1');

    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.unlinkRisk' }));
    await waitFor(() => {
      expect(ticketApiMock.unlinkRisk).toHaveBeenCalledWith('t-1', 'r-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'pick:tickets.detail.linkRisk' }));
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.linkRisk' }));
    await waitFor(() => {
      expect(ticketApiMock.linkRisk).toHaveBeenCalledWith('t-1', 'r-9');
    });
  });

  it('assigns a new assignee picked through the entity picker', async () => {
    await renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'pick:tickets.detail.assignee' }));
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.assign' }));

    await waitFor(() => {
      expect(ticketApiMock.assign).toHaveBeenCalledWith('t-1', { assigneeId: 'u-2' });
    });
  });

  it('renders the asset context and detaches an asset from the ticket', async () => {
    await renderDetail();

    expect(screen.getByRole('link', { name: /AST-0001.*File server/ })).toHaveAttribute('href', '/assets/asset-1');

    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.detach' }));
    await waitFor(() => {
      expect(ticketApiMock.removeAssets).toHaveBeenCalledWith('t-1', { assetIds: ['asset-1'] });
    });
  });

  it('attaches picked assets once at least one value is selected', async () => {
    await renderDetail();

    const attach = screen.getByRole('button', { name: 'tickets.detail.attachAssets' });
    expect(attach).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'pick:tickets.detail.attachAsset' }));
    expect(attach).not.toBeDisabled();
    fireEvent.click(attach);

    await waitFor(() => {
      expect(ticketApiMock.addAssets).toHaveBeenCalledWith('t-1', { assetIds: ['asset-9'] });
    });
  });

  it('posts the work note with the internal flag from the comment form', async () => {
    await renderDetail();

    fireEvent.change(screen.getByPlaceholderText('tickets.detail.updatePlaceholder'), {
      target: { value: 'Containment verified' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.addUpdate' }));

    await waitFor(() => {
      expect(ticketApiMock.comment).toHaveBeenCalledWith('t-1', {
        body: 'Containment verified',
        isInternal: true,
      });
    });
  });

  it('posts a requester comment for the requesting user without write access', async () => {
    setUser(['employee'], ['tickets.read'], 'u-1');

    await renderDetail();

    fireEvent.change(screen.getByPlaceholderText('tickets.detail.requesterCommentPlaceholder'), {
      target: { value: 'Still seeing encrypted files' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.submitComment' }));

    await waitFor(() => {
      expect(ticketApiMock.requesterComment).toHaveBeenCalledWith('t-1', {
        body: 'Still seeing encrypted files',
      });
    });
  });

  it('closes the ticket only when a closure summary is provided', async () => {
    await renderDetail();

    const promptMock = vi.spyOn(window, 'prompt').mockReturnValue('');
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.closeTicket' }));
    expect(ticketApiMock.close).not.toHaveBeenCalled();

    promptMock.mockReturnValue('Patch deployed, verified');
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.closeTicket' }));
    await waitFor(() => {
      expect(ticketApiMock.close).toHaveBeenCalledWith('t-1', { summary: 'Patch deployed, verified' });
    });
  });

  it('opens the history dialog once and keeps the loaded entries on reopen', async () => {
    await renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.historyButton' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'tickets.detail.historyTitle' })).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByText('Ticket opened')).toBeInTheDocument();
    });
    expect(ticketApiMock.history).toHaveBeenCalledWith('t-1');

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.historyButton' }));

    expect(ticketApiMock.history).toHaveBeenCalledTimes(1);
  });

  it('converts an incident after confirmation and navigates to the linked follow-up ticket', async () => {
    await renderDetail();

    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.convertToProblem' }));
    expect(ticketApiMock.convertFromIncident).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'tickets.detail.convertToProblem' }));

    await waitFor(() => {
      expect(ticketApiMock.convertFromIncident).toHaveBeenCalledWith('t-1', { targetType: 'problem' });
    });
    expect(navigateMock).toHaveBeenCalledWith('/tickets/t-2');
  });
});
