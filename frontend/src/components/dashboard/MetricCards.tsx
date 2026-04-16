import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, AlertTriangle } from 'lucide-react';
import { useTrustStore } from '../../store/trustStore';
import { useAuthStore } from '../../store/authStore';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ label, value, icon, color = '#232f3e', trend }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[#eaeded] rounded-sm p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="text-[#565959] text-[10px] uppercase font-bold tracking-wider">{label}</div>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex items-end justify-between">
        <motion.div
          className="text-xl font-bold text-[#232f3e]"
          key={value}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.3 }}
        >
          {value}
        </motion.div>
        {trend && (
          <div className={`text-xs font-bold ${
            trend === 'up' ? 'text-[#00ff88]' : 
            trend === 'down' ? 'text-[#d0021b]' : 'text-[#565959]'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MetricCards() {
  const { trustScore, ipStatus, location, isCompromised } = useTrustStore();
  const session = useAuthStore((s) => s.session);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');

  useEffect(() => {
    if (!session?.login_time) {
      setSessionDuration('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(session.login_time).getTime();
      const elapsed = Math.max(0, Date.now() - startTime);
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setSessionDuration(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.login_time]);

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { label: 'Low', color: '#00ff88' };
    if (score >= 60) return { label: 'Medium', color: '#ff9900' };
    if (score >= 40) return { label: 'High', color: '#ff9900' };
    return { label: 'Critical', color: '#d0021b' };
  };

  const getIPStatusColor = (status: string) => {
    switch (status) {
      case 'CLEAN': return '#00ff88';
      case 'NEW': return '#ff9900';
      case 'BLACKLISTED': return '#d0021b';
      default: return '#565959';
    }
  };

  const risk = getRiskLevel(trustScore);
  const ipColor = getIPStatusColor(ipStatus);

  const icons = {
    trust: <Shield className="w-4 h-4" />,
    ip: <div className="text-[10px] font-bold px-1 border border-current rounded-sm">IP</div>,
    location: <div className="text-[10px] font-bold">LOC</div>,
    time: <Clock className="w-4 h-4" />,
    risk: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <div className="grid grid-cols-5 gap-4">
      <MetricCard
        label="Trust Score"
        value={trustScore}
        icon={icons.trust}
        color={risk.color}
        trend={trustScore >= 80 ? 'up' : trustScore >= 40 ? 'neutral' : 'down'}
      />
      <MetricCard
        label="IP Status"
        value={ipStatus}
        icon={icons.ip}
        color={ipColor}
      />
      <MetricCard
        label="Location"
        value={location.city}
        icon={icons.location}
        color="#0073bb"
      />
      <MetricCard
        label="Session Duration"
        value={sessionDuration}
        icon={icons.time}
        color="#565959"
      />
      <MetricCard
        label="Risk Level"
        value={isCompromised ? 'COMPROMISED' : risk.label}
        icon={icons.risk}
        color={isCompromised ? '#d0021b' : risk.color}
      />
    </div>
  );
}
