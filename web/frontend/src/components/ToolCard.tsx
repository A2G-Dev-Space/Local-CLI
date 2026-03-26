import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Terminal,
  FileText,
  FolderOpen,
  Search,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import type { WSEvent } from '@/lib/websocket';

interface ToolCardProps {
  event: WSEvent;
}

const toolIcons: Record<string, typeof Terminal> = {
  bash: Terminal,
  read_file: FileText,
  create_file: FileText,
  edit_file: FileText,
  list_directory: FolderOpen,
  search_files: Search,
  web_search: Globe,
};

export default function ToolCard({ event }: ToolCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const p = event.payload || {};
  const toolName = (p.tool as string) || (p.name as string) || 'tool';
  const args = p.args as Record<string, unknown> | undefined;
  const result = p.result as string | undefined;
  const duration = p.duration as number | undefined;
  const success = p.success !== false;

  const Icon = toolIcons[toolName] || Terminal;

  return (
    <div
      className={clsx(
        'border rounded-xl overflow-hidden transition-colors',
        success
          ? 'border-[var(--border)] bg-[var(--bg-secondary)]'
          : 'border-red-500/30 bg-red-500/5',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
      >
        <div
          className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            success ? 'bg-[var(--accent)]/15' : 'bg-red-500/15',
          )}
        >
          <Icon size={14} className={success ? 'text-[var(--accent)]' : 'text-red-400'} />
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
            {toolName}
          </span>
          {args?.command != null && (
            <span className="text-xs text-[var(--text-secondary)] truncate font-mono">
              {String(args.command as string).slice(0, 60)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {duration !== undefined && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Clock size={12} />
              {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
            </span>
          )}
          {success ? (
            <CheckCircle2 size={14} className="text-[var(--success)]" />
          ) : (
            <XCircle size={14} className="text-[var(--error)]" />
          )}
          <ChevronDown
            size={14}
            className={clsx(
              'text-[var(--text-secondary)] transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-[var(--border)]">
              {args && (
                <div className="pt-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    {t('chat.args')}
                  </span>
                  <pre className="mt-1.5 text-xs bg-[var(--bg-primary)] p-3 rounded-lg overflow-x-auto text-[var(--text-primary)] font-mono">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              {result !== undefined && (
                <div>
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    {t('chat.result')}
                  </span>
                  <pre className="mt-1.5 text-xs bg-[var(--bg-primary)] p-3 rounded-lg overflow-x-auto text-[var(--text-primary)] font-mono max-h-60 overflow-y-auto">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
