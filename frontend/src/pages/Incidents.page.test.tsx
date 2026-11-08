/**
 * Incidents page-level tests.
 *
 * Covers the page contract that was previously untested:
 *  - initial server load (page 1, page size 50) and row rendering,
 *  - empty state and error banner (server message preferred over i18n key),
 *  - client-side search filtering (title/description, no refetch),
 *  - `?status=` deep-link seeding (with the "open" pseudo-filter omitted),
 *  - create-modal required-field guard and successful create payload,
 *  - bulk archive undo wiring for users allowed to restore.
 *
 * Mocking strategy mirrors `Risks.page.test.tsx`: i18n returns the key itself,
 * react-router-dom is replaced by an in-memory `useSearchParams` stub, heavy
 * entity pickers are stubbed out, and the API module is fully mocked.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { useState, useEffect } from 'react';

// --- i18n: return the key itself so assertions are deterministic ---
vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

// --- react-router-dom: in-memory query string shared with useSearchParams ---
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
    useSearchParams: () => {
      const [search, setSearchState] = useState(() => store.getSearch());
      useEffect(() => store.subscribe(() => setSearchState(store.getSearch())), []);
      return [
        new URLSearchParams(search),
        (next: URLSearchParams) => store.setSearch(next.toString()),
      ] as const;
    },
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// --- Heavy entity pickers are irrelevant to these assertions ---
vi.mock('../components/EntityPicker', () => ({ default: () => null }));

// --- API: capture request parameters ---
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockBulkArchive = vi.fn();
const mockRestore = vi.fn();
const mockHistory = vi.fn();

vi.mock('../services/api', () => ({
  incidentApi: {
    list: (params?: unknown) => mockList(params),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    bulkArchive: (payload: unknown) => mockBulkArchive(payload),
    restore: (id: string, options?: unknown) => mockRestore(id, options),
    history: (...args: unknown[]) => mockHistory(...args),
    createReport: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Import after mocks
import Incidents from './Incidents';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

const ransomwareIncident = {
  id: 'inc-1',
  title: 'Ransomware on file server',
  description: 'Files encrypted by ransomware',
  status: 'new',
  severity: 'critical',
  detectionTime: '2026-02-01T10:00:00.000Z',
  knowledgeTime: '2026-02-01T11:00:00.000Z',
  isSignificant: true,
  significanceReasons: ['availability'],
};

const phishingIncident = {
  id: 'inc-2',
  title: 'Phishing wave',
  description: 'Credential phishing mails',
  status: 'contained',
  severity: 'medium',
  detectionTime: '2026-01-20T10:00:00.000Z',
  knowledgeTime: '2026-01-20T10:30:00.000Z',
  isSignificant: false,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderIncidents() {
  return render(
    <ToastProvider>
      <Incidents />
    </ToastProvider>,
  );
}

function setUser(roles: string[], permissions: string[] = []) {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'admin@example.com', firstName: 'Ada', lastName: 'Admin', roles, permissions },
    isAuthenticated: true,
    isLoading: false,
  });
}

describe('Incidents page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    localStorage.clear();
    mockList.mockResolvedValue({ data: { data: [ransomwareIncident] } });
    mockCreate.mockResolvedValue({ data: {} });
    mockUpdate.mockResolvedValue({ data: {} });
    mockBulkArchive.mockResolvedValue({
      data: { succeeded: [{ id: 'inc-1' }], failed: [], succeededCount: 1, failedCount: 0 },
    });
    mockRestore.mockResolvedValue({ data: {} });
    mockHistory.mockResolvedValue({ data: { data: [] } });
    setUser(['system_admin'], ['administration.access']);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('loads page 1 with a page size and renders incident rows', async () => {
    renderIncidents();
    await flush();

    await waitFor(() => expect(screen.getByText('Ransomware on file server')).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('incidents.significant')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ransomware on file server' })).toHaveAttribute('href', '/incidents/inc-1');
  });

  it('renders the empty-state message when no incidents are returned', async () => {
    mockList.mockResolvedValue({ data: { data: [] } });

    renderIncidents();
    await flush();

    await waitFor(() => expect(screen.getByText('incidents.noIncidents')).toBeInTheDocument());
  });

  it('shows the server error message when loading fails', async () => {
    mockList.mockRejectedValue({ response: { data: { message: 'backend failed' } } });

    renderIncidents();
    await flush();

    await waitFor(() => expect(screen.getByText('backend failed')).toBeInTheDocument());
  });

  it('filters rows client-side from the search box without refetching the server', async () => {
    mockList.mockResolvedValue({ data: { data: [ransomwareIncident, phishingIncident] } });

    renderIncidents();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing wave')).toBeInTheDocument());

    const callsBefore = mockList.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText('incidents.searchPlaceholder'), { target: { value: 'ransom' } });

    expect(screen.getByText('Ransomware on file server')).toBeInTheDocument();
    expect(screen.queryByText('Phishing wave')).not.toBeInTheDocument();
    expect(mockList.mock.calls.length).toBe(callsBefore);
  });

  it('seeds the status filter from the ?status= deep link and sends it to the server', async () => {
    store.setSearch('status=new');

    renderIncidents();
    await flush();

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 50, status: 'new' }),
    );
    expect(screen.getByLabelText('incidents.statusFilterAria')).toHaveValue('new');
  });

  it('omits the "open" pseudo-filter from the server request', async () => {
    store.setSearch('status=open');

    renderIncidents();
    await flush();

    await waitFor(() => expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 50 }));
    expect(screen.getByLabelText('incidents.statusFilterAria')).toHaveValue('open');
  });

  it('blocks create submission on missing required fields and never calls the API', async () => {
    renderIncidents();
    await flush();
    await waitFor(() => expect(screen.getByText('Ransomware on file server')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'incidents.addIncident' }));
    expect(screen.getByRole('heading', { name: 'incidents.createIncident' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(screen.getByText('common.requiredField')).toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('creates an incident with the prefilled manager and selected severity', async () => {
    renderIncidents();
    await flush();
    await waitFor(() => expect(screen.getByText('Ransomware on file server')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'incidents.addIncident' }));
    expect(screen.getByRole('heading', { name: 'incidents.createIncident' })).toBeInTheDocument();

    // The create-modal labels are not associated via `htmlFor`, so target the
    // first text input (title) and the first textarea (description) directly.
    const dialog = screen.getByRole('dialog');
    const titleInput = dialog.querySelector('input[type="text"]') as HTMLInputElement;
    const descriptionInput = dialog.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: 'Data leak' } });
    fireEvent.change(descriptionInput, { target: { value: 'Customer records exposed' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Data leak',
        description: 'Customer records exposed',
        incidentManagerId: 'u-1',
        severity: 'medium',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers undo after bulk archive and restores the archived incident ids', async () => {
    renderIncidents();
    await flush();
    await waitFor(() => expect(screen.getByText('Ransomware on file server')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: 'bulk.select' }));
    fireEvent.click(screen.getByRole('button', { name: 'bulk.archive' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'bulk.archive' }));

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalledWith({ ids: ['inc-1'] }));

    const undoButton = await screen.findByRole('button', { name: 'undo.label' });
    fireEvent.click(undoButton);

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('inc-1', {}));
  });
});
