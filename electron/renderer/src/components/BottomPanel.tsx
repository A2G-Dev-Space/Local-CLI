/**
 * BottomPanel Component
 * Extracted from App.tsx for better code splitting
 * Contains Terminal, Chat, and Logs panels with tab switching
 */

import React, { memo, Suspense, lazy } from 'react';
import type { Session, EndpointConfig } from '../../../preload/index';
import type { ChatPanelRef } from './ChatPanel';
import ResizablePanel from './ResizablePanel';
import Terminal from './Terminal';
import ChatPanel from './ChatPanel';

// Lazy loaded
const LogViewer = lazy(() => import('./LogViewer'));

type PanelLayout = 'terminal' | 'chat' | 'logs' | 'split';

interface CommandHandlers {
  onCompact: () => Promise<void>;
  onSettings: () => void;
}

interface BottomPanelProps {
  isOpen: boolean;
  layout: PanelLayout;
  isFullscreen: boolean;
  height: number;
  layoutState: {
    bottomPanelDefaultHeight: number;
    bottomPanelMinHeight: number;
    bottomPanelMaxHeight: number;
  };
  currentDirectory: string;
  currentSession: Session | null;
  allowAllPermissions: boolean;
  endpoints: EndpointConfig[];
  currentEndpointId: string | null;
  isModelDropdownOpen: boolean;
  modelDropdownRef: React.RefObject<HTMLDivElement | null>;
  chatPanelRef: React.RefObject<ChatPanelRef | null>;
  commandHandlers: CommandHandlers;
  onLayoutChange: (layout: PanelLayout) => void;
  onFullscreenToggle: () => void;
  onHeightChange: (height: number) => void;
  onCollapse: () => void;
  onSessionChange: (session: Session | null) => void;
  onClearSession: () => void;
  onNewSession: () => void;
  onLoadSession: () => void;
  onAllowAllPermissionsChange: (value: boolean) => void;
  onModelDropdownToggle: () => void;
  onSelectModel: (id: string) => void;
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  layout,
  isFullscreen,
  height: _height, // Available for future use
  layoutState,
  currentDirectory,
  currentSession,
  allowAllPermissions,
  endpoints,
  currentEndpointId,
  isModelDropdownOpen,
  modelDropdownRef,
  chatPanelRef,
  commandHandlers,
  onLayoutChange,
  onFullscreenToggle,
  onHeightChange,
  onCollapse,
  onSessionChange,
  onClearSession,
  onNewSession,
  onLoadSession,
  onAllowAllPermissionsChange,
  onModelDropdownToggle,
  onSelectModel,
}) => {
  if (!isOpen) return null;

  const currentEndpoint = endpoints.find(e => e.id === currentEndpointId);
  const currentModelName = currentEndpoint?.models?.[0]?.name || currentEndpoint?.name || 'No model';

  return (
    <div
      className={`bottom-panel-wrapper ${isFullscreen ? 'fullscreen' : ''}`}
      style={isFullscreen ? { height: '100%' } : undefined}
    >
      <ResizablePanel
        id="bottom-panel"
        direction="bottom"
        defaultSize={isFullscreen ? 99999 : layoutState.bottomPanelDefaultHeight}
        minSize={isFullscreen ? 99999 : layoutState.bottomPanelMinHeight}
        maxSize={isFullscreen ? 99999 : layoutState.bottomPanelMaxHeight}
        showCollapseButton={!isFullscreen}
        onSizeChange={isFullscreen ? undefined : onHeightChange}
        onCollapsedChange={(collapsed) => {
          if (collapsed && !isFullscreen) onCollapse();
        }}
        header={
          <div className="panel-tabs">
            <button
              className={`panel-tab ${layout === 'chat' ? 'active' : ''}`}
              onClick={() => onLayoutChange('chat')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
              Chat
            </button>
            <button
              className={`panel-tab ${layout === 'terminal' ? 'active' : ''}`}
              onClick={() => onLayoutChange('terminal')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
              </svg>
              Terminal
            </button>
            <button
              className={`panel-tab ${layout === 'logs' ? 'active' : ''}`}
              onClick={() => onLayoutChange('logs')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                <path d="M8 12h8v2H8zm0 4h8v2H8z"/>
              </svg>
              Logs
            </button>
            <div className="panel-tabs-spacer" />

            {/* Session Controls - only show when Chat tab is active */}
            {layout === 'chat' && (
              <div className="panel-session-controls">
                {/* Model Selector Dropdown */}
                <div className="panel-model-selector" ref={modelDropdownRef}>
                  <button
                    className="panel-toolbar-btn panel-model-btn"
                    onClick={onModelDropdownToggle}
                    title="Change Model (Ctrl+M)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"/>
                    </svg>
                    <span className="panel-model-name">{currentModelName}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="dropdown-arrow">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>
                  {isModelDropdownOpen && (
                    <div className="panel-model-dropdown">
                      {endpoints.length === 0 ? (
                        <div className="panel-model-empty">
                          <span>No models configured</span>
                          <button onClick={() => { onModelDropdownToggle(); commandHandlers.onSettings(); }}>
                            Open Settings
                          </button>
                        </div>
                      ) : (
                        endpoints.map(endpoint => (
                          <button
                            key={endpoint.id}
                            className={`panel-model-item ${endpoint.id === currentEndpointId ? 'active' : ''}`}
                            onClick={() => onSelectModel(endpoint.id)}
                          >
                            <span>{endpoint.models[0]?.name || endpoint.name}</span>
                            {endpoint.id === currentEndpointId && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Compact Conversation */}
                <button
                  className="panel-toolbar-btn"
                  onClick={commandHandlers.onCompact}
                  title="Compact Conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.41 18.59L8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zM16.59 5.41L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59zM5 11h14v2H5z"/>
                  </svg>
                </button>

                <div className="panel-toolbar-divider" />

                {/* Session Name Badge */}
                {currentSession && (
                  <span className="panel-session-badge" title={currentSession.name}>
                    {currentSession.name.slice(0, 15)}{currentSession.name.length > 15 ? '...' : ''}
                  </span>
                )}

                {/* New Session */}
                <button
                  className="panel-toolbar-btn"
                  onClick={onNewSession}
                  title="New Session (Ctrl+N)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </button>

                {/* Load Session */}
                <button
                  className="panel-toolbar-btn"
                  onClick={onLoadSession}
                  title="Load Session (Ctrl+O)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                </button>

                {/* Clear Session */}
                <button
                  className="panel-toolbar-btn"
                  onClick={onClearSession}
                  title="Clear Chat (Ctrl+L)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            )}

            <button
              className="panel-fullscreen-btn"
              onClick={onFullscreenToggle}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        }
        className="bottom-panel-container"
      >
        <div className="panel-content">
          {/* Keep all panels mounted to preserve state, hide with CSS */}
          <div className="panel-tab-content" style={{ display: layout === 'terminal' ? 'flex' : 'none' }}>
            <Terminal currentDirectory={currentDirectory} />
          </div>
          <div className="panel-tab-content" style={{ display: layout === 'chat' ? 'flex' : 'none' }}>
            <ChatPanel
              ref={chatPanelRef}
              session={currentSession}
              onSessionChange={onSessionChange}
              onClearSession={onClearSession}
              currentDirectory={currentDirectory}
              allowAllPermissions={allowAllPermissions}
              onAllowAllPermissionsChange={onAllowAllPermissionsChange}
            />
          </div>
          <div className="panel-tab-content" style={{ display: layout === 'logs' ? 'flex' : 'none' }}>
            <Suspense fallback={<div className="loading-fallback">Loading logs...</div>}>
              <LogViewer isVisible={layout === 'logs'} currentSessionId={currentSession?.id || null} />
            </Suspense>
          </div>
        </div>
      </ResizablePanel>
    </div>
  );
};

export default memo(BottomPanel);
