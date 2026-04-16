import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, Search, Filter, Shield, RefreshCw, Info, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';

export default function LogsPage() {
  const { user, token } = useAuthStore();
  const { notifications, trustScore, isCompromised } = useTrustStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logs, setLogs] = useState<Array<{
    id: string;
    timestamp: string;
    severity: 'critical' | 'warning' | 'info' | 'success';
    message: string;
    source: string;
  }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    const mockLogs = [
      { id: '1', timestamp: new Date(Date.now() - 60000).toISOString(), severity: 'critical' as const, message: 'Account sarah.chen@trustnet.corp flagged as compromised', source: 'Trust Engine' },
      { id: '2', timestamp: new Date(Date.now() - 120000).toISOString(), severity: 'warning' as const, message: 'Unusual login location detected for vikram.nair@trustnet.corp', source: 'Geo-Location Monitor' },
      { id: '3', timestamp: new Date(Date.now() - 180000).toISOString(), severity: 'success' as const, message: 'Face verification successful for priya.sharma@trustnet.corp', source: 'Biometric Service' },
      { id: '4', timestamp: new Date(Date.now() - 240000).toISOString(), severity: 'info' as const, message: 'Session established for rahul.mehta@trustnet.corp', source: 'IAM Service' },
      { id: '5', timestamp: new Date(Date.now() - 300000).toISOString(), severity: 'warning' as const, message: 'Trust score dropped below 60 for cicd.bot@trustnet.corp', source: 'Trust Scoring' },
      { id: '6', timestamp: new Date(Date.now() - 360000).toISOString(), severity: 'critical' as const, message: 'Multiple failed passkey attempts detected', source: 'Auth Service' },
      { id: '7', timestamp: new Date(Date.now() - 420000).toISOString(), severity: 'info' as const, message: 'Remediation applied to compromised account', source: 'Incident Response' },
      { id: '8', timestamp: new Date(Date.now() - 480000).toISOString(), severity: 'success' as const, message: 'Access restored for user rahul.mehta@trustnet.corp', source: 'Admin Service' },
    ];
    setLogs(mockLogs);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.source.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [logs, searchTerm, severityFilter]);

  const refreshLogs = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-[#d0021b]" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-[#e47911]" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-[#00ff88]" />;
      default: return <Info className="h-4 w-4 text-[#0073bb]" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#d0021b]/10 text-[#d0021b] border-[#d0021b]/20';
      case 'warning': return 'bg-[#e47911]/10 text-[#e47911] border-[#e47911]/20';
      case 'success': return 'bg-[#00ff88]/10 text-[#00a86b] border-[#00ff88]/20';
      default: return 'bg-[#0073bb]/10 text-[#0073bb] border-[#0073bb]/20';
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="border-b border-[#eaeded] bg-white px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#232f3e]">Logs & Alerts</h1>
                <p className="text-sm text-[#565959]">Real-time security events and audit trail.</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={refreshLogs}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-sm border border-[#879596] px-4 py-2 text-sm font-bold text-[#232f3e] hover:bg-[#f2f3f3] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#eaeded] bg-[#f9f9f9] px-8 py-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#565959]" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-sm border border-[#879596] bg-white py-2 pl-10 pr-4 text-sm text-[#232f3e] placeholder-[#879596] focus:border-[#e47911] focus:outline-none focus:ring-1 focus:ring-[#e47911]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#565959]" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-sm border border-[#879596] bg-white px-3 py-2 text-sm text-[#232f3e] focus:border-[#e47911] focus:outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="rounded-sm border border-[#eaeded] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#565959]">
                  <Bell className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Total Events</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-[#232f3e]">{logs.length}</div>
              </div>
              <div className="rounded-sm border border-[#d0021b]/20 bg-[#fdf0f1] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#d0021b]">
                  <XCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Critical</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-[#d0021b]">
                  {logs.filter(l => l.severity === 'critical').length}
                </div>
              </div>
              <div className="rounded-sm border border-[#e47911]/20 bg-[#fff4e5] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#e47911]">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Warnings</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-[#e47911]">
                  {logs.filter(l => l.severity === 'warning').length}
                </div>
              </div>
              <div className="rounded-sm border border-[#00ff88]/20 bg-[#f0fff4] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#00a86b]">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">System Status</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-[#00a86b]">Operational</div>
              </div>
            </div>

            <div className="rounded-sm border border-[#eaeded] bg-white shadow-sm">
              <div className="border-b border-[#eaeded] bg-[#f2f3f3] px-4 py-3">
                <h3 className="font-bold text-[#232f3e]">Event Log</h3>
              </div>
              <div className="divide-y divide-[#eaeded]">
                <AnimatePresence>
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-[#565959]">
                      No events match your search criteria.
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-start gap-4 px-6 py-4 hover:bg-[#f2f3f3]/30 transition-colors"
                      >
                        <div className="mt-0.5">
                          {getSeverityIcon(log.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${getSeverityBadge(log.severity)}`}>
                              {log.severity}
                            </span>
                            <span className="text-xs text-[#565959]">{log.source}</span>
                          </div>
                          <p className="text-sm text-[#232f3e]">{log.message}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-[#565959] font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-[10px] text-[#879596]">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
