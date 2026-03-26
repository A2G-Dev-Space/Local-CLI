import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Square,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

interface AdminSession {
  id: string;
  name: string;
  userName: string;
  status: 'running' | 'stopped' | 'creating' | 'error';
  agentName?: string;
  createdAt: string;
  lastActiveAt: string;
}

interface SessionEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function EventTimeline({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SessionEvent[]>([]);

  useEffect(() => {
    api
      .get<SessionEvent[]>(`/api/admin/sessions/${sessionId}/events`)
      .then(setEvents)
      .catch(() => {});
  }, [sessionId]);

  const typeIcons: Record<string, typeof Terminal> = {
    tool_call: Terminal,
    tool_result: Terminal,
    planning: Bot,
    error: AlertCircle,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-6 w-full max-w-2xl relative z-10 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t('admin.sessions.viewEvents')}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              {t('common.noData')}
            </p>
          ) : (
            events.map((event) => {
              const Icon = typeIcons[event.type] || Terminal;
              return (
                <div
                  key={event.seq}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[var(--text-secondary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--accent)]">{event.type}</span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        #{event.seq}
                      </span>
                    </div>
                    <pre className="text-xs text-[var(--text-secondary)] mt-1 overflow-x-auto">
                      {JSON.stringify(event.data, null, 2).slice(0, 500)}
                    </pre>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminSessions() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewingEvents, setViewingEvents] = useState<string | null>(null);
  const perPage = 20;

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
        const res = await api.get<{ sessions: AdminSession[]; total: number }>(
          `/api/admin/sessions?page=${page}&limit=${perPage}&search=${searchQuery}${statusParam}`,
        );
        setSessions(res.sessions);
        setTotal(res.total);
      } catch {
        /* error */
      }
    };
    fetchSessions();
  }, [page, searchQuery, statusFilter]);

  const handleForceStop = async (id: string) => {
    try {
      await api.post(`/api/admin/sessions/${id}/stop`);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'stopped' } : s)),
      );
      toast.success('Session stopped');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop session');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.sessions.confirmDelete', 'Are you sure you want to delete this session?'))) return;
    try {
      await api.delete(`/api/admin/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const statusColors: Record<string, string> = {
    running: 'bg-green-500/15 text-green-400',
    stopped: 'bg-yellow-500/15 text-yellow-400',
    creating: 'bg-blue-500/15 text-blue-400',
    error: 'bg-red-500/15 text-red-400',
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {t('admin.sessions.title')}
      </h1>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative max-w-md flex-1">
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
        <div className="flex items-center gap-2">
          {['all', 'running', 'stopped', 'creating', 'error'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                statusFilter === status
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
              )}
            >
              {status === 'all'
                ? t('marketplace.all')
                : t(`session.status.${status}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Session
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.sessions.user')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.sessions.status')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.sessions.agent')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('admin.sessions.lastActive')}
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
                >
                  <td className="px-5 py-3 text-sm font-medium text-[var(--text-primary)]">
                    {session.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                    {session.userName}
                  </td>
                  <td className="px-5 py-3">
                    <span className={clsx('badge', statusColors[session.status])}>
                      {t(`session.status.${session.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                    {session.agentName || '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                    {formatDistanceToNow(new Date(session.lastActiveAt), {
                      addSuffix: true,
                      locale,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewingEvents(session.id)}
                        className="btn-ghost p-1.5"
                        title={t('admin.sessions.viewEvents')}
                      >
                        <Eye size={14} />
                      </button>
                      {session.status === 'running' && (
                        <button
                          onClick={() => handleForceStop(session.id)}
                          className="btn-ghost p-1.5 text-[var(--warning)]"
                          title={t('admin.sessions.forceStop')}
                        >
                          <Square size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="btn-ghost p-1.5 text-[var(--error)]"
                        title={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[var(--text-secondary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">{total} sessions</span>
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
      </div>

      {/* Event viewer modal */}
      <AnimatePresence>
        {viewingEvents && (
          <EventTimeline sessionId={viewingEvents} onClose={() => setViewingEvents(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
