/**
 * Toolbar Component
 * Main toolbar with icon buttons for frequently used commands
 * Includes tooltips and keyboard shortcut hints
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  RefreshCcw,
  Settings,
  Cpu,
  Wrench,
  BarChart2,
  BookOpen,
  FolderOpen,
  Archive,
  Command,
  Save,
  FilePlus,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Search,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import './Toolbar.css';

export interface ToolbarButton {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  active?: boolean;
  separator?: boolean;
}

interface ToolbarProps {
  onHelp: () => void;
  onClear: () => void;
  onSettings: () => void;
  onModel: () => void;
  onTool: () => void;
  onUsage: () => void;
  onDocs: () => void;
  onLoad: () => void;
  onCompact: () => void;
  onCommandPalette: () => void;
  onOpenFolder?: () => void;
  onNewFile?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onGitCommit?: () => void;
  onGitPush?: () => void;
  onGitPull?: () => void;
  hasUnsavedChanges?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onHelp,
  onClear,
  onSettings,
  onModel,
  onTool,
  onUsage,
  onDocs,
  onLoad,
  onCompact,
  onCommandPalette,
  onOpenFolder,
  onNewFile,
  onSave,
  onSearch,
  onGitCommit,
  onGitPush,
  onGitPull,
  hasUnsavedChanges = false,
}) => {
  const [showMore, setShowMore] = useState(false);

  const mainButtons: ToolbarButton[] = [
    {
      id: 'open-folder',
      icon: FolderOpen,
      label: 'Open Folder',
      shortcut: 'Ctrl+Shift+O',
      action: onOpenFolder || (() => {}),
      disabled: !onOpenFolder,
    },
    { id: 'sep-0', icon: MoreHorizontal, label: '', action: () => {}, separator: true },
    {
      id: 'command-palette',
      icon: Command,
      label: 'Command Palette',
      shortcut: 'Ctrl+Shift+P',
      action: onCommandPalette,
    },
    { id: 'sep-1', icon: MoreHorizontal, label: '', action: () => {}, separator: true },
    {
      id: 'new-file',
      icon: FilePlus,
      label: 'New File',
      shortcut: 'Ctrl+N',
      action: onNewFile || (() => {}),
      disabled: !onNewFile,
    },
    {
      id: 'load-session',
      icon: Archive,
      label: 'Load Session',
      shortcut: 'Ctrl+O',
      action: onLoad,
    },
    {
      id: 'save',
      icon: Save,
      label: 'Save',
      shortcut: 'Ctrl+S',
      action: onSave || (() => {}),
      disabled: !onSave,
      active: hasUnsavedChanges,
    },
    { id: 'sep-2', icon: MoreHorizontal, label: '', action: () => {}, separator: true },
    {
      id: 'search',
      icon: Search,
      label: 'Search',
      shortcut: 'Ctrl+Shift+F',
      action: onSearch || (() => {}),
      disabled: !onSearch,
    },
    { id: 'sep-3', icon: MoreHorizontal, label: '', action: () => {}, separator: true },
    {
      id: 'git-commit',
      icon: GitCommit,
      label: 'Git Commit',
      action: onGitCommit || (() => {}),
      disabled: !onGitCommit,
    },
    {
      id: 'git-push',
      icon: GitBranch,
      label: 'Git Push',
      action: onGitPush || (() => {}),
      disabled: !onGitPush,
    },
    {
      id: 'git-pull',
      icon: GitPullRequest,
      label: 'Git Pull',
      action: onGitPull || (() => {}),
      disabled: !onGitPull,
    },
  ];

  const secondaryButtons: ToolbarButton[] = [
    {
      id: 'model',
      icon: Cpu,
      label: 'Switch Model',
      shortcut: 'Ctrl+M',
      action: onModel,
    },
    {
      id: 'tool',
      icon: Wrench,
      label: 'Tool Settings',
      shortcut: 'Ctrl+T',
      action: onTool,
    },
    {
      id: 'usage',
      icon: BarChart2,
      label: 'Token Usage',
      action: onUsage,
    },
    {
      id: 'docs',
      icon: BookOpen,
      label: 'Documentation',
      action: onDocs,
    },
    {
      id: 'compact',
      icon: Archive,
      label: 'Compact Conversation',
      action: onCompact,
    },
    {
      id: 'clear',
      icon: RefreshCcw,
      label: 'Clear Conversation',
      shortcut: 'Ctrl+L',
      action: onClear,
    },
  ];

  const rightButtons: ToolbarButton[] = [
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      shortcut: 'Ctrl+,',
      action: onSettings,
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Help',
      shortcut: 'F1',
      action: onHelp,
    },
  ];

  const renderButton = (button: ToolbarButton) => {
    if (button.separator) {
      return <div key={button.id} className="toolbar-separator" />;
    }

    const Icon = button.icon;
    return (
      <button
        key={button.id}
        className={`toolbar-button ${button.active ? 'active' : ''} ${button.disabled ? 'disabled' : ''}`}
        onClick={button.action}
        disabled={button.disabled}
        title={button.shortcut ? `${button.label} (${button.shortcut})` : button.label}
        aria-label={button.label}
        aria-disabled={button.disabled}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="toolbar-tooltip">
          {button.label}
          {button.shortcut && <kbd>{button.shortcut}</kbd>}
        </span>
      </button>
    );
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Main Toolbar">
      {/* Main actions */}
      <div className="toolbar-group toolbar-main">
        {mainButtons.map(renderButton)}
      </div>

      {/* Secondary actions (collapsible on smaller screens) */}
      <div className="toolbar-group toolbar-secondary">
        {secondaryButtons.map(renderButton)}
      </div>

      {/* More button for collapsed items */}
      <div className="toolbar-more">
        <button
          className={`toolbar-button toolbar-more-btn ${showMore ? 'active' : ''}`}
          onClick={() => setShowMore(!showMore)}
          aria-expanded={showMore}
          aria-haspopup="menu"
          aria-label="More actions"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
        {showMore && (
          <div className="toolbar-dropdown" role="menu">
            {secondaryButtons.map(button => {
              const Icon = button.icon;
              return (
                <button
                  key={button.id}
                  className="toolbar-dropdown-item"
                  onClick={() => {
                    button.action();
                    setShowMore(false);
                  }}
                  disabled={button.disabled}
                  role="menuitem"
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{button.label}</span>
                  {button.shortcut && <kbd>{button.shortcut}</kbd>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="toolbar-spacer" />

      {/* Right-aligned actions */}
      <div className="toolbar-group toolbar-right">
        {rightButtons.map(renderButton)}
      </div>
    </div>
  );
};

export default Toolbar;
