import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { syncSessionToStores } from '../store/sessionSync';

/** Hydrate user/session from JWT on refresh (token persisted). */
export function AuthBootstrap() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

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
      })
      .catch(() => {
        syncSessionToStores(null);
        useAuthStore.getState().logout();
      });
  }, [token]);

  return null;
}
