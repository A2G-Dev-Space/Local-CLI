import { useState, useEffect } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

interface LoginProps {
  onLogin: (user: User, token: string, isAdmin: boolean, adminRole: string | null) => void;
}

// SSO 설정 (환경변수로 오버라이드 가능)
const SSO_BASE_URL = import.meta.env.VITE_SSO_URL || 'https://genai.samsungds.net:36810';
const SSO_PATH = '/direct_sso';

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);

  // SSO 콜백 처리 (URL에서 data 파라미터 확인)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');

    if (data) {
      setProcessingCallback(true);
      handleSSOCallback(data);
    }
  }, []);

  // SSO 콜백 데이터 처리
  const handleSSOCallback = async (dataString: string) => {
    try {
      // Parse SSO data
      const ssoData = JSON.parse(dataString);

      if (!ssoData.loginid || !ssoData.username) {
        throw new Error('Invalid SSO data');
      }

      // Generate a temporary token from SSO data for backend verification
      // Backend will decode this and create a proper session
      // Use encodeURIComponent + unescape for Unicode-safe base64 encoding
      const jsonData = JSON.stringify({
        loginid: ssoData.loginid,
        username: ssoData.username,
        deptname: ssoData.deptname || '',
        timestamp: Date.now(),
      });
      const ssoToken = btoa(unescape(encodeURIComponent(jsonData)));

      // Exchange SSO data for session token
      const response = await authApi.login(`sso.${ssoToken}`);
      const { user, sessionToken, isAdmin, adminRole } = response.data;

      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);

      // Complete login
      onLogin(user, sessionToken, isAdmin, adminRole);
    } catch (err) {
      console.error('SSO callback error:', err);
      setError('SSO 인증 처리 중 오류가 발생했습니다.');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setProcessingCallback(false);
    }
  };

  // SSO 로그인 시작
  const handleSSOLogin = () => {
    setLoading(true);
    setError('');

    // Build redirect URL (current page)
    const redirectUrl = window.location.origin + window.location.pathname;

    // Build SSO URL
    const ssoUrl = new URL(SSO_PATH, SSO_BASE_URL);
    ssoUrl.searchParams.set('redirect_url', redirectUrl);

    // Redirect to SSO
    window.location.href = ssoUrl.toString();
  };

  // 로딩 중 (SSO 콜백 처리)
  if (processingCallback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pastel-50 via-white to-pastel-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-lg text-pastel-800">SSO 인증 처리 중...</p>
          <p className="mt-2 text-sm text-pastel-500">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-50 via-white to-pastel-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl mb-6 border border-pastel-200 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Nexus Coder" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-pastel-800 tracking-tight">Nexus Coder</h1>
          <p className="text-pastel-500 mt-2 text-sm">Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-pastel-100 p-8">
          <h2 className="text-xl font-semibold text-pastel-800 mb-2">로그인</h2>
          <p className="text-sm text-pastel-500 mb-6">SSO를 통해 로그인하세요</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSSOLogin}
            disabled={loading}
            className="w-full py-4 px-4 bg-gradient-to-r from-pastel-400 to-samsung-blue text-white font-semibold rounded-xl hover:from-pastel-500 hover:to-samsung-blue-dark focus:ring-4 focus:ring-pastel-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-pastel-300/50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                SSO 페이지로 이동 중...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                SSO로 로그인
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-pastel-100">
            <div className="text-center text-xs text-pastel-500 space-y-1">
              <p>Samsung DS 계정으로 로그인됩니다</p>
              <p>관리자 권한이 있는 경우 전체 기능에 접근할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-pastel-500 mt-8">
          &copy; 2026 Nexus Coder. Samsung DS Internal Use Only.
        </p>
      </div>
    </div>
  );
}
