import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrustStore } from '../store/trustStore';

export default function CameraChallengeBanner() {
  const navigate = useNavigate();
  const { cameraChallengeOpen, setCameraChallengeOpen } = useTrustStore();

  return (
    <AnimatePresence>
      {cameraChallengeOpen && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed left-0 right-0 top-16 z-[90] mx-auto max-w-lg px-4"
        >
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-amber bg-bg-card px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-text-primary">
              <Camera className="h-5 w-5 text-accent-amber" />
              <span>Camera verification required — complete identity check.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/verify/face')}
                className="rounded bg-accent-amber px-3 py-1 text-xs font-semibold text-bg-primary"
              >
                Verify now
              </button>
              <button type="button" onClick={() => setCameraChallengeOpen(false)} className="p-1 text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
