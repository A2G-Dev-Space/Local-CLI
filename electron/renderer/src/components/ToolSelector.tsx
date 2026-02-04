/**
 * Tool Selector Component
 * Displays optional tool groups and allows enabling/disabling them
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import './ToolSelector.css';

interface ToolGroup {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  enabled: boolean;
  available: boolean;
  requiresWindows?: boolean;
}

interface ToolSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ToolSelector: React.FC<ToolSelectorProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load tool groups
  const loadToolGroups = useCallback(async () => {
    if (!window.electronAPI?.tools) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.tools.getGroups();
      if (result.success && result.groups) {
        setToolGroups(result.groups);
      } else {
        setError(result.error || 'Failed to load tool groups');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on open
  useEffect(() => {
    if (isOpen) {
      loadToolGroups();
    }
  }, [isOpen, loadToolGroups]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Toggle tool group
  const handleToggle = useCallback(async (groupId: string) => {
    if (!window.electronAPI?.tools || togglingId) return;

    setTogglingId(groupId);
    setError(null);

    try {
      const result = await window.electronAPI.tools.toggle(groupId);
      if (result.success) {
        // Reload groups to get updated state
        await loadToolGroups();
      } else {
        setError(result.error || 'Failed to toggle tool group');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTogglingId(null);
    }
  }, [togglingId, loadToolGroups]);

  // Get icon for tool group
  const getToolIcon = (id: string): React.ReactElement => {
    switch (id) {
      case 'browser':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        );
      case 'word':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        );
      case 'excel':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-2-2H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        );
      case 'powerpoint':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  const enabledCount = toolGroups.filter(g => g.enabled).length;
  const availableCount = toolGroups.filter(g => g.available).length;

  return (
    <div className="tool-selector-backdrop" onClick={onClose}>
      <div className="tool-selector-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tool-selector-header">
          <div className="tool-selector-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
            <span>{t('toolSelector.title')}</span>
          </div>
          <button className="tool-selector-close" onClick={onClose} title={t('toolSelector.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Warning */}
        <div className="tool-selector-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <span>{t('toolSelector.warning')}</span>
        </div>

        {/* Content */}
        <div className="tool-selector-content">
          {isLoading && (
            <div className="tool-loading">{t('toolSelector.loading')}</div>
          )}

          {error && (
            <div className="tool-error">{error}</div>
          )}

          {!isLoading && toolGroups.length === 0 && (
            <div className="tool-empty">{t('toolSelector.empty')}</div>
          )}

          {!isLoading && toolGroups.length > 0 && (
            <div className="tool-list">
              {toolGroups.map((group) => (
                <div
                  key={group.id}
                  className={`tool-item ${group.enabled ? 'enabled' : ''} ${!group.available ? 'unavailable' : ''}`}
                >
                  <div className="tool-item-left">
                    <div className={`tool-icon ${group.enabled ? 'active' : ''}`}>
                      {getToolIcon(group.id)}
                    </div>
                    <div className="tool-info">
                      <div className="tool-name">
                        {group.name}
                        <span className="tool-count">({t('toolSelector.toolCount', { count: group.toolCount })})</span>
                      </div>
                      <div className="tool-description">{group.description}</div>
                      {!group.available && group.requiresWindows && (
                        <div className="tool-requirement">{t('toolSelector.requiresWindows')}</div>
                      )}
                    </div>
                  </div>
                  <div className="tool-item-right">
                    <button
                      className={`tool-toggle ${group.enabled ? 'on' : 'off'}`}
                      onClick={() => handleToggle(group.id)}
                      disabled={!group.available || togglingId === group.id}
                    >
                      {togglingId === group.id ? (
                        <span className="toggle-loading">...</span>
                      ) : (
                        <span className="toggle-indicator" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tool-selector-footer">
          <div className="tool-stats">
            <span className="stat-item">
              <span className="stat-dot enabled" />
              {t('toolSelector.enabled', { count: enabledCount })}
            </span>
            <span className="stat-item">
              <span className="stat-dot available" />
              {t('toolSelector.available', { count: availableCount })}
            </span>
          </div>
          <span className="footer-hint">{t('toolSelector.escToClose')}</span>
        </div>
      </div>
    </div>
  );
};

export default ToolSelector;
