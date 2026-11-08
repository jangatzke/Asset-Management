/**
 * Shared page-level test utilities.
 *
 * The helper intentionally contains only render/auth plumbing. `vi.mock`
 * declarations must stay in each test file (Vitest hoists them), and each page
 * test keeps its own router/API mocks so the assertions can observe calls.
 */
import * as React from 'react';
import { act, render, RenderResult } from '@testing-library/react';
import { ToastProvider } from '../components/ToastProvider';
import { useAuthStore } from '../store/auth';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions?: string[];
}

/** Render a page inside the app-wide toast provider. */
export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

/** Flush two microtask turns so loaders that chain promises can settle. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Seed the zustand auth store with a signed-in user. */
export function setAuthUser(user: TestUser): void {
  useAuthStore.setState({
    user,
    isAuthenticated: true,
    isLoading: false,
  });
}

/** Clear the auth store back to an anonymous, settled state. */
export function resetAuthUser(): void {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
}
