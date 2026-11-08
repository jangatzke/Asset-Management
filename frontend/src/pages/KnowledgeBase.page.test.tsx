/**
 * KnowledgeBase page-level tests.
 *
 * Covers the page contract that was previously untested:
 *  - initial load without filters and list metadata rendering
 *    (displayId/category line, title, summary, tags, draft badge, view count),
 *  - empty state and error banner (extracted server message preferred),
 *  - `?search=` deep-link seeding,
 *  - category/status filters forwarded to the server,
 *  - write gating on `documents.write` (create/edit/delete affordances),
 *  - detail overlay open/close and archive-through-detail wiring,
 *  - create/submit payload (optional summary omitted, tags split/trimmed).
 *
 * Mocking strategy mirrors `Risks.page.test.tsx`/`Incidents.page.test.tsx`:
 * i18n returns the key itself, react-router-dom is replaced by an in-memory
 * `useSearchParams` stub, and the API module is fully mocked.
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

// --- API: capture request parameters ---
const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../services/api', () => ({
  knowledgeApi: {
    list: (params?: unknown) => mockList(params),
    getById: (id: string) => mockGetById(id),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (id: string) => mockDelete(id),
  },
}));

// Import after mocks
import KnowledgeBase from './KnowledgeBase';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

const publishedArticle = {
  id: 'kb-1',
  displayId: 'KB-0001',
  title: 'Phishing response playbook',
  summary: 'Steps to triage phishing incidents',
  category: 'incident',
  tags: ['phishing', 'awareness'],
  status: 'published',
  authorId: 'u-1',
  relatedEntityType: null,
  relatedEntityId: null,
  viewCount: 12,
  updatedAt: '2026-01-10T10:00:00.000Z',
  createdAt: '2026-01-10T10:00:00.000Z',
};

const draftArticle = {
  id: 'kb-2',
  displayId: 'KB-0002',
  title: 'NIS2 reporting notes',
  summary: null,
  category: 'nis2',
  tags: [],
  status: 'draft',
  authorId: 'u-1',
  relatedEntityType: null,
  relatedEntityId: null,
  viewCount: 0,
  updatedAt: '2026-01-12T10:00:00.000Z',
  createdAt: '2026-01-12T10:00:00.000Z',
};

const publishedDetail = {
  ...publishedArticle,
  content: '1. Collect the mail headers\n2. Block the sender\n3. Brief the affected team',
  createdBy: 'u-1',
  updatedBy: 'u-1',
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderKnowledgeBase() {
  return render(
    <ToastProvider>
      <KnowledgeBase />
    </ToastProvider>,
  );
}

function setUser(roles: string[], permissions?: string[]) {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'admin@example.com', firstName: 'Ada', lastName: 'Admin', roles, permissions },
    isAuthenticated: true,
    isLoading: false,
  });
}

describe('KnowledgeBase page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    localStorage.clear();
    mockList.mockResolvedValue({
      data: {
        data: [publishedArticle, draftArticle],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      },
    });
    mockGetById.mockResolvedValue({ data: publishedDetail });
    mockCreate.mockResolvedValue({ data: publishedDetail });
    mockUpdate.mockResolvedValue({ data: publishedDetail });
    mockDelete.mockResolvedValue({ data: {} });
    // Permission list present -> canWrite only with documents.write.
    setUser(['system_admin'], ['administration.access', 'documents.write']);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('loads articles without filters and renders the list metadata', async () => {
    renderKnowledgeBase();
    await flush();

    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 20, search: undefined, category: undefined, status: undefined });
    expect(screen.getByText(/KB-0001 · knowledge\.categories\.incident/)).toBeInTheDocument();
    expect(screen.getByText('Steps to triage phishing incidents')).toBeInTheDocument();
    expect(screen.getByText('phishing')).toBeInTheDocument();
    expect(screen.getByText('awareness')).toBeInTheDocument();
    // One view-count line per article in the fixture set.
    expect(screen.getAllByText('knowledge.viewCount')).toHaveLength(2);
    // Draft-only badge, scoped to the article row (the filter select also renders both labels).
    const draftItem = screen.getByRole('button', { name: 'NIS2 reporting notes' }).closest('li');
    const publishedItem = screen.getByRole('button', { name: 'Phishing response playbook' }).closest('li');
    expect(draftItem).not.toBeNull();
    expect(publishedItem).not.toBeNull();
    expect(within(draftItem as HTMLElement).getByText('knowledge.statuses.draft')).toBeInTheDocument();
    expect(within(publishedItem as HTMLElement).queryByText('knowledge.statuses.draft')).not.toBeInTheDocument();
    expect(within(publishedItem as HTMLElement).queryByText('knowledge.statuses.published')).not.toBeInTheDocument();
  });

  it('renders the empty-state message when no articles are returned', async () => {
    mockList.mockResolvedValue({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });

    renderKnowledgeBase();
    await flush();

    await waitFor(() => expect(screen.getByText('knowledge.empty')).toBeInTheDocument());
  });

  it('shows the extracted server error message when loading fails', async () => {
    mockList.mockRejectedValue({ response: { data: { error: { message: 'kb unavailable' } } } });

    renderKnowledgeBase();
    await flush();

    await waitFor(() => expect(screen.getByText('kb unavailable')).toBeInTheDocument());
  });

  it('seeds the search box from the ?search= deep link and sends it to the server', async () => {
    store.setSearch('search=phish');

    renderKnowledgeBase();
    await flush();

    const searchBox = screen.getByLabelText('common.search');
    expect(searchBox).toHaveValue('phish');
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 20, search: 'phish', category: undefined, status: undefined }),
    );
  });

  it('sends the selected category and status filters to the server', async () => {
    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('knowledge.fields.category'), { target: { value: 'incident' } });
    fireEvent.change(screen.getByLabelText('common.status'), { target: { value: 'published' } });

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: undefined, category: 'incident', status: 'published' }),
    );
  });

  it('hides create/edit/delete affordances for users without documents.write', async () => {
    setUser(['employee'], ['assets.read']);

    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'knowledge.newArticle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
  });

  it('opens the read overlay from a title and closes it again', async () => {
    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Phishing response playbook' }));

    const dialog = await screen.findByRole('dialog');
    expect(mockGetById).toHaveBeenCalledWith('kb-1');
    expect(within(dialog).getByRole('heading', { name: 'Phishing response playbook' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Collect the mail headers/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('archives an article from the read overlay and reloads', async () => {
    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Phishing response playbook' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.delete' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('kb-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('knowledge.archived')).toBeInTheDocument();
    // Archive reloads the list with the current (empty) filters.
    expect(mockList.mock.calls.length).toBeGreaterThan(1);
  });

  it('loads page 1 with the envelope and advances to page 2 via PaginationControls', async () => {
    mockList.mockResolvedValue({
      data: {
        data: [publishedArticle, draftArticle],
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
      },
    });

    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    // The page slice came from the envelope, so only the two fixture rows render.
    expect(screen.getAllByRole('button', { name: /Phishing response playbook|NIS2 reporting notes/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({ page: 2, limit: 20, search: undefined, category: undefined, status: undefined }),
    );
  });

  it('resets to page 1 when a filter changes on a later page', async () => {
    mockList.mockResolvedValue({
      data: {
        data: [publishedArticle, draftArticle],
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
      },
    });

    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({ page: 2, limit: 20, search: undefined, category: undefined, status: undefined }),
    );

    fireEvent.change(screen.getByLabelText('knowledge.fields.category'), { target: { value: 'incident' } });

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: undefined, category: 'incident', status: undefined }),
    );
  });

  it('creates an article with a trimmed tag list and omits the empty summary', async () => {
    renderKnowledgeBase();
    await flush();
    await waitFor(() => expect(screen.getByText('Phishing response playbook')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'knowledge.newArticle' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'knowledge.newArticle' })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/common\.title/), {
      target: { value: 'Incident triage notes' },
    });
    fireEvent.change(within(dialog).getByLabelText(/knowledge\.fields\.content/), {
      target: { value: 'Triage steps for incidents' },
    });
    fireEvent.change(within(dialog).getByLabelText('knowledge.fields.category'), {
      target: { value: 'risk' },
    });
    fireEvent.change(within(dialog).getByLabelText('common.status'), {
      target: { value: 'published' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('knowledge.tagsPlaceholder'), {
      target: { value: ' phishing , awareness ' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Incident triage notes',
      summary: undefined,
      content: 'Triage steps for incidents',
      category: 'risk',
      tags: ['phishing', 'awareness'],
      status: 'published',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('knowledge.saved')).toBeInTheDocument();
  });
});
