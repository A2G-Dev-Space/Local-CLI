/**
 * LOCAL-CLI PowerShell UI - Main Application Component
 * Modern VS Code-inspired layout with custom titlebar, sidebar, and panels
 * Optimized with component splitting, IPC batching, and request deduplication
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import type { ElectronAPI, Theme, Session, EndpointConfig } from '../../preload/index';
import './styles/global.css';
import './styles/App.css';

// Context providers
import { AgentProvider } from './contexts/AgentContext';

// Core components (always loaded)
import TitleBar from './components/TitleBar';
import FileExplorer from './components/FileExplorer';
import type { ChatPanelRef } from './components/ChatPanel';
import CommandPalette, { createDefaultCommands, type CommandItem } from './components/CommandPalette';
import Toolbar from './components/Toolbar';
import SidebarActions from './components/SidebarActions';
import ResizablePanel from './components/ResizablePanel';

// Extracted components for code splitting
import EditorArea from './components/EditorArea';
import BottomPanel from './components/BottomPanel';

// Lazy-loaded components (dialogs/panels not needed on initial render)
const SessionBrowser = lazy(() => import('./components/SessionBrowser'));
const Settings = lazy(() => import('./components/Settings'));
const UsageStats = lazy(() => import('./components/UsageStats'));
const ToolSelector = lazy(() => import('./components/ToolSelector'));
const DocsBrowser = lazy(() => import('./components/DocsBrowser'));
const UpdateModal = lazy(() => import('./components/UpdateModal'));
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
  // Diff mode fields
  isDiff?: boolean;
  originalContent?: string;
  // Special tab types
  type?: 'file' | 'todo';
}

// Special tab IDs
export const TODO_TAB_ID = '__todo__';

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

// Color palette type
export type ColorPalette = 'default' | 'rose' | 'mint' | 'lavender' | 'peach' | 'sky';

const App: React.FC = () => {
  // System state
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState<number>(12);  // 10-18px range
  const [colorPalette, setColorPalette] = useState<ColorPalette>('default');
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [allowAllPermissions, setAllowAllPermissions] = useState(true);
  const [isUsageStatsOpen, setIsUsageStatsOpen] = useState(false);
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
  const [isDocsBrowserOpen, setIsDocsBrowserOpen] = useState(false);

  // Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  // App version (from package.json)
  const [appVersion, setAppVersion] = useState<string>('1.0.0');

  // Update modal state
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available'>('checking');
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string | { note?: string | null }[]; releaseDate?: string } | undefined>(undefined);
  const [updateProgress, setUpdateProgress] = useState<{ percent: number; transferred: number; total: number; bytesPerSecond: number } | undefined>(undefined);
  const [updateError, setUpdateError] = useState<string | undefined>(undefined);

  // Model selector state (for Chat panel header)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [currentEndpointId, setCurrentEndpointId] = useState<string | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  // Initialize app - parallelized for faster startup
  useEffect(() => {
    const init = async () => {
      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        return;
      }

      try {
        // Run independent initialization calls in parallel
        const [, savedTheme, maximized, dirResult, config] = await Promise.all([
          window.electronAPI.system.info(),
          window.electronAPI.config.getTheme(),
          window.electronAPI.window.isMaximized(),
          window.electronAPI.powershell.getCurrentDirectory(),
          window.electronAPI.config.getAll(),
        ]);

        // Set theme (may need additional async call for system theme)
        if (savedTheme === 'system') {
          const systemTheme = await window.electronAPI.theme.getSystem();
          setTheme(systemTheme);
        } else {
          setTheme(savedTheme as Theme);
        }

        // Set font size and color palette from config
        if (config?.fontSize && typeof config.fontSize === 'number') {
          setFontSize(config.fontSize);
        }
        if (config?.colorPalette) {
          setColorPalette(config.colorPalette as ColorPalette);
        }

        // Set window state
        setIsMaximized(maximized);

        // Set current directory
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

  // Auto-update event listeners
  useEffect(() => {
    if (!window.electronAPI?.update) return;

    const unsubAvailable = window.electronAPI.update.onAvailable((info) => {
      setUpdateInfo(info);
      setUpdateStatus('available');
      setUpdateModalOpen(true);
    });

    const unsubNotAvailable = window.electronAPI.update.onNotAvailable(() => {
      // Optionally show "no updates" - usually silent
    });

    const unsubProgress = window.electronAPI.update.onDownloadProgress((progress) => {
      setUpdateProgress(progress);
      setUpdateStatus('downloading');
    });

    const unsubDownloaded = window.electronAPI.update.onDownloaded((info) => {
      setUpdateInfo(info);
      setUpdateStatus('downloaded');
      setUpdateModalOpen(true);
    });

    const unsubError = window.electronAPI.update.onError((error) => {
      setUpdateError(error);
      setUpdateStatus('error');
      setUpdateModalOpen(true);
    });

    return () => {
      unsubAvailable();
      unsubNotAvailable();
      unsubProgress();
      unsubDownloaded();
      unsubError();
    };
  }, []);

  // File edit/create event listeners (for diff view)
  useEffect(() => {
    if (!window.electronAPI?.agent) return;

    // Handle file edit event - show diff view
    const unsubEdit = window.electronAPI.agent.onFileEdit?.((data) => {
      const fileName = data.path.split(/[/\\]/).pop() || 'Untitled';
      const newTabId = `diff-${Date.now()}`;
      const newTab: EditorTab = {
        id: newTabId,
        name: `${fileName} (diff)`,
        path: data.path,
        content: data.newContent,
        language: data.language,
        isDirty: false,
        isActive: true,
        isDiff: true,
        originalContent: data.originalContent,
      };
      setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTabId);
    });

    // Handle file create event - open in editor
    const unsubCreate = window.electronAPI.agent.onFileCreate?.((data) => {
      const fileName = data.path.split(/[/\\]/).pop() || 'Untitled';
      const newTabId = `file-${Date.now()}`;
      const newTab: EditorTab = {
        id: newTabId,
        name: fileName,
        path: data.path,
        content: data.content,
        language: data.language,
        isDirty: false,
        isActive: true,
      };
      setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), newTab]);
      setActiveTabId(newTabId);
    });

    // Handle TODO update event - show todo panel in editor
    // Track previous todo count to detect creation vs update
    let prevTodoCount = 0;
    const unsubTodo = window.electronAPI.agent.onTodoUpdate?.((todos) => {
      const currentCount = todos?.length || 0;
      const wasEmpty = prevTodoCount === 0;
      const isCreation = wasEmpty && currentCount > 0;
      prevTodoCount = currentCount;

      // Only auto-open TODO tab when todos are first CREATED (0 -> some)
      // Updates to existing todos don't auto-switch to the tab
      if (isCreation) {
        // Exit fullscreen mode to show editor area with TODO panel
        setIsBottomPanelFullscreen(false);

        // Check if TODO tab already exists
        setTabs(prev => {
          const existingTodoTab = prev.find(t => t.id === TODO_TAB_ID);
          if (existingTodoTab) {
            // Just switch to it
            return prev.map(t => ({ ...t, isActive: t.id === TODO_TAB_ID }));
          }
          // Create new TODO tab
          const todoTab: EditorTab = {
            id: TODO_TAB_ID,
            name: 'Tasks',
            path: '',
            content: '',
            language: 'plaintext',
            isDirty: false,
            isActive: true,
            type: 'todo',
          };
          return [...prev.map(t => ({ ...t, isActive: false })), todoTab];
        });
        setActiveTabId(TODO_TAB_ID);
      }
    });

    return () => {
      unsubEdit?.();
      unsubCreate?.();
      unsubTodo?.();
    };
  }, []);

  // Load endpoints for model selector - reload when Settings closes
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
    // Load on mount and when settings dialog closes
    if (!isSettingsOpen) {
      loadEndpoints();
    }
  }, [isSettingsOpen]);

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

  // New file handler
  const handleNewFile = useCallback(() => {
    const newTabId = `new-${Date.now()}`;
    const newTab: EditorTab = {
      id: newTabId,
      name: 'Untitled',
      path: '',
      content: '',
      language: 'plaintext',
      isDirty: true,
      isActive: true,
    };
    setTabs(prev => [...prev.map(t => ({ ...t, isActive: false })), newTab]);
    setActiveTabId(newTabId);
  }, []);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  // Command handlers for slash commands
  const commandHandlers = useMemo(() => ({
    onHelp: () => {
      setIsHelpOpen(true);
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
      setIsDocsBrowserOpen(true);
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

  // Update modal handlers
  const handleUpdateInstall = useCallback(() => {
    window.electronAPI?.update?.install();
  }, []);

  const handleUpdateLater = useCallback(() => {
    setUpdateModalOpen(false);
    // If available, start background download
    if (updateStatus === 'available') {
      window.electronAPI?.update?.startDownload();
    }
  }, [updateStatus]);

  const handleUpdateClose = useCallback(() => {
    setUpdateModalOpen(false);
    // If available, start background download
    if (updateStatus === 'available') {
      window.electronAPI?.update?.startDownload();
    }
  }, [updateStatus]);


  return (
    <AgentProvider>
    <div
      className={`app-root ${!isFocused ? 'unfocused' : ''}`}
      data-theme={theme}
      data-palette={colorPalette}
      style={{ '--user-font-size': `${fontSize}px` } as React.CSSProperties}
    >
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
        recentCommands={recentCommands}
        onCommandExecute={handleCommandExecute}
      />

      {/* Session Browser (Lazy) */}
      {isSessionBrowserOpen && (
        <Suspense fallback={<div className="loading-fallback">Loading...</div>}>
          <SessionBrowser
            isOpen={isSessionBrowserOpen}
            onClose={() => setIsSessionBrowserOpen(false)}
            onLoadSession={handleSessionLoad}
            onDeleteCurrentSession={handleDeleteCurrentSession}
            currentSessionId={currentSession?.id}
          />
        </Suspense>
      )}

      {/* Settings (Lazy) */}
      {isSettingsOpen && (
        <Suspense fallback={<div className="loading-fallback">Loading...</div>}>
          <Settings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Suspense>
      )}

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="info-modal-backdrop" onClick={() => setIsInfoOpen(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h2>Local CLI</h2>
              <button className="info-close-btn" onClick={() => setIsInfoOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="info-modal-content">
              <div className="info-item">
                <span className="info-label">Version</span>
                <span className="info-value">1.0.0</span>
              </div>
              <div className="info-item">
                <span className="info-label">Developer</span>
                <span className="info-value">syngha.han</span>
              </div>
              <div className="info-item">
                <span className="info-label">Contact</span>
                <span className="info-value">gkstmdgk2731@naver.com</span>
              </div>
            </div>
            <div className="info-modal-footer">
              <button className="info-ok-btn" onClick={() => setIsInfoOpen(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="info-modal-backdrop" onClick={() => setIsHelpOpen(false)}>
          <div className="info-modal help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="info-close-btn" onClick={() => setIsHelpOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="info-modal-content help-content">
              <div className="help-section">
                <h3>General</h3>
                <div className="help-item"><kbd>Ctrl+Shift+P</kbd><span>Command Palette</span></div>
                <div className="help-item"><kbd>Ctrl+,</kbd><span>Settings</span></div>
                <div className="help-item"><kbd>F1</kbd><span>Help</span></div>
              </div>
              <div className="help-section">
                <h3>Chat</h3>
                <div className="help-item"><kbd>Ctrl+N</kbd><span>New Session</span></div>
                <div className="help-item"><kbd>Ctrl+O</kbd><span>Load Session</span></div>
                <div className="help-item"><kbd>Ctrl+L</kbd><span>Clear Chat</span></div>
                <div className="help-item"><kbd>Ctrl+M</kbd><span>Change Model</span></div>
              </div>
              <div className="help-section">
                <h3>Editor</h3>
                <div className="help-item"><kbd>Ctrl+S</kbd><span>Save File</span></div>
                <div className="help-item"><kbd>Ctrl+Shift+O</kbd><span>Open Folder</span></div>
                <div className="help-item"><kbd>Ctrl+`</kbd><span>Toggle Terminal</span></div>
              </div>
              <div className="help-section">
                <h3>Panel</h3>
                <div className="help-item"><kbd>Ctrl+B</kbd><span>Toggle Sidebar</span></div>
                <div className="help-item"><kbd>Ctrl+J</kbd><span>Toggle Bottom Panel</span></div>
                <div className="help-item"><kbd>Esc</kbd><span>Exit Fullscreen</span></div>
              </div>
            </div>
            <div className="info-modal-footer">
              <button className="info-ok-btn" onClick={() => setIsHelpOpen(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Statistics (Lazy) */}
      {isUsageStatsOpen && (
        <Suspense fallback={<div className="loading-fallback">Loading...</div>}>
          <UsageStats
            isOpen={isUsageStatsOpen}
            onClose={() => setIsUsageStatsOpen(false)}
          />
        </Suspense>
      )}

      {/* Tool Selector (Lazy) */}
      {isToolSelectorOpen && (
        <Suspense fallback={<div className="loading-fallback">Loading...</div>}>
          <ToolSelector
            isOpen={isToolSelectorOpen}
            onClose={() => setIsToolSelectorOpen(false)}
          />
        </Suspense>
      )}

      {/* Documentation Browser (Lazy) */}
      {isDocsBrowserOpen && (
        <Suspense fallback={<div className="loading-fallback">Loading...</div>}>
          <DocsBrowser
            isOpen={isDocsBrowserOpen}
            onClose={() => setIsDocsBrowserOpen(false)}
          />
        </Suspense>
      )}

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
        onNewFile={handleNewFile}
        onSave={activeTabId ? () => saveFile(activeTabId) : undefined}
        onInfo={() => setIsInfoOpen(true)}
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
          {/* Search button removed */}
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
            {/* Search panel removed */}
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
            <EditorArea
              tabs={tabs}
              activeTab={activeTab}
              activeTabId={activeTabId}
              setActiveTabId={setActiveTabId}
              closeTab={closeTab}
              updateTabContent={updateTabContent}
              saveFile={saveFile}
              editorSplitEnabled={editorSplitEnabled}
              bottomPanelOpen={bottomPanelOpen}
              bottomPanelHeight={bottomPanelHeight}
            />
          )}

          {/* Bottom Panel */}
          <BottomPanel
            isOpen={bottomPanelOpen}
            layout={bottomPanelLayout}
            isFullscreen={isBottomPanelFullscreen}
            height={bottomPanelHeight}
            layoutState={layoutState}
            currentDirectory={currentDirectory}
            currentSession={currentSession}
            allowAllPermissions={allowAllPermissions}
            endpoints={endpoints}
            currentEndpointId={currentEndpointId}
            isModelDropdownOpen={isModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
            chatPanelRef={chatPanelRef}
            commandHandlers={commandHandlers}
            onLayoutChange={setBottomPanelLayout}
            onFullscreenToggle={() => setIsBottomPanelFullscreen(prev => !prev)}
            onHeightChange={setBottomPanelHeight}
            onCollapse={() => setBottomPanelOpen(false)}
            onSessionChange={setCurrentSession}
            onClearSession={handleClearSession}
            onNewSession={handleNewSession}
            onLoadSession={handleLoadSession}
            onAllowAllPermissionsChange={setAllowAllPermissions}
            onModelDropdownToggle={() => setIsModelDropdownOpen(prev => !prev)}
            onSelectModel={handleSelectModel}
          />

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

      {/* Status Bar removed */}

      {/* Update Modal (Lazy) */}
      {updateModalOpen && (
        <Suspense fallback={null}>
          <UpdateModal
            isOpen={updateModalOpen}
            status={updateStatus}
            updateInfo={updateInfo}
            progress={updateProgress}
            error={updateError}
            onInstall={handleUpdateInstall}
            onLater={handleUpdateLater}
            onClose={handleUpdateClose}
          />
        </Suspense>
      )}
    </div>
    </AgentProvider>
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
