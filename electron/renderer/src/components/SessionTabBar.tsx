/**
 * SessionTabBar - Multi-session tab bar component
 *
 * Renders horizontal tabs for open sessions. Each tab shows:
 * - Session name (editable via double-click)
 * - Running spinner (when agent is executing)
 * - Unread dot (when background tab has new activity)
 * - Close button
 *
 * Actions: new tab (+), load session, right-click context menu
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import './SessionTabBar.css';

export interface TabInfo {
  sessionId: string;
  name: string;
  isRunning: boolean;
  hasUnread: boolean;
}

interface SessionTabBarProps {
  tabs: TabInfo[];
  activeTabId: string | null;
  onSwitchTab: (sessionId: string) => void;
  onNewTab: () => void;
  onCloseTab: (sessionId: string) => void;
  onRenameTab: (sessionId: string, name: string) => void;
  onLoadSession: () => void;
  onClearTab: (sessionId: string) => void;
}

const SessionTabBar: React.FC<SessionTabBarProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onNewTab,
  onCloseTab,
  onRenameTab,
  onLoadSession,
  onClearTab,
}) => {
  const { t } = useTranslation();

  // Rename state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleDoubleClick = useCallback((sessionId: string, currentName: string) => {
    setEditingTabId(sessionId);
    setEditValue(currentName);
  }, []);

  const handleRenameSubmit = useCallback((sessionId: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onRenameTab(sessionId, trimmed);
    }
    setEditingTabId(null);
  }, [editValue, onRenameTab]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(sessionId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  }, [handleRenameSubmit]);

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
  }, []);

  const handleCloseTab = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onCloseTab(sessionId);
  }, [onCloseTab]);

  // Scroll container ref for horizontal scroll
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle wheel for horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div className="session-tab-bar">
      <div className="session-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {tabs.map((tab, idx) => {
          const isActive = tab.sessionId === activeTabId;
          const isEditing = editingTabId === tab.sessionId;

          return (
            <div
              key={tab.sessionId}
              className={`session-tab ${isActive ? 'active' : ''} ${tab.isRunning ? 'running' : ''} ${tab.hasUnread ? 'unread' : ''}`}
              onClick={() => onSwitchTab(tab.sessionId)}
              onDoubleClick={() => handleDoubleClick(tab.sessionId, tab.name)}
              onContextMenu={(e) => handleContextMenu(e, tab.sessionId)}
              title={tab.name}
              data-session-id={tab.sessionId}
            >
              {/* Tab number badge */}
              <span className="session-tab-num">{idx + 1}</span>

              {/* Running spinner */}
              {tab.isRunning && (
                <span className="session-tab-spinner">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                </span>
              )}

              {/* Tab name (editable) */}
              {isEditing ? (
                <input
                  ref={editInputRef}
                  className="session-tab-edit"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(tab.sessionId)}
                  onKeyDown={(e) => handleRenameKeyDown(e, tab.sessionId)}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={30}
                />
              ) : (
                <span className="session-tab-name">{tab.name}</span>
              )}

              {/* Unread dot */}
              {tab.hasUnread && !isActive && (
                <span className="session-tab-unread" />
              )}

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  className="session-tab-close"
                  onClick={(e) => handleCloseTab(e, tab.sessionId)}
                  title={t('sessionTab.close')}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* New tab button */}
      <button
        className="session-tab-new"
        onClick={onNewTab}
        title={t('sessionTab.newTab')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>

      {/* Load session button */}
      <button
        className="session-tab-load"
        onClick={onLoadSession}
        title={t('sessionTab.loadSession')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
        </svg>
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="session-tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => {
            handleDoubleClick(contextMenu.sessionId, tabs.find(t => t.sessionId === contextMenu.sessionId)?.name || '');
            setContextMenu(null);
          }}>
            {t('sessionTab.rename')}
          </button>
          <button onClick={() => {
            onClearTab(contextMenu.sessionId);
            setContextMenu(null);
          }}>
            {t('sessionTab.clear')}
          </button>
          <div className="context-menu-divider" />
          <button onClick={() => {
            onCloseTab(contextMenu.sessionId);
            setContextMenu(null);
          }}>
            {t('sessionTab.close')}
          </button>
          {tabs.length > 1 && (
            <button onClick={() => {
              tabs.forEach(tab => {
                if (tab.sessionId !== contextMenu.sessionId) {
                  onCloseTab(tab.sessionId);
                }
              });
              setContextMenu(null);
            }}>
              {t('sessionTab.closeOthers')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(SessionTabBar);
