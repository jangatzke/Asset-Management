import { create } from 'zustand';
import { authApi } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  mustChangePasswordOnNext?: boolean;
  isOidcLinked?: boolean;
  oidcProvider?: string | null;
  language?: string | null;
  darkMode?: boolean | null;
  mfaEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaToken?: string) => Promise<{ mfaRequired?: boolean; challenge?: string } | void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  updateUserPreferences: (preferences: Pick<User, 'language' | 'darkMode'>) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Initial loading state - checkAuth will resolve this
  login: async (email: string, password: string, mfaToken?: string) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(email, password, mfaToken);
      if (response.data?.mfaRequired) {
        set({ isLoading: false });
        return { mfaRequired: true, challenge: response.data.challenge };
      }
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  setUser: (user: User, token: string) => {
    set({ user, token, isAuthenticated: true });
  },
  updateUserPreferences: (preferences) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...preferences } : state.user,
    }));
  },
  checkAuth: async () => {
    console.log('[AuthStore] checkAuth started');
    set({ isLoading: true });
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[AuthStore] No token found');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const response = await authApi.me();
      console.log('[AuthStore] User data:', response.data);
      set({ user: response.data, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.log('[AuthStore] checkAuth failed:', error);
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
