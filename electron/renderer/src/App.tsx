/**
 * LOCAL-CLI PowerShell UI - Main Application Component
 * Modern VS Code-inspired layout with custom titlebar, sidebar, and panels
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ElectronAPI, SystemInfo, Theme, Session, EndpointConfig } from '../../preload/index';
import './styles/global.css';
import './styles/App.css';

// Components
import TitleBar from './components/TitleBar';
// import Sidebar from './components/Sidebar'; // Using inline sidebar in activity bar
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import ChatPanel, { type ChatPanelRef } from './components/ChatPanel';
import StatusBar from './components/StatusBar';
import CommandPalette, { createDefaultCommands, type CommandItem } from './components/CommandPalette';
import Toolbar from './components/Toolbar';
import SidebarActions from './components/SidebarActions';
import ResizablePanel from './components/ResizablePanel';
import SplitView, { type SplitPane } from './components/SplitView';
import LogViewer from './components/LogViewer';
import SessionBrowser from './components/SessionBrowser';
import Settings from './components/Settings';
import UsageStats from './components/UsageStats';
import ToolSelector from './components/ToolSelector';
import './components/ResizablePanel.css';
import './components/SplitView.css';
import './components/LogViewer.css';
import './components/SessionBrowser.css';
import './components/Settings.css';
import './components/UsageStats.css';
import './components/ToolSelector.css';

// Hooks
import { useResponsive, useLayoutState } from './hooks';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Tab interface for editor
export interface EditorTab {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
  isActive: boolean;
}

// File tree node interface
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  isExpanded?: boolean;
}

// Panel layout type
type PanelLayout = 'terminal' | 'chat' | 'logs' | 'split';

const App: React.FC = () => {
  // System state
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // Responsive hooks
  const responsive = useResponsive();
  const layoutState = useLayoutState();

  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, setSidebarWidth] = useState(260);
  const [activePanel, setActivePanel] = useState<'explorer' | 'search' | 'extensions'>('explorer');
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);
  const [bottomPanelLayout, setBottomPanelLayout] = useState<PanelLayout>('chat');

  // Split view state
  const [editorSplitEnabled, setEditorSplitEnabled] = useState(false);

  // Fullscreen panel state
  const [isBottomPanelFullscreen, setIsBottomPanelFullscreen] = useState(false);

  // Editor state
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // File explorer state
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');


  // Chat session state
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isSessionBrowserOpen, setIsSessionBrowserOpen] = useState(false);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUsageStatsOpen, setIsUsageStatsOpen] = useState(false);
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);

  // Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  // Model selector state (for Chat panel header)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [currentEndpointId, setCurrentEndpointId] = useState<string | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  // Initialize app
  useEffect(() => {
    const init = async () => {
      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        return;
      }

      try {
        // Get system info
        const info = await window.electronAPI.system.info();
        setSystemInfo(info);

        // Get theme from config (defaults to 'light')
        const savedTheme = await window.electronAPI.config.getTheme();
        setTheme(savedTheme === 'system'
          ? await window.electronAPI.theme.getSystem()
          : savedTheme as Theme);

        // Check window state
        const maximized = await window.electronAPI.window.isMaximized();
        setIsMaximized(maximized);

        // Get current directory from PowerShell
        const dirResult = await window.electronAPI.powershell.getCurrentDirectory();
        if (dirResult.success && dirResult.directory) {
          setCurrentDirectory(dirResult.directory);
          loadFileTree(dirResult.directory);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    init();
  }, []);

  // Event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubMaximize = window.electronAPI.window.onMaximizeChange(setIsMaximized);
    const unsubFocus = window.electronAPI.window.onFocusChange(setIsFocused);
    const unsubTheme = window.electronAPI.theme.onChange(setTheme);

    return () => {
      unsubMaximize();
      unsubFocus();
      unsubTheme();
    };
  }, []);

  // Load endpoints for model selector
  useEffect(() => {
    const loadEndpoints = async () => {
      if (!window.electronAPI?.llm) return;
      try {
        const result = await window.electronAPI.llm.getEndpoints();
        if (result.success && result.endpoints) {
          setEndpoints(result.endpoints);
          setCurrentEndpointId(result.currentEndpointId || null);
        }
      } catch (err) {
        console.error('Failed to load endpoints:', err);
      }
    };
    loadEndpoints();
  }, []);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen]);

  // Handle model selection
  const handleSelectModel = useCallback(async (endpointId: string) => {
    if (!window.electronAPI?.llm) return;
    try {
      const result = await window.electronAPI.llm.setCurrentEndpoint(endpointId);
      if (result.success) {
        setCurrentEndpointId(endpointId);
      }
    } catch (err) {
      console.error('Failed to set model:', err);
    }
    setIsModelDropdownOpen(false);
  }, []);

  // Get current model name
  const currentEndpoint = endpoints.find(e => e.id === currentEndpointId);
  const currentModelName = currentEndpoint?.models[0]?.name || currentEndpoint?.name || 'No model';

  // Load file tree
  const loadFileTree = useCallback(async (dirPath: string) => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.fs.readDir(dirPath);
      if (result.success && result.files) {
        const nodes: FileNode[] = result.files
          .filter(name => !name.startsWith('.'))
          .map(name => ({
            id: `${dirPath}/${name}`,
            name,
            path: `${dirPath}/${name}`,
            type: 'file' as const, // Will be updated on expansion
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setFileTree(nodes);
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  }, []);

  // Open folder dialog
  const openFolder = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.dialog.openFolder({
        title: 'Select Folder',
      });
      if (result.success && result.filePath) {
        setCurrentDirectory(result.filePath);
        loadFileTree(result.filePath);

        // Create a new chat session for this folder
        if (window.electronAPI.session) {
          const sessionResult = await window.electronAPI.session.create(
            `Session - ${result.filePath.split(/[/\\]/).pop() || 'New'}`,
            result.filePath
          );
          if (sessionResult.success && sessionResult.session) {
            setCurrentSession(sessionResult.session);
          }
        }
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [loadFileTree]);

  // Create a new session
  const handleNewSession = useCallback(async () => {
    if (!window.electronAPI?.session) return;

    try {
      const result = await window.electronAPI.session.create(
        undefined,
        currentDirectory || undefined
      );

      if (result.success && result.session) {
        setCurrentSession(result.session);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }, [currentDirectory]);

  // Load session from browser
  const handleLoadSession = useCallback(() => {
    setIsSessionBrowserOpen(true);
  }, []);

  // Handle session load from browser
  const handleSessionLoad = useCallback(async (sessionId: string) => {
    if (!window.electronAPI?.session) return;

    try {
      const result = await window.electronAPI.session.load(sessionId);
      if (result.success && result.session) {
        setCurrentSession(result.session);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, []);

  // Clear session
  const handleClearSession = useCallback(async () => {
    await chatPanelRef.current?.clear();
  }, []);

  // Handle delete current session (from SessionBrowser)
  const handleDeleteCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // Open file in editor
  const openFile = useCallback(async (filePath: string, fileName: string) => {
    // Check if already open
    const existingTab = tabs.find(tab => tab.path === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Read file content
    if (!window.electronAPI) return;
    const result = await window.electronAPI.fs.readFile(filePath);
    if (result.success && result.content !== undefined) {
      const extension = fileName.split('.').pop() || '';
      const language = getLanguageFromExtension(extension);

      const newTab: EditorTab = {
        id: `tab-${Date.now()}`,
        name: fileName,
        path: filePath,
        content: result.content,
        language,
        isDirty: false,
        isActive: true,
      };

      setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTab.id);
    }
  }, [tabs]);

  // Close tab
  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && filtered.length > 0) {
        const lastTab = filtered[filtered.length - 1];
        lastTab.isActive = true;
        setActiveTabId(lastTab.id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
      }
      return filtered;
    });
  }, [activeTabId]);

  // Update tab content
  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId
        ? { ...tab, content, isDirty: true }
        : tab
    ));
  }, []);

  // Save file
  const saveFile = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !window.electronAPI) return;

    const result = await window.electronAPI.fs.writeFile(tab.path, tab.content);
    if (result.success) {
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, isDirty: false } : t
      ));
    }
  }, [tabs]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  // Command handlers for slash commands
  const commandHandlers = useMemo(() => ({
    onHelp: () => {
      console.log('Help command');
      // TODO: Show help dialog
    },
    onClear: () => {
      setTabs([]);
      setActiveTabId(null);
    },
    onSettings: () => {
      setIsSettingsOpen(true);
    },
    onModel: () => {
      setIsSettingsOpen(true);
    },
    onTool: () => {
      setIsToolSelectorOpen(true);
    },
    onUsage: () => {
      setIsUsageStatsOpen(true);
    },
    onDocs: () => {
      console.log('Documentation');
      // TODO: Show documentation browser
    },
    onLoad: () => {
      console.log('Load session');
      // TODO: Show session browser
    },
    onCompact: async () => {
      await chatPanelRef.current?.compact();
    },
    onExit: () => {
      window.electronAPI?.window.close();
    },
  }), []);

  // Create command palette commands
  const commands = useMemo<CommandItem[]>(() =>
    createDefaultCommands(commandHandlers),
  [commandHandlers]);

  // Track recent commands
  const handleCommandExecute = useCallback((commandId: string) => {
    setRecentCommands(prev => {
      const filtered = prev.filter(id => id !== commandId);
      return [commandId, ...filtered].slice(0, 5);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Exit fullscreen panel
      if (e.key === 'Escape' && isBottomPanelFullscreen) {
        e.preventDefault();
        setIsBottomPanelFullscreen(false);
        return;
      }

      // Command Palette: Ctrl+Shift+P or F1
      if ((e.ctrlKey && e.shiftKey && e.key === 'P') || e.key === 'F1') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Settings: Ctrl+,
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        commandHandlers.onSettings();
        return;
      }

      // Clear: Ctrl+L
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        commandHandlers.onClear();
        return;
      }

      // Model: Ctrl+M
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        commandHandlers.onModel();
        return;
      }

      // Open Folder: Ctrl+Shift+O
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        openFolder();
        return;
      }

      // Load Session: Ctrl+O (without shift)
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        commandHandlers.onLoad();
        return;
      }

      // Save: Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (activeTabId) {
          saveFile(activeTabId);
        }
        return;
      }

      // Toggle Terminal: Ctrl+`
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setBottomPanelOpen(prev => !prev);
        return;
      }

      // Toggle Sidebar: Ctrl+B
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
        return;
      }

      // Toggle Split View: Ctrl+\
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        setEditorSplitEnabled(prev => !prev);
        return;
      }

      // Toggle DevTools: Ctrl+Shift+I or F12
      if ((e.ctrlKey && e.shiftKey && e.key === 'I') || e.key === 'F12') {
        e.preventDefault();
        window.electronAPI?.devTools.toggle();
        return;
      }

      // Toggle Log Viewer: Ctrl+Shift+L
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setBottomPanelLayout('logs');
        setBottomPanelOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandHandlers, activeTabId, saveFile, openFolder, isBottomPanelFullscreen]);

  // Auto-hide sidebar on small screens
  useEffect(() => {
    if (responsive.shouldHideSidebar && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [responsive.shouldHideSidebar]);

  // Split view panes for editor
  const editorPanes = useMemo<SplitPane[]>(() => {
    if (!editorSplitEnabled) {
      return [{
        id: 'editor-main',
        content: (
          <Editor
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onContentChange={updateTabContent}
            onSave={saveFile}
          />
        ),
        initialSize: 1,
      }];
    }

    return [
      {
        id: 'editor-left',
        content: (
          <Editor
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onContentChange={updateTabContent}
            onSave={saveFile}
          />
        ),
        initialSize: 0.5,
        minSize: 200,
      },
      {
        id: 'editor-right',
        content: (
          <Editor
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onContentChange={updateTabContent}
            onSave={saveFile}
          />
        ),
        initialSize: 0.5,
        minSize: 200,
      },
    ];
  }, [editorSplitEnabled, tabs, activeTab, setActiveTabId, closeTab, updateTabContent, saveFile]);

  return (
    <div
      className={`app-root ${!isFocused ? 'unfocused' : ''}`}
      data-theme={theme}
    >
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
        recentCommands={recentCommands}
        onCommandExecute={handleCommandExecute}
      />

      {/* Session Browser */}
      <SessionBrowser
        isOpen={isSessionBrowserOpen}
        onClose={() => setIsSessionBrowserOpen(false)}
        onLoadSession={handleSessionLoad}
        onDeleteCurrentSession={handleDeleteCurrentSession}
        currentSessionId={currentSession?.id}
      />

      {/* Settings */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Usage Statistics */}
      <UsageStats
        isOpen={isUsageStatsOpen}
        onClose={() => setIsUsageStatsOpen(false)}
      />

      {/* Tool Selector */}
      <ToolSelector
        isOpen={isToolSelectorOpen}
        onClose={() => setIsToolSelectorOpen(false)}
      />

      {/* Custom Title Bar */}
      <TitleBar
        title="Local CLI (For Windows)"
        isMaximized={isMaximized}
        isFocused={isFocused}
        onMinimize={() => window.electronAPI?.window.minimize()}
        onMaximize={() => window.electronAPI?.window.maximize()}
        onClose={() => window.electronAPI?.window.close()}
      />

      {/* Toolbar */}
      <Toolbar
        onHelp={commandHandlers.onHelp}
        onClear={commandHandlers.onClear}
        onSettings={commandHandlers.onSettings}
        onModel={commandHandlers.onModel}
        onTool={commandHandlers.onTool}
        onUsage={commandHandlers.onUsage}
        onDocs={commandHandlers.onDocs}
        onLoad={commandHandlers.onLoad}
        onCompact={commandHandlers.onCompact}
        onCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenFolder={openFolder}
        onSave={activeTabId ? () => saveFile(activeTabId) : undefined}
        hasUnsavedChanges={tabs.some(t => t.isDirty)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        {/* Activity Bar */}
        <div className="activity-bar">
          <button
            className={`activity-btn ${activePanel === 'explorer' && sidebarOpen ? 'active' : ''}`}
            onClick={() => {
              if (activePanel === 'explorer' && sidebarOpen) {
                setSidebarOpen(false);
              } else {
                setActivePanel('explorer');
                setSidebarOpen(true);
              }
            }}
            title="Explorer (Ctrl+Shift+E)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.5l1.5-1.5v-15L20.5 0h-3zM14 22.5H2.5V7.5H7v9.07L8.5 18h5.5v4.5zm6-6H8.5V1.5H14V6h4.5v10.5h1.5zm0-12H15V1.5h2.5V4.5z"/>
            </svg>
          </button>
          <button
            className={`activity-btn ${activePanel === 'search' && sidebarOpen ? 'active' : ''}`}
            onClick={() => {
              if (activePanel === 'search' && sidebarOpen) {
                setSidebarOpen(false);
              } else {
                setActivePanel('search');
                setSidebarOpen(true);
              }
            }}
            title="Search"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.25 0a8.25 8.25 0 0 0-6.18 13.72L1 22.88l1.12 1.12 8.16-8.07A8.25 8.25 0 1 0 15.25.01V0zm0 15a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5z"/>
            </svg>
          </button>
          <div className="activity-spacer" />
          <button
            className="activity-btn"
            onClick={toggleTheme}
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

        {/* Sidebar with ResizablePanel */}
        {sidebarOpen && (
          <ResizablePanel
            id="sidebar"
            direction="right"
            defaultSize={layoutState.sidebarDefaultWidth}
            minSize={layoutState.sidebarMinWidth}
            maxSize={layoutState.sidebarMaxWidth}
            showCollapseButton={true}
            onSizeChange={setSidebarWidth}
            onCollapsedChange={(collapsed) => {
              if (collapsed) setSidebarOpen(false);
            }}
            header={
              <span className="sidebar-title">
                {activePanel.charAt(0).toUpperCase() + activePanel.slice(1)}
              </span>
            }
            className="sidebar-panel"
          >
            {activePanel === 'explorer' && (
              <FileExplorer
                files={fileTree}
                currentDirectory={currentDirectory}
                onFileOpen={openFile}
                onDirectoryChange={(dir) => {
                  setCurrentDirectory(dir);
                  loadFileTree(dir);
                }}
                onRefresh={() => loadFileTree(currentDirectory)}
              />
            )}
            {activePanel === 'search' && (
              <SidebarActions
                activeSection="search"
              />
            )}
            {activePanel === 'extensions' && (
              <SidebarActions
                activeSection="settings"
                onOpenSettings={commandHandlers.onSettings}
              />
            )}
          </ResizablePanel>
        )}

        {/* Editor and Panels Container */}
        <div className="content-area">
          {/* Editor Area with SplitView support */}
          {!isBottomPanelFullscreen && (
          <div
            className="editor-area"
            style={{ height: bottomPanelOpen ? `calc(100% - ${bottomPanelHeight}px)` : '100%' }}
          >
            {editorSplitEnabled ? (
              <SplitView
                direction="horizontal"
                panes={editorPanes}
                storageKey="editor-split"
                splitterSize={4}
              />
            ) : (
              <Editor
                tabs={tabs}
                activeTab={activeTab}
                onTabSelect={setActiveTabId}
                onTabClose={closeTab}
                onContentChange={updateTabContent}
                onSave={saveFile}
              />
            )}
          </div>
          )}

          {/* Bottom Panel (Terminal/Chat) with ResizablePanel */}
          {bottomPanelOpen && (
            <div
              className={`bottom-panel-wrapper ${isBottomPanelFullscreen ? 'fullscreen' : ''}`}
              style={isBottomPanelFullscreen ? { height: '100%' } : undefined}
            >
            <ResizablePanel
              id="bottom-panel"
              direction="bottom"
              defaultSize={isBottomPanelFullscreen ? 99999 : layoutState.bottomPanelDefaultHeight}
              minSize={isBottomPanelFullscreen ? 99999 : layoutState.bottomPanelMinHeight}
              maxSize={isBottomPanelFullscreen ? 99999 : layoutState.bottomPanelMaxHeight}
              showCollapseButton={!isBottomPanelFullscreen}
              onSizeChange={isBottomPanelFullscreen ? undefined : setBottomPanelHeight}
              onCollapsedChange={(collapsed) => {
                if (collapsed && !isBottomPanelFullscreen) setBottomPanelOpen(false);
              }}
              header={
                <div className="panel-tabs">
                  <button
                    className={`panel-tab ${bottomPanelLayout === 'chat' ? 'active' : ''}`}
                    onClick={() => setBottomPanelLayout('chat')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    Chat
                  </button>
                  <button
                    className={`panel-tab ${bottomPanelLayout === 'terminal' ? 'active' : ''}`}
                    onClick={() => setBottomPanelLayout('terminal')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
                    </svg>
                    Terminal
                  </button>
                  <button
                    className={`panel-tab ${bottomPanelLayout === 'logs' ? 'active' : ''}`}
                    onClick={() => setBottomPanelLayout('logs')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                      <path d="M8 12h8v2H8zm0 4h8v2H8z"/>
                    </svg>
                    Logs
                  </button>
                  <div className="panel-tabs-spacer" />

                  {/* Session Controls - only show when Chat tab is active */}
                  {bottomPanelLayout === 'chat' && (
                    <div className="panel-session-controls">
                      {/* Model Selector Dropdown */}
                      <div className="panel-model-selector" ref={modelDropdownRef}>
                        <button
                          className="panel-toolbar-btn panel-model-btn"
                          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
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
                                <button onClick={() => { setIsModelDropdownOpen(false); commandHandlers.onSettings(); }}>
                                  Open Settings
                                </button>
                              </div>
                            ) : (
                              endpoints.map(endpoint => (
                                <button
                                  key={endpoint.id}
                                  className={`panel-model-item ${endpoint.id === currentEndpointId ? 'active' : ''}`}
                                  onClick={() => handleSelectModel(endpoint.id)}
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
                        onClick={handleNewSession}
                        title="New Session (Ctrl+N)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </button>

                      {/* Load Session */}
                      <button
                        className="panel-toolbar-btn"
                        onClick={handleLoadSession}
                        title="Load Session (Ctrl+O)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                        </svg>
                      </button>

                      {/* Clear Session */}
                      <button
                        className="panel-toolbar-btn"
                        onClick={handleClearSession}
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
                    onClick={() => setIsBottomPanelFullscreen(!isBottomPanelFullscreen)}
                    title={isBottomPanelFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
                  >
                    {isBottomPanelFullscreen ? (
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
                <div className="panel-tab-content" style={{ display: bottomPanelLayout === 'terminal' ? 'flex' : 'none' }}>
                  <Terminal currentDirectory={currentDirectory} />
                </div>
                <div className="panel-tab-content" style={{ display: bottomPanelLayout === 'chat' ? 'flex' : 'none' }}>
                  <ChatPanel
                    ref={chatPanelRef}
                    session={currentSession}
                    onSessionChange={setCurrentSession}
                    onClearSession={handleClearSession}
                    currentDirectory={currentDirectory}
                  />
                </div>
                <div className="panel-tab-content" style={{ display: bottomPanelLayout === 'logs' ? 'flex' : 'none' }}>
                  <LogViewer isVisible={bottomPanelLayout === 'logs'} />
                </div>
              </div>
            </ResizablePanel>
            </div>
          )}

          {/* Toggle Bottom Panel Button */}
          {!bottomPanelOpen && (
            <button
              className="toggle-panel-btn"
              onClick={() => setBottomPanelOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
              </svg>
              Panel
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        systemInfo={systemInfo}
        currentFile={activeTab?.name}
        currentDirectory={currentDirectory}
        theme={theme}
        onToggleTerminal={() => setBottomPanelOpen(!bottomPanelOpen)}
      />
    </div>
  );
};

// Helper function to determine language from file extension
function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    ps1: 'powershell',
    psm1: 'powershell',
    psd1: 'powershell',
  };
  return languageMap[ext.toLowerCase()] || 'plaintext';
}

export default App;
