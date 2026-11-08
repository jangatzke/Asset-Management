/**
 * Tickets page-level tests.
 *
 * Complements `Tickets.undo.test.tsx` (which covers bulk archive + undo) with the
 * remaining page contract:
 *  - initial server load (page 1, page size 20) renders the ticket rows,
 *  - empty state and its permission-gated call-to-action,
 *  - error banner when the list request fails,
 *  - role-based gating of the "new ticket" affordances,
 *  - create modal submission sends the expected payload (requester + type extension),
 *  - filters are sent to the server as query params,
 *  - server pagination drives the page param,
 *  - the `?search=` deep link seeds the search box and triggers the debounced load.
 *
 * Mocking strategy mirrors `Assets.test.tsx`: i18n returns the key itself, the
 * router is a tiny in-memory stub for `usePersistedView`, and the API module is
 * fully mocked so assertions observe the request parameters.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { useState, useEffect } from 'react';

// --- i18n: return the key itself so assertions are deterministic ---
// `t` must be a stable reference: loaders list it in their dependency array,
// so a fresh function per render would loop the fetch effect.
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
      const [state, setState] = useState(() => ({ search: store.getSearch() }));
      useEffect(() => store.subscribe(() => setState({ search: store.getSearch() })), []);
      return state;
    },
    useNavigate: () => (target: { search: string }) => {
      store.setSearch(target.search);
    },
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// --- API: capture list/create parameters ---
const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock('../services/api', () => ({
  ticketApi: {
    list: (params?: unknown) => mockList(params),
    create: (...args: unknown[]) => mockCreate(...args),
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

function paginatedResponse(data: unknown[], pagination: Record<string, unknown> = { page: 1, limit: 20, total: data.length, totalPages: 1 }) {
  return { data: { data, pagination } };
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

/** Open the DataTableShell filter panel if it is currently collapsed. */
function openFiltersPanel() {
  const toggle = screen.getByRole('button', { name: 'common.filters' });
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(toggle);
  }
}

function setUser(roles: string[], permissions: string[] = []) {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'admin@example.com', firstName: 'Ada', lastName: 'Admin', roles, permissions },
    isAuthenticated: true,
    isLoading: false,
  });
}

describe('Tickets page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    localStorage.clear();
    mockList.mockResolvedValue(paginatedResponse([ticketFixture]));
    mockCreate.mockResolvedValue({ data: { id: 't-2' } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('loads page 1 with a page size and renders the ticket rows', async () => {
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    expect(screen.getByText('Printer outage')).toBeInTheDocument();
    expect(screen.getByText('TCK-0001')).toBeInTheDocument();
  });

  it('renders the empty state and the write-gated call to action', async () => {
    mockList.mockResolvedValue(paginatedResponse([], { page: 1, limit: 20, total: 0, totalPages: 1 }));
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    expect(screen.getByText('tickets.emptyTitle')).toBeInTheDocument();
    expect(screen.getByText('tickets.emptyDescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tickets.emptyAction' })).toBeInTheDocument();
  });

  it('omits the empty-state action for users who cannot write', async () => {
    mockList.mockResolvedValue(paginatedResponse([], { page: 1, limit: 20, total: 0, totalPages: 1 }));
    setUser(['employee']);
    renderTickets();
    await flush();

    expect(screen.getByText('tickets.emptyTitle')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tickets.emptyAction' })).not.toBeInTheDocument();
  });

  it('shows an error banner with the extracted server message when loading fails', async () => {
    mockList.mockRejectedValue(Object.assign(new Error('network down'), {
      response: { data: { error: { message: 'db down' } } },
    }));
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('db down');
  });

  it('gates the new-ticket affordances by role', async () => {
    setUser(['employee']);
    renderTickets();
    await flush();

    expect(screen.queryByRole('button', { name: 'tickets.newTicket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tickets.emptyAction' })).not.toBeInTheDocument();
  });

  it('creates a ticket through the modal and sends requester + type extension', async () => {
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'tickets.newTicket' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('common.title'), { target: { value: 'Printer issue' } });
    fireEvent.change(within(dialog).getByLabelText('common.description'), { target: { value: 'Paper jam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.create' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        type: 'service_request',
        title: 'Printer issue',
        description: 'Paper jam',
        requesterId: 'u-1',
        serviceRequest: {},
      }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends the selected type filter to the server', async () => {
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    openFiltersPanel();
    fireEvent.change(screen.getByRole('combobox', { name: 'tickets.typeLabel' }), { target: { value: 'service_request' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'service_request', page: 1 }));
    });
  });

  it('advances the server page when the next button is clicked', async () => {
    mockList.mockImplementation(async (params: any) => {
      const items = params.page === 2 ? [{ ...ticketFixture, id: 't-2', displayId: 'TCK-0002', title: 'Page two ticket' }] : [ticketFixture];
      return paginatedResponse(items, { page: params.page, limit: 20, total: 60, totalPages: 3 });
    });
    setUser(['service_desk_agent']);
    renderTickets();
    await flush();

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
    expect(screen.getByText('Page two ticket')).toBeInTheDocument();
  });

  it('seeds the search box from the ?search= deep link and debounces the server query', async () => {
    vi.useFakeTimers();
    setUser(['service_desk_agent']);
    store.setSearch('?search=printer');

    renderTickets();
    await act(async () => {
      await Promise.resolve();
    });

    // The first load has no search term yet (debounce is still pending).
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('search', 'printer');

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'printer', page: 1 }));
  });
});
