import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Server, Key, FileText, 
  ChevronRight, Settings, Network, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Administrator';

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
    { icon: Server, label: 'Services', path: '/dashboard/services' },
    { icon: Key, label: 'Secrets', path: '/dashboard/secrets' },
    { icon: Network, label: 'IAM Graph', path: '/dashboard/incident', adminOnly: false },
    { icon: AlertTriangle, label: 'Logs & Alerts', path: '/dashboard/logs', adminOnly: false },
    { icon: FileText, label: 'Reports', path: '/dashboard/reports', adminOnly: true },
    { icon: Settings, label: 'Admin Panel', path: '/dashboard/admin', adminOnly: true },
  ];

  return (
    <aside className={`bg-[#232f3e] border-r border-[#eaeded] flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-sm transition-all ${
                  isActive
                    ? 'bg-[#37475a] text-white border-l-4 border-[#e47911]'
                    : 'text-[#879596] hover:text-white hover:bg-[#37475a]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 font-bold text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && !collapsed && (
                    <ChevronRight className="w-4 h-4 text-[#e47911]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#37475a]">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className={`w-2 h-2 rounded-full bg-[#00ff88] ${collapsed ? '' : ''}`} />
          {!collapsed && (
            <span className="text-[10px] uppercase font-bold text-[#879596]">System Operational</span>
          )}
        </div>
      </div>
    </aside>
  );
}