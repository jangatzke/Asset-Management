/**
 * Tickets page bulk-archive undo wiring.
 *
 * Proves that the Tickets list now offers the same undo affordance as Assets:
 *  - a successful bulk archive is announced through the shared undo toast,
 *  - the undo action restores exactly the tickets the backend confirmed as
 *    archived (via `ticketApi.restore` with an empty body),
 *  - the undo action is withheld when the user lacks restore permission.
 *
 * Mocking strategy mirrors `Assets.test.tsx`: i18n returns the key, the router
 * is a tiny in-memory stub, and the API module is fully mocked so the
 * assertions can observe both the bulk archive and the per-ticket restore call.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';

// --- i18n: return the key itself so assertions are deterministic ---
vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

// --- react-router-dom: in-memory `search` shared with usePersistedView ---
const { store } = vi.hoisted(() => {
  let search = '';
  const listeners = new Set<() => void>();
  return {
    store: {
      getSearch() {
        return search;
      },
      setSearch(value: string) {
        search = value;
        listeners.forEach((l) => l());
      },
      reset() {
        search = '';
        listeners.forEach((l) => l());
      },
      subscribe(fn: () => void) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    },
  };
});
vi.mock('react-router-dom', async (importOriginal: () => Promise<typeof import('react-router-dom')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLocation: () => {
      const [state, setState] = React.useState(() => ({ search: store.getSearch() }));
      React.useEffect(() => store.subscribe(() => setState({ search: store.getSearch() })), []);
      return state;
    },
    useNavigate: () => (target: { search: string }) => {
      store.setSearch(target.search);
    },
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// --- API: capture bulk archive and per-ticket restore calls ---
const mockList = vi.fn();
const mockBulkArchive = vi.fn();
const mockRestore = vi.fn();

vi.mock('../services/api', () => ({
  ticketApi: {
    list: (params?: unknown) => mockList(params),
    bulkArchive: (...args: unknown[]) => mockBulkArchive(...args),
    restore: (...args: unknown[]) => mockRestore(...args),
  },
}));

// Import after mocks
import Tickets from './Tickets';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

const ticketFixture = {
  id: 't-1',
  displayId: 'TCK-0001',
  title: 'Printer outage',
  type: 'service_request',
  priority: 'medium',
  status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function listResponse() {
  return {
    data: {
      data: [ticketFixture],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderTickets() {
  return render(
    <ToastProvider>
      <Tickets />
    </ToastProvider>,
  );
}

/** Select the single rendered ticket row. */
async function selectFirstRow() {
  await waitFor(() => expect(screen.getByText('Printer outage')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('checkbox', { name: 'bulk.select' }));
}

/** Open the bulk confirm dialog and confirm the archive. */
async function confirmBulkArchive() {
  // The page-level archive button opens the dialog; the dialog's confirm
  // button then performs the archive.
  fireEvent.click(screen.getByRole('button', { name: 'bulk.archive' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'bulk.archive' }));
}

function setUser(permissions: string[], roles: string[]) {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'admin@example.com', firstName: 'Ada', lastName: 'Admin', roles, permissions },
  });
}

describe('Tickets bulk archive undo wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    mockList.mockResolvedValue(listResponse());
    mockBulkArchive.mockResolvedValue({
      data: { succeeded: [{ id: 't-1' }], failed: [], succeededCount: 1, failedCount: 0, totalCount: 1 },
    });
    mockRestore.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers an undo action after a successful bulk archive and restores the archived ticket', async () => {
    setUser(['administration.access'], ['system_admin']);
    renderTickets();
    await flush();
    await selectFirstRow();
    await confirmBulkArchive();

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalledWith({ ids: ['t-1'] }));

    // The success toast carries the shared undo label.
    const undoButton = await screen.findByRole('button', { name: 'undo.label' });
    fireEvent.click(undoButton);

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('t-1', {}));
    expect(await screen.findByText('undo.done')).toBeInTheDocument();
  });

  it('does not offer undo when the user has no restore permission', async () => {
    setUser([], ['employee']);
    renderTickets();
    await flush();
    await selectFirstRow();
    await confirmBulkArchive();

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: 'undo.label' })).not.toBeInTheDocument();
  });
});
