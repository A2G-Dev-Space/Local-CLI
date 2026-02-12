/// <reference types="vite/client" />

// ============ 타입 정의 ============

// PowerShell 타입
export interface PowerShellResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  error?: string;
  duration?: number;
}

export interface PowerShellOutput {
  type: 'stdout' | 'stderr' | 'error' | 'exit';
  data: string;
  timestamp: number;
}

export interface PowerShellExitEvent {
  code: number | null;
  sessionId: string;
}

export interface PowerShellErrorEvent {
  error: string;
  sessionId: string;
}

export interface SessionInfo {
  id: string;
  state: 'idle' | 'running' | 'busy' | 'error' | 'terminated';
  startTime: number;
  currentDirectory: string;
  lastActivity: number;
}

// 시스템 정보 타입
export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
  appPath: string;
  userDataPath: string;
  tempPath: string;
}

// 다이얼로그 타입
export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface DialogResult {
  success: boolean;
  canceled: boolean;
  filePath?: string;
  filePaths?: string[];
  error?: string;
}

export interface MessageDialogOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
}

// 로그 파일 타입
export interface LogFile {
  name: string;
  path: string;
  size: number;
  date: string;
}

// 테마 타입
export type Theme = 'dark' | 'light';

// ============ Electron API 인터페이스 ============

export interface ElectronAPI {
  // 윈도우 제어
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
    onFocusChange: (callback: (isFocused: boolean) => void) => () => void;
    reload: () => Promise<{ success: boolean }>;
    getWindowType: () => Promise<'chat' | 'task'>;
  };

  // Task 윈도우 제어
  taskWindow: {
    toggle: () => Promise<{ success: boolean; visible?: boolean }>;
    show: () => Promise<{ success: boolean }>;
    hide: () => Promise<{ success: boolean }>;
    isVisible: () => Promise<boolean>;
    setAlwaysOnTop: (value: boolean) => Promise<{ success: boolean; alwaysOnTop?: boolean }>;
    isAlwaysOnTop: () => Promise<boolean>;
  };

  // 테마
  theme: {
    getSystem: () => Promise<Theme>;
    onChange: (callback: (theme: Theme) => void) => () => void;
    onAppearanceChange?: (callback: (data: { key: string; value: unknown }) => void) => () => void;
  };

  // 다이얼로그
  dialog: {
    openFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: FileFilter[];
      multiSelections?: boolean;
    }) => Promise<DialogResult>;

    saveFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: FileFilter[];
    }) => Promise<DialogResult>;

    openFolder: (options?: {
      title?: string;
      defaultPath?: string;
      multiSelections?: boolean;
    }) => Promise<DialogResult>;

    showMessage: (options: MessageDialogOptions) => Promise<{
      success: boolean;
      response?: number;
      error?: string;
    }>;
  };

  // 파일 시스템
  fs: {
    readFile: (filePath: string) => Promise<{
      success: boolean;
      content?: string;
      error?: string;
    }>;

    writeFile: (filePath: string, content: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    exists: (filePath: string) => Promise<boolean>;

    readDir: (dirPath: string) => Promise<{
      success: boolean;
      files?: string[];
      error?: string;
    }>;
  };

  // Shell
  shell: {
    showItemInFolder: (filePath: string) => Promise<{ success: boolean }>;
    openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    openExternal: (url: string) => Promise<{ success: boolean }>;
  };

  // VSCode
  vscode: {
    isAvailable: () => Promise<{ available: boolean; autoDetected: boolean }>;
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string; fallback?: boolean }>;
    openDiff: (originalPath: string, modifiedPath: string, title?: string) => Promise<{ success: boolean; error?: string; fallback?: boolean }>;
    openDiffWithContent: (data: {
      filePath: string;
      originalContent: string;
      newContent: string;
    }) => Promise<{ success: boolean; error?: string; fallback?: boolean }>;
    setPath: (vscodePath: string | null) => Promise<{ success: boolean; error?: string }>;
    getPath: () => Promise<{ path: string | null }>;
  };

  // PowerShell
  powershell: {
    startSession: () => Promise<{
      success: boolean;
      session?: SessionInfo;
      error?: string;
    }>;

    execute: (command: string) => Promise<PowerShellResult>;

    executeOnce: (command: string, cwd?: string) => Promise<PowerShellResult>;

    sendInput: (input: string) => Promise<{ success: boolean }>;

    interrupt: () => Promise<{ success: boolean }>;

    terminate: () => Promise<{ success: boolean }>;

    restart: () => Promise<{
      success: boolean;
      session?: SessionInfo;
      error?: string;
    }>;

    getSessionInfo: () => Promise<SessionInfo>;

    isRunning: () => Promise<boolean>;

    changeDirectory: (newPath: string) => Promise<{ success: boolean }>;

    getCurrentDirectory: () => Promise<{
      success: boolean;
      directory?: string;
    }>;

    onOutput: (callback: (output: PowerShellOutput) => void) => () => void;

    onExit: (callback: (event: PowerShellExitEvent) => void) => () => void;

    onError: (callback: (event: PowerShellErrorEvent) => void) => () => void;
  };

  // 로그
  log: {
    getFiles: () => Promise<LogFile[]>;

    readFile: (filePath: string) => Promise<{
      success: boolean;
      content?: string;
      error?: string;
    }>;

    openInExplorer: (filePath?: string) => Promise<{ success: boolean }>;

    openDirectory: () => Promise<{ success: boolean }>;

    setLevel: (level: number) => Promise<{ success: boolean }>;

    getLevel: () => Promise<number>;

    getCurrentPath: () => Promise<string>;
  };

  // 시스템
  system: {
    info: () => Promise<SystemInfo>;
  };

  // 앱 제어
  app: {
    restart: () => Promise<void>;
    quit: () => Promise<void>;
  };

  // 개발자 도구
  devTools: {
    toggle: () => Promise<{ success: boolean }>;
  };

  // Image (Vision 첨부)
  image: {
    saveFromClipboard: (base64: string, mimeType: string) => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
    selectFile: () => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
  };

  // Auth (Dashboard 인증)
  auth: {
    getCredentials: () => Promise<{
      success: boolean;
      credentials?: {
        email: string | null;
        displayName: string | null;
        provider: string | null;
        plan?: { name: string; displayName: string; tier: string } | null;
        expiresAt: string;
      } | null;
      error?: string;
    }>;
    logout: () => Promise<{ success: boolean; error?: string }>;
  };
}

// ============ 전역 타입 선언 ============

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Vite 환경 변수 타입
interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
