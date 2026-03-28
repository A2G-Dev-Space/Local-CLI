import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import Layout from '@/components/Layout';
import ToastContainer from '@/components/Toast';
import CommandPalette from '@/components/CommandPalette';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Chat from '@/pages/Chat';
import Sessions from '@/pages/Sessions';
import AgentBuilder from '@/pages/AgentBuilder';
import Marketplace from '@/pages/Marketplace';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminUsers from '@/pages/admin/Users';
import AdminSessions from '@/pages/admin/Sessions';
import AdminResources from '@/pages/admin/Resources';
import AdminErrors from '@/pages/admin/Errors';
import AdminSettings from '@/pages/admin/Settings';
import NotFound from '@/pages/NotFound';

/* Premium loading spinner */
function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">Loading...</span>
      </div>
    </div>
  );
}

/* Page transition wrapper */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1],
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/sessions" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initTheme = useThemeStore((s) => s.init);
  const location = useLocation();

  useEffect(() => {
    initTheme();
    initAuth();
  }, [initAuth, initTheme]);

  return (
    <>
    <ToastContainer />
    <CommandPalette />
    <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<AnimatedPage><Landing /></AnimatedPage>} />
      <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/sessions" element={<AnimatedPage><Sessions /></AnimatedPage>} />
        <Route path="/chat/:sessionId" element={<Chat />} />
        <Route path="/agents/new" element={<AnimatedPage><AgentBuilder /></AnimatedPage>} />
        <Route path="/agents/:id/edit" element={<AnimatedPage><AgentBuilder /></AnimatedPage>} />
        <Route path="/marketplace" element={<AnimatedPage><Marketplace /></AnimatedPage>} />

        <Route path="/admin" element={<AdminRoute><AnimatedPage><AdminDashboard /></AnimatedPage></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AnimatedPage><AdminUsers /></AnimatedPage></AdminRoute>} />
        <Route path="/admin/sessions" element={<AdminRoute><AnimatedPage><AdminSessions /></AnimatedPage></AdminRoute>} />
        <Route path="/admin/resources" element={<AdminRoute><AnimatedPage><AdminResources /></AnimatedPage></AdminRoute>} />
        <Route path="/admin/errors" element={<AdminRoute><AnimatedPage><AdminErrors /></AnimatedPage></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AnimatedPage><AdminSettings /></AnimatedPage></AdminRoute>} />
      </Route>

      <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
    </Routes>
    </AnimatePresence>
    </>
  );
}
