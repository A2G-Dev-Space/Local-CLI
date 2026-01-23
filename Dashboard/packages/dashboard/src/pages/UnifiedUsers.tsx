import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, ChevronDown, Shield, Clock, Activity, Users, Building2, X, GripVertical } from 'lucide-react';
import { unifiedUsersApi, serviceApi } from '../services/api';

interface ServiceStat {
  serviceId: string;
  serviceName: string;
  firstSeen: string;
  lastActive: string;
  requestCount: number;
}

interface ServicePermission {
  serviceId: string;
  serviceName: string;
  role: string;
}

interface UnifiedUser {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
  businessUnit: string | null;
  globalRole: string | null;
  isEnvDeveloper: boolean;
  servicePermissions: ServicePermission[];
  serviceStats: ServiceStat[];
  totalRequests: number;
  firstSeen: string;
  lastActive: string;
}

interface FilterOptions {
  services: { id: string; name: string; displayName: string }[];
  businessUnits: string[];
  deptnames: string[];
  roles: string[];
}

interface Service {
  id: string;
  name: string;
  displayName: string;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
  SERVICE_ADMIN: 'bg-orange-100 text-orange-700 border-orange-200',
  VIEWER: 'bg-blue-100 text-blue-700 border-blue-200',
  SERVICE_VIEWER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  USER: 'bg-gray-100 text-gray-600 border-gray-200',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: '슈퍼관리자',
  SERVICE_ADMIN: '서비스관리자',
  VIEWER: '뷰어',
  SERVICE_VIEWER: '서비스뷰어',
  USER: '일반사용자',
};

