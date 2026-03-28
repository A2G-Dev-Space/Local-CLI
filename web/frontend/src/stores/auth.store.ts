import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
    get().fetchMe();
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const res = await api.get<User>('/api/auth/me');
      set({ user: res, isLoading: false });
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  init: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true });
      await get().fetchMe();
    } else {
      set({ isLoading: false });
    }
  },
}));
