import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useTrustStore } from '../store/trustStore';
import { syncSessionToStores } from '../store/sessionSync';

/**
 * Socket.IO: trust updates, global compromise broadcasts, remediation events.
 */
export function TrustSync() {
  const { token, session, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const passkeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session?.needs_passkey || session.passkey_verified || !session.passkey_due_at) return;
    const dueMs = new Date(session.passkey_due_at).getTime();
    const wait = Math.max(0, dueMs - Date.now());
    if (passkeyTimerRef.current) clearTimeout(passkeyTimerRef.current);
    passkeyTimerRef.current = setTimeout(() => {
      useTrustStore.getState().setPasskeyModalOpen(true);
    }, wait);
    return () => {
      if (passkeyTimerRef.current) clearTimeout(passkeyTimerRef.current);
    };
  }, [session?.needs_passkey, session?.passkey_verified, session?.passkey_due_at]);

  useEffect(() => {
    if (!isAuthenticated || !session?.session_id || !token) return;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      query: { session_id: session.session_id },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const onTrustUpdate = (p: {
      session_id: string;
      user_id: string;
      trust_score: number;
      access_level: string;
      is_compromised: boolean;
      ip_status?: string;
      location?: { city: string; country: string };
      pending_action?: string | null;
      needs_passkey?: boolean;
      needs_camera_after_passkey?: boolean;
      passkey_verified?: boolean;
      passkey_due_at?: string | null;
      face_fail_attempts?: number;
      anomalies?: string[];
      login_time?: string;
      face_verified_this_session?: boolean;
      restriction_reason?: string | null;
      block_message?: string | null;
      required_verification?: string | null;
      admin_recovery_required?: boolean;
      admin_recovery_status?: string | null;
      admin_recovery_request_id?: string | null;
    }) => {
      const authState = useAuthStore.getState();
      const mySession = authState.session;
      const mySid = mySession?.session_id;
      if (p.session_id !== mySid) return;

      const nextSession = mySession
        ? {
            ...mySession,
            trust_score: p.trust_score,
            access_level: p.access_level,
            is_compromised: p.is_compromised,
            ip_status: p.ip_status ?? mySession.ip_status,
            location: p.location ? { ...mySession.location, ...p.location } : mySession.location,
            pending_action: p.pending_action ?? mySession.pending_action,
            needs_passkey: p.needs_passkey ?? mySession.needs_passkey,
            needs_camera_after_passkey: p.needs_camera_after_passkey ?? mySession.needs_camera_after_passkey,
            passkey_verified: p.passkey_verified ?? mySession.passkey_verified,
            passkey_due_at: p.passkey_due_at ?? mySession.passkey_due_at,
            face_fail_attempts: p.face_fail_attempts ?? mySession.face_fail_attempts,
            anomalies: p.anomalies ?? mySession.anomalies,
            login_time: p.login_time ?? mySession.login_time,
            face_verified_this_session: p.face_verified_this_session ?? mySession.face_verified_this_session,
            restriction_reason: p.restriction_reason ?? mySession.restriction_reason,
            block_message: p.block_message ?? mySession.block_message,
            required_verification: p.required_verification ?? mySession.required_verification,
            admin_recovery_required: p.admin_recovery_required ?? mySession.admin_recovery_required,
            admin_recovery_status: p.admin_recovery_status ?? mySession.admin_recovery_status,
            admin_recovery_request_id: p.admin_recovery_request_id ?? mySession.admin_recovery_request_id,
          }
        : null;

      if (nextSession) {
        authState.setSession(nextSession);
        syncSessionToStores(nextSession, authState.user);
      }

      const ts = useTrustStore.getState();
      if (p.ip_status) ts.setIPStatus(p.ip_status);
      if (p.location?.city) {
        ts.setLocation({ city: p.location.city, country: p.location.country || '' });
      }
      if (p.pending_action === 'passkey_challenge') {
        ts.setPasskeyModalOpen(true);
      }
      if (p.pending_action === 'camera_challenge') {
        ts.setCameraChallengeOpen(true);
      }
      if (p.anomalies) {
        ts.setAnomalies(p.anomalies);
      }

      if (p.needs_passkey && !p.passkey_verified && p.passkey_due_at) {
        const dueMs = new Date(p.passkey_due_at).getTime();
        const wait = Math.max(0, dueMs - Date.now());
        if (passkeyTimerRef.current) clearTimeout(passkeyTimerRef.current);
        passkeyTimerRef.current = setTimeout(() => {
          useTrustStore.getState().setPasskeyModalOpen(true);
        }, wait);
      }

      if (!p.is_compromised) {
        const acc = useTrustStore.getState().compromisedAccount;
        if (acc?.user_id === p.user_id) {
          useTrustStore.getState().setCompromisedAccount(null);
        }
      }

      const me = useAuthStore.getState().user;
      if (p.is_compromised && me && p.user_id === me.id) {
        ts.setCompromisedAccount({
          user_id: me.id,
          name: me.name,
          role: me.role,
          is_admin: me.role === 'Administrator',
        });
      }
    };

    const onCompromised = (p: {
      user_id: string;
      name: string;
      role: string;
      is_admin: boolean;
    }) => {
      useTrustStore.getState().setCompromisedAccount({
        user_id: p.user_id,
        name: p.name,
        role: p.role,
        is_admin: p.is_admin,
      });
      useTrustStore.getState().addNotification({
        id: `comp_${p.user_id}_${Date.now()}`,
        severity: 'critical',
        message: `Account ${p.name} flagged as compromised`,
        timestamp: new Date().toISOString(),
        user_id: p.user_id,
      });
    };

    const onRestored = (p: { user_id: string }) => {
      const acc = useTrustStore.getState().compromisedAccount;
      if (acc?.user_id === p.user_id) {
        useTrustStore.getState().setCompromisedAccount(null);
      }
      useTrustStore.getState().bumpRemediationTick();
    };

    const onAdminRecoveryUpdate = (p: {
      request_id: string;
      user_id: string;
      status: string;
      votes: Record<string, boolean>;
      eligible_voters: string[];
    }) => {
      const me = useAuthStore.getState().user;
      if (!me || me.role === 'Administrator') return;
      useTrustStore.getState().addNotification({
        id: `admin_recovery_${p.request_id}`,
        severity: 'critical',
        message:
          p.status === 'pending'
            ? 'Administrator account recovery requires your approval vote.'
            : p.status === 'approved'
              ? 'Administrator account recovery has been approved.'
              : 'Administrator account recovery has been denied.',
        timestamp: new Date().toISOString(),
        user_id: p.user_id,
        request_id: p.request_id,
        vote_status: p.votes[me.id],
      });
    };

    const onRemediation = () => {
      useTrustStore.getState().bumpRemediationTick();
      useTrustStore.getState().addNotification({
        id: `rem_${Date.now()}`,
        severity: 'info',
        message: 'Remediation applied — permission paths updated',
        timestamp: new Date().toISOString(),
      });
    };

    socket.on('trust_update', onTrustUpdate);
    socket.on('account_compromised', onCompromised);
    socket.on('access_restored', onRestored);
    socket.on('remediation_applied', onRemediation);
    socket.on('admin_recovery_update', onAdminRecoveryUpdate);

    const hb = setInterval(() => {
      socket.emit('session_heartbeat', {
        session_id: session.session_id,
        timestamp: Date.now(),
      });
    }, 10000);

    return () => {
      if (passkeyTimerRef.current) clearTimeout(passkeyTimerRef.current);
      clearInterval(hb);
      socket.off('trust_update', onTrustUpdate);
      socket.off('account_compromised', onCompromised);
      socket.off('access_restored', onRestored);
      socket.off('remediation_applied', onRemediation);
      socket.off('admin_recovery_update', onAdminRecoveryUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, session?.session_id, token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((notifications) => {
        const store = useTrustStore.getState();
        store.clearNotifications();
        notifications.forEach((notification: any) => store.addNotification(notification));
      })
      .catch(() => {
        /* ignore */
      });
  }, [token]);

  return null;
}
