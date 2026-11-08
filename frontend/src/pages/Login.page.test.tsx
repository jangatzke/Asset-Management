/**
 * Page-level tests for Login.
 *
 * The real auth store is kept in place (it owns the token/session transition);
 * only the HTTP layer (`authApi`) is mocked, and the router is replaced with a
 * location/navigate stub so deep-link redirects can be asserted.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, flush, resetAuthUser } from '../test/renderWithProviders';
import Login from './Login';

vi.mock('../context/I18nContext', () => {
  const t = (key: string) => key;
  return { useI18n: () => ({ t, language: 'en', setLanguage: vi.fn() }) };
});

const { locationState, navigateMock } = vi.hoisted(() => ({
  locationState: { value: { next: '/risks' } as Record<string, unknown> },
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal: () => Promise<typeof import('react-router-dom')>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLocation: () => ({ pathname: '/login', search: '', hash: '', state: locationState.value }),
    useNavigate: () => navigateMock,
  };
});

const authApiMock = vi.hoisted(() => ({
  login: vi.fn(),
  hasAdmin: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  createFirstAdmin: vi.fn(),
  verifyMfaLogin: vi.fn(),
  beginPreAuthMfaSetup: vi.fn(),
  confirmPreAuthMfaSetup: vi.fn(),
  changePreAuthPassword: vi.fn(),
}));

vi.mock('../services/api', () => ({ authApi: authApiMock }));

const sessionUser = {
  id: 'u-1',
  email: 'admin@example.com',
  firstName: 'Ada',
  lastName: 'Admin',
  roles: ['system_admin'],
  permissions: ['administration.access'],
};

beforeEach(() => {
  locationState.value = { next: '/risks' };
  authApiMock.hasAdmin.mockResolvedValue({ data: { hasAdmin: true } });
  authApiMock.login.mockResolvedValue({ data: { user: sessionUser, token: 'token-1' } });
  authApiMock.register.mockResolvedValue({ data: {} });
  authApiMock.createFirstAdmin.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  resetAuthUser();
});

function fillCredentials(email = 'admin@example.com', password = 'secret') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
}

describe('Login page', () => {
  it('renders the loading shell until the admin bootstrap check resolves', async () => {
    authApiMock.hasAdmin.mockImplementation(() => new Promise(() => undefined));

    renderWithProviders(<Login />);

    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('signs in and redirects to the deep-linked destination', async () => {
    renderWithProviders(<Login />);
    await flush();

    expect(authApiMock.hasAdmin).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'navigation.applicationName' })).toBeInTheDocument();
    expect(screen.getByText('login.signInPrompt')).toBeInTheDocument();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalledWith('admin@example.com', 'secret', undefined);
    });
    expect(navigateMock).toHaveBeenCalledWith('/risks', { replace: true });
  });

  it('falls back to the dashboard route when no deep link was stored', async () => {
    locationState.value = {};

    renderWithProviders(<Login />);
    await flush();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('switches to register mode and shows the name fields plus the registration payload', async () => {
    renderWithProviders(<Login />);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /login\.noAccount login\.register/ }));
    expect(screen.getByText('login.createAccountPrompt')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Lovelace' } });
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.createAccount' }));

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'secret',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith('/risks', { replace: true });
  });

  it('surfaces the server error message when sign-in is rejected', async () => {
    authApiMock.login.mockRejectedValue({
      response: { data: { error: { message: 'Invalid credentials' } } },
    });

    renderWithProviders(<Login />);
    await flush();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows the disabled-account message and does not navigate', async () => {
    authApiMock.login.mockResolvedValue({ data: { state: 'disabled' } });

    renderWithProviders(<Login />);
    await flush();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('login.accountDisabled');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('switches to the MFA prompt and verifies the code with the pre-auth token', async () => {
    authApiMock.login.mockResolvedValue({
      data: { state: 'mfa_required', preAuthToken: 'pre-1' },
    });
    authApiMock.verifyMfaLogin.mockResolvedValue({ data: { user: sessionUser, token: 'token-2' } });

    renderWithProviders(<Login />);
    await flush();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    expect(await screen.findByText('login.mfaRequiredHint')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.getByRole('button', { name: 'login.verifyCode' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('settings.mfaCode'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'login.verifyCode' }));

    await waitFor(() => {
      expect(authApiMock.verifyMfaLogin).toHaveBeenCalledWith('pre-1', '123456');
    });
    expect(navigateMock).toHaveBeenCalledWith('/risks', { replace: true });
  });

  it('changes the password during the pre-auth password-change state', async () => {
    authApiMock.login.mockResolvedValue({
      data: { state: 'password_change_required', preAuthToken: 'pre-2' },
    });
    authApiMock.changePreAuthPassword.mockResolvedValue({
      data: { state: 'authenticated', user: sessionUser, token: 'token-3' },
    });

    renderWithProviders(<Login />);
    await flush();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.signIn' }));

    expect(await screen.findByText('login.passwordChangeHint')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('settings.newPassword'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'login.changePassword' }));

    await waitFor(() => {
      expect(authApiMock.changePreAuthPassword).toHaveBeenCalledWith('pre-2', 'new-secret');
    });
    expect(navigateMock).toHaveBeenCalledWith('/risks', { replace: true });
  });

  it('bootstraps the first administrator when no admin account exists', async () => {
    authApiMock.hasAdmin.mockResolvedValue({ data: { hasAdmin: false } });

    renderWithProviders(<Login />);
    await flush();

    expect(screen.getByText('login.firstAdminTitle')).toBeInTheDocument();
    expect(screen.getByText('login.firstAdminHint')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Admin' } });
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'login.createAdminAccount' }));

    await waitFor(() => {
      expect(authApiMock.createFirstAdmin).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'secret',
        firstName: 'Ada',
        lastName: 'Admin',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith('/risks', { replace: true });
  });
});
