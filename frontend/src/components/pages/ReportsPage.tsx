import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, Users } from 'lucide-react';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';
export default function ReportsPage() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className="flex-1 overflow-auto p-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 font-display text-2xl font-bold text-text-primary">Executive Reports</h1>
            <p className="mb-8 text-text-secondary">Board-ready summaries of trust posture and incidents (demo data).</p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: TrendingUp, title: 'Trust trend', desc: 'Rolling 7-day average trust score across all sessions.' },
                { icon: Users, title: 'Identity coverage', desc: 'Face enrollment, passkey adoption, and anomaly rates.' },
                { icon: FileText, title: 'Compliance pack', desc: 'Export-ready audit trail for SOC2-style reviews.' },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-border bg-bg-card p-6">
                  <c.icon className="mb-3 h-8 w-8 text-accent-cyan" />
                  <h3 className="font-display font-semibold text-text-primary">{c.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{c.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
