/**
 * Status Bar Component
 * Bottom status bar with system info and quick actions
 */

import React from 'react';
import type { SystemInfo, Theme } from '../../../preload/index';
import './StatusBar.css';

interface StatusBarProps {
  systemInfo: SystemInfo | null;
  currentFile?: string;
  currentDirectory: string;
  theme: Theme;
  onToggleTerminal: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  systemInfo: _systemInfo,
  currentFile,
  currentDirectory: _currentDirectory,
  theme: _theme,
  onToggleTerminal,
}) => {
  // Suppress unused warnings - available for future use
  void _systemInfo;
  void _currentDirectory;
  void _theme;
  return (
    <div className="statusbar">
      {/* Left Section */}
      <div className="statusbar-left">
        {/* Git Branch */}
        <button className="statusbar-item" title="Source Control">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.007 8.222A3.738 3.738 0 0 0 17.5 5.5a3.73 3.73 0 0 0-3.007 1.525 3.737 3.737 0 0 0-2.96-1.455c-1.584.033-3.003 1.016-3.595 2.448-1.122.153-2.058.71-2.67 1.56-.646.898-.935 2.08-.79 3.243.223 1.794 1.438 3.293 3.207 3.957 1.052.396 2.267.565 3.56.498l-.044.018c.047-.02.09-.044.14-.065.085-.04.17-.077.254-.12l.047-.022c.027-.013.057-.024.083-.038 1.315-.67 2.46-1.65 3.335-2.865a3.64 3.64 0 0 0 2.44.927c2.068 0 3.75-1.682 3.75-3.75a3.746 3.746 0 0 0-.743-2.24z"/>
          </svg>
          <span>main</span>
        </button>

        {/* Sync Status */}
        <button className="statusbar-item" title="Synchronize Changes">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
        </button>

        {/* Errors/Warnings */}
        <button className="statusbar-item" title="No Problems">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>0</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <span>0</span>
        </button>
      </div>

      {/* Center Section */}
      <div className="statusbar-center">
        {currentFile && (
          <span className="statusbar-file">{currentFile}</span>
        )}
      </div>

      {/* Right Section */}
      <div className="statusbar-right">
        {/* PowerShell Terminal Toggle */}
        <button
          className="statusbar-item"
          onClick={onToggleTerminal}
          title="Toggle PowerShell Terminal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
          </svg>
          <span>Terminal</span>
        </button>

        {/* Line/Column */}
        <button className="statusbar-item" title="Go to Line">
          <span>Ln 1, Col 1</span>
        </button>

        {/* Spaces */}
        <button className="statusbar-item" title="Select Indentation">
          <span>Spaces: 2</span>
        </button>

        {/* Encoding */}
        <button className="statusbar-item" title="Select Encoding">
          <span>UTF-8</span>
        </button>

        {/* Line Ending */}
        <button className="statusbar-item" title="Select End of Line Sequence">
          <span>LF</span>
        </button>

        {/* Language */}
        <button className="statusbar-item" title="Select Language Mode">
          <span>TypeScript</span>
        </button>

        {/* Notifications */}
        <button className="statusbar-item" title="Notifications">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
