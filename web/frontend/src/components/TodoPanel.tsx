import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface TodoPanelProps {
  todos: TodoItem[];
}

const statusIcons = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const statusColors = {
  pending: 'text-[var(--text-secondary)]',
  in_progress: 'text-[var(--accent)]',
  completed: 'text-[var(--success)]',
  failed: 'text-[var(--error)]',
};

export default function TodoPanel({ todos }: TodoPanelProps) {
  const { t } = useTranslation();

  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === 'completed').length;
  const failed = todos.filter((t) => t.status === 'failed').length;
  const progress = todos.length > 0 ? ((completed + failed) / todos.length) * 100 : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('todo.title')}</h3>
        <span className="text-xs text-[var(--text-secondary)]">
          {completed}/{todos.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full mb-4 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--success)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Todo items */}
      <div className="space-y-1.5">
        <AnimatePresence>
          {todos.map((todo, index) => {
            const Icon = statusIcons[todo.status];
            return (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={clsx(
                  'flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  todo.status === 'in_progress' && 'bg-[var(--accent)]/5',
                  todo.status === 'completed' && 'opacity-60',
                )}
              >
                <Icon
                  size={16}
                  className={clsx(
                    'flex-shrink-0 mt-0.5',
                    statusColors[todo.status],
                    todo.status === 'in_progress' && 'animate-spin',
                  )}
                />
                <span
                  className={clsx(
                    'text-[var(--text-primary)]',
                    todo.status === 'completed' && 'line-through',
                  )}
                >
                  {todo.title}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
