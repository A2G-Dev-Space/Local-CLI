import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[150px] opacity-[0.06]"
          style={{ background: 'var(--accent)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-md px-6 relative z-10"
      >
        {/* Big 404 with gradient */}
        <div className="relative mb-6">
          <span className="text-[120px] sm:text-[150px] font-extrabold leading-none gradient-text select-none">
            404
          </span>
          {/* Ghost shadow */}
          <span className="absolute inset-0 text-[120px] sm:text-[150px] font-extrabold leading-none text-[var(--accent)] opacity-[0.08] blur-xl select-none">
            404
          </span>
        </div>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-[var(--text-tertiary)] mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5"
        >
          <ArrowLeft size={16} />
          {t('common.goHome', 'Go Home')}
        </Link>
      </motion.div>
    </div>
  );
}
