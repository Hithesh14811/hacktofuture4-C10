import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';
import { useTrustScore } from '../../hooks/useTrustScore';
import {
  Shield,
  Globe,
  MapPin,
  UserCheck,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
  Server,
  Camera,
  AlertTriangle,
} from 'lucide-react';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

const IP_SCENARIOS = [
  { id: 'clean_ip', label: 'Simulate Clean IP', icon: <Wifi />, color: '#00FF88' },
  { id: 'known_vpn', label: 'Simulate VPN', icon: <WifiOff />, color: '#FFB800' },
  { id: 'datacenter_ip', label: 'Simulate Datacenter IP', icon: <Server />, color: '#FF2D55' },
  { id: 'tor', label: 'Simulate Tor', icon: <AlertTriangle />, color: '#FF2D55' },
];

const GEO_SCENARIOS = [
  { id: 'normal_location', label: 'Normal Location', icon: <MapPin />, color: '#00FF88' },
  { id: 'city_change', label: 'City Change', icon: <MapPin />, color: '#FFB800' },
  { id: 'new_country', label: 'New Country', icon: <Globe />, color: '#FFB800' },
  { id: 'impossible_travel', label: 'Impossible Travel', icon: <AlertTriangle />, color: '#FF2D55' },
  { id: 'mid_session_shift', label: 'Mid-Session Shift', icon: <Globe />, color: '#FF2D55' },
];

const VERIFY_SCENARIOS = [
  { id: 'passkey_success', label: 'Passkey Success', icon: <UserCheck />, color: '#00FF88' },
  { id: 'passkey_failure', label: 'Passkey Failure', icon: <UserCheck />, color: '#FF2D55' },
  { id: 'face_match_success', label: 'Face Match Success', icon: <Camera />, color: '#00FF88' },
  { id: 'face_match_fail', label: 'Face Match Fail', icon: <Camera />, color: '#FF2D55' },
  { id: 'camera_unavailable', label: 'Camera Unavailable', icon: <Camera />, color: '#FFB800' },
];

export default function DemoControlPanel() {
  const { user } = useAuthStore();
  const { trustScore, isCompromised, setTrustScore, setIPStatus, setLocation, setIsCompromised, setCompromisedAccount } =
    useTrustStore();
  const { injectScenario } = useTrustScore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  if (!DEMO_MODE) return null;

  const handleScenario = async (scenario: string) => {
    setLoading(scenario);
    await injectScenario(scenario);
    setTimeout(() => setLoading(null), 800);
  };

  const runFullAttack = async () => {
    setLoading('full_attack');
    await injectScenario('clean_ip');
    setIPStatus('CLEAN');
    setLocation({ city: 'Bengaluru', country: 'India' });
    await new Promise((r) => setTimeout(r, 400));
    await injectScenario('impossible_travel');
    await new Promise((r) => setTimeout(r, 400));
    await injectScenario('passkey_failure');
    await new Promise((r) => setTimeout(r, 400));
    await injectScenario('face_match_fail');
    setTimeout(() => setLoading(null), 600);
  };

  const resetAll = async () => {
    setLoading('reset');
    try {
      await fetch('/api/trust/demo/reset', { method: 'POST' });
      setTrustScore(100);
      setIPStatus('CLEAN');
      setLocation({ city: 'Mysuru', country: 'India' });
      setIsCompromised(false);
      setCompromisedAccount(null);
    } catch {
      /* ignore */
    }
    setTimeout(() => setLoading(null), 400);
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed right-4 bottom-4 z-50 rounded-lg bg-accent-cyan px-4 py-2 font-display font-semibold text-bg-primary shadow-lg"
        style={{ boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)' }}
      >
        DEMO CONTROLS
      </motion.button>

      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="fixed inset-y-0 right-0 z-50 w-96 overflow-y-auto border-l border-border bg-bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-display text-lg font-bold text-text-primary">Demo Scenario Injector</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
              ✕
            </button>
          </div>

          <div className="p-4">
            <div className="mb-4 text-sm text-text-muted">
              Active Session: <span className="text-text-primary">{user?.name || 'Not logged in'}</span>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-bg-secondary p-3 text-center">
                <div className="text-xs text-text-muted uppercase">Trust Score</div>
                <div
                  className={`font-mono text-2xl font-bold ${
                    trustScore >= 80 ? 'text-accent-green' : trustScore >= 40 ? 'text-accent-amber' : 'text-accent-red'
                  }`}
                >
                  {trustScore}
                </div>
              </div>
              <div className="rounded-lg bg-bg-secondary p-3 text-center">
                <div className="text-xs text-text-muted uppercase">Status</div>
                <div className={`font-mono text-sm font-bold ${isCompromised ? 'text-accent-red' : 'text-accent-green'}`}>
                  {isCompromised ? 'COMPROMISED' : 'SECURE'}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-xs text-text-muted uppercase">
                <Globe className="h-4 w-4" /> IP Scenarios
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {IP_SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScenario(s.id)}
                    disabled={!!loading}
                    className="rounded-lg border border-border p-2 text-left text-xs transition-colors hover:border-accent-cyan disabled:opacity-50"
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="ml-2 text-text-secondary">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-xs text-text-muted uppercase">
                <MapPin className="h-4 w-4" /> Geo Scenarios
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {GEO_SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScenario(s.id)}
                    disabled={!!loading}
                    className="rounded-lg border border-border p-2 text-left text-xs transition-colors hover:border-accent-cyan disabled:opacity-50"
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="ml-2 text-text-secondary">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-xs text-text-muted uppercase">
                <UserCheck className="h-4 w-4" /> Verification
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {VERIFY_SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScenario(s.id)}
                    disabled={!!loading}
                    className="rounded-lg border border-border p-2 text-left text-xs transition-colors hover:border-accent-cyan disabled:opacity-50"
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="ml-2 text-text-secondary">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-xs text-text-muted uppercase">
                <Play className="h-4 w-4" /> Quick Scenarios
              </h3>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={runFullAttack}
                  disabled={!!loading}
                  className="rounded-lg border border-accent-red/30 bg-accent-red/20 p-3 text-sm text-accent-red transition-colors hover:bg-accent-red/30 disabled:opacity-50"
                >
                  🎬 Full Attack Demo
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleScenario('clean_ip')}
                    disabled={!!loading}
                    className="flex-1 rounded-lg border border-accent-green/30 bg-accent-green/20 p-3 text-sm text-accent-green transition-colors hover:bg-accent-green/30 disabled:opacity-50"
                  >
                    🟢 Normal Session
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScenario('admin_compromise')}
                    disabled={!!loading}
                    className="flex-1 rounded-lg border border-accent-red/30 bg-accent-red/20 p-3 text-sm text-accent-red transition-colors hover:bg-accent-red/30 disabled:opacity-50"
                  >
                    🔴 Admin Compromise
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetAll}
              disabled={!!loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-secondary p-3 text-text-secondary transition-colors hover:border-accent-cyan disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All Trust Scores
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
