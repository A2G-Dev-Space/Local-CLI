import { useState, useEffect } from 'react';
import { User, Search, ChevronLeft, ChevronRight, Shield, ShieldCheck, Crown } from 'lucide-react';
import { usersApi, serviceApi } from '../services/api';

/**
 * URL 인코딩된 사용자 이름을 디코딩
 */
function decodeUsername(name: string | undefined | null): string {
  if (!name) return '';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

interface UserData {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
  firstSeen: string;
  lastActive: string;
  isActive: boolean;
  _count: {
    usageLogs: number;
  };
}

interface AdminStatus {
  isAdmin: boolean;
  adminRole: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null;
  isDeveloper: boolean;
  canModify: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ServiceInfo {
  id: string;
  name: string;
  displayName: string;
}

interface UsersProps {
  serviceId?: string;
}

export default function Users({ serviceId }: UsersProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [adminStatuses, setAdminStatuses] = useState<Record<string, AdminStatus>>({});
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData(1);
  }, [serviceId]);

  const loadData = async (page: number) => {
    setLoading(true);
    try {
      const response = await usersApi.list(page, 50, serviceId);
      setUsers(response.data.users);
      setPagination(response.data.pagination);

      // Load admin status for each user
      const statuses: Record<string, AdminStatus> = {};
      await Promise.all(
        response.data.users.map(async (user: UserData) => {
          try {
            const statusResponse = await usersApi.getAdminStatus(user.id);
            statuses[user.id] = statusResponse.data;
          } catch {
            statuses[user.id] = { isAdmin: false, adminRole: null, isDeveloper: false, canModify: true };
          }
        })
      );
      setAdminStatuses(statuses);

      // Load service info if serviceId is provided
      if (serviceId) {
        const serviceRes = await serviceApi.get(serviceId);
        setServiceInfo(serviceRes.data.service);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredUsers = users.filter(
    (user) =>
      user.loginid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.deptname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (status: AdminStatus | undefined) => {
    if (!status?.isAdmin) return null;

    if (status.isDeveloper) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
          <Crown className="w-3 h-3" />
          개발자
        </span>
      );
    }

    if (status.adminRole === 'SUPER_ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          <ShieldCheck className="w-3 h-3" />
          슈퍼관리자
        </span>
      );
    }

    if (status.adminRole === 'SERVICE_ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
          <Shield className="w-3 h-3" />
          서비스관리자
        </span>
      );
    }

    if (status.adminRole === 'VIEWER') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
          <Shield className="w-3 h-3" />
          뷰어
        </span>
      );
    }

    if (status.adminRole === 'SERVICE_VIEWER') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700 rounded-full">
          <Shield className="w-3 h-3" />
          서비스뷰어
        </span>
      );
    }

    return null;
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-samsung-blue"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Service Info Banner */}
      {serviceInfo && (
        <div className="bg-gradient-to-r from-samsung-blue to-blue-600 rounded-2xl p-6 text-white mb-8">
          <h1 className="text-2xl font-bold">{serviceInfo.displayName} - 사용자 관리</h1>
          <p className="text-blue-200 text-sm mt-1">서비스 ID: {serviceInfo.name}</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
        <p className="text-gray-500 mt-1">
          {serviceInfo ? `${serviceInfo.displayName} 서비스의 사용자 목록` : '등록된 사용자 목록 및 권한 관리'}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, ID, 부서로 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  부서
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  권한
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  마지막 활동
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  요청 수
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const status = adminStatuses[user.id];

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-samsung-blue/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-samsung-blue" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{decodeUsername(user.username)}</p>
                          <p className="text-sm text-gray-500">{user.loginid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{decodeUsername(user.deptname)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(status) || (
                        <span className="text-sm text-gray-400">일반 사용자</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{formatDate(user.lastActive)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{user._count.usageLogs.toLocaleString()}</p>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {(pagination.page - 1) * pagination.limit + 1} -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} / 총 {pagination.total}명
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadData(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
