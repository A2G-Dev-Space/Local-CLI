/**
 * Sidebar Actions Component
 * Quick action panels for file operations, Git, search, and settings
 */

import React, { useState } from 'react';
import {
  // File actions
  FilePlus,
  FolderPlus,
  FolderOpen,
  Save,
  Download,
  Upload,
  RefreshCcw,
  // Git actions
  GitBranch,
  GitCommit,
  GitPullRequest,
  GitMerge,
  History,
  // Search actions
  Search,
  FileSearch,
  FolderSearch,
  Replace,
  // Settings actions
  Settings,
  Palette,
  Keyboard,
  Monitor,
  Database,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import './SidebarActions.css';

interface ActionItem {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ActionGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: ActionItem[];
}

interface SidebarActionsProps {
  activeSection: 'file' | 'git' | 'search' | 'settings';
  // File handlers
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onOpenFile?: () => void;
  onSaveFile?: () => void;
  onSaveAll?: () => void;
  onRefresh?: () => void;
  // Git handlers
  onGitCommit?: () => void;
  onGitPush?: () => void;
  onGitPull?: () => void;
  onGitBranch?: () => void;
  onGitMerge?: () => void;
  onGitHistory?: () => void;
  // Search handlers
  onSearchFiles?: () => void;
  onSearchInFiles?: () => void;
  onSearchReplace?: () => void;
  // Settings handlers
  onOpenSettings?: () => void;
  onThemeSettings?: () => void;
  onKeybindSettings?: () => void;
  onDisplaySettings?: () => void;
  onDataSettings?: () => void;
  onSecuritySettings?: () => void;
  // State
  hasUnsavedChanges?: boolean;
  gitBranch?: string;
  gitChanges?: number;
}

const SidebarActions: React.FC<SidebarActionsProps> = ({
  activeSection,
  onNewFile,
  onNewFolder,
  onOpenFile,
  onSaveFile,
  onSaveAll,
  onRefresh,
  onGitCommit,
  onGitPush,
  onGitPull,
  onGitBranch,
  onGitMerge,
  onGitHistory,
  onSearchFiles,
  onSearchInFiles,
  onSearchReplace,
  onOpenSettings,
  onThemeSettings,
  onKeybindSettings,
  onDisplaySettings,
  onDataSettings,
  onSecuritySettings,
  hasUnsavedChanges = false,
  gitBranch = 'main',
  gitChanges = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  const fileActions: ActionGroup = {
    id: 'file',
    title: 'File Operations',
    icon: FolderOpen,
    items: [
      {
        id: 'new-file',
        icon: FilePlus,
        label: 'New File',
        shortcut: 'Ctrl+N',
        action: onNewFile || (() => {}),
        disabled: !onNewFile,
      },
      {
        id: 'new-folder',
        icon: FolderPlus,
        label: 'New Folder',
        action: onNewFolder || (() => {}),
        disabled: !onNewFolder,
      },
      {
        id: 'open-file',
        icon: FolderOpen,
        label: 'Open File',
        shortcut: 'Ctrl+O',
        action: onOpenFile || (() => {}),
        disabled: !onOpenFile,
      },
      {
        id: 'save-file',
        icon: Save,
        label: hasUnsavedChanges ? 'Save (unsaved)' : 'Save',
        shortcut: 'Ctrl+S',
        action: onSaveFile || (() => {}),
        disabled: !onSaveFile,
      },
      {
        id: 'save-all',
        icon: Download,
        label: 'Save All',
        shortcut: 'Ctrl+Shift+S',
        action: onSaveAll || (() => {}),
        disabled: !onSaveAll,
      },
      {
        id: 'refresh',
        icon: RefreshCcw,
        label: 'Refresh',
        action: onRefresh || (() => {}),
        disabled: !onRefresh,
      },
    ],
  };

  const gitActions: ActionGroup = {
    id: 'git',
    title: 'Source Control',
    icon: GitBranch,
    items: [
      {
        id: 'git-commit',
        icon: GitCommit,
        label: `Commit${gitChanges > 0 ? ` (${gitChanges} changes)` : ''}`,
        action: onGitCommit || (() => {}),
        disabled: !onGitCommit,
      },
      {
        id: 'git-push',
        icon: Upload,
        label: 'Push',
        action: onGitPush || (() => {}),
        disabled: !onGitPush,
      },
      {
        id: 'git-pull',
        icon: GitPullRequest,
        label: 'Pull',
        action: onGitPull || (() => {}),
        disabled: !onGitPull,
      },
      {
        id: 'git-branch',
        icon: GitBranch,
        label: `Branch: ${gitBranch}`,
        action: onGitBranch || (() => {}),
        disabled: !onGitBranch,
      },
      {
        id: 'git-merge',
        icon: GitMerge,
        label: 'Merge',
        action: onGitMerge || (() => {}),
        disabled: !onGitMerge,
      },
      {
        id: 'git-history',
        icon: History,
        label: 'History',
        action: onGitHistory || (() => {}),
        disabled: !onGitHistory,
      },
    ],
  };

  const settingsActions: ActionGroup = {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    items: [
      {
        id: 'general-settings',
        icon: Settings,
        label: 'General Settings',
        shortcut: 'Ctrl+,',
        action: onOpenSettings || (() => {}),
        disabled: !onOpenSettings,
      },
      {
        id: 'theme-settings',
        icon: Palette,
        label: 'Theme & Colors',
        action: onThemeSettings || (() => {}),
        disabled: !onThemeSettings,
      },
      {
        id: 'keybind-settings',
        icon: Keyboard,
        label: 'Keyboard Shortcuts',
        shortcut: 'Ctrl+K Ctrl+S',
        action: onKeybindSettings || (() => {}),
        disabled: !onKeybindSettings,
      },
      {
        id: 'display-settings',
        icon: Monitor,
        label: 'Display',
        action: onDisplaySettings || (() => {}),
        disabled: !onDisplaySettings,
      },
      {
        id: 'data-settings',
        icon: Database,
        label: 'Data & Sessions',
        action: onDataSettings || (() => {}),
        disabled: !onDataSettings,
      },
      {
        id: 'security-settings',
        icon: Shield,
        label: 'Security & Privacy',
        action: onSecuritySettings || (() => {}),
        disabled: !onSecuritySettings,
      },
    ],
  };

  const renderActionButton = (item: ActionItem) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        className={`sidebar-action-btn ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
        onClick={item.action}
        disabled={item.disabled}
        title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
        aria-label={item.label}
        aria-disabled={item.disabled}
      >
        <Icon size={16} aria-hidden="true" />
        <span className="action-label">{item.label}</span>
        {item.shortcut && <kbd className="action-shortcut">{item.shortcut}</kbd>}
      </button>
    );
  };

  const renderSearchSection = () => (
    <div className="sidebar-search-section">
      <div className="search-header">
        <Search size={16} />
        <span>Search</span>
      </div>

      {/* Search input */}
      <div className="search-input-group">
        <FileSearch size={14} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && onSearchInFiles) {
              onSearchInFiles();
            }
          }}
          aria-label="Search in files"
        />
      </div>

      {/* Replace input */}
      <div className="search-input-group">
        <Replace size={14} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Replace..."
          value={replaceQuery}
          onChange={e => setReplaceQuery(e.target.value)}
          aria-label="Replace text"
        />
      </div>

      {/* Search actions */}
      <div className="search-actions">
        <button
          className="search-action-btn"
          onClick={onSearchFiles}
          disabled={!onSearchFiles}
          title="Search by filename"
        >
          <FolderSearch size={14} />
          <span>Find Files</span>
        </button>
        <button
          className="search-action-btn"
          onClick={onSearchInFiles}
          disabled={!onSearchInFiles}
          title="Search in file contents"
        >
          <Search size={14} />
          <span>Find in Files</span>
        </button>
        <button
          className="search-action-btn"
          onClick={onSearchReplace}
          disabled={!onSearchReplace || !replaceQuery}
          title="Replace all"
        >
          <Replace size={14} />
          <span>Replace All</span>
        </button>
      </div>

      {/* Search options */}
      <div className="search-options">
        <label className="search-option">
          <input type="checkbox" />
          <span>Case sensitive</span>
        </label>
        <label className="search-option">
          <input type="checkbox" />
          <span>Regex</span>
        </label>
        <label className="search-option">
          <input type="checkbox" />
          <span>Whole word</span>
        </label>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'file':
        return (
          <div className="sidebar-actions-section">
            <div className="section-header">
              <fileActions.icon size={16} />
              <span>{fileActions.title}</span>
            </div>
            <div className="action-list">
              {fileActions.items.map(renderActionButton)}
            </div>
          </div>
        );

      case 'git':
        return (
          <div className="sidebar-actions-section">
            <div className="section-header">
              <gitActions.icon size={16} />
              <span>{gitActions.title}</span>
            </div>
            {gitChanges > 0 && (
              <div className="git-status-badge">
                <span className="badge">{gitChanges}</span>
                <span>pending changes</span>
              </div>
            )}
            <div className="action-list">
              {gitActions.items.map(renderActionButton)}
            </div>
          </div>
        );

      case 'search':
        return renderSearchSection();

      case 'settings':
        return (
          <div className="sidebar-actions-section">
            <div className="section-header">
              <settingsActions.icon size={16} />
              <span>{settingsActions.title}</span>
            </div>
            <div className="action-list">
              {settingsActions.items.map(renderActionButton)}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="sidebar-actions" role="region" aria-label={`${activeSection} actions`}>
      {renderSection()}
    </div>
  );
};

export default SidebarActions;
