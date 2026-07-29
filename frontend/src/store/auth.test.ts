/// <reference types="vitest" />

export {};

declare const vi: typeof import('vitest').vi;

const testUser = {
  id: 'user-123',
  email: 'user@example.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['user'],
};

function installAuthApiMock() {
  const authApi = {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
  };

  vi.doMock('../services/api', () => ({ authApi }));
  return authApi;
}

async function loadAuthStore() {
  const { useAuthStore } = await import('./auth');
  return useAuthStore;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

test('checkAuth skips refresh when an authenticated in-memory session already exists', async () => {
  const authApi = installAuthApiMock();
  const useAuthStore = await loadAuthStore();

  useAuthStore.setState({
    user: testUser,
    token: 'existing-token',
    isAuthenticated: true,
    isLoading: false,
  });

  await useAuthStore.getState().checkAuth();

  expect(authApi.refresh).not.toHaveBeenCalled();
  expect(authApi.me).not.toHaveBeenCalled();
  expect(useAuthStore.getState()).toMatchObject({
    user: testUser,
    token: 'existing-token',
    isAuthenticated: true,
    isLoading: false,
  });
});

test('checkAuth shares concurrent refresh work to avoid refresh-token reuse', async () => {
  const authApi = installAuthApiMock();
  authApi.refresh.mockResolvedValue({ data: { token: 'fresh-token' } });
  authApi.me.mockResolvedValue({ data: testUser });
  const useAuthStore = await loadAuthStore();

  const firstCheck = useAuthStore.getState().checkAuth();
  const secondCheck = useAuthStore.getState().checkAuth();

  await Promise.all([firstCheck, secondCheck]);

  expect(authApi.refresh).toHaveBeenCalledTimes(1);
  expect(authApi.me).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState()).toMatchObject({
    user: testUser,
    token: 'fresh-token',
    isAuthenticated: true,
    isLoading: false,
  });
});
