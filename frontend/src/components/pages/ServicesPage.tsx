import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Settings, Lock, Eye, Database, Cloud, Code, HardDrive, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { postRuntimeAccess } from '../../lib/telemetry';
import { useTrustStore } from '../../store/trustStore';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';

interface Service {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'running' | 'stopped' | 'degraded';
  lastAccessed: string;
  privileged: string[];
}

const ALL_SERVICES: Service[] = [
  { id: 'ec2', name: 'EC2 Instances', icon: <Server />, status: 'running', lastAccessed: '2 min ago', privileged: ['Administrator', 'DevOps Engineer'] },
  { id: 'lambda', name: 'Lambda Functions', icon: <Cloud />, status: 'running', lastAccessed: '5 min ago', privileged: ['Administrator', 'DevOps Engineer', 'Developer'] },
  { id: 'secrets', name: 'Secrets Manager', icon: <Lock />, status: 'running', lastAccessed: '1 hour ago', privileged: ['Administrator', 'DevOps Engineer'] },
  { id: 'iam', name: 'IAM (read)', icon: <Shield />, status: 'running', lastAccessed: '1 min ago', privileged: ['Administrator', 'DevOps Engineer'] },
  { id: 'cloudwatch', name: 'CloudWatch', icon: <Eye />, status: 'running', lastAccessed: 'Real-time', privileged: ['Administrator', 'DevOps Engineer', 'Developer', 'Data Analyst', 'Service Principal'] },
  { id: 's3', name: 'S3 Buckets', icon: <HardDrive />, status: 'degraded', lastAccessed: '10 min ago', privileged: ['Administrator', 'Developer', 'Data Analyst'] },
  { id: 'athena', name: 'Athena', icon: <Database />, status: 'running', lastAccessed: '30 min ago', privileged: ['Administrator', 'Data Analyst'] },
  { id: 'codedeploy', name: 'CodeDeploy', icon: <Code />, status: 'running', lastAccessed: '1 hour ago', privileged: ['Administrator', 'DevOps Engineer', 'Developer'] },
  { id: 'rds', name: 'RDS Database', icon: <Database />, status: 'running', lastAccessed: '15 min ago', privileged: ['Administrator', 'Data Analyst'] },
];

export default function ServicesPage() {
  const { user, token } = useAuthStore();
  const { accessLevel, trustScore } = useTrustStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const canAccess = (privileged: string[]) => {
    if (!user) return false;
    return privileged.includes(user.role);
  };

  const isLocked = accessLevel === 'blocked' || accessLevel === 'read_only' || trustScore < 40;
  const userServices = ALL_SERVICES.filter((s) => canAccess(s.privileged));

  const handleServiceAccess = async (service: Service, action: 'console_access' | 'service_settings') => {
    if (!token) return;
    await postRuntimeAccess(token, {
      route: '/dashboard/services',
      resource: service.id,
      action,
      data_volume_read: action === 'console_access' ? 6 : 2,
      privileged: service.privileged.includes('Administrator') || service.privileged.includes('DevOps Engineer'),
    }).catch(() => undefined);
  };

  return (
    <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 overflow-auto bg-white p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#232f3e]">Cloud Infrastructure Services</h2>
              <p className="text-sm text-[#565959]">Operate a cloud-style service catalog while security controls continuously validate the session in the background.</p>
            </div>

            {isLocked && (
              <div className="mb-8 flex items-center gap-3 rounded-sm border border-[#e47911]/40 bg-[#fff4e5] p-4 shadow-sm">
                <Lock className="w-5 h-5 text-[#e47911]" />
                <span className="text-sm font-bold text-[#e47911]">Cloud access is restricted for this session until required verification completes or an administrator unlocks the account.</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {userServices.map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-sm border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                    service.status === 'degraded' ? 'border-[#e47911]' : 'border-[#eaeded]'
                  }`}
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${
                      service.status === 'running' ? 'bg-[#00ff88]/10 text-[#00ff88]' :
                      service.status === 'degraded' ? 'bg-[#fff4e5] text-[#e47911]' :
                      'bg-[#fdf0f1] text-[#d0021b]'
                    }`}>
                      {service.icon}
                    </div>
                    <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${
                      service.status === 'running' ? 'bg-[#00ff88]/10 text-[#00ff88]' :
                      service.status === 'degraded' ? 'bg-[#fff4e5] text-[#e47911]' :
                      'bg-[#fdf0f1] text-[#d0021b]'
                    }`}>
                      {service.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-[#232f3e]">{service.name}</h3>
                  <p className="mb-6 text-[10px] font-bold uppercase text-[#565959]">Last active: {service.lastAccessed}</p>
                  <div className="flex gap-3">
                    <button
                      disabled={isLocked}
                      onClick={() => {
                        void handleServiceAccess(service, 'console_access');
                      }}
                      className={`flex-1 rounded-sm py-2 text-sm font-bold transition-colors ${
                        isLocked
                          ? 'cursor-not-allowed border border-[#eaeded] bg-[#f2f3f3] text-[#879596]'
                          : 'bg-[#0073bb] text-white hover:bg-[#005f99]'
                      }`}
                    >
                      Console Access
                    </button>
                    <button
                      disabled={isLocked || !canAccess(['Administrator', 'DevOps Engineer'])}
                      onClick={() => {
                        void handleServiceAccess(service, 'service_settings');
                      }}
                      className={`rounded-sm border p-2 transition-colors ${
                        isLocked || !canAccess(['Administrator', 'DevOps Engineer'])
                          ? 'cursor-not-allowed border-[#eaeded] bg-[#f2f3f3] text-[#879596]'
                          : 'border-[#879596] bg-white text-[#565959] hover:bg-[#f2f3f3]'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
