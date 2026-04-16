import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, X, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';

type Props = {
  reason?: string;
};

export default function PasskeyChallenge({ reason = 'Unusual activity detected — verify with your passkey.' }: Props) {
  const { token } = useAuthStore();
  const { passkeyModalOpen, setPasskeyModalOpen, setCameraChallengeOpen } = useTrustStore();
  const [busy, setBusy] = useState(false);
  const [failMode, setFailMode] = useState(false);
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setPasskeyModalOpen(false);
    setFailMode(false);
    setPasskey('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkey) return;
    
    // Simulation logic: fail if PIN is not 123456 or if failMode is active
    const shouldFail = failMode || passkey !== '123456';
    await runPasskey(shouldFail);
  };

  const runPasskey = async (simulateFailure: boolean) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, simulateFailure ? 800 : 1500));
      const res = await fetch('/api/auth/passkey/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ simulate_failure: simulateFailure }),
      });
      const data = await res.json();
      if (data.verified) {
        if (data.requires_camera) {
          setCameraChallengeOpen(true);
        }
        close();
      } else {
        setError('Verification failed. Escalating to biometric scan...');
        setTimeout(() => {
          setCameraChallengeOpen(true);
          close();
        }, 1500);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {passkeyModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#232f3e]/60 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-md overflow-hidden rounded-sm bg-white shadow-2xl border border-[#eaeded]"
          >
            <div className="bg-[#f2f3f3] px-6 py-4 border-b border-[#eaeded] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-[#232f3e]" />
                <h3 className="font-bold text-[#232f3e]">Security Verification</h3>
              </div>
              <button onClick={close} className="text-[#565959] hover:text-[#232f3e]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4e5] text-[#e47911]">
                  <Lock className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-[#232f3e]">Verify Session Identity</h2>
                <p className="mt-2 text-xs text-[#565959]">
                  {reason}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565959] mb-2">
                  Passkey / PIN
                </label>
                <div className="relative">
                  <input
                    autoFocus
                    type="password"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-sm border border-[#879596] bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.5em] text-[#232f3e] outline-none transition-all focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911]"
                    required
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-[#565959]">
                  Default passkey for demo: <span className="font-bold">123456</span>
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-[10px] text-[#565959]">
                  <input
                    type="checkbox"
                    checked={failMode}
                    onChange={(e) => setFailMode(e.target.checked)}
                    className="rounded border-[#879596]"
                  />
                  Force passkey failure (demo escalation)
                </label>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 flex items-center gap-2 rounded-sm border border-[#d0021b] bg-[#fdf0f1] p-3 text-xs text-[#d0021b]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="font-bold">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-sm border border-[#879596] py-2 text-sm font-bold text-[#565959] hover:bg-[#f2f3f3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-sm bg-[#ff9900] py-2 text-sm font-bold text-[#11181C] hover:bg-[#e68a00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#11181C] border-t-transparent" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Verify Identity
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="bg-[#f2f3f3] px-6 py-3 text-center">
              <p className="text-[10px] text-[#565959] uppercase font-bold tracking-widest">
                FIDO2 / WebAuthn Compliance Layer
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
