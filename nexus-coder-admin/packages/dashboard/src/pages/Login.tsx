import { useState } from 'react';
import { Terminal, ExternalLink } from 'lucide-react';
import { authApi } from '../services/api';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

interface LoginProps {
  onLogin: (user: User, token: string, isAdmin: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.callback(token.trim());
      const { user, sessionToken, isAdmin } = response.data;

      if (!isAdmin) {
        setError('Admin access required. Please contact your administrator.');
        return;
      }

      onLogin(user, sessionToken, isAdmin);
    } catch (err) {
      setError('Authentication failed. Please check your token.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const ssoUrl = 'https://genai.samsungds.net:36810/sso';

  return (
    <div className="min-h-screen bg-gradient-to-br from-nexus-900 to-nexus-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-nexus-700 rounded-2xl mb-4">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nexus Coder Admin</h1>
          <p className="text-nexus-400 mt-2">Enterprise AI Coding Assistant</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Admin Login</h2>

          {/* SSO Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 mb-3">
              1. Login via SSO to get your token
            </p>
            <a
              href={ssoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Open SSO Login
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-sm text-blue-800 mt-3">
              2. Copy the token and paste it below
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                SSO Token
              </label>
              <textarea
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nexus-500 focus:border-transparent resize-none font-mono text-sm"
                rows={4}
                placeholder="Paste your SSO token here..."
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-3 px-4 bg-nexus-600 text-white font-medium rounded-lg hover:bg-nexus-700 focus:ring-4 focus:ring-nexus-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Only authorized administrators can access this dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
