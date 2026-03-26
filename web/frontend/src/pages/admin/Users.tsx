import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Shield, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  sessionCount: number;
  maxSessions: number;
  lastActiveAt: string;
}

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get<{ users: UserData[]; total: number }>(
          `/api/admin/users?page=${page}&limit=${perPage}&search=${searchQuery}`,
        );
        setUsers(res.users);
        setTotal(res.total);
      } catch {
        /* error */
      }
    };
    fetchUsers();
  }, [page, searchQuery]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await api.patch(`/api/admin/users/${userId}`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('admin.users.title')}</h1>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
        />
        <input
          className="input pl-10"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.search')}
        />
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.name')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.email')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.role')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.sessions')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.lastActive')}
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.users.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
                        {user.role === 'admin' ? (
                          <Shield size={14} className="text-[var(--accent)]" />
                        ) : (
                          <User size={14} className="text-[var(--text-secondary)]" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">{user.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={clsx(
                        'badge',
                        user.role === 'admin'
                          ? 'bg-purple-500/15 text-purple-400'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
                      )}
                    >
                      {t(`admin.users.${user.role}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                    {user.sessionCount} / {user.maxSessions}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                    {user.lastActiveAt
                      ? formatDistanceToNow(new Date(user.lastActiveAt), {
                          addSuffix: true,
                          locale,
                        })
                      : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() =>
                        handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')
                      }
                      className="btn-ghost text-xs"
                    >
                      {t('admin.users.editRole')}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[var(--text-secondary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">
              {total} {t('admin.users.title').toLowerCase()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-1.5"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-[var(--text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-1.5"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
