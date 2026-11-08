/**
 * DetailTabs (Stage 10c / LT-5) behavior tests.
 *
 * Covers: rendering + default selection, aria wiring (tablist/tab/tabpanel,
 * aria-selected, aria-controls/labelledby), roving tabindex, keyboard
 * navigation (Arrow/Home/End, disabled skipping), onTabChange callback and
 * controlled usage.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

import { DetailTabs } from './DetailTabs';

const TABS = [
  { id: 'overview', label: 'Overview', content: <p>overview panel</p> },
  { id: 'relations', label: 'Relations', content: <p>relations panel</p> },
  { id: 'history', label: 'History', content: <p>history panel</p> },
];

function renderTabs(props: Partial<React.ComponentProps<typeof DetailTabs>> = {}) {
  return render(
    <MemoryRouter>
      <DetailTabs tabs={TABS} ariaLabel="Test detail" {...props} />
    </MemoryRouter>,
  );
}

describe('DetailTabs', () => {
  afterEach(cleanup);

  it('renders the tablist and selects the first tab by default', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('overview panel')).toBeInTheDocument();
    expect(screen.queryByText('relations panel')).not.toBeInTheDocument();
  });

  it('honors defaultTabId', () => {
    renderTabs({ defaultTabId: 'history' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('history panel')).toBeInTheDocument();
  });

  it('wires aria-controls/labelledby between tab and panel', () => {
    renderTabs();
    const tab = screen.getByRole('tab', { name: 'Overview' });
    const panelId = tab.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId as string);
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('uses roving tabindex: only the active tab is in the tab order', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('switches tab on click and calls onTabChange', () => {
    const onTabChange = vi.fn();
    renderTabs({ onTabChange });
    fireEvent.click(screen.getByRole('tab', { name: 'Relations' }));
    expect(onTabChange).toHaveBeenCalledWith('relations');
    expect(screen.getByText('relations panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Relations' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates with ArrowRight/ArrowLeft and wraps around', () => {
    renderTabs();
    const first = screen.getByRole('tab', { name: 'Overview' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Relations' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    // Wrap to the end.
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });

  it('supports Home/End', () => {
    renderTabs({ defaultTabId: 'relations' });
    const current = screen.getByRole('tab', { name: 'Relations' });
    fireEvent.keyDown(current, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('skips disabled tabs during keyboard navigation and blocks clicks', () => {
    const onTabChange = vi.fn();
    renderTabs({
      tabs: [TABS[0], { ...TABS[1], disabled: true }, TABS[2]],
      onTabChange,
    });
    const first = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    onTabChange.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: 'Relations' }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('is controlled when activeTabId is provided', () => {
    const onTabChange = vi.fn();
    renderTabs({ activeTabId: 'relations', onTabChange });
    expect(screen.getByRole('tab', { name: 'Relations' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    // Caller did not change the prop → selection stays where the parent put it.
    expect(onTabChange).toHaveBeenCalledWith('overview');
    expect(screen.getByRole('tab', { name: 'Relations' })).toHaveAttribute('aria-selected', 'true');
  });

  it('reads ?tab= from the URL on mount and mirrors tab changes into it when syncUrlParam is set', () => {
    window.history.replaceState({}, '', '/detail?tab=history');
    render(<DetailTabs tabs={TABS} ariaLabel="Test detail" syncUrlParam />);
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(window.location.search).toContain('tab=overview');
  });
});
