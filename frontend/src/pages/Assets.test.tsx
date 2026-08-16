/**
 * Assets page tests.
 *
 * Proves:
 *  - Initial load fetches page 1 with a page size and renders the result count
 *  - Server-side search is debounced (no immediate refetch, refetch after 300ms with `search`)
 *  - Type / criticality / lifecycle status filters are sent to the server
 *  - Pagination: next/prev buttons, page indicator, disabled states
 *  - Toast feedback: create success, create failure (shows server error, NOT success),
 *    delete success, and load failure (error banner + toast)
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';

// --- Mock I18nContext (t returns the key itself, so assertions are deterministic) ---
// IMPORTANT: `t` must be a stable reference across renders, otherwise every render
// creates a new `loadAssets` callback (deps: [t, addToast]) which re-triggers the
// fetch effect -> infinite refetch loop in tests.
vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

// --- Mock react-router-dom ---
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '' }),
}));

// --- Mock heavy/visual components (not under test) ---
vi.mock('../components/AssetGraph', () => ({ default: () => null }));
vi.mock('../components/AssetImpactAnalysis', () => ({ default: () => null }));
vi.mock('../components/EntityHistoryModal', () => ({ EntityHistoryModal: () => null }));
vi.mock('../components/EntitySearchSelect', () => ({ default: () => null }));

// --- Mock API ---
const mockList = vi.fn();
const mockGetTypes = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGetById = vi.fn();
const mockHistory = vi.fn();
const mockContractList = vi.fn();
const mockLicenseList = vi.fn();
const mockListUsers = vi.fn();

vi.mock('../services/api', () => ({
  assetApi: {
    // Forward only `params`; the optional `config` (AbortSignal) is internal plumbing,
    // not behavior under test.
    list: (params?: unknown) => mockList(params),
    getTypes: (...args: unknown[]) => mockGetTypes(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    history: (...args: unknown[]) => mockHistory(...args),
  },
  contractApi: {
    list: (...args: unknown[]) => mockContractList(...args),
  },
  licenseApi: {
    list: (...args: unknown[]) => mockLicenseList(...args),
  },
  adminApi: {
    listUsers: (...args: unknown[]) => mockListUsers(...args),
  },
}));

// Import after mocks
import Assets from './Assets';
import { ToastProvider } from '../components/ToastProvider';

// --- Fixtures ---
const assetFixture = {
  id: 'a-1',
  name: 'Web Server 01',
  displayId: 'AS-0001',
  criticality: 'high',
  lifecycleStatus: 'active',
  status: 'active',
  inventoryNumber: 'INV-1',
  assetType: { name: 'Server' },
};

const paginationFixture = { page: 1, limit: 50, total: 1, totalPages: 1 };

function paginatedResponse(data: unknown[], pagination: Record<string, unknown> = paginationFixture) {
  return { data: { data, pagination } };
}

function renderAssets() {
  return render(
    <ToastProvider>
      <Assets />
    </ToastProvider>
  );
}

/** Flush pending promise microtasks so async state updates are applied. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Assets page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(paginatedResponse([assetFixture]));
    mockGetTypes.mockResolvedValue({ data: [{ id: 'type-1', name: 'Server' }] });
    mockCreate.mockResolvedValue({ data: { id: 'a-2' } });
    mockUpdate.mockResolvedValue({ data: { id: 'a-1' } });
    mockDelete.mockResolvedValue({ data: {} });
    mockGetById.mockResolvedValue({ data: assetFixture });
    mockHistory.mockResolvedValue({ data: [] });
    mockContractList.mockResolvedValue({ data: [] });
    mockLicenseList.mockResolvedValue({ data: [] });
    mockListUsers.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('initial load & server pagination', () => {
    it('fetches page 1 with a page size, renders assets and the result count', async () => {
      renderAssets();
      await flush();

      expect(mockList).toHaveBeenCalledTimes(1);
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
      expect(screen.getByText('Web Server 01')).toBeInTheDocument();
      expect(screen.getByText('1 assets.results')).toBeInTheDocument();
    });

    it('shows pagination controls with next/prev and disabled states', async () => {
      mockList.mockImplementation(async (params: any) => {
        const items = params.page === 2 ? [{ ...assetFixture, id: 'a-2', name: 'Page Two Asset' }] : [assetFixture];
        return paginatedResponse(items, { page: params.page, limit: 50, total: 120, totalPages: 3 });
      });

      renderAssets();
      await flush();

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      const backButton = screen.getByRole('button', { name: 'common.back' });
      expect(nextButton).toBeEnabled();
      expect(backButton).toBeDisabled();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      });
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
      expect(screen.getByText('Page Two Asset')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
      });
      expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'common.back' })).toBeEnabled();

      fireEvent.click(screen.getByRole('button', { name: 'common.back' }));
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      });
    });
  });

  describe('server-side search & filters', () => {
    it('does not refetch immediately while typing, and sends `search` after the 300ms debounce', async () => {
      vi.useFakeTimers();

      renderAssets();
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockList).toHaveBeenCalledTimes(1);

      const searchInput = screen.getByPlaceholderText('assets.searchPlaceholder');
      fireEvent.change(searchInput, { target: { value: 'web' } });
      expect(mockList).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockList).toHaveBeenCalledTimes(2);
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'web', page: 1 }));
    });

    it('sends assetType, criticality and lifecycleStatus filters to the server', async () => {
      renderAssets();
      await flush();

      fireEvent.change(screen.getByRole('combobox', { name: 'assets.fields.assetType' }), { target: { value: 'type-1' } });
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ assetTypeId: 'type-1' }));
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'assets.fields.criticality' }), { target: { value: 'high' } });
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: 'high', assetTypeId: 'type-1' }));
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'assets.fields.lifecycleStatus' }), { target: { value: 'active' } });
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(
          expect.objectContaining({ lifecycleStatus: 'active', criticality: 'high', assetTypeId: 'type-1', page: 1 })
        );
      });
    });

    it('resets to page 1 when a filter changes on a later page', async () => {
      mockList.mockImplementation(async (params: any) => paginatedResponse([assetFixture], { page: params.page, limit: 50, total: 120, totalPages: 3 }));

      renderAssets();
      await flush();

      fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      });

      fireEvent.change(screen.getByRole('combobox', { name: 'assets.fields.criticality' }), { target: { value: 'critical' } });
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: 'critical', page: 1 }));
      });
    });
it('discards a stale, out-of-order response when a newer request resolves first', async () => {
  // StrictMode double-invokes the mount effect (dev-mode behavior), which yields two
  // overlapping list requests — the real-world race the latestRequestId guard protects
  // against. The first (older) request is held back; the second (newer) resolves first.
  let resolveStale: (value: unknown) => void = () => undefined;
  const staleRequest = new Promise((resolve) => {
    resolveStale = resolve;
  });
  let call = 0;
  mockList.mockImplementation(async () => {
    call += 1;
    if (call === 1) {
      return await staleRequest; // older request: held back
    }
    return paginatedResponse(
      [{ ...assetFixture, id: 'a-3', name: 'Fresh Asset' }],
      { page: 1, limit: 50, total: 1, totalPages: 1 },
    ); // newer request: resolves immediately
  });

  const { unmount } = render(
    <React.StrictMode>
      <ToastProvider>
        <Assets />
      </ToastProvider>
    </React.StrictMode>,
  );
  try {
    // Let the newer (second) request settle.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    });
    expect(screen.getByText('Fresh Asset')).toBeInTheDocument();

    // Now release the older, stale response — it must be discarded.
    await act(async () => {
      resolveStale(paginatedResponse([{ ...assetFixture, id: 'a-9', name: 'Stale Asset' }]));
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });

    expect(screen.queryByText('Stale Asset')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh Asset')).toBeInTheDocument();
  } finally {
    unmount();
  }
    });
  });

  describe('toast feedback', () => {
    it('shows a success toast after creating an asset', async () => {
      renderAssets();
      await flush();

      fireEvent.click(screen.getByRole('button', { name: 'assets.newAsset' }));
      const dialog = await screen.findByRole('dialog');

      const nameInput = dialog.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Web Server 02' } });

      const typeSelect = dialog.querySelectorAll('select')[0] as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: 'type-1' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'assets.createAsset' }));

      await waitFor(() => {
        expect(screen.getByText('assets.createSuccess')).toBeInTheDocument();
      });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Web Server 02', assetTypeId: 'type-1' }));
    });

    it('shows the server error message (not a success message) when create fails', async () => {
      mockCreate.mockRejectedValue(Object.assign(new Error('validation failed'), {
        response: { data: { error: { message: 'validation failed' } } },
      }));

      renderAssets();
      await flush();

      fireEvent.click(screen.getByRole('button', { name: 'assets.newAsset' }));
      const dialog = await screen.findByRole('dialog');

      const nameInput = dialog.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Broken Asset' } });
      const typeSelect = dialog.querySelectorAll('select')[0] as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: 'type-1' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'assets.createAsset' }));

      // The server error is shown both in the inline banner and the toast
      await waitFor(() => {
        expect(screen.getAllByText('validation failed').length).toBeGreaterThanOrEqual(2);
      });
      expect(screen.queryByText('assets.createSuccess')).not.toBeInTheDocument();
    });

    it('deletes after confirmation and shows a success toast', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));

      renderAssets();
      await flush();

      fireEvent.click(screen.getByRole('button', { name: 'common.delete: Web Server 01' }));

      await waitFor(() => {
        expect(screen.getByText('assets.deleteSuccess')).toBeInTheDocument();
      });
      expect(mockDelete).toHaveBeenCalledWith('a-1');
    });

    it('keeps the current page and filters when refreshing after delete', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      mockList.mockImplementation(async (params: any) =>
        paginatedResponse(
          params.page === 2 ? [{ ...assetFixture, id: 'a-2', name: 'Page Two Asset' }] : [assetFixture],
          { page: params.page, limit: 50, total: 120, totalPages: 3 },
        ),
      );

      renderAssets();
      await flush();

      // Apply a criticality filter, then move to page 2 (the reported scenario:
      // UI shows page 2 with an active filter).
      fireEvent.change(screen.getByRole('combobox', { name: 'assets.fields.criticality' }), { target: { value: 'critical' } });
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: 'critical', page: 1 }));
      });

      fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
      await waitFor(() => {
        expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, criticality: 'critical' }));
      });
      expect(screen.getByText('Page Two Asset')).toBeInTheDocument();

      const callsBeforeDelete = mockList.mock.calls.length;

      // Delete the asset on the current page.
      fireEvent.click(screen.getByRole('button', { name: 'common.delete: Page Two Asset' }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('a-2');
      });
      await waitFor(() => {
        expect(screen.getByText('assets.deleteSuccess')).toBeInTheDocument();
      });

      // Exactly one refresh request after the delete ...
      await waitFor(() => {
        expect(mockList.mock.calls.length).toBe(callsBeforeDelete + 1);
      });

      // ... and it must re-run the active query (page 2 + criticality filter),
      // not reset to unfiltered page 1.
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, criticality: 'critical' }));
    });

    it('does not delete when the user cancels the confirmation', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));

      renderAssets();
      await flush();

      fireEvent.click(screen.getByRole('button', { name: 'common.delete: Web Server 01' }));
      await flush();

      expect(mockDelete).not.toHaveBeenCalled();
      expect(screen.queryByText('assets.deleteSuccess')).not.toBeInTheDocument();
    });

    it('shows an error banner and error toast with the server message when loading fails', async () => {
      mockList.mockRejectedValue(Object.assign(new Error('network down'), {
        response: { data: { error: { message: 'db down' } } },
      }));

      renderAssets();
      await flush();

      await waitFor(() => {
        expect(screen.getAllByText('db down').length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
