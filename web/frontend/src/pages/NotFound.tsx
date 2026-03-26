import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center max-w-md px-6">
        <div className="text-7xl font-bold text-[var(--accent)] mb-4">404</div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="btn-primary inline-block">
          {t('common.goHome', 'Go Home')}
        </Link>
      </div>
    </div>
  );
}
