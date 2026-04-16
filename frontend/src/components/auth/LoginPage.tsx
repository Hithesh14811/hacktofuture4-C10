import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { syncSessionToStores } from '../../store/sessionSync';

type LocationOption = { label: string; city: string; country: string; lat: number; lon: number };
type UserNetworkProfile = {
  ips: { label: string; ip: string; status: string }[];
  locations: LocationOption[];
};

export default function LoginPage() {
  const navigate = useNavigate();
  const completeLogin = useAuthStore((s) => s.completeLogin);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedIp, setSelectedIp] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const userNetworkProfiles: Record<string, UserNetworkProfile> = {
    'sarah.chen@trustnet.corp': {
      ips: [
        { label: 'Home WiFi (Trusted)', ip: '49.207.12.11', status: 'CLEAN' },
        { label: 'Office VPN (Trusted)', ip: '223.190.82.14', status: 'CLEAN' },
        { label: 'Blacklisted Exit Node', ip: '185.220.101.34', status: 'BLACKLISTED' },
        { label: 'Unknown New IP', ip: '191.101.210.20', status: 'NEW' },
      ],
      locations: [
        { label: 'Primary: Bengaluru', city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946 },
        { label: 'Buffer: Mysuru', city: 'Mysuru', country: 'India', lat: 12.2958, lon: 76.6394 },
        { label: 'Buffer: Chennai', city: 'Chennai', country: 'India', lat: 13.0827, lon: 80.2707 },
        { label: 'Far: New York', city: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
      ],
    },
    'vikram.nair@trustnet.corp': {
      ips: [
        { label: 'Home WiFi (Trusted)', ip: '106.51.89.12', status: 'CLEAN' },
        { label: 'Office WiFi (Trusted)', ip: '117.232.44.102', status: 'CLEAN' },
        { label: 'Blacklisted IP', ip: '193.32.162.72', status: 'BLACKLISTED' },
        { label: 'Unknown New IP', ip: '171.22.11.88', status: 'NEW' },
      ],
      locations: [
        { label: 'Primary: Mysuru', city: 'Mysuru', country: 'India', lat: 12.2958, lon: 76.6394 },
        { label: 'Buffer: Bengaluru', city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946 },
        { label: 'Buffer: Mangaluru', city: 'Mangaluru', country: 'India', lat: 12.9141, lon: 74.856 },
        { label: 'Far: Berlin', city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
      ],
    },
    'priya.sharma@trustnet.corp': {
      ips: [
        { label: 'Home WiFi (Trusted)', ip: '49.43.91.9', status: 'CLEAN' },
        { label: 'Office WiFi (Trusted)', ip: '103.81.70.140', status: 'CLEAN' },
        { label: 'Blacklisted IP', ip: '190.2.145.26', status: 'BLACKLISTED' },
        { label: 'Unknown New IP', ip: '144.72.19.222', status: 'NEW' },
      ],
      locations: [
        { label: 'Primary: Mumbai', city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
        { label: 'Buffer: Navi Mumbai', city: 'Navi Mumbai', country: 'India', lat: 19.033, lon: 73.0297 },
        { label: 'Buffer: Pune', city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567 },
        { label: 'Far: London', city: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 },
      ],
    },
    'rahul.mehta@trustnet.corp': {
      ips: [
        { label: 'Home WiFi (Trusted)', ip: '59.93.112.18', status: 'CLEAN' },
        { label: 'Office WiFi (Trusted)', ip: '27.59.221.10', status: 'CLEAN' },
        { label: 'Blacklisted IP', ip: '45.155.205.233', status: 'BLACKLISTED' },
        { label: 'Unknown New IP', ip: '121.15.41.9', status: 'NEW' },
      ],
      locations: [
        { label: 'Primary: Pune', city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567 },
        { label: 'Buffer: Mumbai', city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
        { label: 'Buffer: Nashik', city: 'Nashik', country: 'India', lat: 19.9975, lon: 73.7898 },
        { label: 'Far: Toronto', city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
      ],
    },
    'cicd.bot@trustnet.corp': {
      ips: [
        { label: 'Server IP A (Trusted)', ip: '10.0.0.9', status: 'CLEAN' },
        { label: 'Server IP B (Trusted)', ip: '10.0.1.20', status: 'CLEAN' },
        { label: 'Blacklisted IP', ip: '104.244.74.11', status: 'BLACKLISTED' },
        { label: 'Unknown New IP', ip: '8.8.8.8', status: 'NEW' },
      ],
      locations: [
        { label: 'Primary: Bengaluru', city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946 },
        { label: 'Buffer: Hyderabad', city: 'Hyderabad', country: 'India', lat: 17.385, lon: 78.4867 },
        { label: 'Buffer: Chennai', city: 'Chennai', country: 'India', lat: 13.0827, lon: 80.2707 },
        { label: 'Far: Singapore', city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
      ],
    },
  };

  const fallbackProfile: UserNetworkProfile = {
    ips: [{ label: 'Default Trusted IP', ip: '127.0.0.1', status: 'CLEAN' }],
    locations: [{ label: 'Default Location', city: 'Unknown', country: 'Unknown', lat: 0, lon: 0 }],
  };

  const activeProfile = userNetworkProfiles[email] || fallbackProfile;

  useEffect(() => {
    if (!selectedIp && activeProfile.ips[0]) {
      setSelectedIp(activeProfile.ips[0].ip);
    }
    if (!selectedLocation && activeProfile.locations[0]) {
      setSelectedLocation(activeProfile.locations[0].label);
    }
  }, [activeProfile, selectedIp, selectedLocation]);

  const mockUsers = [
    { name: 'Sarah Chen (Admin)', email: 'sarah.chen@trustnet.corp', password: 'Admin@2024' },
    { name: 'Vikram Nair (DevOps)', email: 'vikram.nair@trustnet.corp', password: 'DevOps@2024' },
    { name: 'Priya Sharma (Developer)', email: 'priya.sharma@trustnet.corp', password: 'Dev@2024' },
    { name: 'Rahul Mehta (Data Analyst)', email: 'rahul.mehta@trustnet.corp', password: 'Data@2024' },
    { name: 'CI/CD Bot (Bot)', email: 'cicd.bot@trustnet.corp', password: 'Bot@2024' },
  ];

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = mockUsers.find((u) => u.email === e.target.value);
    if (selected) {
      setEmail(selected.email);
      setPassword(selected.password);
      const profile = userNetworkProfiles[selected.email] || fallbackProfile;
      setSelectedIp(profile.ips[0]?.ip || '');
      setSelectedLocation(profile.locations[0]?.label || '');
    } else {
      setEmail('');
      setPassword('');
      setSelectedIp('');
      setSelectedLocation('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const chosenIp = activeProfile.ips.find((i) => i.ip === selectedIp) || activeProfile.ips[0];
      const chosenLocation =
        activeProfile.locations.find((l) => l.label === selectedLocation) || activeProfile.locations[0];
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          mock_ip: chosenIp?.ip,
          mock_ip_status: chosenIp?.status,
          mock_location: chosenLocation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Invalid credentials');
        return;
      }

      completeLogin({
        user: data.user,
        session: data.session ?? null,
        token: data.access_token,
      });
      syncSessionToStores(data.session ?? null, data.user);
      
      // Backend sends requires_face_verification based on face_enrolled status
      if (data.requires_face_verification) {
        navigate('/verify/face');
      } else {
        navigate('/dashboard');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(0,115,187,0.08),_transparent_35%),linear-gradient(180deg,_#eef4fb_0%,_#f6f8fb_100%)] text-[#11181C]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-[460px] bg-white p-10 shadow-[0_24px_80px_rgba(35,47,62,0.14)] rounded-xl border border-[#d7e3f0]"
      >
        <div className="mb-6 flex flex-col items-center">
          <Shield className="h-12 w-12 text-[#0073bb] mb-2" />
          <h1 className="text-2xl font-bold text-[#232f3e]">Sign in to NimbusCloud</h1>
          <p className="mt-2 text-center text-sm text-[#565959]">A cloud operations console with embedded identity protection.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#11181C] mb-1">
              Select Demo User
            </label>
            <select
              onChange={handleUserSelect}
              value={email}
              className="w-full rounded-sm border border-[#879596] px-3 py-2 text-sm focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911] outline-none"
            >
              <option value="">Select a user...</option>
              {mockUsers.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#11181C] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-[#879596] px-3 py-2 text-sm focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911] outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#11181C] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-[#879596] px-3 py-2 text-sm focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911] outline-none"
              required
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-bold text-[#11181C] mb-1">
              Login Test Condition: IP Address
            </label>
            <select
              value={selectedIp}
              onChange={(e) => setSelectedIp(e.target.value)}
              className="w-full rounded-sm border border-[#879596] px-3 py-2 text-sm focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911] outline-none bg-white"
            >
              {activeProfile.ips.map((ip) => (
                <option key={ip.ip} value={ip.ip}>
                  {ip.label} ({ip.ip})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#11181C] mb-1">
              Login Test Condition: Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full rounded-sm border border-[#879596] px-3 py-2 text-sm focus:border-[#e47911] focus:ring-1 focus:ring-[#e47911] outline-none bg-white"
            >
              {activeProfile.locations.map((loc) => (
                <option key={loc.label} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 rounded-sm border border-[#d0021b] bg-[#fdf0f1] p-3 text-sm text-[#d0021b]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-[#ff9900] py-2 text-sm font-medium text-[#11181C] shadow-sm hover:bg-[#e68a00] focus:outline-none disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 border-t border-[#eaeded] pt-6 text-center">
          <p className="text-xs text-[#565959]">
            Locked accounts remain locked across logout, relogin, IP changes, and location changes until an administrator unlocks them.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
