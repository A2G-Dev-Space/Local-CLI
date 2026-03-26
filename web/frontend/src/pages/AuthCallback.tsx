import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';

export default function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err) {
      setError(err);
      return;
    }

    if (token) {
      login(token);
      navigate('/sessions', { replace: true });
    } else {
      setError('No token received');
    }
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--error)]/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-[var(--error)] text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {t('common.error')}
          </h2>
          <p className="text-[var(--text-secondary)] mb-6">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[var(--text-secondary)]">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        {t('auth.loggingIn')}
      </div>
    </div>
  );
}
