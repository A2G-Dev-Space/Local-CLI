/**
 * Command Palette Component
 * VS Code-style command palette with search and keyboard navigation
 * Opens with Ctrl+Shift+P or F1
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HelpCircle,
  RefreshCcw,
  Settings,
  Cpu,
  Wrench,
  BarChart2,
  BookOpen,
  LogOut,
  FolderOpen,
  Archive,
  Search,
  History,
  Command,
  type LucideIcon,
} from 'lucide-react';
import './CommandPalette.css';

// Command definition interface
export interface CommandItem {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  icon: LucideIcon;
  category: 'general' | 'file' | 'git' | 'tools' | 'navigation';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  recentCommands?: string[];
  onCommandExecute?: (commandId: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  recentCommands = [],
  onCommandExecute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show recent commands first if no search query
      const recent = recentCommands
        .map(id => commands.find(cmd => cmd.id === id))
        .filter((cmd): cmd is CommandItem => cmd !== undefined);
      const others = commands.filter(cmd => !recentCommands.includes(cmd.id));
      return [...recent, ...others];
    }

    const query = searchQuery.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query)
    );
  }, [commands, searchQuery, recentCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      // Focus input after a short delay for animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex(prev =>
              prev > 0 ? prev - 1 : filteredCommands.length - 1
            );
          } else {
            setSelectedIndex(prev =>
              prev < filteredCommands.length - 1 ? prev + 1 : 0
            );
          }
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Execute selected command
  const executeCommand = useCallback(
    (command: CommandItem) => {
      onCommandExecute?.(command.id);
      command.action();
      onClose();
    },
    [onCommandExecute, onClose]
  );

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className="command-palette">
        {/* Search Input */}
        <div className="command-palette-header">
          <Command size={16} className="command-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={
              filteredCommands[selectedIndex]
                ? `command-${filteredCommands[selectedIndex].id}`
                : undefined
            }
          />
          <kbd className="shortcut-hint">Esc</kbd>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          id="command-list"
          className="command-palette-list"
          role="listbox"
          aria-label="Commands"
        >
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              <Search size={24} />
              <p>No commands found</p>
            </div>
          ) : (
            <>
              {/* Show "Recent" label if there are recent commands and no search */}
              {!searchQuery && recentCommands.length > 0 && (
                <div className="command-palette-section">
                  <History size={12} />
                  <span>Recently Used</span>
                </div>
              )}
              {filteredCommands.map((command, index) => {
                const Icon = command.icon;
                const isRecent = !searchQuery && recentCommands.includes(command.id);
                const showDivider =
                  !searchQuery &&
                  index === recentCommands.filter(id =>
                    commands.some(c => c.id === id)
                  ).length &&
                  recentCommands.length > 0;

                return (
                  <React.Fragment key={command.id}>
                    {showDivider && (
                      <div className="command-palette-section">
                        <Command size={12} />
                        <span>All Commands</span>
                      </div>
                    )}
                    <button
                      id={`command-${command.id}`}
                      className={`command-palette-item ${
                        index === selectedIndex ? 'selected' : ''
                      } ${isRecent ? 'recent' : ''}`}
                      onClick={() => executeCommand(command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <Icon size={18} className="command-item-icon" aria-hidden="true" />
                      <div className="command-item-content">
                        <span className="command-item-name">{command.name}</span>
                        <span className="command-item-description">
                          {command.description}
                        </span>
                      </div>
                      {command.shortcut && (
                        <kbd className="command-item-shortcut">{command.shortcut}</kbd>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>Enter</kbd> to select
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};

// Default slash commands mapped to UI commands
export const createDefaultCommands = (handlers: {
  onHelp: () => void;
  onClear: () => void;
  onSettings: () => void;
  onModel: () => void;
  onTool: () => void;
  onUsage: () => void;
  onDocs: () => void;
  onLoad: () => void;
  onCompact: () => void;
  onExit: () => void;
}): CommandItem[] => [
  {
    id: 'help',
    name: 'Help',
    description: 'Show available commands and shortcuts',
    shortcut: 'F1',
    icon: HelpCircle,
    category: 'general',
    action: handlers.onHelp,
  },
  {
    id: 'clear',
    name: 'Clear Conversation',
    description: 'Clear all messages and TODOs',
    shortcut: 'Ctrl+L',
    icon: RefreshCcw,
    category: 'general',
    action: handlers.onClear,
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Open settings menu',
    shortcut: 'Ctrl+,',
    icon: Settings,
    category: 'general',
    action: handlers.onSettings,
  },
  {
    id: 'model',
    name: 'Switch Model',
    description: 'Change LLM model',
    shortcut: 'Ctrl+M',
    icon: Cpu,
    category: 'tools',
    action: handlers.onModel,
  },
  {
    id: 'tool',
    name: 'Tool Settings',
    description: 'Enable/disable optional tools',
    shortcut: 'Ctrl+T',
    icon: Wrench,
    category: 'tools',
    action: handlers.onTool,
  },
  {
    id: 'usage',
    name: 'Token Usage',
    description: 'Show token usage statistics',
    icon: BarChart2,
    category: 'general',
    action: handlers.onUsage,
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Manage documentation',
    icon: BookOpen,
    category: 'general',
    action: handlers.onDocs,
  },
  {
    id: 'load',
    name: 'Load Session',
    description: 'Load a saved session',
    shortcut: 'Ctrl+O',
    icon: FolderOpen,
    category: 'file',
    action: handlers.onLoad,
  },
  {
    id: 'compact',
    name: 'Compact Conversation',
    description: 'Compress conversation to free up context',
    icon: Archive,
    category: 'general',
    action: handlers.onCompact,
  },
  {
    id: 'exit',
    name: 'Exit',
    description: 'Exit the application',
    shortcut: 'Ctrl+Q',
    icon: LogOut,
    category: 'general',
    action: handlers.onExit,
  },
];

export default CommandPalette;
