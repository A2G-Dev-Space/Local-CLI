/**
 * ActivityBar Component
 * Extracted from App.tsx for better code splitting
 * VS Code-style activity bar with panel toggles
 */

import React, { memo, useCallback } from 'react';
import type { Theme } from '../../../preload/index';

type ActivePanel = 'explorer' | 'search' | 'extensions';

interface ActivityBarProps {
  activePanel: ActivePanel;
  sidebarOpen: boolean;
  theme: Theme;
  onPanelChange: (panel: ActivePanel) => void;
  onSidebarToggle: (open: boolean) => void;
  onThemeToggle: () => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({
  activePanel,
  sidebarOpen,
  theme,
  onPanelChange,
  onSidebarToggle,
  onThemeToggle,
}) => {
  const handleExplorerClick = useCallback(() => {
    if (activePanel === 'explorer' && sidebarOpen) {
      onSidebarToggle(false);
    } else {
      onPanelChange('explorer');
      onSidebarToggle(true);
    }
  }, [activePanel, sidebarOpen, onPanelChange, onSidebarToggle]);

  return (
    <div className="activity-bar">
      <button
        className={`activity-btn ${activePanel === 'explorer' && sidebarOpen ? 'active' : ''}`}
        onClick={handleExplorerClick}
        title="Explorer (Ctrl+Shift+E)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.5l1.5-1.5v-15L20.5 0h-3zM14 22.5H2.5V7.5H7v9.07L8.5 18h5.5v4.5zm6-6H8.5V1.5H14V6h4.5v10.5h1.5zm0-12H15V1.5h2.5V4.5z"/>
        </svg>
      </button>
      <div className="activity-spacer" />
      <button
        className="activity-btn"
        onClick={onThemeToggle}
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      >
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
          </svg>
        )}
      </button>
    </div>
  );
};

export default memo(ActivityBar);
