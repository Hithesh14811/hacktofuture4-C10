import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink, Users, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTrustStore } from '../../store/trustStore';
import { useAuthStore } from '../../store/authStore';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MetricCards } from './MetricCards';
export default function Dashboard() {
  const { compromisedAccount, trustScore } = useTrustStore();
  const { user } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dismissWeekly, setDismissWeekly] = useState(false);

  const isAdmin = user?.role === 'Administrator';
  const showBanner = Boolean(compromisedAccount);

  const weeklyDue = useMemo(() => {
    if (!user?.last_face_enrollment) return false;
    const last = new Date(user.last_face_enrollment).getTime();
    return Date.now() - last > 7 * 24 * 60 * 60 * 1000;
  }, [user?.last_face_enrollment]);

  return (
    <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />

      <AnimatePresence>
        {weeklyDue && !dismissWeekly && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#e47911]/40 bg-[#fff4e5]"
          >
            <div className="flex items-center justify-between px-6 py-2">
              <span className="text-sm text-[#e47911] font-bold">
                Weekly face update required —{' '}
                <Link to="/verify/face" className="font-bold underline">
                  Update Now
                </Link>
              </span>
              <button type="button" onClick={() => setDismissWeekly(true)} className="text-[#565959] hover:text-[#11181C]">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[#d0021b] bg-[#fdf0f1]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="flex items-center gap-3">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <AlertTriangle className="h-5 w-5 text-[#d0021b]" />
                </motion.div>
                <span className="font-bold text-[#d0021b]">
                  {compromisedAccount?.is_admin
                    ? `🔴 ADMIN ACCOUNT ${compromisedAccount.name.toUpperCase()} FLAGGED AS COMPROMISED — Admin panel locked pending recovery`
                    : `⚠️ Account ${compromisedAccount?.name} has been flagged as potentially compromised — Blast radius analysis available`}
                </span>
              </div>
              <Link
                to="/dashboard/incident"
                className="flex items-center gap-1 text-sm text-[#0073bb] font-bold hover:underline"
              >
                View Analysis <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user?.face_enrolled && isAdmin && (
        <div className="border-b border-[#eaeded] bg-white px-6 py-2 text-sm text-[#e47911] font-bold">
          {user.name} has not completed face enrollment — encourage enrollment at next login.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />

        <main className="flex flex-1 flex-col overflow-hidden bg-white">
          <div className="shrink-0 p-8 pb-0">
            <h1 className="text-2xl font-bold text-[#232f3e] mb-2">Cloud Infrastructure Overview</h1>
            <p className="text-sm text-[#565959] mb-6">Continuous identity verification and real-time blast radius monitoring.</p>
            <MetricCards />
          </div>

          <div className="flex-1 overflow-auto p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-sm border border-[#eaeded] bg-white p-10 shadow-sm"
            >
              <div className="mb-10">
                <h2 className="mb-2 text-xl font-bold text-[#232f3e]">Welcome to TRUSTNET IAM</h2>
                <p className="text-[#565959]">Amazon Web Services like platform for Zero Trust identity governance.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { icon: Shield, label: 'Zero Trust', desc: 'Never trust, always verify every request.' },
                  { icon: Users, label: 'Identity First', desc: 'Continuous face verification for high-risk actions.' },
                  { icon: AlertTriangle, label: 'Blast Radius', desc: 'Real-time visualization of potential compromise impact.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 border border-[#eaeded] rounded-sm hover:shadow-md transition-shadow"
                  >
                    <item.icon className="mb-4 h-8 w-8 text-[#e47911]" />
                    <h3 className="mb-2 font-bold text-[#232f3e]">{item.label}</h3>
                    <p className="text-sm text-[#565959] leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12 border-t border-[#eaeded] pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-[#565959] tracking-wider">Current Trust Status</span>
                    <div className="mt-1 flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${trustScore >= 80 ? 'bg-[#00ff88]' : trustScore >= 40 ? 'bg-[#ff9900]' : 'bg-[#d0021b]'}`} />
                      <span className="text-2xl font-mono font-bold text-[#232f3e]">{trustScore} / 100</span>
                    </div>
                  </div>
                  <Link to="/dashboard/incident" className="rounded-sm bg-[#ff9900] px-6 py-2 text-sm font-bold text-[#11181C] hover:bg-[#e68a00] transition-colors">
                    View IAM Graph
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
