import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  token: string | null;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setHydrated: (isHydrated: boolean) => void;
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
      isHydrated: false,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setToken: (token) => set({ token }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      completeLogin: ({ user, session, token }) =>
        set({
          user,
          session,
          token,
          isAuthenticated: true,
          isHydrated: true,
        }),
      logout: () =>
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          token: null,
          isHydrated: true,
        }),
    }),
    {
      name: 'trustnet-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
