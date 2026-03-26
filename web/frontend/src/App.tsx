import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import Layout from '@/components/Layout';
import ToastContainer from '@/components/Toast';
import Login from '@/pages/Login';
import Chat from '@/pages/Chat';
import Sessions from '@/pages/Sessions';
import AgentBuilder from '@/pages/AgentBuilder';
import LLMSettings from '@/pages/LLMSettings';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminUsers from '@/pages/admin/Users';
import AdminSessions from '@/pages/admin/Sessions';
import AdminResources from '@/pages/admin/Resources';
import AdminErrors from '@/pages/admin/Errors';
import AdminSettings from '@/pages/admin/Settings';
import NotFound from '@/pages/NotFound';

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    initTheme();
    initAuth();
  }, [initAuth, initTheme]);

  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/" element={<Navigate to="/sessions" replace />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Layout />}>
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/chat/:sessionId" element={<Chat />} />
        <Route path="/agents/new" element={<AgentBuilder />} />
        <Route path="/agents/:id/edit" element={<AgentBuilder />} />
        <Route path="/settings/llm" element={<LLMSettings />} />

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/sessions" element={<AdminSessions />} />
        <Route path="/admin/resources" element={<AdminResources />} />
        <Route path="/admin/errors" element={<AdminErrors />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}
