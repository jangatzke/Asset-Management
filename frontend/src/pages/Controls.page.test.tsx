/**
 * Controls page-level tests.
 *
 * Covers the page contract that was previously untested:
 *  - initial load (page 1, page size 50 + abort signal), row metadata and
 *    the aggregate stats cards,
 *  - empty state and error banner (server message preferred over i18n key),
 *  - client-side search filtering and `?search=` deep-link seeding,
 *  - create-modal guard (submit stays disabled until required fields exist)
 *    and the resulting create payload,
 *  - edit prefill through `controlApi.getById` and the update payload,
 *  - bulk archive undo wiring for users allowed to restore, and the
 *    permission gate for non-admin sessions,
 *  - ISMS scope -> SoA generation request and success message.
 *
 * Mocking strategy mirrors `Risks.page.test.tsx`: i18n returns the key itself,
 * react-router-dom is replaced by an in-memory `useSearchParams` stub, heavy
 * pickers/history/entity-search modules are stubbed, and the API module is
 * fully mocked (including the `default` axios instance used by the entity
 * picker helper).
 */
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
  };
});

// --- Heavy widgets are irrelevant to these assertions ---
vi.mock('../components/EntitySearchSelect', () => ({ default: () => null }));
vi.mock('../components/EntityHistoryModal', () => ({ EntityHistoryModal: () => null }));
vi.mock('../services/entityPickerApi', () => ({ entitySearchEndpoint: () => async () => [] }));

// --- API: capture request parameters ---
const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockBulkArchive = vi.fn();
const mockRestore = vi.fn();
const mockListImplementationRisks = vi.fn();
const mockListOptions = vi.fn();
const mockFrameworkList = vi.fn();
const mockSoAList = vi.fn();
const mockEvidenceList = vi.fn();
const mockListScopes = vi.fn();
const mockGenerateSoA = vi.fn();
const mockPendingJustifications = vi.fn();

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  controlApi: {
    list: (params?: unknown, options?: unknown) => mockList(params, options),
    getById: (id: string) => mockGetById(id),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    bulkArchive: (payload: unknown) => mockBulkArchive(payload),
    restore: (id: string, data?: unknown) => mockRestore(id, data),
    listImplementationRisks: (implementationId: string) => mockListImplementationRisks(implementationId),
    listSoA: () => mockSoAList(),
    generateIso27001AnnexASoA: (scopeId: string) => mockGenerateSoA(scopeId),
    pendingJustifications: () => mockPendingJustifications(),
    history: (..._args: unknown[]) => Promise.resolve({ data: { data: [] } }),
  },
  catalogApi: {
    listOptions: () => mockListOptions(),
  },
  frameworkApi: {
    list: () => mockFrameworkList(),
  },
  evidenceApi: {
    list: () => mockEvidenceList(),
  },
  organizationApi: {
    listScopes: () => mockListScopes(),
  },
}));

// Import after mocks
import Controls from './Controls';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

const accessControl = {
  id: 'c-1',
  catalogId: 'ISO 27001 - 2022',
  catalogVersion: '2022',
  title: 'Access control policy',
  description: 'Policy for logical access',
  controlGoal: 'Protect authentication',
  implementationStatus: 'planned',
  maturityLevel: 2,
  applicability: 'applicable',
  status: 'active',
  implementations: [
    {
      id: 'impl-1',
      implementationStatus: 'implemented',
      maturityLevel: 3,
      implementationDescription: 'Rolled out to all services',
    },
  ],
  requirementMappings: [
    { requirement: { id: 'req-1', requirementKey: 'A.5.1', title: 'Access control policy' } },
  ],
};

const backupControl = {
  id: 'c-2',
  catalogId: 'ISO 27001 - 2022',
  catalogVersion: '2022',
  title: 'Backup procedure',
  description: 'Daily encrypted backups',
  controlGoal: 'Preserve data',
  implementationStatus: 'planned',
  maturityLevel: 1,
  applicability: 'applicable',
  status: 'active',
  implementations: [],
  requirementMappings: [],
};

