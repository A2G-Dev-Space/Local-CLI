import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Server, Users, LogOut, Menu, X, ChevronRight, MessageSquare, Shield, BookOpen, BarChart3 } from 'lucide-react';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | null;

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  isAdmin: boolean;
  adminRole: AdminRole;
  onLogout: () => void;
}

// Admin 전용 메뉴
const adminNavItems = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/models', label: '모델 관리', icon: Server },
  { path: '/users', label: '사용자', icon: Users },
];

// 모든 사용자 메뉴
const userNavItems = [
  { path: '/my-usage', label: '내 사용량', icon: BarChart3 },
  { path: '/feedback', label: '피드백', icon: MessageSquare },
];

export default function Layout({ children, user, isAdmin, adminRole, onLogout }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin이면 전체 메뉴, 아니면 사용자 메뉴만
  const navItems = isAdmin ? [...adminNavItems, ...userNavItems] : userNavItems;
  const currentPage = navItems.find((item) => item.path === location.pathname);

  // 역할 표시 텍스트
  const roleLabel = adminRole === 'SUPER_ADMIN' ? '개발자' :
                    adminRole === 'ADMIN' ? '관리자' :
                    adminRole === 'VIEWER' ? '뷰어' : '사용자';

  return (
    <div className="min-h-screen bg-pastel-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Light theme */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-pastel-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-pastel-100">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Nexus Coder" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="font-bold text-lg tracking-tight text-pastel-800">Nexus Coder</h1>
              <p className="text-[10px] text-pastel-500 uppercase tracking-wider">Portal</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-pastel-500 hover:text-pastel-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          {/* Admin 섹션 */}
          {isAdmin && (
            <div className="mb-4">
              <p className="px-4 mb-2 text-xs font-semibold text-pastel-500 uppercase tracking-wider">
                관리
              </p>
              {adminNavItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 group ${
                      isActive
                        ? 'bg-pastel-100 text-pastel-700 shadow-sm'
                        : 'text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-600'}`} />
                    <span className="font-medium">{label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-samsung-blue" />}
                  </Link>
                );
              })}
            </div>
          )}

          {/* 일반 섹션 */}
          <div>
            <p className="px-4 mb-2 text-xs font-semibold text-pastel-500 uppercase tracking-wider">
              {isAdmin ? '커뮤니티' : '메뉴'}
            </p>
            {userNavItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 group ${
                    isActive
                      ? 'bg-pastel-100 text-pastel-700 shadow-sm'
                      : 'text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-600'}`} />
                  <span className="font-medium">{label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-samsung-blue" />}
                </Link>
              );
            })}
          </div>

          {/* 리소스 섹션 */}
          <div className="mt-4">
            <p className="px-4 mb-2 text-xs font-semibold text-pastel-500 uppercase tracking-wider">
              리소스
            </p>
            <a
              href="/docs/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 group text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700"
            >
              <BookOpen className="w-5 h-5 text-pastel-400 group-hover:text-pastel-600" />
              <span className="font-medium">문서</span>
            </a>
          </div>
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-pastel-100 bg-pastel-50/50">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-pastel-800 truncate">{user.username}</p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-pastel-200 text-pastel-700 rounded">
                    <Shield className="w-2.5 h-2.5" />
                    {roleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-pastel-500 truncate">{user.deptname}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2.5 text-pastel-500 hover:text-pastel-700 hover:bg-pastel-100 rounded-xl transition-all duration-200"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-pastel-100">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-pastel-500 hover:text-pastel-700 hover:bg-pastel-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-pastel-800">
                  {currentPage?.label || '피드백'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-pastel-100 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-pastel-600">온라인</span>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-pastel-300 to-samsung-blue rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
