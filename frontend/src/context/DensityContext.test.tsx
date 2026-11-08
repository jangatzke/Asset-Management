/**
 * DensityContext Stage 10b (LT-3) tests.
 *
 * Covers the default, toggle, localStorage persistence/restore and the safe
 * fallback behavior when no provider is mounted.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DensityProvider, useDensity, DEFAULT_DENSITY } from './DensityContext';

const STORAGE_KEY = 'am.density';

/** Probe component: renders the density plus toggle/set actions. */
function DensityProbe() {
  const { density, setDensity, toggleDensity } = useDensity();
  return (
    <div>
      <span data-testid="density">{density}</span>
      <button type="button" onClick={toggleDensity}>toggle</button>
      <button type="button" onClick={() => setDensity('compact')}>set-compact</button>
    </div>
  );
}

describe('DensityContext', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('defaults to comfortable when nothing was persisted', () => {
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent(DEFAULT_DENSITY);
    expect(DEFAULT_DENSITY).toBe('comfortable');
  });

  it('toggles between comfortable and compact and persists the value', () => {
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('compact');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('comfortable');
  });

  it('restores a persisted preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'compact');
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
  });

  it('ignores invalid persisted values and keeps the default', () => {
    localStorage.setItem(STORAGE_KEY, 'diagonal');
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('setDensity writes through to localStorage', () => {
    render(
      <DensityProvider>
        <DensityProbe />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByText('set-compact'));
    expect(screen.getByTestId('density')).toHaveTextContent('compact');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('compact');
  });

  it('falls back to comfortable with no-op setters outside a provider', () => {
    render(<DensityProbe />);
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
    // No throw and no state change when toggling without a provider.
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });
});