export default function UnifiedUsers() {
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [businessUnitFilter, setBusinessUnitFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Permission edit modal
  const [editingUser, setEditingUser] = useState<UnifiedUser | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editServicePermissions, setEditServicePermissions] = useState<{ serviceId: string; role: string }[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);

  // Column resize state
  const [columnWidths, setColumnWidths] = useState({
    user: 180,
    dept: 160,
    role: 200,
    activity: 220,
    requests: 150,
    manage: 100,
  });
  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Expanded rows for service details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUsers();
    loadServices();
  }, [pagination.page, serviceFilter, businessUnitFilter, roleFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        loadUsers();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await unifiedUsersApi.list({
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        serviceId: serviceFilter || undefined,
        businessUnit: businessUnitFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(res.data.users);
      setPagination(prev => ({ ...prev, ...res.data.pagination }));
      setFilterOptions(res.data.filterOptions);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const res = await serviceApi.list();
      setServices(res.data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const openEditModal = (user: UnifiedUser) => {
    setEditingUser(user);
    setEditRole(user.globalRole || '');
    setEditServicePermissions(
      user.servicePermissions.map(sp => ({ serviceId: sp.serviceId, role: sp.role }))
    );
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditRole('');
    setEditServicePermissions([]);
  };

  const addServicePermission = () => {
    if (services.length > 0) {
      setEditServicePermissions(prev => [...prev, { serviceId: '', role: 'SERVICE_VIEWER' }]);
    }
  };

  const removeServicePermission = (index: number) => {
    setEditServicePermissions(prev => prev.filter((_, i) => i !== index));
  };

  const updateServicePermission = (index: number, field: 'serviceId' | 'role', value: string) => {
    setEditServicePermissions(prev =>
      prev.map((sp, i) => (i === index ? { ...sp, [field]: value } : sp))
    );
  };

  const savePermissions = async () => {
    if (!editingUser) return;

    try {
      setSaving(true);
      await unifiedUsersApi.updatePermissions(editingUser.id, {
        globalRole: editRole || undefined,
        servicePermissions: editServicePermissions.filter(sp => sp.serviceId),
      });
      closeEditModal();
      loadUsers();
    } catch (error) {
      console.error('Failed to update permissions:', error);
      alert('권한 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setSearch('');
    setServiceFilter('');
    setBusinessUnitFilter('');
    setRoleFilter('');
  };

  const hasActiveFilters = search || serviceFilter || businessUnitFilter || roleFilter;

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizing(column);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[column as keyof typeof columnWidths];
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - resizeStartX.current;
    const newWidth = Math.max(80, resizeStartWidth.current + diff);
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }));
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const toggleExpanded = (userId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pastel-800">통합 사용자 관리</h1>
          <p className="text-sm text-pastel-500 mt-1">
            전체 서비스의 사용자 권한 및 활동 현황을 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-pastel-600">
          <Users className="w-4 h-4" />
          <span>총 {pagination.total}명</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-pastel-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pastel-400" />
            <input
              type="text"
              placeholder="사용자명, 아이디, 부서 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20 focus:border-samsung-blue"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-samsung-blue text-white border-samsung-blue'
                : 'bg-pastel-50 text-pastel-600 border-pastel-200 hover:bg-pastel-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>필터</span>
            {hasActiveFilters && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded">
                {[serviceFilter, businessUnitFilter, roleFilter].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-pastel-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-pastel-600 mb-1">서비스</label>
              <select
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
                className="w-full px-3 py-2 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20"
              >
                <option value="">전체</option>
                {filterOptions?.services.map(s => (
                  <option key={s.id} value={s.id}>{s.displayName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-pastel-600 mb-1">사업부</label>
              <select
                value={businessUnitFilter}
                onChange={e => setBusinessUnitFilter(e.target.value)}
                className="w-full px-3 py-2 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20"
              >
                <option value="">전체</option>
                {filterOptions?.businessUnits.map(bu => (
                  <option key={bu} value={bu}>{bu}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-pastel-600 mb-1">권한</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20"
              >
                <option value="">전체</option>
                {filterOptions?.roles.map(r => (
                  <option key={r} value={r}>{roleLabels[r] || r}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="sm:col-span-3">
                <button
                  onClick={clearFilters}
                  className="text-sm text-pastel-500 hover:text-pastel-700"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-pastel-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed" style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
            <thead>
              <tr className="bg-pastel-50 border-b border-pastel-200">
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider relative select-none"
                  style={{ width: columnWidths.user }}
                >
                  사용자
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-pastel-200"
                    onMouseDown={(e) => handleResizeStart(e, 'user')}
                  >
                    <GripVertical className="w-3 h-3 text-pastel-400" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider relative select-none"
                  style={{ width: columnWidths.dept }}
                >
                  부서/사업부
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-pastel-200"
                    onMouseDown={(e) => handleResizeStart(e, 'dept')}
                  >
                    <GripVertical className="w-3 h-3 text-pastel-400" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider relative select-none"
                  style={{ width: columnWidths.role }}
                >
                  권한
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-pastel-200"
                    onMouseDown={(e) => handleResizeStart(e, 'role')}
                  >
                    <GripVertical className="w-3 h-3 text-pastel-400" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider relative select-none"
                  style={{ width: columnWidths.activity }}
                >
                  활동
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-pastel-200"
                    onMouseDown={(e) => handleResizeStart(e, 'activity')}
                  >
                    <GripVertical className="w-3 h-3 text-pastel-400" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider relative select-none"
                  style={{ width: columnWidths.requests }}
                >
                  요청수
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-pastel-200"
                    onMouseDown={(e) => handleResizeStart(e, 'requests')}
                  >
                    <GripVertical className="w-3 h-3 text-pastel-400" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider"
                  style={{ width: columnWidths.manage }}
                >
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pastel-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-pastel-500">
                    <div className="w-8 h-8 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-2">로딩 중...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-pastel-500">
                    검색 결과가 없습니다
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-pastel-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-pastel-800">{user.username}</p>
                        <p className="text-sm text-pastel-500">{user.loginid}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-pastel-400" />
                        <div>
                          <p className="text-sm text-pastel-700">{user.deptname || '-'}</p>
                          {user.businessUnit && (
                            <p className="text-xs text-pastel-500">{user.businessUnit}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.globalRole ? (
                          <>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${roleColors[user.globalRole]}`}>
                              <Shield className="w-3 h-3" />
                              {roleLabels[user.globalRole]}
                              {user.isEnvDeveloper && ' (ENV)'}
                            </span>
                            {/* SERVICE_ADMIN/SERVICE_VIEWER의 경우 서비스 목록 표시 */}
                            {(user.globalRole === 'SERVICE_ADMIN' || user.globalRole === 'SERVICE_VIEWER') && user.servicePermissions.length > 0 && (
                              <div className="w-full mt-1 flex flex-wrap gap-1">
                                {user.servicePermissions.map(sp => (
                                  <span key={sp.serviceId} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${
                                    sp.role === 'SERVICE_ADMIN' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-cyan-50 text-cyan-600 border-cyan-200'
                                  }`}>
                                    {sp.serviceName}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* SERVICE_ADMIN/SERVICE_VIEWER인데 서비스가 없으면 경고 표시 */}
                            {(user.globalRole === 'SERVICE_ADMIN' || user.globalRole === 'SERVICE_VIEWER') && user.servicePermissions.length === 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-50 text-yellow-600 rounded border border-yellow-200">
                                ⚠️ 서비스 미지정
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${roleColors.USER}`}>
                            {roleLabels.USER}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-pastel-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span>최근: {formatDateTime(user.lastActive)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-pastel-500">
                          <Activity className="w-3.5 h-3.5" />
                          <span>가입: {formatDate(user.firstSeen)}</span>
                        </div>
                        {user.serviceStats.length > 1 && (
                          <button
                            onClick={() => toggleExpanded(user.id)}
                            className="text-xs text-samsung-blue hover:underline mt-1"
                          >
                            {expandedRows.has(user.id) ? '접기 ▲' : `서비스별 보기 (${user.serviceStats.length}) ▼`}
                          </button>
                        )}
                        {expandedRows.has(user.id) && (
                          <div className="mt-2 pt-2 border-t border-pastel-100 space-y-1.5">
                            {user.serviceStats.map(ss => (
                              <div key={ss.serviceId} className="text-xs bg-pastel-50 p-2 rounded">
                                <p className="font-medium text-pastel-700">{ss.serviceName}</p>
                                <p className="text-pastel-500">가입: {formatDate(ss.firstSeen)}</p>
                                <p className="text-pastel-500">최근: {formatDateTime(ss.lastActive)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-pastel-700">
                        {user.totalRequests.toLocaleString()}회
                      </div>
                      {/* 서비스별 요청 수 항상 표시 */}
                      {user.serviceStats.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {user.serviceStats.map(ss => (
                            <div key={ss.serviceId} className="text-xs text-pastel-500 flex justify-between items-center gap-2">
                              <span className="truncate">{ss.serviceName}</span>
                              <span className="font-medium text-pastel-600 whitespace-nowrap">{ss.requestCount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {user.serviceStats.length === 0 && (
                        <div className="text-xs text-pastel-400 mt-1">-</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!user.isEnvDeveloper && (
                        <button
                          onClick={() => openEditModal(user)}
                          className="px-3 py-1.5 text-sm bg-pastel-100 text-pastel-600 hover:bg-pastel-200 rounded-lg transition-colors"
                        >
                          권한 변경
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-pastel-100 flex items-center justify-between">
            <p className="text-sm text-pastel-500">
              {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm bg-pastel-100 text-pastel-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pastel-200 transition-colors"
              >
                이전
              </button>
              <span className="px-3 py-1.5 text-sm text-pastel-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm bg-pastel-100 text-pastel-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pastel-200 transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Permission Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-pastel-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-pastel-800">권한 변경</h2>
                <p className="text-sm text-pastel-500">{editingUser.username} ({editingUser.loginid})</p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 text-pastel-400 hover:text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Global Role */}
              <div>
                <label className="block text-sm font-medium text-pastel-700 mb-2">
                  전역 권한
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20"
                >
                  <option value="">권한 없음 (일반 사용자)</option>
                  <option value="SUPER_ADMIN">슈퍼관리자 (모든 서비스)</option>
                  <option value="SERVICE_ADMIN">서비스관리자 (특정 서비스)</option>
                  <option value="VIEWER">뷰어 (모든 서비스 읽기)</option>
                  <option value="SERVICE_VIEWER">서비스뷰어 (특정 서비스 읽기)</option>
                </select>
                <p className="mt-1 text-xs text-pastel-500">
                  SERVICE_ADMIN, SERVICE_VIEWER는 아래에서 서비스별 권한을 설정해야 합니다
                </p>
              </div>

              {/* Service-specific Permissions */}
              {(editRole === 'SERVICE_ADMIN' || editRole === 'SERVICE_VIEWER' || editRole === '') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-pastel-700">
                      서비스별 권한
                    </label>
                    <button
                      onClick={addServicePermission}
                      className="text-sm text-samsung-blue hover:underline"
                    >
                      + 추가
                    </button>
                  </div>

                  {editServicePermissions.length === 0 ? (
                    <p className="text-sm text-pastel-500 py-4 text-center bg-pastel-50 rounded-lg">
                      서비스별 권한이 없습니다
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {editServicePermissions.map((sp, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <select
                            value={sp.serviceId}
                            onChange={e => updateServicePermission(index, 'serviceId', e.target.value)}
                            className="flex-1 px-3 py-2 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20 text-sm"
                          >
                            <option value="">서비스 선택</option>
                            {services.map(s => (
                              <option key={s.id} value={s.id}>{s.displayName}</option>
                            ))}
                          </select>
                          <select
                            value={sp.role}
                            onChange={e => updateServicePermission(index, 'role', e.target.value)}
                            className="px-3 py-2 bg-pastel-50 border border-pastel-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-samsung-blue/20 text-sm"
                          >
                            <option value="SERVICE_ADMIN">관리자</option>
                            <option value="SERVICE_VIEWER">뷰어</option>
                          </select>
                          <button
                            onClick={() => removeServicePermission(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-pastel-100 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="px-4 py-2 bg-samsung-blue text-white rounded-lg hover:bg-samsung-blue/90 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
