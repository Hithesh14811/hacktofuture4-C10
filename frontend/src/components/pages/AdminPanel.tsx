import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, CheckCircle, Camera } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';
import AdminFaceCapture from './AdminFaceCapture';
import type { User, Session } from '../../types';

export default function AdminPanel() {
  const { user, token } = useAuthStore();
  const { notifications } = useTrustStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingUser, setEnrollingUser] = useState<User | null>(null);

  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    if (!isAdmin || !token) return;
    loadData();
  }, [isAdmin, token]);

  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [usersRes, sessionsRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/sessions', { headers }),
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreAccess = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/restore/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to restore access:', error);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  const handleStartEnrollment = (user: User) => {
    setEnrollingUser(user);
  };

  const handleEnrollCompleted = async (descriptor: Float32Array | null) => {
    if (!enrollingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${enrollingUser.id}/face-enroll`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ descriptor: descriptor ? Array.from(descriptor) : null })
      });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to enroll face:', error);
    } finally {
        setEnrollingUser(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f2f3f3]">
        <div className="text-center bg-white p-10 border border-[#eaeded] shadow-lg rounded-sm">
          <LockIcon className="w-16 h-16 text-[#d0021b] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#232f3e] mb-2">Access Denied</h2>
          <p className="text-[#565959]">Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  const getRiskLevelColor = (level?: string) => {
    switch (level) {
      case 'Critical': return 'text-[#d0021b] bg-[#fdf0f1]';
      case 'High': return 'text-[#e47911] bg-[#fff4e5]';
      case 'Medium': return 'text-[#0073bb] bg-[#f2f3f3]';
      default: return 'text-[#565959] bg-[#f2f3f3]';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 p-8 overflow-auto bg-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#232f3e]">Identity Management Admin</h2>
              <p className="text-sm text-[#565959]">Manage user enrollment, session trust states, and global access recovery.</p>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Active Sessions', value: sessions.length, color: '#0073bb' },
                { label: 'Enrolled Users', value: users.filter((u) => u.face_enrolled).length, color: '#00ff88' },
                { label: 'Flagged Today', value: notifications.filter(n => n.severity === 'critical').length, color: '#d0021b' },
                { label: 'Anomalies (1h)', value: 0, color: '#e47911' },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-[#eaeded] rounded-sm p-6 shadow-sm">
                  <div className="text-[#565959] text-[10px] uppercase font-bold mb-2">{stat.label}</div>
                  <div className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mb-10">
              <h3 className="text-lg font-bold text-[#232f3e] mb-4">User Directory</h3>
              <div className="bg-white border border-[#eaeded] rounded-sm overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-[#f2f3f3] border-b border-[#eaeded]">
                    <tr>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">User Identity</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Role</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Privilege</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Trust Score</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Risk Level</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Face Enrollment</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const trustScore = (u as User & { trust_score?: number }).trust_score;
                      return (
                      <tr key={u.id} className="border-b border-[#eaeded] last:border-0 hover:bg-[#f2f3f3]/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-[#eaeded]" />
                            <div>
                              <div className="text-sm font-bold text-[#232f3e]">{u.name}</div>
                              <div className="text-[10px] text-[#565959]">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-medium text-[#232f3e]">{u.role}</td>
                        <td className="p-4 font-mono text-xs text-[#232f3e]">{u.privilege_score}</td>
                        <td className="p-4 font-mono text-xs">
                          <span className={`font-bold ${typeof trustScore === 'number' && trustScore < 40 ? 'text-[#d0021b]' : typeof trustScore === 'number' && trustScore < 80 ? 'text-[#e47911]' : 'text-[#00ff88]'}`}>
                            {trustScore ?? 'N/A'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${getRiskLevelColor(u.risk_level)}`}>
                            {u.risk_level}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${u.face_enrolled ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#fff4e5] text-[#e47911]'}`}>
                            {u.face_enrolled ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {u.role !== 'Administrator' && !u.face_enrolled && (
                              <button
                                onClick={() => handleStartEnrollment(u)}
                                className="p-2 hover:bg-[#f2f3f3] rounded-sm text-[#565959] hover:text-[#0073bb]"
                                title="Enroll Face (Admin Scan)"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => restoreAccess(u.id)}
                              className="p-2 hover:bg-[#f2f3f3] rounded-sm text-[#565959] hover:text-[#00ff88]"
                              title="Restore Access"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button 
                              className="p-2 hover:bg-[#f2f3f3] rounded-sm text-[#565959] hover:text-[#d0021b]"
                              title="Delete Identity"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#232f3e] mb-4">Active Session Monitoring</h3>
              <div className="bg-white border border-[#eaeded] rounded-sm overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-[#f2f3f3] border-b border-[#eaeded]">
                    <tr>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">User</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Login Time</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">IP Address</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Location</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Trust Score</th>
                      <th className="text-left text-[#565959] text-[10px] uppercase font-bold p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id} className="border-b border-[#eaeded] last:border-0 hover:bg-[#f2f3f3]/30 transition-colors">
                        <td className="p-4 text-sm font-bold text-[#232f3e]">{s.user?.name}</td>
                        <td className="p-4 text-[#565959] font-mono text-xs">
                          {new Date(s.login_time).toLocaleTimeString()}
                        </td>
                        <td className="p-4 font-mono text-xs text-[#232f3e]">{s.ip_address}</td>
                        <td className="p-4 text-xs text-[#232f3e]">{s.location?.city}</td>
                        <td className="p-4 font-mono text-xs">
                          <span className={`font-bold ${s.trust_score >= 80 ? 'text-[#00ff88]' : s.trust_score >= 40 ? 'text-[#e47911]' : 'text-[#d0021b]'}`}>
                            {s.trust_score}
                          </span>
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => terminateSession(s.session_id)}
                            className="p-2 hover:bg-[#f2f3f3] rounded-sm text-[#565959] hover:text-[#d0021b]"
                            title="Terminate Session"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {enrollingUser && (
          <AdminFaceCapture 
            userName={enrollingUser.name}
            onEnroll={handleEnrollCompleted}
            onCancel={() => setEnrollingUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LockIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
