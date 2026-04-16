import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  token: string | null;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  completeLogin: (payload: { user: User; session: Session | null; token: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      token: null,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setToken: (token) => set({ token }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      completeLogin: ({ user, session, token }) =>
        set({
          user,
          session,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          token: null,
        }),
    }),
    {
      name: 'trustnet-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
