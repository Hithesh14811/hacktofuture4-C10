import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AuthBootstrap } from './components/AuthBootstrap';
import { SecurityOverlay } from './components/SecurityOverlay';
import { TrustSync } from './components/TrustSync';
import PasskeyChallenge from './components/auth/PasskeyChallenge';
import CameraChallengeBanner from './components/CameraChallengeBanner';
import LoginPage from './components/auth/LoginPage';
import FaceVerification from './components/auth/FaceVerification';
import Dashboard from './components/dashboard/Dashboard';
import ServicesPage from './components/pages/ServicesPage';
import SecretsPage from './components/pages/SecretsPage';
import AdminPanel from './components/pages/AdminPanel';
import IncidentResponse from './components/pages/IncidentResponse';
import ReportsPage from './components/pages/ReportsPage';
import LogsPage from './components/pages/LogsPage';
import DemoControlPanel from './components/demo/DemoControlPanel';

function AuthenticatedDemoMount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return null;
  return <DemoControlPanel />;
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { isAuthenticated, user, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return <div className="min-h-screen bg-[#f2f3f3]" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && user?.role !== 'Administrator') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function FaceVerifiedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, session } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!session?.face_verified_this_session) {
    return <Navigate to="/verify/face" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <TrustSync />
      <SecurityOverlay />
      <PasskeyChallenge />
      <CameraChallengeBanner />
      <AuthenticatedDemoMount />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/verify/face"
          element={
            <ProtectedRoute>
              <FaceVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <Dashboard />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/services"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <ServicesPage />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/secrets"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <SecretsPage />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute requireAdmin>
              <FaceVerifiedRoute>
                <AdminPanel />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/incident"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <IncidentResponse />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/reports"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <ReportsPage />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/logs"
          element={
            <ProtectedRoute>
              <FaceVerifiedRoute>
                <LogsPage />
              </FaceVerifiedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
