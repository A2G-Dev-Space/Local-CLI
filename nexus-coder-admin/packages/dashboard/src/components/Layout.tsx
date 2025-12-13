import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, Users, LogOut, Terminal } from 'lucide-react';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/models', label: 'Models', icon: Server },
  { path: '/users', label: 'Users', icon: Users },
];

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-nexus-900 text-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-nexus-800">
          <Terminal className="w-8 h-8 text-nexus-400" />
          <div>
            <h1 className="font-bold text-lg">Nexus Coder</h1>
            <p className="text-xs text-nexus-400">Admin Dashboard</p>
          </div>
        </div>

        <nav className="mt-6 px-3">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-nexus-700 text-white'
                    : 'text-nexus-300 hover:bg-nexus-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-nexus-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-nexus-400 truncate">{user.deptname}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-nexus-400 hover:text-white hover:bg-nexus-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
