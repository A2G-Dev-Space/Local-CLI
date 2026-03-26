import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Search,
  MessageSquare,
  Bot,
  Store,
  Shield,
  Users,
  MonitorDot,
  HardDrive,
  AlertTriangle,
  Settings,
  Sun,
  Moon,
  Plus,
  ArrowRight,
  Command,
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '@/stores/theme.store';
import { useAuthStore } from '@/stores/auth.store';

interface CommandItem {
  id: string;
  label: string;
  icon: typeof Search;
  section: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      { id: 'sessions', label: t('nav.sessions'), icon: MessageSquare, section: 'Navigation', action: () => go('/sessions') },
      { id: 'agents', label: t('nav.agents'), icon: Bot, section: 'Navigation', action: () => go('/agents/new') },
      { id: 'marketplace', label: t('nav.marketplace'), icon: Store, section: 'Navigation', action: () => go('/marketplace') },
      { id: 'new-session', label: 'New Workspace', icon: Plus, section: 'Actions', shortcut: 'N', action: () => go('/sessions') },
      { id: 'toggle-theme', label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', icon: theme === 'dark' ? Sun : Moon, section: 'Actions', shortcut: 'T', action: () => { toggleTheme(); setOpen(false); } },
    ];

    if (isAdmin) {
      items.push(
        { id: 'admin-dashboard', label: t('nav.dashboard'), icon: Shield, section: 'Admin', action: () => go('/admin') },
        { id: 'admin-users', label: t('nav.users'), icon: Users, section: 'Admin', action: () => go('/admin/users') },
        { id: 'admin-sessions', label: t('nav.allSessions'), icon: MonitorDot, section: 'Admin', action: () => go('/admin/sessions') },
        { id: 'admin-resources', label: t('nav.resources'), icon: HardDrive, section: 'Admin', action: () => go('/admin/resources') },
        { id: 'admin-errors', label: t('nav.errors'), icon: AlertTriangle, section: 'Admin', action: () => go('/admin/errors') },
        { id: 'admin-settings', label: t('nav.settings'), icon: Settings, section: 'Admin', action: () => go('/admin/settings') },
      );
    }

    return items;
  }, [t, theme, isAdmin, go, toggleTheme]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const sections = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((c) => {
      if (!map.has(c.section)) map.set(c.section, []);
      map.get(c.section)!.push(c);
    });
    return map;
  }, [filtered]);

  // Keyboard: open with cmd+k
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="flex justify-center pt-[20vh]">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg mx-4 rounded-2xl border border-[var(--glass-border)] shadow-elevation-4 overflow-hidden"
          style={{ background: 'var(--bg-secondary)', backdropFilter: 'blur(24px)' }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--glass-border)]">
            <Search size={18} className="text-[var(--text-tertiary)] flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none text-sm"
            />
            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-tertiary)] font-mono ring-1 ring-[var(--border)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2 scrollbar-hidden">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">No results found</p>
              </div>
            )}

            {[...sections.entries()].map(([section, items]) => (
              <div key={section}>
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.1em]">
                    {section}
                  </span>
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-[var(--accent)]/8 text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                      )}
                    >
                      <Icon size={16} className={isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'} />
                      <span className="flex-1 text-sm">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-tertiary)] font-mono ring-1 ring-[var(--border)]">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && <ArrowRight size={13} className="text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--glass-border)] text-[10px] text-[var(--text-tertiary)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] ring-1 ring-[var(--border)]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] ring-1 ring-[var(--border)]">↵</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command size={10} />
              K to toggle
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
