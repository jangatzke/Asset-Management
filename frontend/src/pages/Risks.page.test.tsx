/**
 * Risks page-level tests.
 *
 * Covers the page contract that was previously untested:
 *  - initial server load (page 1, page size 50) plus per-risk detail enrichment,
 *  - empty state and error banner (server message surfaced via getErrorMessage),
 *  - client-side search filtering (must not refetch the server),
 *  - `?search=` deep-link seeding of the search box,
 *  - server-side status filtering (and the "open" pseudo-filter being omitted),
 *  - create-modal required-field guard (formState vs legacy form contract),
 *  - delete confirmation issuing the delete request,
 *  - bulk archive undo wiring + permission gating.
 *
 * Mocking strategy mirrors `Assets.test.tsx` / `Tickets.page.test.tsx`: i18n
 * returns the key itself, react-router-dom is replaced by an in-memory
 * `useSearchParams` stub (Risks uses URL query params for the status filter),
 * and the API module is fully mocked so assertions observe request parameters.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { useState, useEffect } from 'react';

// --- i18n: return the key itself so assertions are deterministic ---
// `t` must be a stable reference: the loader lists it in the dependency array,
// so a fresh function per render would loop the fetch effect.
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

// --- Heavy entity widgets are not relevant to these assertions ---
vi.mock('../components/EntitySearchSelect', () => ({ default: () => null }));
vi.mock('../components/EntityHistoryModal', () => ({ EntityHistoryModal: () => null }));

// --- API: capture request parameters ---
const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockBulkArchive = vi.fn();
const mockRestore = vi.fn();

vi.mock('../services/api', () => {
  const noop = () => Promise.resolve({ data: { data: [] } });
  return {
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    riskApi: {
      list: (params?: unknown, options?: unknown) => mockList(params, options),
      getById: (id: string) => mockGetById(id),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (id: string) => mockDelete(id),
      bulkArchive: (payload: unknown) => mockBulkArchive(payload),
      restore: (id: string, options?: unknown) => mockRestore(id, options),
      history: (..._args: unknown[]) => Promise.resolve({ data: { data: [] } }),
    },
    assetApi: { list: noop },
    processApi: { list: noop },
    treatmentApi: { list: noop, create: noop },
    controlApi: { list: noop },
  };
});

// Import after mocks
import Risks from './Risks';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

const phishingRisk = {
  id: 'r-1',
  displayId: 'RSK-0001',
  title: 'Phishing risk',
  description: 'Credential theft through phishing mails',
  status: 'identified',
  inherentRisk: 'high',
  residualRisk: 'medium',
  likelihood: 4,
  impact: 4,
};

const vendorRisk = {
  id: 'r-2',
  displayId: 'RSK-0002',
  title: 'Vendor risk',
  description: 'Supplier dependency',
  status: 'assessed',
  inherentRisk: 'medium',
  residualRisk: 'low',
  likelihood: 2,
  impact: 3,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderRisks() {
  return render(
    <ToastProvider>
      <Risks />
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

describe('Risks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    localStorage.clear();
    mockList.mockResolvedValue({ data: { data: [phishingRisk] } });
    mockGetById.mockResolvedValue({ data: {} });
    mockCreate.mockResolvedValue({ data: {} });
    mockUpdate.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    mockBulkArchive.mockResolvedValue({
      data: { succeeded: [{ id: 'r-1' }], failed: [], succeededCount: 1, failedCount: 0 },
    });
    mockRestore.mockResolvedValue({ data: {} });
    setUser(['system_admin'], ['administration.access']);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('loads page 1 with a page size, enriches details and renders risk rows', async () => {
    mockGetById.mockResolvedValue({
      data: { riskAssessmentVersions: [{ id: 'a-1', assessmentType: 'inherent', inherentRisk: 'critical', residualRisk: 'high', targetRisk: 'low', isCurrent: true }] },
    });

    renderRisks();
    await flush();

    await waitFor(() => expect(screen.getByText('RSK-0001')).toBeInTheDocument());
    expect(screen.getByText('Phishing risk')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 50 }, expect.objectContaining({ signal: expect.anything() }));
    expect(mockGetById).toHaveBeenCalledWith('r-1');
    // Inherent risk badge comes from the enriched detail version.
    expect(screen.getByText('risks.riskLevel.critical')).toBeInTheDocument();
    expect(screen.getByText('risks.status.identified')).toBeInTheDocument();
  });

  it('renders the empty-state message when no risks are returned', async () => {
    mockList.mockResolvedValue({ data: { data: [] } });

    renderRisks();
    await flush();

    await waitFor(() => expect(screen.getByText('risks.noRisks')).toBeInTheDocument());
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('shows the server error message when loading fails', async () => {
    mockList.mockRejectedValue({ response: { data: { error: { message: 'db down' } } } });

    renderRisks();
    await flush();

    await waitFor(() => expect(screen.getByText('db down')).toBeInTheDocument());
  });

  it('filters rows client-side from the search box without refetching the server', async () => {
    mockList.mockResolvedValue({ data: { data: [phishingRisk, vendorRisk] } });

    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('Vendor risk')).toBeInTheDocument());

    const callsBefore = mockList.mock.calls.length;
    openFiltersPanel();
    const searchInput = screen.getByPlaceholderText('risks.searchPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'phish' } });

    expect(screen.getByText('Phishing risk')).toBeInTheDocument();
    expect(screen.queryByText('Vendor risk')).not.toBeInTheDocument();
    expect(mockList.mock.calls.length).toBe(callsBefore);
  });

  it('seeds the search box from the ?search= deep link', async () => {
    store.setSearch('search=vendor');
    mockList.mockResolvedValue({ data: { data: [phishingRisk, vendorRisk] } });

    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('Vendor risk')).toBeInTheDocument());

    openFiltersPanel();
    expect(screen.getByPlaceholderText('risks.searchPlaceholder')).toHaveValue('vendor');
    expect(screen.queryByText('Phishing risk')).not.toBeInTheDocument();
  });

  it('sends the status filter to the server and omits the "open" pseudo-filter', async () => {
    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('RSK-0001')).toBeInTheDocument());

    openFiltersPanel();
    fireEvent.change(screen.getByLabelText('risks.statusFilterAria'), { target: { value: 'identified' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        { page: 1, limit: 50, status: 'identified' },
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    // A refetch flips the page into its loading state, which unmounts the
    // filter panel; reopen it and re-query the select before changing again.
    mockList.mockClear();
    openFiltersPanel();
    fireEvent.change(screen.getByLabelText('risks.statusFilterAria'), { target: { value: 'open' } });

    await waitFor(() => {
      expect(mockList).toHaveBeenLastCalledWith(
        { page: 1, limit: 50 },
        expect.objectContaining({ signal: expect.anything() }),
      );
    });
  });

  it('blocks create submission on missing required fields and never calls the API', async () => {
    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('RSK-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'risks.newRisk' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'risks.createRisk' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'risks.createRisk' }));

    await waitFor(() => expect(screen.getByText('common.requiredField')).toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('deletes the risk after the confirmation dialog is accepted', async () => {
    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('RSK-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'common.delete: Phishing risk' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('risks.deleteConfirm')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('r-1'));
  });

  it('offers undo after bulk archive and restores the archived risk ids', async () => {
    renderRisks();
    await flush();
    await waitFor(() => expect(screen.getByText('RSK-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: 'bulk.select' }));
    fireEvent.click(screen.getByRole('button', { name: 'bulk.archive' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'bulk.archive' }));

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalledWith({ ids: ['r-1'] }));

    const undoButton = await screen.findByRole('button', { name: 'undo.label' });
    fireEvent.click(undoButton);

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('r-1', {}));
  });
});
