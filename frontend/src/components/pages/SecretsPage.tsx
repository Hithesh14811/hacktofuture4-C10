import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Key, Eye, EyeOff, Lock, Shield, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { postRuntimeAccess } from '../../lib/telemetry';
import { useTrustStore } from '../../store/trustStore';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';

const SECRETS = [
  { id: 'prod/db/password', name: 'prod/database/password', value: 'Pg••••••2024', sensitive: true, roles: ['Administrator', 'DevOps Engineer'] },
  { id: 'prod/stripe/key', name: 'prod/stripe/api_key', value: 'sk_live_••••••••••••xK9p', sensitive: true, roles: ['Administrator'] },
  { id: 'prod/jwt/secret', name: 'prod/jwt/secret', value: 'ey••••••••••••••••••', sensitive: true, roles: ['Administrator', 'DevOps Engineer'] },
  { id: 'staging/db/password', name: 'staging/database/password', value: 'staging_pg_pass_2024', sensitive: false, roles: ['Administrator', 'DevOps Engineer', 'Developer'] },
  { id: 'prod/aws/key', name: 'prod/aws/access_key', value: 'AKIA••••••••••••••C', sensitive: true, roles: ['Administrator', 'DevOps Engineer'] },
];

const DENIED_ROLES = ['Data Analyst', 'Service Principal'];

export default function SecretsPage() {
  const { user, token } = useAuthStore();
  const { trustScore, accessLevel } = useTrustStore();
  const [sidebarCollapsed] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const noAccess = useMemo(() => {
    if (!user) return true;
    return DENIED_ROLES.includes(user.role);
  }, [user]);

  const canView = useCallback((roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const isRestricted = trustScore < 40 || accessLevel === 'blocked' || accessLevel === 'read_only';

  const visibleSecrets = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Developer') {
      return SECRETS.filter((s) => s.name.includes('staging'));
    }
    return SECRETS.filter((s) => canView(s.roles));
  }, [user, canView]);

  const toggleReveal = (id: string) => {
    if (isRestricted) return;
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
    if (token) {
      void postRuntimeAccess(token, {
        route: '/dashboard/secrets',
        resource: `secret:${id}`,
        action: revealed[id] ? 'hide_secret' : 'reveal_secret',
        data_volume_read: 12,
        privileged: true,
      }).catch(() => undefined);
    }
  };

  if (noAccess) {
    return (
      <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsed={sidebarCollapsed} />
          <main className="flex flex-1 items-center justify-center overflow-auto p-6 bg-white">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center bg-white p-10 border border-[#eaeded] shadow-lg rounded-sm">
              <Lock className="mx-auto mb-4 h-16 w-16 text-[#d0021b]" />
              <h2 className="mb-2 text-2xl font-bold text-[#232f3e]">Access Denied</h2>
              <p className="text-[#565959]">Your current identity role is not authorized to access the Secrets Vault.</p>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-auto p-8 bg-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#232f3e]">Secrets Manager</h2>
              <p className="text-sm text-[#565959]">Manage and retrieve sensitive credentials, API keys, and certificates with identity-based access control.</p>
            </div>

            {isRestricted && (
              <div className="mb-8 flex items-center gap-3 rounded-sm border border-[#d0021b] bg-[#fdf0f1] p-4 shadow-sm">
                <AlertTriangle className="h-5 w-5 text-[#d0021b]" />
                <span className="text-sm font-bold text-[#d0021b]">Identity trust score too low to reveal sensitive credentials. Complete multi-factor or biometric verification to unlock.</span>
              </div>
            )}

            <div className="bg-white border border-[#eaeded] rounded-sm shadow-sm overflow-hidden">
              <div className="bg-[#f2f3f3] px-6 py-3 border-b border-[#eaeded]">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 text-[10px] uppercase font-bold text-[#565959]">Secret Name</div>
                  <div className="col-span-4 text-[10px] uppercase font-bold text-[#565959]">Secret Value</div>
                  <div className="col-span-2 text-right text-[10px] uppercase font-bold text-[#565959]">Actions</div>
                </div>
              </div>
              <div className="divide-y divide-[#eaeded]">
                {visibleSecrets.map((secret, i) => (
                  <motion.div
                    key={secret.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="px-6 py-4 hover:bg-[#f2f3f3]/30 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-6 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#0073bb]/10 text-[#0073bb]">
                          <Key className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#232f3e]">{secret.name}</span>
                          {secret.sensitive && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#fdf0f1] text-[#d0021b]">
                              <Shield className="h-3 w-3" />
                              <span className="text-[8px] font-bold uppercase">Sensitive</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-4">
                        <span className="font-mono text-xs text-[#565959] bg-[#f2f3f3] px-2 py-1 rounded-sm">
                          {isRestricted ? '••••••••••••' : revealed[secret.id] ? secret.value : '••••••••••••'}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleReveal(secret.id)}
                          disabled={isRestricted}
                          className={`p-2 rounded-sm transition-colors border ${
                            isRestricted
                              ? 'cursor-not-allowed bg-[#f2f3f3] text-[#879596] border-[#eaeded]'
                              : revealed[secret.id]
                                ? 'bg-[#0073bb] text-white border-[#0073bb]'
                                : 'bg-white text-[#565959] border-[#879596] hover:bg-[#f2f3f3]'
                          }`}
                        >
                          {revealed[secret.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
