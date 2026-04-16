import type { Session, User } from '../types';
import { useAuthStore } from './authStore';
import { useTrustStore } from './trustStore';

export function syncSessionToStores(session: Session | null, user?: User | null) {
  const activeUser = user ?? useAuthStore.getState().user;

  if (!session) {
    useTrustStore.getState().reset();
    return;
  }

  const trustStore = useTrustStore.getState();
  trustStore.setTrustScore(session.trust_score);
  trustStore.setIPStatus(session.ip_status);
  trustStore.setLocation({
    city: session.location?.city || 'Unknown',
    country: session.location?.country || 'Unknown',
  });
  trustStore.setAccessLevel(session.access_level);
  trustStore.setIsCompromised(session.is_compromised);
  trustStore.setAnomalies(session.anomalies || []);
  trustStore.setPasskeyDueAt(session.passkey_due_at || null);
  trustStore.setNeedsPasskey(Boolean(session.needs_passkey && !session.passkey_verified));
  trustStore.setFaceFailAttempts(session.face_fail_attempts || 0);

  if (session.is_compromised && activeUser && session.user_id === activeUser.id) {
    trustStore.setCompromisedAccount({
      user_id: activeUser.id,
      name: activeUser.name,
      role: activeUser.role,
      is_admin: activeUser.role === 'Administrator',
    });
  } else if (activeUser && session.user_id === activeUser.id) {
    const compromised = trustStore.compromisedAccount;
    if (compromised?.user_id === activeUser.id) {
      trustStore.setCompromisedAccount(null);
    }
  }
}
