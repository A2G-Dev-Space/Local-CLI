import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, XCircle, Loader2, Sparkles, Zap } from 'lucide-react';
import clsx from 'clsx';

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface TodoPanelProps {
  todos: TodoItem[];
}

const statusConfig = {
  pending: {
    icon: Circle,
    color: 'text-[var(--text-tertiary)]',
    bg: '',
    ring: '',
    line: 'bg-[var(--bg-tertiary)]',
    dotColor: 'bg-[var(--text-tertiary)]/40',
  },
  in_progress: {
    icon: Loader2,
    color: 'text-[var(--accent)]',
    bg: 'bg-[var(--accent)]/[0.04]',
    ring: 'ring-1 ring-[var(--accent)]/15',
    line: 'bg-[var(--accent)]',
    dotColor: 'bg-[var(--accent)]',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: '',
    ring: '',
    line: 'bg-emerald-500',
    dotColor: 'bg-emerald-400',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/[0.03]',
    ring: 'ring-1 ring-red-500/15',
    line: 'bg-red-500',
    dotColor: 'bg-red-400',
  },
};

export default function TodoPanel({ todos }: TodoPanelProps) {
  const { t } = useTranslation();

  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === 'completed').length;
  const failed = todos.filter((t) => t.status === 'failed').length;
  const inProgress = todos.filter((t) => t.status === 'in_progress').length;
  const progress = todos.length > 0 ? ((completed + failed) / todos.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header with animated progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--accent)]" />
          <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            {t('todo.title')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {inProgress > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-[10px] text-[var(--accent)] bg-[var(--accent)]/8 px-2 py-0.5 rounded-full"
            >
              <Zap size={9} />
              <span className="font-medium">{inProgress} active</span>
            </motion.div>
          )}
          <span className="text-xs font-mono text-[var(--text-tertiary)] tabular-nums">
            {completed}/{todos.length}
          </span>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-1 h-1.5">
        {todos.map((todo, i) => {
          const cfg = statusConfig[todo.status];
          return (
            <motion.div
              key={todo.id}
              className="flex-1 rounded-full overflow-hidden bg-[var(--bg-tertiary)]/60"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
            >
              <motion.div
                className={clsx('h-full rounded-full', cfg.line)}
                initial={{ width: '0%' }}
                animate={{
                  width: todo.status === 'pending' ? '0%' : todo.status === 'in_progress' ? '50%' : '100%',
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Percentage display */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-baseline gap-1">
          <motion.span
            key={Math.round(progress)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-[var(--text-primary)] tabular-nums"
          >
            {Math.round(progress)}
          </motion.span>
          <span className="text-xs text-[var(--text-tertiary)]">%</span>
        </div>
        <div className="flex gap-3 text-[10px] text-[var(--text-tertiary)]">
          {completed > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {completed} done
            </span>
          )}
          {failed > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Todo items with timeline */}
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-[var(--accent)]/30 to-transparent" />

        <div className="space-y-0.5">
          <AnimatePresence>
            {todos.map((todo, index) => {
              const cfg = statusConfig[todo.status];
              const Icon = cfg.icon;
              const isActive = todo.status === 'in_progress';
              return (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={clsx(
                    'relative flex items-start gap-3 px-2.5 py-2 rounded-xl transition-all duration-200',
                    cfg.bg, cfg.ring,
                    isActive && 'shadow-glow-sm',
                  )}
                >
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    {isActive ? (
                      <div className="relative">
                        <motion.div
                          className="absolute inset-0 rounded-full bg-[var(--accent)]/30"
                          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <Icon
                          size={14}
                          className={clsx(cfg.color, 'animate-spin')}
                        />
                      </div>
                    ) : (
                      <Icon size={14} className={cfg.color} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={clsx(
                        'text-[13px] leading-snug',
                        todo.status === 'completed' && 'line-through text-[var(--text-tertiary)] opacity-50',
                        isActive && 'text-[var(--text-primary)] font-medium',
                        todo.status === 'pending' && 'text-[var(--text-secondary)]',
                        todo.status === 'failed' && 'text-red-300/80',
                      )}
                    >
                      {todo.title}
                    </span>
                  </div>

                  {/* Step number */}
                  <span className="text-[9px] font-mono text-[var(--text-tertiary)]/50 flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
