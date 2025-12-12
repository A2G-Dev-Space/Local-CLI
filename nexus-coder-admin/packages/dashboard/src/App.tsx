import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Users from './pages/Users';
import Login from './pages/Login';
import { api } from './services/api';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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

      const response = await api.get('/auth/me');
      setUser(response.data.user);
      setIsAdmin(response.data.isAdmin);
    } catch {
      localStorage.removeItem('nexus_token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User, token: string, admin: boolean) => {
    localStorage.setItem('nexus_token', token);
    setUser(userData);
    setIsAdmin(admin);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    setUser(null);
    setIsAdmin(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexus-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/models" element={<Models />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
