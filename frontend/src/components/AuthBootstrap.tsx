import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { syncSessionToStores } from '../store/sessionSync';

/** Hydrate user/session from JWT on refresh (token persisted). */
export function AuthBootstrap() {
  const token = useAuthStore((s) => s.token);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    if (!token) {
      setHydrated(true);
      return;
    }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error('unauthorized');
        return r.json();
      })
      .then((data) => {
        useAuthStore.setState({
          user: data.user,
          session: data.session,
          isAuthenticated: true,
        });
        syncSessionToStores(data.session, data.user);
        setHydrated(true);
      })
      .catch(() => {
        syncSessionToStores(null);
        useAuthStore.getState().logout();
        setHydrated(true);
      });
  }, [token, setHydrated]);

  return null;
}
