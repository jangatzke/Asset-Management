/**
 * Page-level tests for Settings.
 *
 * Settings is wrapped in the real ToastProvider/DarkModeProvider; only the
 * HTTP layer (`authApi`) is mocked. The auth store is seeded with a signed-in
 * user (and an in-memory access token so `checkAuth()` short-circuits instead
 * of attempting a real refresh). Assertions focus on user-visible state and
 * the exact preference payloads sent to the API.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, resetAuthUser } from '../test/renderWithProviders';
import { useAuthStore } from '../store/auth';
import { setAccessToken } from '../store/accessToken';
import { DarkModeProvider } from '../context/DarkModeContext';
import Settings from './Settings';

// The `t` function must keep a stable identity: Settings memoizes its nav
// catalog with `t` in the dependency list, and a new function per render would
// make the load effect re-run on every render.
const { tMock, setLanguageMock } = vi.hoisted(() => ({
  tMock: (key: string) => key,
  setLanguageMock: vi.fn(),
}));

vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: tMock, language: 'en', setLanguage: setLanguageMock }),
}));

const authApiMock = vi.hoisted(() => ({
  beginMfaSetup: vi.fn(),
  confirmMfaSetup: vi.fn(),
  disableMfa: vi.fn(),
  changeOwnPassword: vi.fn(),
  updatePreferences: vi.fn(),
  getNavigationConfig: vi.fn(),
  getNavigationViews: vi.fn(),
  createNavigationView: vi.fn(),
  updateNavigationView: vi.fn(),
  deleteNavigationView: vi.fn(),
  setDefaultNavigationView: vi.fn(),
  me: vi.fn(),
}));

vi.mock('../services/api', () => ({ authApi: authApiMock }));

const baseUser = {
  id: 'u-1',
  email: 'settings@example.com',
  firstName: 'Sam',
  lastName: 'Settings',
  roles: ['system_admin'],
  darkMode: false,
  mfaEnabled: false,
};

function seedUser(overrides: Record<string, unknown> = {}) {
  useAuthStore.setState({
    user: { ...baseUser, ...overrides },
    isAuthenticated: true,
    isLoading: false,
  });
}

function renderSettings() {
  return renderWithProviders(
    <DarkModeProvider>
      <Settings />
    </DarkModeProvider>,
  );
}

/** Label elements in Settings are not associated via htmlFor; locate the input by its label text. */
function inputForLabel(labelKey: string): HTMLInputElement {
  const label = screen.getByText(labelKey);
  const input = label.parentElement?.querySelector('input');
  if (!input) throw new Error(`No input found for label ${labelKey}`);
  return input as HTMLInputElement;
}

function languageSelect(): HTMLSelectElement {
  const label = screen.getByText('settings.language');
  const select = label.parentElement?.querySelector('select');
  if (!select) throw new Error('Language select not found');
  return select as HTMLSelectElement;
}

function navScopeSelect(): HTMLSelectElement {
  return screen.getByLabelText('navViews.scopeLabel') as HTMLSelectElement;
}

async function waitForNavEditor(): Promise<void> {
  await waitFor(() =>
    expect(screen.getByRole('list', { name: 'navigationOrder.listLabel' })).toBeInTheDocument(),
  );
}

beforeEach(() => {
  // DarkModeProvider probes matchMedia; provide the minimal jsdom-compatible stub.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  seedUser();
  setAccessToken('token-1');

  authApiMock.updatePreferences.mockResolvedValue({ data: {} });
  authApiMock.getNavigationViews.mockResolvedValue({ data: [] });
  authApiMock.getNavigationConfig.mockResolvedValue({ data: { navOrder: [], hiddenEntries: [] } });
  authApiMock.beginMfaSetup.mockResolvedValue({
    data: { qrCodeDataUrl: 'data:image/png;base64,QRCODE', otpauthUrl: 'otpauth://totp/AssetManagement?secret=ABC123' },
  });
  authApiMock.confirmMfaSetup.mockResolvedValue({ data: {} });
  authApiMock.disableMfa.mockResolvedValue({ data: {} });
  authApiMock.changeOwnPassword.mockResolvedValue({ data: {} });
  authApiMock.createNavigationView.mockResolvedValue({ data: {} });
  authApiMock.updateNavigationView.mockResolvedValue({ data: {} });
  authApiMock.deleteNavigationView.mockResolvedValue({ data: {} });
  authApiMock.setDefaultNavigationView.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  setAccessToken(null);
  resetAuthUser();
});

