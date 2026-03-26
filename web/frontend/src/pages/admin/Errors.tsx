import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { api } from '@/lib/api';

interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  userName?: string;
  sessionId?: string;
  stackTrace?: string;
}

const levelConfig = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/15' },
};

export default function AdminErrors() {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 30;

  useEffect(() => {
    const fetchErrors = async () => {
      try {
        const levelParam = levelFilter !== 'all' ? `&level=${levelFilter}` : '';
        const res = await api.get<{ errors: ErrorLog[]; total: number }>(
          `/api/admin/errors?page=${page}&limit=${perPage}&search=${searchQuery}${levelParam}`,
        );
        setErrors(res.errors);
        setTotal(res.total);
      } catch {
        /* error */
      }
    };
    fetchErrors();
  }, [page, searchQuery, levelFilter]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {t('admin.errors.title')}
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
          {['all', 'error', 'warn', 'info'].map((level) => (
            <button
              key={level}
              onClick={() => {
                setLevelFilter(level);
                setPage(1);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                levelFilter === level
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
              )}
            >
              {level === 'all' ? t('marketplace.all') : level.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-premium">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider w-8" />
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                  {t('admin.errors.time')}
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                  {t('admin.errors.level')}
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                  {t('admin.errors.source')}
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                  {t('admin.errors.message')}
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                  {t('admin.errors.user')}
                </th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => {
                const config = levelConfig[err.level];
                const Icon = config.icon;
                const isExpanded = expandedId === err.id;

                return (
                  <motion.tr
                    key={err.id}
                    layout
                    className="border-b border-[var(--border)] transition-all duration-200 hover:bg-[var(--accent-subtle)] cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : err.id)}
                  >
                    <td className="px-5 py-3">
                      <ChevronDown
                        size={14}
                        className={clsx(
                          'text-[var(--text-secondary)] transition-transform',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap font-mono">
                      {format(new Date(err.timestamp), 'MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('badge', config.bg, config.color)}>
                        <Icon size={12} className="mr-1" />
                        {err.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--text-secondary)] font-mono">
                      {err.source}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--text-primary)] max-w-md truncate">
                      {err.message}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                      {err.userName || '-'}
                    </td>
                  </motion.tr>
                );
              })}
              {errors.length === 0 && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className={clsx('h-4 rounded-lg shimmer', j === 0 ? 'w-6' : j === 4 ? 'w-48' : 'w-20')} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Stack trace panel */}
        <AnimatePresence>
          {expandedId && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[var(--border)] overflow-hidden"
            >
              {(() => {
                const err = errors.find((e) => e.id === expandedId);
                if (!err) return null;
                return (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                        {t('admin.errors.stackTrace')}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(null);
                        }}
                        className="btn-ghost p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-[var(--text-secondary)] mb-3">
                      {err.sessionId && <span>Session: {err.sessionId}</span>}
                    </div>
                    {err.stackTrace ? (
                      <pre className="text-xs font-mono bg-[var(--bg-primary)] p-4 rounded-lg overflow-x-auto max-h-60 overflow-y-auto text-[var(--text-secondary)]">
                        {err.stackTrace}
                      </pre>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)] italic">
                        No stack trace available
                      </p>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">{total} errors</span>
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
    </div>
  );
}
