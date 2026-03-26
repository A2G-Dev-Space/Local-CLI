import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  Cpu,
  Shield,
  Users,
  MonitorDot,
  HardDrive,
  AlertTriangle,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Languages,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import clsx from 'clsx';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
  );

export default function Layout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleLang = () => {
    const next = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(next);
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        {sidebarOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-lg text-[var(--text-primary)] whitespace-nowrap"
          >
            Local Web
          </motion.span>
        )}
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink to="/sessions" className={navLinkClass} onClick={() => setMobileOpen(false)}>
          <MessageSquare size={20} />
          {sidebarOpen && <span>{t('nav.sessions')}</span>}
        </NavLink>
        <NavLink to="/agents/new" className={navLinkClass} onClick={() => setMobileOpen(false)}>
          <Bot size={20} />
          {sidebarOpen && <span>{t('nav.agents')}</span>}
        </NavLink>
        <NavLink to="/settings/llm" className={navLinkClass} onClick={() => setMobileOpen(false)}>
          <Cpu size={20} />
          {sidebarOpen && <span>{t('nav.llmSettings')}</span>}
        </NavLink>

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              {sidebarOpen && (
                <span className="px-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('nav.admin')}
                </span>
              )}
            </div>
            <NavLink to="/admin" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
              <Shield size={20} />
              {sidebarOpen && <span>{t('nav.dashboard')}</span>}
            </NavLink>
            <NavLink
              to="/admin/users"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <Users size={20} />
              {sidebarOpen && <span>{t('nav.users')}</span>}
            </NavLink>
            <NavLink
              to="/admin/sessions"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <MonitorDot size={20} />
              {sidebarOpen && <span>{t('nav.allSessions')}</span>}
            </NavLink>
            <NavLink
              to="/admin/resources"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <HardDrive size={20} />
              {sidebarOpen && <span>{t('nav.resources')}</span>}
            </NavLink>
            <NavLink
              to="/admin/errors"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <AlertTriangle size={20} />
              {sidebarOpen && <span>{t('nav.errors')}</span>}
            </NavLink>
            <NavLink
              to="/admin/settings"
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <Settings size={20} />
              {sidebarOpen && <span>{t('nav.settings')}</span>}
            </NavLink>
          </>
        )}
      </div>

      {/* User section */}
      {sidebarOpen && user && (
        <div className="border-t border-[var(--border)] p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user.name}
                </div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{user.email}</div>
              </div>
              <ChevronDown
                size={16}
                className={clsx(
                  'text-[var(--text-secondary)] transition-transform',
                  userMenuOpen && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden"
                >
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--error)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <LogOut size={16} />
                    {t('auth.logout')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg-primary)]">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] transition-all duration-300 flex-shrink-0',
          sidebarOpen ? 'w-64' : 'w-[68px]',
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-secondary)] border-r border-[var(--border)] z-50 lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleLang}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
              title={i18n.language === 'ko' ? 'English' : '한국어'}
            >
              <Languages size={20} />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
              title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
