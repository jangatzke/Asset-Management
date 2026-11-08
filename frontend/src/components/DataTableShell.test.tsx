/**
 * DataTableShell Stage 7 (MT-3) extension tests.
 *
 * Covers the additive API only: loading skeleton, empty slot, sticky-header
 * helper classes, density context (useTableDensity / tableCellClass),
 * sr-only caption via TableCaption, and the actions-column styling hint.
 * Existing behavior (toolbar, children passthrough) is guarded by the page
 * tests (Assets, Tickets, AdminRoles, ...).
 */
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

import DataTableShell, {
  TableCaption,
  densityRowClass,
  tableCellClass,
  tableHeadCellClass,
  useTableDensity,
} from './DataTableShell';
import { DensityProvider } from '../context/DensityContext';

/** Probe component: renders the density exposed by the surrounding shell. */
function DensityProbe() {
  const density = useTableDensity();
  return <span data-testid="density">{density}</span>;
}

describe('DataTableShell helpers', () => {
  it('tableCellClass maps density to padding and keeps text-body2', () => {
    expect(tableCellClass('comfortable')).toContain('py-3');
    expect(tableCellClass('compact')).toContain('py-2');
    expect(tableCellClass('compact')).not.toContain('py-3');
    for (const density of ['comfortable', 'compact'] as const) {
      expect(tableCellClass(density)).toContain('px-4');
      expect(tableCellClass(density)).toContain('text-body2');
    }
  });

  it('tableHeadCellClass carries the caption typography and optional sticky classes', () => {
    const base = tableHeadCellClass();
    expect(base).toContain('text-caption');
    expect(base).toContain('text-text-muted');
    expect(base).not.toContain('sticky');

    const sticky = tableHeadCellClass({ sticky: true });
    expect(sticky).toContain('sticky top-0 z-10 bg-surface-sunken');
  });

  it('densityRowClass switches vertical padding without touching horizontal padding', () => {
    expect(densityRowClass('comfortable')).toContain('py-3');
    expect(densityRowClass('compact')).toContain('py-2');
    for (const density of ['comfortable', 'compact'] as const) {
      expect(densityRowClass(density)).toContain('px-4');
    }
  });
});

describe('DataTableShell global density (Stage 10b / LT-3)', () => {
  afterEach(cleanup);

  it('outside any shell the hook follows the global DensityProvider preference', () => {
    localStorage.setItem('am.density', 'compact');
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
    localStorage.removeItem('am.density');
  });

  it('the global context overrides the comfortable default inside a shell', () => {
    localStorage.setItem('am.density', 'compact');
    render(
      <DensityProvider>
        <DataTableShell>
          <DensityProbe />
        </DataTableShell>
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
    expect(document.querySelector('[data-table-density="compact"]')).toBeInTheDocument();
    localStorage.removeItem('am.density');
  });

  it('an explicit density prop beats the global context', () => {
    localStorage.setItem('am.density', 'compact');
    render(
      <DensityProvider>
        <DataTableShell density="comfortable">
          <DensityProbe />
        </DataTableShell>
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
    localStorage.removeItem('am.density');
  });
});

describe('DataTableShell additive slots', () => {
  afterEach(cleanup);

  it('renders children when neither loading nor empty is set (unchanged default)', () => {
    render(
      <DataTableShell>
        <table><tbody><tr><td>real row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(screen.getByText('real row')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the skeleton table with aria-busy while loading', () => {
    render(
      <DataTableShell loading skeletonRows={3} columns={[{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]}>
        <table><tbody><tr><td>hidden row</td></tr></tbody></table>
      </DataTableShell>,
    );
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).toBeInTheDocument();
    expect(screen.queryByText('hidden row')).not.toBeInTheDocument();
    // SkeletonTable renders aria-hidden rows with the configured shape.
    const skeletonBody = busy!.querySelector('tbody[aria-hidden="true"]');
    expect(skeletonBody).toBeInTheDocument();
    expect(skeletonBody!.querySelectorAll('tr')).toHaveLength(3);
    expect(skeletonBody!.querySelectorAll('td')).toHaveLength(6);
  });

  it('renders the empty slot instead of children', () => {
    render(
      <DataTableShell empty={<p>Nothing here yet</p>}>
        <table><tbody><tr><td>hidden row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.queryByText('hidden row')).not.toBeInTheDocument();
  });

  it('prioritises loading over the empty slot', () => {
    render(
      <DataTableShell loading empty={<p>Nothing here yet</p>}>
        <table><tbody><tr><td>row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
  });

  it('exposes the effective density through context and marks it on the section', () => {
    render(
      <DataTableShell density="compact">
        <DensityProbe />
      </DataTableShell>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
    expect(document.querySelector('[data-table-density="compact"]')).toBeInTheDocument();
  });

  it('defaults the context to comfortable outside any shell', () => {
    render(<DensityProbe />);
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('renders an sr-only caption inside the page table via TableCaption', () => {
    render(
      <DataTableShell caption="Asset inventory table">
        <table>
          <TableCaption />
          <tbody><tr><td>row</td></tr></tbody>
        </table>
      </DataTableShell>,
    );
    const caption = screen.getByText('Asset inventory table');
    expect(caption.tagName).toBe('CAPTION');
    expect(caption).toHaveClass('sr-only');
  });

  it('renders no caption element when none was configured', () => {
    render(
      <DataTableShell>
        <table><TableCaption /><tbody><tr><td>row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(document.querySelector('caption')).toBeNull();
  });

  it('sets the actions-column styling hint when requested', () => {
    render(
      <DataTableShell actionsColumn>
        <table><tbody><tr><td>row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(document.querySelector('[data-actions-column]')).toBeInTheDocument();
  });

  it('does not set the actions-column attribute by default', () => {
    render(
      <DataTableShell>
        <table><tbody><tr><td>row</td></tr></tbody></table>
      </DataTableShell>,
    );
    expect(document.querySelector('[data-actions-column]')).toBeNull();
  });
});
