import { Link, useLocation, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Server, Users, LogOut, Menu, X, ChevronRight, ChevronDown, MessageSquare, Shield, BookOpen, BarChart3, Home, Layers } from 'lucide-react';
import { serviceApi } from '../services/api';

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
}

interface Service {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  enabled: boolean;
}

/**
 * Decode unicode escape sequences (e.g., \uD55C\uAE00 → 한글)
 */
function decodeUnicodeEscape(str: string): string {
  if (!str) return str;
  try {
    // Check if string contains unicode escape sequences
    if (str.includes('\\u')) {
      return JSON.parse(`"${str}"`);
    }
    return str;
  } catch {
    return str;
  }
}

type AdminRole = 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null;

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  isAdmin: boolean;
  adminRole: AdminRole;
  onLogout: () => void;
}

// 모든 사용자 메뉴
const userNavItems = [
  { path: '/my-usage', label: '내 사용량', icon: BarChart3 },
  { path: '/feedback', label: '피드백', icon: MessageSquare },
];

export default function Layout({ children, user, isAdmin, adminRole, onLogout }: LayoutProps) {
  const location = useLocation();
  const { serviceId } = useParams<{ serviceId?: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isAdmin) {
      loadServices();
    }
  }, [isAdmin]);

  // Listen for service updates from other components
  useEffect(() => {
    const handleServiceUpdate = () => {
      if (isAdmin) {
        loadServices();
      }
    };

    window.addEventListener('services-updated', handleServiceUpdate);
    return () => {
      window.removeEventListener('services-updated', handleServiceUpdate);
    };
  }, [isAdmin]);

  // Auto-expand current service
  useEffect(() => {
    if (serviceId) {
      setExpandedServices(prev => new Set([...prev, serviceId]));
    }
  }, [serviceId]);

  const loadServices = async () => {
    try {
      const res = await serviceApi.list();
      setServices(res.data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const toggleService = (id: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Determine current page label
  const getCurrentPageLabel = () => {
    if (location.pathname === '/') return '통합 대시보드';
    if (location.pathname === '/users') return '사용자 관리';
    if (location.pathname === '/my-usage') return '내 사용량';
    if (location.pathname === '/feedback') return '피드백';
    if (location.pathname.startsWith('/service/')) {
      const service = services.find(s => s.id === serviceId);
      if (location.pathname.includes('/models')) return `${service?.displayName || ''} 모델 관리`;
      if (location.pathname.includes('/users')) return `${service?.displayName || ''} 사용자`;
      return `${service?.displayName || ''} 대시보드`;
    }
    return 'AX Portal';
  };

  // 역할 표시 텍스트
  const roleLabel = adminRole === 'SUPER_ADMIN' ? '슈퍼관리자' :
                    adminRole === 'SERVICE_ADMIN' ? '서비스관리자' :
                    adminRole === 'VIEWER' ? '뷰어' :
                    adminRole === 'SERVICE_VIEWER' ? '서비스뷰어' : '사용자';

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
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-pastel-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-pastel-100 sticky top-0 bg-white z-10">
          <Link to="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <img src="/logo.png" alt="AX Portal" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="font-bold text-lg tracking-tight text-pastel-800">AX Portal</h1>
              <p className="text-[10px] text-pastel-500 uppercase tracking-wider">Multi-Service</p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-pastel-500 hover:text-pastel-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 pb-24">
          {/* Admin 섹션: 통합 대시보드 */}
          {isAdmin && (
            <div className="mb-4">
              <p className="px-4 mb-2 text-xs font-semibold text-pastel-500 uppercase tracking-wider">
                통합 관리
              </p>
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 group ${
                  location.pathname === '/'
                    ? 'bg-pastel-100 text-pastel-700 shadow-sm'
                    : 'text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700'
                }`}
              >
                <Home className={`w-5 h-5 ${location.pathname === '/' ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-600'}`} />
                <span className="font-medium">통합 대시보드</span>
                {location.pathname === '/' && <ChevronRight className="w-4 h-4 ml-auto text-samsung-blue" />}
              </Link>
              {/* SUPER_ADMIN만 통합 사용자 관리 */}
              {adminRole === 'SUPER_ADMIN' && (
                <Link
                  to="/users"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 group ${
                    location.pathname === '/users'
                      ? 'bg-pastel-100 text-pastel-700 shadow-sm'
                      : 'text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700'
                  }`}
                >
                  <Users className={`w-5 h-5 ${location.pathname === '/users' ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-600'}`} />
                  <span className="font-medium">사용자 관리</span>
                  {location.pathname === '/users' && <ChevronRight className="w-4 h-4 ml-auto text-samsung-blue" />}
                </Link>
              )}
            </div>
          )}

          {/* Admin 섹션: 서비스별 메뉴 */}
          {isAdmin && services.length > 0 && (
            <div className="mb-4">
              <p className="px-4 mb-2 text-xs font-semibold text-pastel-500 uppercase tracking-wider">
                서비스
              </p>
              {services.map((service) => {
                const isExpanded = expandedServices.has(service.id);
                const isServiceActive = location.pathname.startsWith(`/service/${service.id}`);
                const servicePaths = [
                  { path: `/service/${service.id}`, label: '대시보드', icon: LayoutDashboard },
                  { path: `/service/${service.id}/models`, label: '모델 관리', icon: Server },
                  { path: `/service/${service.id}/users`, label: '사용자', icon: Users },
                ];

                return (
                  <div key={service.id} className="mb-1">
                    {/* Service Header */}
                    <button
                      onClick={() => toggleService(service.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                        isServiceActive
                          ? 'bg-pastel-100 text-pastel-700'
                          : 'text-pastel-600 hover:bg-pastel-50 hover:text-pastel-700'
                      }`}
                    >
                      {service.iconUrl ? (
                        <img src={service.iconUrl} alt={service.displayName} className="w-5 h-5 rounded" />
                      ) : (
                        <Layers className={`w-5 h-5 ${isServiceActive ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-600'}`} />
                      )}
                      <span className="font-medium flex-1 text-left">{service.displayName}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-pastel-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-pastel-400" />
                      )}
                    </button>

                    {/* Service Sub-menu */}
                    {isExpanded && (
                      <div className="ml-4 mt-1 border-l-2 border-pastel-100 pl-2">
                        {servicePaths.map(({ path, label, icon: Icon }) => {
                          const isActive = location.pathname === path;
                          return (
                            <Link
                              key={path}
                              to={path}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-all duration-200 group ${
                                isActive
                                  ? 'bg-samsung-blue/10 text-samsung-blue'
                                  : 'text-pastel-500 hover:bg-pastel-50 hover:text-pastel-700'
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${isActive ? 'text-samsung-blue' : 'text-pastel-400 group-hover:text-pastel-500'}`} />
                              <span className="text-sm">{label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 일반 섹션 */}
          <div className="mb-4">
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
          <div>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-pastel-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-pastel-800 truncate">{decodeUnicodeEscape(user.username)}</p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-pastel-200 text-pastel-700 rounded">
                    <Shield className="w-2.5 h-2.5" />
                    {roleLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-pastel-500 truncate">{decodeUnicodeEscape(user.deptname)}</p>
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
                  {getCurrentPageLabel()}
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
