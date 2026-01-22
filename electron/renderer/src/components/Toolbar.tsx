/**
 * Toolbar Component
 * Main toolbar with icon buttons for frequently used commands
 * Includes tooltips and keyboard shortcut hints
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  Settings,
  Wrench,
  BarChart2,
  BookOpen,
  FolderOpen,
  Command,
  Save,
  FilePlus,
  MoreHorizontal,
  Info,
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
  onInfo?: () => void;
  hasUnsavedChanges?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onHelp,
  onClear: _onClear,
  onSettings,
  onModel: _onModel,
  onTool,
  onUsage,
  onDocs,
  onLoad: _onLoad,
  onCompact: _onCompact,
  onCommandPalette,
  onOpenFolder,
  onNewFile,
  onSave,
  onSearch: _onSearch,
  onGitCommit: _onGitCommit,
  onGitPush: _onGitPush,
  onGitPull: _onGitPull,
  onInfo,
  hasUnsavedChanges = false,
}) => {
  // Suppress unused warning for removed features
  void _onClear;
  void _onModel;
  void _onLoad;
  void _onCompact;
  void _onSearch;
  void _onGitCommit;
  void _onGitPush;
  void _onGitPull;

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
      id: 'save',
      icon: Save,
      label: 'Save',
      shortcut: 'Ctrl+S',
      action: onSave || (() => {}),
      disabled: !onSave,
      active: hasUnsavedChanges,
    },
  ];

  const secondaryButtons: ToolbarButton[] = [
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
  ];

  const rightButtons: ToolbarButton[] = [
    {
      id: 'info',
      icon: Info,
      label: 'Info',
      action: onInfo || (() => {}),
    },
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
