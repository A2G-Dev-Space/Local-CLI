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
  Pencil,
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
  edit_file: Pencil,
  list_directory: FolderOpen,
  search_files: Search,
  web_search: Globe,
};

const toolColors: Record<string, { icon: string; bg: string; ring: string }> = {
  bash: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  read_file: { icon: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
  create_file: { icon: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
  edit_file: { icon: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
  list_directory: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20' },
  search_files: { icon: 'text-pink-400', bg: 'bg-pink-500/10', ring: 'ring-pink-500/20' },
  web_search: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', ring: 'ring-indigo-500/20' },
};

const defaultColor = { icon: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10', ring: 'ring-[var(--accent)]/20' };

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
  const colors = toolColors[toolName] || defaultColor;
  const errorColors = { icon: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20' };
  const c = success ? colors : errorColors;

  return (
    <div
      className={clsx(
        'group rounded-xl overflow-hidden transition-all duration-200',
        'border border-[var(--glass-border)]',
        success
          ? 'bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)]/80'
          : 'bg-red-500/[0.06] border-red-500/20 hover:border-red-500/30',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
      >
        <div
          className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ring-1',
            c.bg, c.ring,
          )}
        >
          <Icon size={13} className={c.icon} />
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {toolName}
          </span>
          {args?.command != null && (
            <span className="text-[11px] text-[var(--text-tertiary)] truncate font-mono opacity-70">
              {String(args.command as string).slice(0, 60)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {duration !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] tabular-nums">
              <Clock size={10} />
              {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
            </span>
          )}
          {success ? (
            <CheckCircle2 size={13} className="text-emerald-400" />
          ) : (
            <XCircle size={13} className="text-red-400" />
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={13} className="text-[var(--text-tertiary)]" />
          </motion.div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-[var(--glass-border)]">
              {args && (
                <div className="pt-3">
                  <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                    {t('chat.args')}
                  </span>
                  <pre className="mt-1.5 text-xs bg-[var(--bg-primary)]/80 p-3 rounded-lg overflow-x-auto text-[var(--text-secondary)] font-mono leading-relaxed ring-1 ring-[var(--border)]">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              {result !== undefined && (
                <div>
                  <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                    {t('chat.result')}
                  </span>
                  <pre className="mt-1.5 text-xs bg-[var(--bg-primary)]/80 p-3 rounded-lg overflow-x-auto text-[var(--text-secondary)] font-mono max-h-60 overflow-y-auto leading-relaxed ring-1 ring-[var(--border)]">
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
