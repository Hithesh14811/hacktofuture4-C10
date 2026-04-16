import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTrustStore } from '../store/trustStore';

export function SecurityOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const {
    blockMessage,
    restrictionReason,
    requiredVerification,
    adminRecoveryRequired,
    adminRecoveryStatus,
    reset,
  } = useTrustStore();

  const isPublicRoute = location.pathname === '/';

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Best-effort logout; local state is still cleared below.
    } finally {
      logout();
      reset();
      navigate('/', { replace: true });
    }
  };

  const state = useMemo(() => {
    if (!session || !isAuthenticated || isPublicRoute) return null;
    const isBlocked =
      session.access_level === 'blocked' ||
      restrictionReason === 'passkey_failed' ||
      restrictionReason === 'restricted_identity' ||
      adminRecoveryRequired;

    if (requiredVerification === 'face' && location.pathname !== '/verify/face' && !isBlocked) {
      return {
        tone: 'amber',
        title: 'Face verification required',
        message:
          blockMessage || 'Please proceed with face verification to continue using the application.',
        actionLabel: 'Verify now',
        action: () => navigate('/verify/face'),
      };
    }

    if (
      isBlocked
    ) {
      return {
        tone: 'red',
        title: adminRecoveryRequired ? 'Administrator recovery required' : 'Access blocked',
        message:
          blockMessage ||
          (adminRecoveryStatus === 'denied'
            ? 'Administrator recovery was denied. Access remains blocked.'
            : 'You have been blocked from access. Please contact the administrator.'),
        actionLabel: null,
        action: null,
      };
    }

    return null;
  }, [
    adminRecoveryRequired,
    adminRecoveryStatus,
    blockMessage,
    isAuthenticated,
    isPublicRoute,
    location.pathname,
    navigate,
    requiredVerification,
    restrictionReason,
    session,
  ]);

  if (!state) return null;

  const isAmber = state.tone === 'amber';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#232f3e]/65 backdrop-blur-sm">
      <div className="absolute inset-0" />
      <div className="relative mx-6 w-full max-w-xl rounded-sm border border-[#eaeded] bg-white p-8 text-center shadow-2xl">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            isAmber ? 'bg-[#fff4e5] text-[#e47911]' : 'bg-[#fdf0f1] text-[#d0021b]'
          }`}
        >
          {isAmber ? <Camera className="h-8 w-8" /> : adminRecoveryRequired ? <ShieldAlert className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </div>
        <h2 className="mb-3 text-2xl font-bold text-[#232f3e]">{state.title}</h2>
        <p className="mx-auto max-w-lg text-sm text-[#565959]">{state.message}</p>
        {state.actionLabel && state.action && (
          <button
            type="button"
            onClick={state.action}
            className="mt-6 rounded-sm bg-[#ff9900] px-6 py-2 text-sm font-bold text-[#11181C] hover:bg-[#e68a00]"
          >
            {state.actionLabel}
          </button>
        )}
        {!isAmber && (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 rounded-sm border border-[#879596] px-6 py-2 text-sm font-bold text-[#565959] hover:bg-[#f2f3f3]"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  );
}
