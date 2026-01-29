/**
 * Status Bar Component
 * Bottom status bar with system info, quick actions, and agent activity indicator
 */

import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import type { SystemInfo, Theme } from '../../../preload/index';
import './StatusBar.css';

// Convert tool name to user-friendly display format
// e.g., "call_docs_search_agent" -> "Docs Search Agent"
// e.g., "read_file" -> "Read File"
const getToolDisplayName = (toolName: string): string => {
  // Special cases for docs search (show searching indicator)
  if (toolName.includes('docs_search')) {
    return 'Searching Docs';
  }

  // Convert snake_case/camelCase to Title Case with spaces
  return toolName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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
  currentDirectory,
  theme: _theme,
  onToggleTerminal,
}) => {
  // Suppress unused warnings - available for future use
  void _systemInfo;
  void _theme;

  // Agent activity state
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [contextUsage, setContextUsage] = useState<number>(0);

  // Listen to agent events
  useEffect(() => {
    if (!window.electronAPI?.agent) return;

    const unsubscribes: Array<() => void> = [];

    // Track tool calls
    unsubscribes.push(
      window.electronAPI.agent.onToolCall((data) => {
        setIsAgentRunning(true);
        setCurrentTool(data.toolName);
      })
    );

    // Track tool results
    unsubscribes.push(
      window.electronAPI.agent.onToolResult(() => {
        setCurrentTool(null);
      })
    );

    // Track completion
    unsubscribes.push(
      window.electronAPI.agent.onComplete(() => {
        setIsAgentRunning(false);
        setCurrentTool(null);
        // Don't reset contextUsage - keep showing last known value until next session
      })
    );

    // Track errors
    unsubscribes.push(
      window.electronAPI.agent.onError(() => {
        setIsAgentRunning(false);
        setCurrentTool(null);
      })
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Check agent status periodically
  useEffect(() => {
    const checkStatus = async () => {
      if (window.electronAPI?.agent?.isRunning) {
        const running = await window.electronAPI.agent.isRunning();
        setIsAgentRunning(running);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Get real context usage from main process via IPC
  useEffect(() => {
    if (!window.electronAPI?.agent?.onContextUpdate) return;

    const unsub = window.electronAPI.agent.onContextUpdate((data) => {
      setContextUsage(data.usagePercentage);
    });

    return () => unsub();
  }, []);

  // Memoize directory display format
  const displayDirectory = useMemo(() => {
    return currentDirectory
      ? currentDirectory.split(/[/\\]/).slice(-2).join('/')
      : 'No folder';
  }, [currentDirectory]);

  // Memoize toggle terminal handler
  const handleToggleTerminal = useCallback(() => {
    onToggleTerminal();
  }, [onToggleTerminal]);

  return (
    <div className="statusbar">
      {/* Left Section */}
      <div className="statusbar-left">
        {/* Agent Activity Indicator */}
        <div className={`statusbar-item agent-activity ${isAgentRunning ? 'running' : ''}`}>
          {isAgentRunning ? (
            <>
              <div className="activity-spinner" />
              <span className="activity-text">
                {currentTool ? `${getToolDisplayName(currentTool)}...` : 'Working...'}
              </span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span>Ready</span>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="statusbar-separator" />

        {/* Current Directory */}
        <button className="statusbar-item" title={currentDirectory || 'No folder'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
          </svg>
          <span>{displayDirectory}</span>
        </button>

        {/* Git Branch */}
        <button className="statusbar-item" title="Source Control">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>main</span>
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
        {/* Context Usage */}
        {contextUsage > 0 && (
          <div className="statusbar-item context-usage" title={`Context: ${contextUsage}%`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h2v8zm-6 0H6v-6h2v6zm12 0h-2v-4h2v4z"/>
            </svg>
            <span>{contextUsage}%</span>
            <div className="context-bar">
              <div
                className="context-bar-fill"
                style={{
                  width: `${contextUsage}%`,
                  background: contextUsage > 80 ? '#EF4444' : contextUsage > 60 ? '#F59E0B' : '#10B981'
                }}
              />
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="statusbar-separator" />

        {/* PowerShell Terminal Toggle */}
        <button
          className="statusbar-item"
          onClick={handleToggleTerminal}
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

        {/* Encoding */}
        <button className="statusbar-item" title="Select Encoding">
          <span>UTF-8</span>
        </button>

        {/* Notifications */}
        <button className="statusbar-item notifications" title="Notifications">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default memo(StatusBar);
