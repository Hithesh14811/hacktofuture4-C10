import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Clock, LogOut, ChevronDown, Cloud, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';
import { syncSessionToStores } from '../../store/sessionSync';

interface TrustScoreGaugeProps {
  score: number;
}

export function TrustScoreGauge({ score }: TrustScoreGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 80) return '#00FF88';
    if (s >= 60) return '#FFB800';
    if (s >= 40) return '#FF8C00';
    return '#FF2D55';
  };

  const color = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1E2D40"
          strokeWidth="6"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-mono font-bold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          key={score}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-text-muted uppercase">Trust</span>
      </div>
    </div>
  );
}

export function TopBar() {
  const { user, logout, token, setSession, session } = useAuthStore();
  const { trustScore, notifications } = useTrustStore();
  const [sessionTime, setSessionTime] = useState('00:00:00');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchLatestTrust = async () => {
      if (!token || !user) return;
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setSession(data.session);
            syncSessionToStores(data.session, data.user);
          }
        }
      } catch (err) {
        console.error('Failed to fetch latest trust score:', err);
      }
    };

    fetchLatestTrust();
    const pollInterval = setInterval(fetchLatestTrust, 30000); // Poll every 30s as fallback to socket
    
    return () => clearInterval(pollInterval);
  }, [token, user, setSession]);

  useEffect(() => {
    if (!session?.login_time) {
      setSessionTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(session.login_time).getTime();
      const elapsed = Math.max(0, Date.now() - startTime);
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setSessionTime(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.login_time]);

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-[#d0021b]/10 text-[#d0021b] border-[#d0021b]/20';
      case 'DevOps Engineer':
        return 'bg-[#0073bb]/10 text-[#0073bb] border-[#0073bb]/20';
      case 'Developer':
        return 'bg-[#00a1c9]/10 text-[#00a1c9] border-[#00a1c9]/20';
      default:
        return 'bg-[#565959]/10 text-[#565959] border-[#565959]/20';
    }
  };

  const unreadCount = notifications.filter(n => n.severity === 'critical' || n.severity === 'warning').length;

  const submitAdminRecoveryVote = async (requestId: string, approve: boolean) => {
    if (!token) return;
    await fetch('/api/admin/recovery/vote', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: requestId,
        approve,
      }),
    });
    setShowNotifications(false);
  };

  return (
    <header className="h-16 bg-[#1b2733] border-b border-[#31465f] flex items-center justify-between px-6 shadow-[0_8px_30px_rgba(15,23,42,0.18)]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-[#ffb347]" />
          <span className="font-bold text-lg text-white tracking-tight">NimbusCloud <span className="text-[#7cc4ff]">Console</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-4 ml-4">
          <div className="relative group">
            <button className="text-[#879596] hover:text-white text-sm font-bold flex items-center gap-1">
              Cloud Services <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-sm border border-[#31465f] bg-[#223244] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b6c7d8]">
            <Activity className="h-3.5 w-3.5 text-[#56d39b]" />
            Live IAM Telemetry
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-2">
            <span className="text-white font-bold text-sm">{user?.name}</span>
            <span className={`text-[10px] px-1.5 py-0 rounded border uppercase font-bold ${getRoleBadgeColor(user?.role)}`}>
              {user?.role}
            </span>
          </div>
          <img
            src={user?.avatar}
            alt={user?.name}
            className="w-8 h-8 rounded-full border border-[#37475a]"
          />
        </div>

        <div className="h-6 w-px bg-[#37475a]" />

        <div className="flex items-center gap-4 text-[#879596]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-xs">{sessionTime}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-[#37475a] rounded-sm transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#d0021b] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-80 bg-[#232f3e] border border-[#37475a] rounded-md shadow-xl z-50 max-h-80 overflow-y-auto"
              >
                <div className="p-3 border-b border-[#37475a]">
                  <h3 className="font-medium text-white text-sm">Operations Feed</h3>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-[#879596] text-sm">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 border-b border-[#37475a] last:border-0 ${
                        notif.severity === 'critical'
                          ? 'bg-[#d0021b]/10'
                          : notif.severity === 'warning'
                            ? 'bg-[#e47911]/10'
                            : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 ${
                            notif.severity === 'critical'
                              ? 'bg-[#d0021b]'
                              : notif.severity === 'warning'
                                ? 'bg-[#e47911]'
                                : 'bg-[#00FF88]'
                          }`}
                        />
                        <div>
                          <p className="text-sm text-white">{notif.message}</p>
                          <p className="text-xs text-[#879596]">
                            {new Date(notif.timestamp).toLocaleTimeString()}
                          </p>
                          {notif.request_id && user?.role !== 'Administrator' && notif.vote_status == null && (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => submitAdminRecoveryVote(notif.request_id!, true)}
                                className="rounded bg-[#00a86b] px-2 py-1 text-[10px] font-bold text-white"
                              >
                                Recover
                              </button>
                              <button
                                type="button"
                                onClick={() => submitAdminRecoveryVote(notif.request_id!, false)}
                                className="rounded bg-[#d0021b] px-2 py-1 text-[10px] font-bold text-white"
                              >
                                Deny
                              </button>
                            </div>
                          )}
                          {notif.request_id && notif.vote_status != null && (
                            <p className="mt-2 text-[10px] font-bold text-[#879596]">
                              Vote recorded: {notif.vote_status ? 'Recover' : 'Deny'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </div>

          <button
            onClick={async () => {
              if (token) {
                try {
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                } catch {
                  /* ignore */
                }
              }
              useTrustStore.getState().reset();
              logout();
            }}
            className="p-2 hover:bg-[#37475a] rounded-sm transition-colors text-[#879596] hover:text-[#d0021b]"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
