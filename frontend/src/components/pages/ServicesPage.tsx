import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Play, Square, Settings, Lock, Eye, EyeOff, Package, Database, Cloud, Code, HardDrive, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
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
  const { user } = useAuthStore();
  const { accessLevel, trustScore } = useTrustStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const canAccess = (privileged: string[]) => {
    if (!user) return false;
    return privileged.includes(user.role);
  };

  const isLocked = accessLevel === 'blocked' || accessLevel === 'read_only' || trustScore < 40;

  const userServices = ALL_SERVICES.filter(s => canAccess(s.privileged));

  return (
    <div className="h-screen flex flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 p-8 overflow-auto bg-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#232f3e]">Cloud Infrastructure Services</h2>
              <p className="text-sm text-[#565959]">Manage and monitor your decentralized cloud resources with continuous identity verification.</p>
            </div>
            
            {isLocked && (
              <div className="bg-[#fff4e5] border border-[#e47911]/40 rounded-sm p-4 mb-8 flex items-center gap-3 shadow-sm">
                <Lock className="w-5 h-5 text-[#e47911]" />
                <span className="text-sm font-bold text-[#e47911]">Identity access restricted — multi-factor authentication or biometric verification required for this session level.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userServices.map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-white border rounded-sm p-6 shadow-sm hover:shadow-md transition-shadow ${
                    service.status === 'degraded' ? 'border-[#e47911]' : 'border-[#eaeded]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-12 h-12 rounded-sm flex items-center justify-center ${
                      service.status === 'running' ? 'bg-[#00ff88]/10 text-[#00ff88]' :
                      service.status === 'degraded' ? 'bg-[#fff4e5] text-[#e47911]' :
                      'bg-[#fdf0f1] text-[#d0021b]'
                    }`}>
                      {service.icon}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                      service.status === 'running' ? 'bg-[#00ff88]/10 text-[#00ff88]' :
                      service.status === 'degraded' ? 'bg-[#fff4e5] text-[#e47911]' :
                      'bg-[#fdf0f1] text-[#d0021b]'
                    }`}>
                      {service.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#232f3e] mb-1">{service.name}</h3>
                  <p className="text-[10px] uppercase font-bold text-[#565959] mb-6">Last active: {service.lastAccessed}</p>
                  <div className="flex gap-3">
                    <button 
                      disabled={isLocked}
                      className={`flex-1 py-2 rounded-sm text-sm font-bold transition-colors ${
                        isLocked 
                          ? 'bg-[#f2f3f3] text-[#879596] cursor-not-allowed border border-[#eaeded]'
                          : 'bg-[#0073bb] text-white hover:bg-[#005f99]'
                      }`}
                    >
                      Console Access
                    </button>
                    <button 
                      disabled={isLocked || !canAccess(['Administrator', 'DevOps Engineer'])}
                      className={`p-2 rounded-sm transition-colors border ${
                        isLocked || !canAccess(['Administrator', 'DevOps Engineer'])
                          ? 'bg-[#f2f3f3] text-[#879596] cursor-not-allowed border-[#eaeded]'
                          : 'bg-white text-[#565959] border-[#879596] hover:bg-[#f2f3f3]'
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