const catalogOption = { id: 'cat-1', name: 'ISO 27001', version: '2022', itemCount: 93 };
const ismsScope = { id: 'scope-1', name: 'Aurora Cloud', version: '1.0' };
const soaItem = { id: 'soa-1', frameworkId: 'ISO 27001', frameworkVersion: '2022', approvalStatus: 'approved', items: [] };

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderControls() {
  return render(
    <ToastProvider>
      <Controls />
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

describe('Controls page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    localStorage.clear();
    mockList.mockResolvedValue({ data: { data: [accessControl, backupControl] } });
    mockGetById.mockResolvedValue({ data: accessControl });
    mockCreate.mockResolvedValue({ data: {} });
    mockUpdate.mockResolvedValue({ data: {} });
    mockBulkArchive.mockResolvedValue({
      data: { succeeded: [{ id: 'c-1' }], failed: [], succeededCount: 1, failedCount: 0 },
    });
    mockRestore.mockResolvedValue({ data: {} });
    mockListImplementationRisks.mockResolvedValue({ data: { risks: [] } });
    mockListOptions.mockResolvedValue({ data: [catalogOption] });
    mockFrameworkList.mockResolvedValue({ data: [{ id: 'fw-1' }, { id: 'fw-2' }] });
    mockSoAList.mockResolvedValue({ data: [soaItem] });
    mockEvidenceList.mockResolvedValue({ data: [{ id: 'ev-1' }, { id: 'ev-2' }] });
    mockListScopes.mockResolvedValue({ data: { data: [ismsScope] } });
    mockGenerateSoA.mockResolvedValue({ data: { items: [{ id: 'item-1' }] } });
    mockPendingJustifications.mockResolvedValue({ data: { totalPending: 0, entries: [] } });
    setUser(['system_admin'], ['administration.access']);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('loads page 1 with a page size and renders control rows plus stats', async () => {
    renderControls();
    await flush();

    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith(
      { page: 1, limit: 50 },
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(mockListImplementationRisks).toHaveBeenCalledWith('impl-1');

    // Row metadata
    expect(screen.getByText('Protect authentication')).toBeInTheDocument();
    // implemented without lastTestDate -> not-verified summary key
    expect(screen.getByText('controls.verification.notVerified')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('A.5.1 Access control policy')).toBeInTheDocument();

    // Aggregate stats: 2 frameworks, 1 SoA, 2 evidence items.
    const frameworkCard = screen.getByText('controls.stats.frameworkVersions').parentElement as HTMLElement;
    const soaCard = screen.getByText('controls.stats.statementsOfApplicability').parentElement as HTMLElement;
    const evidenceCard = screen.getByText('controls.stats.evidenceItems').parentElement as HTMLElement;
    expect(within(frameworkCard).getByText('2')).toBeInTheDocument();
    expect(within(soaCard).getByText('1')).toBeInTheDocument();
    expect(within(evidenceCard).getByText('2')).toBeInTheDocument();
  });

  it('renders the empty-state message when no controls are returned', async () => {
    mockList.mockResolvedValue({ data: { data: [] } });

    renderControls();
    await flush();

    await waitFor(() => expect(screen.getByText('controls.noControls')).toBeInTheDocument());
  });

  it('shows the server error message when loading fails', async () => {
    mockList.mockRejectedValue({ response: { data: { error: { message: 'controls backend down' } } } });

    renderControls();
    await flush();

    await waitFor(() => expect(screen.getByText('controls backend down')).toBeInTheDocument());
  });

  it('filters rows client-side from the search box without refetching', async () => {
    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Backup procedure')).toBeInTheDocument());

    const callsBefore = mockList.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText('controls.searchPlaceholder'), { target: { value: 'backup' } });

    expect(screen.getByText('Backup procedure')).toBeInTheDocument();
    expect(screen.queryByText('Access control policy')).not.toBeInTheDocument();
    expect(mockList.mock.calls.length).toBe(callsBefore);
  });

  it('seeds the search box from the ?search= deep link', async () => {
    store.setSearch('search=policy');

    renderControls();
    await flush();

    expect(screen.getByPlaceholderText('controls.searchPlaceholder')).toHaveValue('policy');
    await waitFor(() => expect(screen.queryByText('Backup procedure')).not.toBeInTheDocument());
  });

  it('keeps the create submit disabled until required fields exist, then sends the catalog payload', async () => {
    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'controls.newControl' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'controls.createControl' })).toBeInTheDocument();

    const submit = within(dialog).getByRole('button', { name: 'controls.createControl' });
    expect(submit).toBeDisabled();

    const combos = within(dialog).getAllByRole('combobox');
    fireEvent.change(combos[0], { target: { value: 'cat-1' } });

    fireEvent.change(within(dialog).getByPlaceholderText('controls.fields.title'), { target: { value: 'Network segmentation' } });
    fireEvent.change(within(dialog).getByPlaceholderText('controls.fields.controlGoal'), { target: { value: 'Limit lateral movement' } });

    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogId: 'ISO 27001 - 2022',
        catalogVersion: '2022',
        title: 'Network segmentation',
        controlGoal: 'Limit lateral movement',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('prefills the edit modal from getById and updates the control', async () => {
    mockGetById.mockResolvedValue({
      data: {
        ...accessControl,
        title: 'Access control policy (edited)',
        implementationStatus: 'implemented',
        maturityLevel: 4,
      },
    });

    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'common.edit: Access control policy' }));
    const dialog = await screen.findByRole('dialog');

    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'controls.editControlTitle' })).toBeInTheDocument());
    expect(mockGetById).toHaveBeenCalledWith('c-1');
    expect(within(dialog).getByPlaceholderText('controls.fields.title')).toHaveValue('Access control policy (edited)');

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.update' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({
        catalogId: 'ISO 27001 - 2022',
        catalogVersion: '2022',
        title: 'Access control policy (edited)',
        maturityLevel: 4,
      }),
    );
  });

  it('offers undo after bulk archive and restores the archived control ids', async () => {
    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());

    // One row checkbox per control; select the first row (c-1) only.
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'bulk.select' })[0]);
    expect(screen.getByText('bulk.selectedCount')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'bulk.archive' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'bulk.archive' }));

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalledWith({ ids: ['c-1'] }));

    const undoButton = await screen.findByRole('button', { name: 'undo.label' });
    fireEvent.click(undoButton);

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('c-1', {}));
    expect(await screen.findByText('undo.done')).toBeInTheDocument();
  });

  it('does not offer undo when the user cannot restore entities', async () => {
    setUser(['employee'], ['controls.read']);

    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'bulk.select' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'bulk.archive' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'bulk.archive' }));

    await waitFor(() => expect(mockBulkArchive).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'undo.label' })).not.toBeInTheDocument();
  });

  it('generates an ISO 27001 Annex A SoA for the selected scope and reloads', async () => {
    renderControls();
    await flush();
    await waitFor(() => expect(screen.getByText('Access control policy')).toBeInTheDocument());

    const scopeSelect = screen.getByLabelText('controls.soaGenerator.scopeLabel');
    fireEvent.change(scopeSelect, { target: { value: 'scope-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'controls.soaGenerator.generateButton' }));

    await waitFor(() => expect(mockGenerateSoA).toHaveBeenCalledWith('scope-1'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('controls.soaGenerator.success'));
    expect(mockList.mock.calls.length).toBeGreaterThan(1);
  });
});
