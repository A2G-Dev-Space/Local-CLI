import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LogIn, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/sessions', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'var(--accent)', opacity: 0.06 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px]"
          style={{ background: '#a855f7', opacity: 0.04 }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(var(--text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--text-secondary) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-[var(--glass-border)] shadow-elevation-4 overflow-hidden"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(24px)' }}
        >
          {/* Gradient top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)]" />

          <div className="p-10 text-center">
            {/* Logo */}
            <div className="relative w-18 h-18 mx-auto mb-6">
              <motion.div
                className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-600 blur-xl opacity-30 mx-auto"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden mx-auto shadow-glow-md">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <motion.div
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles size={10} className="text-white" />
              </motion.div>
            </div>

            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1.5">LOCAL BOT Web</h1>
            <p className="text-sm text-[var(--text-tertiary)] mb-8">{t('auth.loginDesc')}</p>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              className="w-full py-3 text-base font-semibold flex items-center justify-center gap-2.5
                rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white
                shadow-glow-sm hover:shadow-glow-md transition-shadow duration-300"
            >
              <LogIn size={18} />
              {t('auth.loginWith')}
            </motion.button>

            <p className="text-[10px] text-[var(--text-tertiary)] mt-6 opacity-60">
              Powered by LOCAL BOT Agent Platform
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
