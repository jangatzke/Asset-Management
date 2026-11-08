/**
 * Stage 10c / LT-6 — High-Contrast preference tests.
 * Covers: default off, toggle flips state + applies/removes the
 * `.contrast-high` class on <html>, persistence in localStorage
 * 'am.contrast', restore from storage on mount, and cross-tab sync via
 * the storage event. Dark-mode behaviour itself is unchanged and covered
 * implicitly by the untouched toggle path.
 */
import type { ReactNode } from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const updatePreferences = vi.fn().mockResolvedValue({ data: {} });

vi.mock('../services/api', () => ({
  authApi: {
    updatePreferences: (...args: unknown[]) => updatePreferences(...args),
  },
}));

import { DarkModeProvider, useDarkMode } from './DarkModeContext';
import { useAuthStore } from '../store/auth';

function wrapper({ children }: { children: ReactNode }) {
  return <DarkModeProvider>{children}</DarkModeProvider>;
}

beforeAll(() => {
  // jsdom has no matchMedia; the provider only reads prefers-color-scheme.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'contrast-high');
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  updatePreferences.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('DarkModeContext high contrast (Stage 10c)', () => {
  it('defaults to off and does not apply the class', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    expect(result.current.highContrast).toBe(false);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(false);
  });

  it('toggle applies .contrast-high and persists am.contrast=high', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => result.current.toggleHighContrast());
    expect(result.current.highContrast).toBe(true);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(true);
    expect(localStorage.getItem('am.contrast')).toBe('high');
  });

  it('toggling back removes the class and stores normal', () => {
    localStorage.setItem('am.contrast', 'high');
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    expect(result.current.highContrast).toBe(true);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(true);

    act(() => result.current.toggleHighContrast());
    expect(result.current.highContrast).toBe(false);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(false);
    expect(localStorage.getItem('am.contrast')).toBe('normal');
  });

  it('setHighContrast controls the value explicitly', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => result.current.setHighContrast(true));
    expect(result.current.highContrast).toBe(true);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(true);
  });

  it('syncs when another tab writes the storage key', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => {
      localStorage.setItem('am.contrast', 'high');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'am.contrast', newValue: 'high' }),
      );
    });
    expect(result.current.highContrast).toBe(true);
  });

  it('dark mode toggle keeps working alongside high contrast', async () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => result.current.setHighContrast(true));
    // setDarkMode is async (persists to the profile) — await it so the DOM
    // effect has flushed before asserting.
    await act(async () => {
      await result.current.setDarkMode(true);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('contrast-high')).toBe(true);
  });
});
