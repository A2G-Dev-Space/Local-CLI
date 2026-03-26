import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Play,
  Square,
  Trash2,
  ExternalLink,
  MessageSquare,
  Clock,
  Bot,
  Cpu,
  Sparkles,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS, type Locale } from 'date-fns/locale';
import { useSessionStore, type Session } from '@/stores/session.store';
import { toast } from '@/components/Toast';

const statusAccent: Record<string, string> = {
  RUNNING: 'from-green-400 to-emerald-500',
  STOPPED: 'from-amber-400 to-orange-500',
  CREATING: 'from-blue-400 to-indigo-500',
  DELETED: 'from-red-400 to-rose-500',
};

const statusDot: Record<string, string> = {
  RUNNING: 'bg-green-400',
  STOPPED: 'bg-amber-400',
  CREATING: 'bg-blue-400',
  DELETED: 'bg-red-400',
};

/* ── Skeleton card ─────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-xl p-5">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--bg-tertiary)]" />
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-[var(--bg-tertiary)] animate-pulse" />
        </div>
      </div>
      <div className="h-3 w-2/3 rounded bg-[var(--bg-tertiary)] animate-pulse mb-4" />
      <div className="h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] animate-pulse mb-4" />
      <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
        <div className="h-8 flex-1 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
      </div>
    </div>
  );
}

/* ── Confirm delete modal ──────────────────────────────────── */
function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        className="card p-6 w-full max-w-sm relative z-10"
      >
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost">
            {/* Cancel */}
            <X size={16} className="mr-1.5 inline" />
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger flex items-center gap-1.5">
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Create session modal ──────────────────────────────────── */
function CreateSessionModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-2xl shadow-2xl"
      >
        {/* Gradient header bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-purple-500 to-pink-500" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
              <Sparkles size={20} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('session.new')}</h2>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Session name..."
            className="input mb-5"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-ghost">
              {t('common.cancel')}
            </button>
            <button onClick={handleCreate} disabled={!name.trim()} className="btn-primary">
              <Plus size={16} className="mr-1.5 inline" />
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Session card ──────────────────────────────────────────── */
function SessionCard({
  session,
  locale,
  onOpen,
  onStart,
  onStop,
  onDelete,
}: {
  session: Session;
  locale: Locale;
  onOpen: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const usage = session.status === 'RUNNING' ? 0.3 + Math.random() * 0.5 : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-[var(--accent)]/5 hover:scale-[1.015] hover:border-[var(--accent)]/30">
      {/* Left gradient accent */}
      <div
        className={clsx(
          'absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b',
          statusAccent[session.status] ?? statusAccent.stopped,
        )}
      />

      <div className="p-5 pl-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-[var(--accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {session.name}
            </h3>
            {session.agentName && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                {session.agentName}
              </p>
            )}
          </div>
          {/* Status dot */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                statusDot[session.status] ?? statusDot.stopped,
                session.status === 'RUNNING' && 'animate-pulse',
              )}
            />
            <span className="text-[11px] text-[var(--text-secondary)] capitalize">
              {t(`session.status.${session.status}`)}
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-3">
          <Clock size={12} />
          {formatDistanceToNow(new Date(session.lastActiveAt), {
            addSuffix: true,
            locale,
          })}
        </div>

        {/* Resource bar */}
        {session.status === 'RUNNING' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mb-1">
              <span className="flex items-center gap-1">
                <Cpu size={10} />
                CPU
              </span>
              <span>{Math.round(usage * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${usage * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
          <button
            onClick={onOpen}
            className="btn-ghost text-xs py-1.5 flex items-center gap-1.5 flex-1 justify-center"
          >
            <ExternalLink size={14} />
            {t('session.actions.open')}
          </button>

          {session.status === 'STOPPED' && (
            <button
              onClick={onStart}
              className="btn-ghost text-xs py-1.5 px-2 text-[var(--success)] hover:bg-green-500/10"
              title="Start"
            >
              <Play size={14} />
            </button>
          )}
          {session.status === 'RUNNING' && (
            <button
              onClick={onStop}
              className="btn-ghost text-xs py-1.5 px-2 text-[var(--warning)] hover:bg-amber-500/10"
              title="Stop"
            >
              <Square size={14} />
            </button>
          )}

          <button
            onClick={onDelete}
            className="btn-ghost text-xs py-1.5 px-2 text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-red-500/10"
            title={t('session.actions.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function Sessions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { sessions, isLoading, listSessions, createSession, startSession, stopSession, deleteSession } =
    useSessionStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const locale = i18n.language === 'ko' ? ko : enUS;

  useEffect(() => {
    listSessions();
  }, [listSessions]);

  const handleCreate = useCallback(
    async (name: string) => {
      try {
        const session = await createSession({ name });
        toast.success(t('session.created', 'Session created'));
        navigate(`/chat/${session.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create session');
      }
    },
    [createSession, navigate, t],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteSession(deleteTarget.id);
      toast.success(t('session.deleted', 'Session deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteSession, t]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('session.title')}</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {sessions.length} {t('nav.sessions').toLowerCase()}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          {t('session.new')}
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-24"
        >
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 flex items-center justify-center">
              <MessageSquare size={40} className="text-[var(--accent)]" />
            </div>
            <motion.div
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={14} className="text-[var(--accent)]" />
            </motion.div>
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {t('session.empty')}
          </h3>
          <p className="text-[var(--text-secondary)] mb-8 text-center max-w-md">
            {t('session.emptyDesc')}
          </p>
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            {t('session.new')}
          </button>
        </motion.div>
      )}

      {/* Session grid */}
      {!isLoading && sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Create new card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setModalOpen(true)}
            className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/50 bg-[var(--bg-secondary)]/30 backdrop-blur-xl transition-all duration-300 flex flex-col items-center justify-center min-h-[200px] hover:shadow-lg hover:shadow-[var(--accent)]/5"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus size={24} className="text-[var(--accent)]" />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
              {t('session.new')}
            </span>
          </motion.button>

          <AnimatePresence mode="popLayout">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                layout
              >
                <SessionCard
                  session={session}
                  locale={locale}
                  onOpen={() => navigate(`/chat/${session.id}`)}
                  onStart={() => startSession(session.id)}
                  onStop={() => stopSession(session.id)}
                  onDelete={() => setDeleteTarget(session)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('session.deleteConfirm', 'Delete session?')}
        message={`"${deleteTarget?.name ?? ''}" will be permanently deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
