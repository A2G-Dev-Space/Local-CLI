import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MainDashboard from './pages/MainDashboard';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Users from './pages/Users';
import UnifiedUsers from './pages/UnifiedUsers';
import Feedback from './pages/Feedback';
import MyUsage from './pages/MyUsage';
import Login from './pages/Login';
import { authApi } from './services/api';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

type AdminRole = 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null;

// Wrapper components to pass serviceId prop from URL params
function ServiceDashboardWrapper() {
  const { serviceId } = useParams<{ serviceId: string }>();
  return <Dashboard serviceId={serviceId} />;
}

function ServiceModelsWrapper() {
  const { serviceId } = useParams<{ serviceId: string }>();
  return <Models serviceId={serviceId} />;
}

function ServiceUsersWrapper() {
  const { serviceId } = useParams<{ serviceId: string }>();
  return <Users serviceId={serviceId} />;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('nexus_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authApi.check();
      setUser(response.data.user);
      setIsAdmin(response.data.isAdmin);
      setAdminRole(response.data.adminRole);
    } catch {
      localStorage.removeItem('nexus_token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User, token: string, admin: boolean, role: string | null) => {
    localStorage.setItem('nexus_token', token);
    setUser(userData);
    setIsAdmin(admin);
    setAdminRole(role as AdminRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    setUser(null);
    setIsAdmin(false);
    setAdminRole(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pastel-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-pastel-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 필요
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // 일반 사용자: MyUsage, Feedback만 접근 가능
  // Admin: 전체 접근 가능
  return (
    <Layout user={user} isAdmin={isAdmin} adminRole={adminRole} onLogout={handleLogout}>
      <Routes>
        {/* 모든 사용자 접근 가능 */}
        <Route path="/my-usage" element={<MyUsage />} />
        <Route path="/feedback" element={<Feedback isAdmin={isAdmin} />} />

        {/* Admin만 접근 가능 */}
        {isAdmin && (
          <>
            {/* 통합 대시보드 (메인) */}
            <Route path="/" element={<MainDashboard adminRole={adminRole} />} />

            {/* 통합 사용자 관리 (SUPER_ADMIN만) */}
            {adminRole === 'SUPER_ADMIN' && (
              <Route path="/users" element={<UnifiedUsers />} />
            )}

            {/* 서비스별 라우트 */}
            <Route path="/service/:serviceId" element={<ServiceDashboardWrapper />} />
            <Route path="/service/:serviceId/models" element={<ServiceModelsWrapper />} />
            <Route path="/service/:serviceId/users" element={<ServiceUsersWrapper />} />
          </>
        )}

        {/* 기본 리다이렉트 */}
        <Route
          path="*"
          element={<Navigate to={isAdmin ? '/' : '/my-usage'} replace />}
        />
      </Routes>
    </Layout>
  );
}

export default App;