describe('Settings page', () => {
  it('renders account information, roles, the temporary-password banner and the nav editor', async () => {
    seedUser({ mustChangePasswordOnNext: true });

    renderSettings();
    await waitForNavEditor();

    expect(screen.getByRole('heading', { name: 'settings.title' })).toBeInTheDocument();
    expect(screen.getByText('settings.mustChangeTemporaryPassword')).toBeInTheDocument();
    expect(screen.getByText('settings.accountInfo')).toBeInTheDocument();
    expect(screen.getByText('settings@example.com')).toBeInTheDocument();
    expect(screen.getByText('Sam Settings')).toBeInTheDocument();
    expect(screen.getByText('system_admin')).toBeInTheDocument();
    expect(screen.getByText('settings.localAccount')).toBeInTheDocument();
    expect(screen.getByText('settings.mfaTitle')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'settings.changePassword' })).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'navigationOrder.listLabel' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('navigation.dashboard');
    expect(authApiMock.getNavigationConfig).toHaveBeenCalled();
  });

  it('hides the MFA and password sections for OIDC-linked accounts and shows the provider', async () => {
    seedUser({ isOidcLinked: true, oidcProvider: 'azure-ad', roles: ['employee'] });

    renderSettings();
    await waitForNavEditor();

    expect(screen.getByText('settings.oidcLinked')).toBeInTheDocument();
    expect(screen.getByText('(azure-ad)')).toBeInTheDocument();
    expect(screen.queryByText('settings.mfaTitle')).toBeNull();
    expect(screen.queryByText('settings.changePassword')).toBeNull();
    expect(screen.queryByPlaceholderText('settings.mfaCode')).toBeNull();
  });

  it('toggles the theme, persisting the dark mode preference and applying the DOM class', async () => {
    renderSettings();
    await waitForNavEditor();

    expect(screen.getByText('settings.lightMode')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'settings.darkMode' }));

    await waitFor(() => {
      expect(authApiMock.updatePreferences).toHaveBeenCalledWith({ darkMode: true });
    });
    expect(localStorage.getItem('darkMode')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'settings.lightMode' })).toBeInTheDocument();
  });

  it('changes the application language through the language selector', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.change(languageSelect(), { target: { value: 'de' } });

    expect(setLanguageMock).toHaveBeenCalledWith('de');
  });

  it('shows the navigation loading placeholder while views and config are still pending', async () => {
    authApiMock.getNavigationViews.mockImplementation(() => new Promise(() => undefined));

    renderSettings();

    expect(screen.getByText('common.loading')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'navigationOrder.listLabel' })).toBeNull();
  });

  it('saves a reordered navigation configuration as the personal order override', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.click(screen.getAllByRole('button', { name: 'navigationOrder.moveDown' })[0]);

    expect(screen.getByText('navigationOrder.unsavedChanges')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(authApiMock.updatePreferences).toHaveBeenCalled();
    });
    const payload = authApiMock.updatePreferences.mock.calls[0][0];
    expect(payload.navigationOrder.slice(0, 3)).toEqual(['/assets', '/', '/risks']);
    expect(payload.navigationOrder).toHaveLength(20);
    expect(payload).not.toHaveProperty('hiddenNavigationEntries');

    await waitFor(() => {
      expect(screen.getByText('navigationOrder.saved')).toBeInTheDocument();
    });
  });

  it('saves hidden entries without writing an order override', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.click(screen.getAllByRole('button', { name: 'navigationOrder.hideEntry' })[0]);

    expect(screen.getByText('navigationOrder.unsavedChanges')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(authApiMock.updatePreferences).toHaveBeenCalledWith({ hiddenNavigationEntries: ['/'] });
    });
    expect(screen.getAllByRole('button', { name: 'navigationOrder.showEntry' })).toHaveLength(1);
  });

  it('clears a personal override and falls back to the global default configuration', async () => {
    seedUser({ navigationOrder: ['/assets', '/'], hiddenNavigationEntries: ['/licenses'] });

    renderSettings();
    await waitForNavEditor();

    expect(screen.getByText('navigationOrder.overrideActive')).toBeInTheDocument();

    const useGlobalButton = screen.getByRole('button', { name: 'navigationOrder.useGlobal' });
    expect(useGlobalButton).not.toBeDisabled();

    fireEvent.click(useGlobalButton);

    await waitFor(() => {
      expect(authApiMock.updatePreferences).toHaveBeenCalledWith({
        navigationOrder: null,
        hiddenNavigationEntries: null,
      });
    });
    await waitFor(() => {
      expect(screen.getByText('navigationOrder.resetDone')).toBeInTheDocument();
    });
    expect(screen.getByText('navigationOrder.usingGlobal')).toBeInTheDocument();
  });

  it('creates a personal view from the current order and switches scope to it', async () => {
    const personalView = {
      id: 'v-7',
      name: 'Focus view',
      ownerId: 'u-1',
      navOrder: ['/assets'],
      hiddenEntries: [],
      isDefault: false,
    };
    authApiMock.getNavigationViews.mockResolvedValue({ data: [personalView] });
    authApiMock.createNavigationView.mockResolvedValue({ data: personalView });

    renderSettings();
    await waitForNavEditor();

    fireEvent.change(screen.getByPlaceholderText('navViews.newViewPlaceholder'), {
      target: { value: 'Focus view' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'navViews.create' }));

    await waitFor(() => {
      expect(authApiMock.createNavigationView).toHaveBeenCalled();
    });
    const payload = authApiMock.createNavigationView.mock.calls[0][0];
    expect(payload.name).toBe('Focus view');
    expect(payload.hiddenEntries).toEqual([]);
    expect(payload.navOrder).toHaveLength(20);

    await waitFor(() => {
      expect(navScopeSelect().value).toBe('v-7');
    });
    expect(screen.getByRole('button', { name: 'navViews.setDefault' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'navViews.delete' })).toBeInTheDocument();
    expect(screen.getByText('navViews.created')).toBeInTheDocument();
  });

  it('sets a personal view as default and deletes it, returning to the default scope', async () => {
    const personalView = {
      id: 'v-1',
      name: 'Focus view',
      ownerId: 'u-1',
      navOrder: [],
      hiddenEntries: [],
      isDefault: false,
    };
    authApiMock.getNavigationViews.mockResolvedValue({ data: [personalView] });

    renderSettings();
    await waitForNavEditor();

    await waitFor(() => {
      expect(navScopeSelect().value).toBe('__default__');
    });
    fireEvent.change(navScopeSelect(), { target: { value: 'v-1' } });

    const setDefaultButton = screen.getByRole('button', { name: 'navViews.setDefault' });
    expect(setDefaultButton).not.toBeDisabled();
    fireEvent.click(setDefaultButton);

    await waitFor(() => {
      expect(authApiMock.setDefaultNavigationView).toHaveBeenCalledWith('v-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'navViews.delete' }));

    await waitFor(() => {
      expect(authApiMock.deleteNavigationView).toHaveBeenCalledWith('v-1');
    });
    await waitFor(() => {
      expect(navScopeSelect().value).toBe('__default__');
    });
  });

  it('blocks password submission when the confirmation does not match and never calls the API', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.change(inputForLabel('settings.currentPassword'), { target: { value: 'old-secret' } });
    fireEvent.change(inputForLabel('settings.newPassword'), { target: { value: 'new-secret' } });
    fireEvent.change(inputForLabel('settings.confirmNewPassword'), { target: { value: 'different' } });

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }));

    expect(screen.getByText('New password and confirmation do not match.')).toBeInTheDocument();
    expect(authApiMock.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('changes the password, clears the fields and reports success', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.change(inputForLabel('settings.currentPassword'), { target: { value: 'old-secret' } });
    fireEvent.change(inputForLabel('settings.newPassword'), { target: { value: 'new-secret' } });
    fireEvent.change(inputForLabel('settings.confirmNewPassword'), { target: { value: 'new-secret' } });

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }));

    await waitFor(() => {
      expect(authApiMock.changeOwnPassword).toHaveBeenCalledWith({
        currentPassword: 'old-secret',
        newPassword: 'new-secret',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Password changed successfully.')).toBeInTheDocument();
    });
    expect(inputForLabel('settings.currentPassword').value).toBe('');
    expect(inputForLabel('settings.newPassword').value).toBe('');
    expect(inputForLabel('settings.confirmNewPassword').value).toBe('');
  });

  it('surfaces the server error message when the password change fails', async () => {
    authApiMock.changeOwnPassword.mockRejectedValue({
      response: { data: { error: { message: 'Current password is incorrect.' } } },
    });

    renderSettings();
    await waitForNavEditor();

    fireEvent.change(inputForLabel('settings.currentPassword'), { target: { value: 'wrong' } });
    fireEvent.change(inputForLabel('settings.newPassword'), { target: { value: 'new-secret' } });
    fireEvent.change(inputForLabel('settings.confirmNewPassword'), { target: { value: 'new-secret' } });

    fireEvent.click(screen.getByRole('button', { name: 'settings.changePassword' }));

    await waitFor(() => {
      expect(screen.getByText('Current password is incorrect.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Password changed successfully.')).toBeNull();
  });

  it('starts MFA setup, shows the QR code and confirms the token', async () => {
    renderSettings();
    await waitForNavEditor();

    fireEvent.click(screen.getByRole('button', { name: 'settings.mfaSetup' }));

    expect(await screen.findByAltText('settings.mfaQrAlt')).toBeInTheDocument();
    expect(screen.getByText('otpauth://totp/AssetManagement?secret=ABC123')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('settings.mfaCode'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.mfaConfirm' }));

    await waitFor(() => {
      expect(authApiMock.confirmMfaSetup).toHaveBeenCalledWith('123456');
    });
    await waitFor(() => {
      expect(screen.getByText('MFA enabled successfully.')).toBeInTheDocument();
    });
    expect(screen.queryByAltText('settings.mfaQrAlt')).toBeNull();
  });

  it('disables MFA with the entered token', async () => {
    seedUser({ mfaEnabled: true });

    renderSettings();
    await waitForNavEditor();

    expect(screen.getByText('settings.mfaEnabled')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('settings.mfaCode'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.mfaDisable' }));

    await waitFor(() => {
      expect(authApiMock.disableMfa).toHaveBeenCalledWith('654321');
    });
    await waitFor(() => {
      expect(screen.getByText('MFA disabled.')).toBeInTheDocument();
    });
  });

  it('reports a navigation load error via toast when the configuration request fails', async () => {
    authApiMock.getNavigationConfig.mockRejectedValue(new Error('config unavailable'));

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('navigationOrder.loadError')).toBeInTheDocument();
    });
  });
});
