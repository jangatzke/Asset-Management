/**
 * Sidebar component tests (Stage 6b, MT-2).
 *
 * Covers the acceptance criteria of the navigation restructure:
 *  - fixed group rendering in the defined order (group headings via i18n keys)
 *  - `aria-current="page"` on the active route entry
 *  - collapse toggle persists to localStorage and switches to icon-only mode
 *  - permission guard hides entries the user lacks (any-of semantics)
 *  - mobile drawer renders as a modal dialog and closes on Escape
 *
 * The i18n context is stubbed so `t()` returns the key itself, which keeps
 * assertions independent from locale files.
 */
/// <reference types="vitest" />
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar, type SidebarEntry } from './Sidebar';

vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const COLLAPSED_STORAGE_KEY = 'am.sidebar.collapsed';

const ENTRIES: SidebarEntry[] = [
  { href: '/', name: 'nav.dashboard' },
  { href: '/assets', name: 'nav.assets' },
  { href: '/risks', name: 'nav.risks' },
  { href: '/controls', name: 'nav.controls' },
  { href: '/tickets', name: 'nav.tickets' },
  { href: '/ticket-workload', name: 'nav.ticketWorkload', permission: 'tickets.read' },
];

function renderSidebar(overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const props = {
    entries: ENTRIES,
    userPermissions: undefined as string[] | null | undefined,
    isAdmin: false,
    mobileOpen: false,
    onMobileClose: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter initialEntries={['/assets']}>
      <Sidebar {...props} />
    </MemoryRouter>
  );
  return props;
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('grouped rendering', () => {
    it('renders the fixed group headings in order and omits empty groups', () => {
      renderSidebar();

      const overview = screen.getByRole('heading', { name: 'nav.group.overview' });
      const assetsRisks = screen.getByRole('heading', { name: 'nav.group.assetsRisks' });
      const complianceIsm = screen.getByRole('heading', { name: 'nav.group.complianceIsm' });
      const operations = screen.getByRole('heading', { name: 'nav.group.operations' });

      // Fixed group order: overview → assets & risks → compliance → operations.
      expect(overview.compareDocumentPosition(assetsRisks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(assetsRisks.compareDocumentPosition(complianceIsm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(complianceIsm.compareDocumentPosition(operations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // /controls lands in Compliance/ISMS, /tickets + /ticket-workload in Betrieb.
      const complianceLink = screen.getByRole('link', { name: 'nav.controls' });
      expect(complianceLink.closest('div')).toContainElement(screen.getByRole('heading', { name: 'nav.group.complianceIsm' }));

      // No admin entries and isAdmin=false → no Administration heading.
      expect(screen.queryByRole('heading', { name: 'nav.group.administration' })).toBeNull();
    });

    it('keeps the caller-provided order inside a group (admin-configured order)', () => {
      renderSidebar({ entries: [{ href: '/risks', name: 'nav.risks' }, { href: '/assets', name: 'nav.assets' }] });

      const links = screen.getAllByRole('link', { name: /nav\.(assets|risks)/ });
      expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(['nav.risks', 'nav.assets']);
    });

    it('appends the administration group only for admins', () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/assets']}>
          <Sidebar entries={ENTRIES} userPermissions={undefined} isAdmin={false} mobileOpen={false} onMobileClose={vi.fn()} />
        </MemoryRouter>
      );
      expect(screen.queryByRole('heading', { name: 'nav.group.administration' })).toBeNull();

      rerender(
        <MemoryRouter initialEntries={['/assets']}>
          <Sidebar entries={ENTRIES} userPermissions={undefined} isAdmin mobileOpen={false} onMobileClose={vi.fn()} />
        </MemoryRouter>
      );
      expect(screen.getByRole('heading', { name: 'nav.group.administration' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'navigation.userManagement' })).toHaveAttribute('href', '/admin/users');
    });
  });

  describe('active entry', () => {
    it('marks the matching route with aria-current="page"', () => {
      renderSidebar();

      const active = screen.getByRole('link', { name: 'nav.assets' });
      expect(active).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'nav.risks' })).not.toHaveAttribute('aria-current');
    });

    it('activates the dashboard entry on a sub-route like /assets/:id', () => {
      render(
        <MemoryRouter initialEntries={['/assets/asset-1']}>
          <Sidebar entries={ENTRIES} userPermissions={undefined} isAdmin={false} mobileOpen={false} onMobileClose={vi.fn()} />
        </MemoryRouter>
      );

      expect(screen.getByRole('link', { name: 'nav.assets' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('collapse persistence', () => {
    it('toggles to icon-only mode and persists the state in localStorage', () => {
      renderSidebar();

      const aside = screen.getByRole('complementary');
      expect(aside.className).toContain('w-60');

      fireEvent.click(screen.getByRole('button', { name: 'navigation.collapseSidebar' }));

      expect(localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe('1');
      expect(aside.className).toContain('w-16');
      // Labels stay accessible while collapsed (sr-only text + aria-label kept).
      expect(screen.getByRole('link', { name: 'nav.assets' })).toBeInTheDocument();
    });

    it('restores the persisted collapsed state on mount', () => {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, '1');
      renderSidebar();

      expect(screen.getByRole('complementary').className).toContain('w-16');
      expect(screen.getByRole('button', { name: 'navigation.expandSidebar' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('permission guard', () => {
    it('hides entries whose permission the user lacks and shows them otherwise', () => {
      renderSidebar({ userPermissions: ['assets.read'] });
      expect(screen.queryByRole('link', { name: 'nav.ticketWorkload' })).toBeNull();

      renderSidebar({ userPermissions: ['assets.read', 'tickets.read'] });
      expect(screen.getByRole('link', { name: 'nav.ticketWorkload' })).toBeInTheDocument();
    });

    it('keeps the legacy show-all fallback when no permission list is present', () => {
      renderSidebar({ userPermissions: null });
      expect(screen.getByRole('link', { name: 'nav.ticketWorkload' })).toBeInTheDocument();
    });
  });

  describe('mobile drawer', () => {
    it('renders a modal dialog when open and closes on Escape', () => {
      const { onMobileClose } = renderSidebar({ mobileOpen: true });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      // The drawer navigation is reachable inside the dialog.
      expect(within(dialog).getByRole('link', { name: 'nav.assets' })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('closes via the backdrop and close button', () => {
      const { onMobileClose } = renderSidebar({ mobileOpen: true });

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getAllByRole('button', { name: 'common.close' })[0]);
      expect(onMobileClose).toHaveBeenCalledTimes(1);
    });
  });
});
