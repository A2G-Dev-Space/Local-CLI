/**
 * IPC Handlers for Electron Main Process
 * - 파일 열기/저장 다이얼로그
 * - 폴더 선택 다이얼로그
 * - CLI 재시작 기능
 * - 현재 작업 디렉토리 변경
 * - 로그 관련 기능
 */

import { ipcMain, dialog, shell, app, BrowserWindow, nativeTheme } from 'electron';
import fs from 'fs';
import { logger, LogLevel } from './utils/logger';
import { powerShellManager, PowerShellOutput, SessionInfo } from './powershell-manager';
import { configManager, AppConfig, EndpointConfig } from './core/config';
import { sessionManager, Session, SessionSummary, ChatMessage } from './core/session';
import { llmClient, Message } from './core/llm';
import { compactConversation, canCompact, CompactContext } from './core/compact';
import { usageTracker } from './core/usage-tracker';
import { toolManager } from './tool-manager';
import {
  runAgent,
  abortAgent,
  isAgentRunning,
  getCurrentTodos,
  setCurrentTodos,
  setAgentMainWindow,
  setAgentTaskWindow,
  simpleChat,
  handleToolApprovalResponse,
  clearAlwaysApprovedTools,
  AgentConfig,
  AgentCallbacks,
  TodoItem,
  AskUserRequest,
  AskUserResponse,
} from './orchestration';
import {
  getDocsInfoForIpc as getDocsInfo,
  downloadDocs,
  deleteDocs,
  openDocsFolder,
  DownloadProgress,
} from './core/docs-manager';

// 파일 필터 타입
interface FileFilter {
  name: string;
  extensions: string[];
}

// 다이얼로그 결과 타입
interface DialogResult {
  success: boolean;
  canceled: boolean;
  filePath?: string;
  filePaths?: string[];
  error?: string;
}

// 파일 내용 결과 타입
interface FileContentResult {
  success: boolean;
  content?: string;
  error?: string;
}

// 윈도우 참조 (index.ts에서 설정)
let chatWindow: BrowserWindow | null = null;
let taskWindow: BrowserWindow | null = null;

/**
 * Chat 윈도우 설정 (메인)
 */
export function setChatWindow(win: BrowserWindow): void {
  chatWindow = win;
}

/**
 * Task 윈도우 설정 (보조)
 */
export function setTaskWindow(win: BrowserWindow | null): void {
  taskWindow = win;
}

/**
 * 양쪽 윈도우에 IPC 메시지 전송
 */
function broadcastToAll(channel: string, ...args: unknown[]): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send(channel, ...args);
  }
  if (taskWindow && !taskWindow.isDestroyed()) {
    taskWindow.webContents.send(channel, ...args);
  }
}

/**
 * 파일 수정 이벤트 발송 (for Diff View)
 */
export function sendFileEditEvent(data: {
  path: string;
  originalContent: string;
  newContent: string;
  language: string;
}): void {
  chatWindow?.webContents.send('agent:fileEdit', data);
}

/**
 * 파일 생성 이벤트 발송
 */
export function sendFileCreateEvent(data: {
  path: string;
  content: string;
  language: string;
}): void {
  chatWindow?.webContents.send('agent:fileCreate', data);
}

/**
 * IPC 핸들러 등록
 */
export function setupIpcHandlers(): void {
  // ============ 윈도우 제어 (event.sender 기반) ============

  // 창 최소화
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  // 창 최대화/복원
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.restore();
    } else {
      win?.maximize();
    }
  });

  // 창 닫기
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  // 창 최대화 상태 확인
  ipcMain.handle('window:isMaximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });

  // 창 최대화 상태 변경 이벤트 전달
  ipcMain.handle('window:onMaximizeChange', () => {
    return true;
  });

  // ============ 윈도우 타입 판별 ============

  ipcMain.handle('window:getType', (event) => {
    // BrowserWindow.fromWebContents로 정확한 윈도우 매칭
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin && taskWindow && !taskWindow.isDestroyed() && senderWin.id === taskWindow.id) {
      return 'task';
    }
    return 'chat';
  });

  // ============ Task 윈도우 제어 ============

  ipcMain.handle('task-window:toggle', () => {
    if (taskWindow && !taskWindow.isDestroyed()) {
      if (taskWindow.isVisible()) {
        taskWindow.hide();
      } else {
        taskWindow.show();
      }
      const visible = taskWindow.isVisible();
      return { success: true, visible };
    }
    return { success: false, visible: false };
  });

  ipcMain.handle('task-window:show', () => {
    if (taskWindow && !taskWindow.isDestroyed()) {
      taskWindow.show();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('task-window:hide', () => {
    if (taskWindow && !taskWindow.isDestroyed()) {
      taskWindow.hide();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('task-window:isVisible', () => {
    return taskWindow && !taskWindow.isDestroyed() ? taskWindow.isVisible() : false;
  });

  // Task 윈도우 항상 맨 위에 고정 (pin)
  ipcMain.handle('task-window:setAlwaysOnTop', (_event, value: boolean) => {
    if (taskWindow && !taskWindow.isDestroyed()) {
      taskWindow.setAlwaysOnTop(value, 'floating');
      return { success: true, alwaysOnTop: value };
    }
    return { success: false };
  });

  ipcMain.handle('task-window:isAlwaysOnTop', () => {
    return taskWindow && !taskWindow.isDestroyed() ? taskWindow.isAlwaysOnTop() : false;
  });

  // ============ 테마 ============

  // 시스템 테마 가져오기
  ipcMain.handle('theme:getSystem', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // 테마 변경 이벤트 설정
  ipcMain.handle('theme:onChange', () => {
    // 렌더러에서 이벤트 리스너 등록 확인
    return true;
  });

  // ============ Config ============

  // Config 전체 가져오기
  ipcMain.handle('config:getAll', () => {
    return configManager.getAll();
  });

  // Config 특정 값 가져오기
  ipcMain.handle('config:get', (_event, key: keyof AppConfig) => {
    return configManager.get(key);
  });

  // Config 특정 값 설정
  ipcMain.handle('config:set', async (_event, key: keyof AppConfig, value: unknown) => {
    await configManager.set(key, value as AppConfig[typeof key]);

    // 외관 관련 설정 변경 시 모든 윈도우에 브로드캐스트
    const appearanceKeys = ['fontSize', 'fontFamily', 'colorPalette', 'theme'];
    if (appearanceKeys.includes(key)) {
      broadcastToAll('appearance:change', { key, value });
    }

    return true;
  });

  // Config 여러 값 업데이트
  ipcMain.handle('config:update', async (_event, updates: Partial<AppConfig>) => {
    await configManager.update(updates);
    return true;
  });

  // 테마 설정
  ipcMain.handle('config:setTheme', async (_event, theme: 'light' | 'dark' | 'system') => {
    await configManager.setTheme(theme);
    return true;
  });

  // 테마 가져오기
  ipcMain.handle('config:getTheme', () => {
    return configManager.getTheme();
  });

  // Config 경로 가져오기
  ipcMain.handle('config:getPath', () => {
    return {
      configPath: configManager.getConfigPath(),
      configDir: configManager.getConfigDirectory(),
    };
  });

  // ============ Session ============

  // 새 세션 생성
  ipcMain.handle('session:create', async (_event, name?: string, workingDirectory?: string): Promise<{ success: boolean; session?: Session; error?: string }> => {
    logger.ipcHandle('session:create', { name, workingDirectory });
    try {
      const session = await sessionManager.createSession(name, workingDirectory);
      logger.sessionStart({ sessionId: session.id, name: session.name, workingDirectory });

      // Reset context tracker for fresh session (prevents stale context from leaking)
      contextTracker.reset();

      // Clear always-approved tools for new session (Supervised Mode)
      clearAlwaysApprovedTools();

      // Notify renderer that context is reset
      broadcastToAll('agent:contextUpdate', {
        usagePercentage: 0,
        currentTokens: 0,
        maxTokens: 128000,
      });

      return { success: true, session };
    } catch (error) {
      logger.error('Failed to create session', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 로드
  ipcMain.handle('session:load', async (_event, sessionId: string): Promise<{ success: boolean; session?: Session; error?: string }> => {
    logger.ipcHandle('session:load', { sessionId });
    try {
      const session = await sessionManager.loadSession(sessionId);
      if (session) {
        logger.flow('Session loaded', { sessionId, messageCount: session.messages?.length || 0 });
        return { success: true, session };
      }
      logger.warn('Session not found', { sessionId });
      return { success: false, error: 'Session not found' };
    } catch (error) {
      logger.error('Failed to load session', { sessionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 저장
  ipcMain.handle('session:save', async (_event, session: Session): Promise<{ success: boolean; error?: string }> => {
    logger.ipcHandle('session:save', { sessionId: session.id, messageCount: session.messages?.length || 0 });
    try {
      const success = await sessionManager.saveSession(session);
      logger.flow('Session saved', { sessionId: session.id, success });
      return { success };
    } catch (error) {
      logger.ipcError('session:save', { sessionId: session.id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 현재 세션 저장
  ipcMain.handle('session:saveCurrent', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await sessionManager.saveCurrentSession();
      return { success };
    } catch (error) {
      logger.error('Failed to save current session', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 삭제
  ipcMain.handle('session:delete', async (_event, sessionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await sessionManager.deleteSession(sessionId);
      return { success };
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 목록 가져오기
  ipcMain.handle('session:list', async (): Promise<{ success: boolean; sessions?: SessionSummary[]; error?: string }> => {
    try {
      const sessions = await sessionManager.listSessions();
      return { success: true, sessions };
    } catch (error) {
      logger.error('Failed to list sessions', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 현재 세션 가져오기
  ipcMain.handle('session:getCurrent', (): Session | null => {
    return sessionManager.getCurrentSession();
  });

  // 현재 세션 설정
  ipcMain.handle('session:setCurrent', (_event, session: Session | null) => {
    sessionManager.setCurrentSession(session);
    return { success: true };
  });

  // 메시지 추가
  ipcMain.handle('session:addMessage', async (_event, message: ChatMessage): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await sessionManager.addMessage(message);
      return { success };
    } catch (error) {
      logger.error('Failed to add message', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 이름 변경
  ipcMain.handle('session:rename', async (_event, sessionId: string, newName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await sessionManager.renameSession(sessionId, newName);
      return { success };
    } catch (error) {
      logger.error('Failed to rename session', { sessionId, newName, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 복제
  ipcMain.handle('session:duplicate', async (_event, sessionId: string): Promise<{ success: boolean; session?: Session; error?: string }> => {
    try {
      const session = await sessionManager.duplicateSession(sessionId);
      if (session) {
        return { success: true, session };
      }
      return { success: false, error: 'Failed to duplicate session' };
    } catch (error) {
      logger.error('Failed to duplicate session', { sessionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 내보내기
  ipcMain.handle('session:export', async (_event, sessionId: string): Promise<{ success: boolean; data?: string; error?: string }> => {
    try {
      const data = await sessionManager.exportSession(sessionId);
      if (data) {
        return { success: true, data };
      }
      return { success: false, error: 'Session not found' };
    } catch (error) {
      logger.error('Failed to export session', { sessionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 가져오기
  ipcMain.handle('session:import', async (_event, jsonData: string): Promise<{ success: boolean; session?: Session; error?: string }> => {
    try {
      const session = await sessionManager.importSession(jsonData);
      if (session) {
        return { success: true, session };
      }
      return { success: false, error: 'Invalid session data' };
    } catch (error) {
      logger.error('Failed to import session', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 검색
  ipcMain.handle('session:search', async (_event, query: string): Promise<{ success: boolean; sessions?: SessionSummary[]; error?: string }> => {
    try {
      const sessions = await sessionManager.searchSessions(query);
      return { success: true, sessions };
    } catch (error) {
      logger.error('Failed to search sessions', { query, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 경로 가져오기
  ipcMain.handle('session:getPath', () => {
    return {
      sessionsDir: sessionManager.getSessionsDirectory(),
    };
  });

  // ============ 파일 다이얼로그 ============

  // 파일 열기 다이얼로그
  ipcMain.handle(
    'dialog:openFile',
    async (
      _event,
      options?: {
        title?: string;
        defaultPath?: string;
        filters?: FileFilter[];
        multiSelections?: boolean;
      }
    ): Promise<DialogResult> => {
      logger.ipcHandle('dialog:openFile', { title: options?.title, defaultPath: options?.defaultPath });
      try {
        const result = await dialog.showOpenDialog(chatWindow!, {
          title: options?.title || '파일 열기',
          defaultPath: options?.defaultPath,
          filters: options?.filters || [{ name: '모든 파일', extensions: ['*'] }],
          properties: options?.multiSelections
            ? ['openFile', 'multiSelections']
            : ['openFile'],
        });

        return {
          success: !result.canceled,
          canceled: result.canceled,
          filePaths: result.filePaths,
          filePath: result.filePaths[0],
        };
      } catch (error) {
        logger.error('Failed to open file dialog', error);
        return {
          success: false,
          canceled: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 파일 저장 다이얼로그
  ipcMain.handle(
    'dialog:saveFile',
    async (
      _event,
      options?: {
        title?: string;
        defaultPath?: string;
        filters?: FileFilter[];
      }
    ): Promise<DialogResult> => {
      try {
        const result = await dialog.showSaveDialog(chatWindow!, {
          title: options?.title || '파일 저장',
          defaultPath: options?.defaultPath,
          filters: options?.filters || [{ name: '모든 파일', extensions: ['*'] }],
        });

        return {
          success: !result.canceled && !!result.filePath,
          canceled: result.canceled,
          filePath: result.filePath,
        };
      } catch (error) {
        logger.error('Failed to save file dialog', error);
        return {
          success: false,
          canceled: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 폴더 선택 다이얼로그
  ipcMain.handle(
    'dialog:openFolder',
    async (
      _event,
      options?: {
        title?: string;
        defaultPath?: string;
        multiSelections?: boolean;
      }
    ): Promise<DialogResult> => {
      try {
        const result = await dialog.showOpenDialog(chatWindow!, {
          title: options?.title || '폴더 선택',
          defaultPath: options?.defaultPath,
          properties: options?.multiSelections
            ? ['openDirectory', 'multiSelections']
            : ['openDirectory'],
        });

        return {
          success: !result.canceled,
          canceled: result.canceled,
          filePaths: result.filePaths,
          filePath: result.filePaths[0],
        };
      } catch (error) {
        logger.error('Failed to open folder dialog', error);
        return {
          success: false,
          canceled: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 메시지 박스 표시
  ipcMain.handle(
    'dialog:showMessage',
    async (
      _event,
      options: {
        type?: 'none' | 'info' | 'error' | 'question' | 'warning';
        title?: string;
        message: string;
        detail?: string;
        buttons?: string[];
      }
    ) => {
      try {
        const result = await dialog.showMessageBox(chatWindow!, {
          type: options.type || 'info',
          title: options.title || 'Local CLI',
          message: options.message,
          detail: options.detail,
          buttons: options.buttons || ['확인'],
        });

        return {
          success: true,
          response: result.response,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // ============ 파일 시스템 ============

  // 파일 읽기
  ipcMain.handle(
    'fs:readFile',
    async (_event, filePath: string): Promise<FileContentResult> => {
      logger.ipcHandle('fs:readFile', { filePath });
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        logger.flow('File read successfully', { filePath, contentLength: content.length });
        return { success: true, content };
      } catch (error) {
        logger.ipcError('fs:readFile', { filePath, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 파일 쓰기
  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, content: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        logger.error('Failed to write file', { filePath, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 파일 존재 확인
  ipcMain.handle('fs:exists', async (_event, filePath: string): Promise<boolean> => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // 디렉토리 내용 읽기
  ipcMain.handle(
    'fs:readDir',
    async (_event, dirPath: string): Promise<{ success: boolean; files?: string[]; error?: string }> => {
      try {
        const files = await fs.promises.readdir(dirPath);
        return { success: true, files };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // 탐색기에서 열기
  ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // 외부 프로그램으로 열기
  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    const result = await shell.openPath(filePath);
    return { success: !result, error: result || undefined };
  });

  // 외부 URL 열기
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  // ============ VSCode Integration ============

  // Helper: Get VSCode command (custom path or 'code')
  const getVSCodeCommand = (): string => {
    const customPath = configManager.get('vscodePath');
    if (customPath && typeof customPath === 'string') {
      // Windows paths with spaces need quotes
      return `"${customPath}"`;
    }
    return 'code';
  };

  // Check if VSCode is available (auto-detect from PATH)
  ipcMain.handle('vscode:isAvailable', async () => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Try to get VSCode version using 'code' command in PATH
      await execAsync('code --version');
      return { available: true, autoDetected: true };
    } catch {
      return { available: false, autoDetected: false };
    }
  });

  // Open file in VSCode
  ipcMain.handle('vscode:openFile', async (_event, filePath: string) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const vscodeCmd = getVSCodeCommand();

    try {
      await execAsync(`${vscodeCmd} "${filePath}"`);
      return { success: true };
    } catch (error) {
      // Fallback to shell.openPath
      const result = await shell.openPath(filePath);
      return { success: !result, error: result || undefined, fallback: true };
    }
  });

  // Open diff in VSCode
  ipcMain.handle('vscode:openDiff', async (_event, originalPath: string, modifiedPath: string, title?: string) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const vscodeCmd = getVSCodeCommand();

    try {
      // VSCode diff command: code --diff file1 file2
      const titleArg = title ? ` --title "${title}"` : '';
      await execAsync(`${vscodeCmd} --diff "${originalPath}" "${modifiedPath}"${titleArg}`);
      return { success: true };
    } catch (error) {
      // Fallback to opening the modified file
      const result = await shell.openPath(modifiedPath);
      return { success: !result, error: result || undefined, fallback: true };
    }
  });

  // Open diff with temp files (for showing edit diff)
  ipcMain.handle('vscode:openDiffWithContent', async (_event, data: {
    filePath: string;
    originalContent: string;
    newContent: string;
  }) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const os = await import('os');
    const fsPromises = await import('fs/promises');
    const pathModule = await import('path');
    const vscodeCmd = getVSCodeCommand();

    const { filePath, originalContent, newContent } = data;
    const ext = pathModule.extname(filePath);
    const baseName = pathModule.basename(filePath, ext);

    // Create temp files for diff
    const tempDir = os.tmpdir();
    const originalTempPath = pathModule.join(tempDir, `${baseName}.original${ext}`);
    const modifiedTempPath = pathModule.join(tempDir, `${baseName}.modified${ext}`);

    try {
      // Write temp files
      await fsPromises.writeFile(originalTempPath, originalContent, 'utf-8');
      await fsPromises.writeFile(modifiedTempPath, newContent, 'utf-8');

      // Open diff in VSCode
      await execAsync(`${vscodeCmd} --diff "${originalTempPath}" "${modifiedTempPath}"`);

      // Clean up temp files after a delay (give VSCode time to read them)
      setTimeout(async () => {
        try {
          await fsPromises.unlink(originalTempPath);
          await fsPromises.unlink(modifiedTempPath);
        } catch {
          // Ignore cleanup errors
        }
      }, 5000);

      return { success: true };
    } catch (error) {
      // Fallback to opening the actual file
      const result = await shell.openPath(filePath);
      return { success: !result, error: result || undefined, fallback: true };
    }
  });

  // Set custom VSCode path
  ipcMain.handle('vscode:setPath', async (_event, vscodePath: string | null) => {
    try {
      if (vscodePath) {
        configManager.set('vscodePath', vscodePath);
      } else {
        // Clear custom path
        configManager.set('vscodePath', undefined);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get custom VSCode path
  ipcMain.handle('vscode:getPath', async () => {
    const customPath = configManager.get('vscodePath');
    return { path: customPath || null };
  });

  // ============ PowerShell ============

  // PowerShell 세션 시작
  ipcMain.handle('powershell:startSession', async (): Promise<{ success: boolean; session?: SessionInfo; error?: string }> => {
    try {
      const session = await powerShellManager.startSession();
      return { success: true, session };
    } catch (error) {
      logger.error('Failed to start PowerShell session', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // PowerShell 명령 실행 (세션 내)
  ipcMain.handle(
    'powershell:execute',
    async (_event, command: string) => {
      logger.ipcHandle('powershell:execute', { commandLength: command.length });
      try {
        const result = await powerShellManager.execute(command);
        logger.flow('PowerShell command executed', { exitCode: result.exitCode, outputLength: result.output?.length || 0 });
        return { ...result, success: true };
      } catch (error) {
        logger.ipcError('powershell:execute', { command, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // PowerShell 단일 명령 실행 (새 프로세스)
  ipcMain.handle(
    'powershell:executeOnce',
    async (_event, command: string, cwd?: string) => {
      try {
        const result = await powerShellManager.executeOnce(command, cwd);
        return { ...result };
      } catch (error) {
        logger.error('PowerShell executeOnce error', { command, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // PowerShell 입력 전송
  ipcMain.handle('powershell:sendInput', async (_event, input: string) => {
    const success = powerShellManager.sendInput(input);
    return { success };
  });

  // PowerShell 인터럽트
  ipcMain.handle('powershell:interrupt', async () => {
    powerShellManager.sendInterrupt();
    return { success: true };
  });

  // PowerShell 세션 종료
  ipcMain.handle('powershell:terminate', async () => {
    await powerShellManager.terminate();
    return { success: true };
  });

  // PowerShell 세션 재시작
  ipcMain.handle('powershell:restart', async () => {
    try {
      const session = await powerShellManager.restart();
      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // PowerShell 세션 정보
  ipcMain.handle('powershell:getSessionInfo', () => {
    return powerShellManager.getSessionInfo();
  });

  // PowerShell 상태 확인
  ipcMain.handle('powershell:isRunning', () => {
    return powerShellManager.isRunning();
  });

  // PowerShell 작업 디렉토리 변경
  ipcMain.handle('powershell:changeDirectory', async (_event, newPath: string) => {
    const success = await powerShellManager.changeDirectory(newPath);
    return { success };
  });

  // PowerShell 현재 디렉토리 가져오기
  ipcMain.handle('powershell:getCurrentDirectory', async () => {
    const directory = await powerShellManager.getCurrentDirectory();
    return { success: true, directory };
  });

  // PowerShell 출력 이벤트 리스너 설정
  powerShellManager.on('output', (output: PowerShellOutput) => {
    chatWindow?.webContents.send('powershell:output', output);
  });

  powerShellManager.on('exit', (data: { code: number | null; sessionId: string }) => {
    chatWindow?.webContents.send('powershell:exit', data);
  });

  powerShellManager.on('error', (data: { error: Error; sessionId: string }) => {
    chatWindow?.webContents.send('powershell:error', {
      error: data.error.message,
      sessionId: data.sessionId,
    });
  });

  // ============ 로그 ============

  // Renderer에서 보낸 로그 쓰기 (Log Viewer에 표시됨)
  ipcMain.on('log:write', (_event, level: string, message: string, data?: unknown) => {
    switch (level) {
      case 'error':
        logger.error(`[Renderer] ${message}`, data);
        break;
      case 'warn':
        logger.warn(`[Renderer] ${message}`, data);
        break;
      case 'info':
        logger.info(`[Renderer] ${message}`, data);
        break;
      case 'debug':
        logger.debug(`[Renderer] ${message}`, data);
        break;
      default:
        logger.info(`[Renderer] ${message}`, data);
    }
  });

  // 로그 파일 목록
  ipcMain.handle('log:getFiles', async () => {
    return await logger.getLogFiles();
  });

  // 로그 파일 내용 읽기
  ipcMain.handle('log:readFile', async (_event, filePath: string) => {
    try {
      const content = await logger.readLogFile(filePath);
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 로그 엔트리 읽기 (파싱됨)
  ipcMain.handle('log:readEntries', async (_event, filePath: string) => {
    try {
      const entries = await logger.readLogEntries(filePath);
      return { success: true, entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 로그 파일 탐색기에서 열기
  ipcMain.handle('log:openInExplorer', async (_event, filePath?: string) => {
    await logger.openLogFileInExplorer(filePath);
    return { success: true };
  });

  // 로그 디렉토리 열기
  ipcMain.handle('log:openDirectory', async () => {
    await logger.openLogDirectory();
    return { success: true };
  });

  // 로그 레벨 설정
  ipcMain.handle('log:setLevel', (_event, level: LogLevel) => {
    logger.setLogLevel(level);
    return { success: true };
  });

  // 로그 레벨 가져오기
  ipcMain.handle('log:getLevel', () => {
    return logger.getLogLevel();
  });

  // 현재 로그 파일 경로
  ipcMain.handle('log:getCurrentPath', () => {
    return logger.getLogFilePath();
  });

  // 로그 디렉토리 경로
  ipcMain.handle('log:getDirectory', () => {
    return logger.getLogDirectory();
  });

  // 로그 파일 삭제
  ipcMain.handle('log:deleteFile', async (_event, filePath: string) => {
    try {
      await logger.deleteLogFile(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 모든 로그 삭제
  ipcMain.handle('log:clearAll', async () => {
    try {
      const deletedCount = await logger.clearAllLogs();
      return { success: true, deletedCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 로그 스트리밍 관리
  let logStreamUnsubscribe: (() => void) | null = null;

  ipcMain.handle('log:startStreaming', () => {
    if (logStreamUnsubscribe) {
      return { success: true }; // 이미 스트리밍 중
    }

    logStreamUnsubscribe = logger.onLogEntry((entry) => {
      chatWindow?.webContents.send('log:entry', entry);
    });

    return { success: true };
  });

  ipcMain.handle('log:stopStreaming', () => {
    if (logStreamUnsubscribe) {
      logStreamUnsubscribe();
      logStreamUnsubscribe = null;
    }
    return { success: true };
  });

  // Session log handlers
  ipcMain.handle('log:setSession', (_event, sessionId: string | null) => {
    logger.setSessionId(sessionId);
    return { success: true };
  });

  ipcMain.handle('log:getSessionFiles', async () => {
    try {
      const files = await logger.getSessionLogFiles();
      return { success: true, files };
    } catch (error) {
      return { success: false, error: (error as Error).message, files: [] };
    }
  });

  ipcMain.handle('log:readSessionLog', async (_event, sessionId: string) => {
    try {
      const entries = await logger.readSessionLog(sessionId);
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: (error as Error).message, entries: [] };
    }
  });

  ipcMain.handle('log:deleteSessionLog', async (_event, sessionId: string) => {
    try {
      await logger.deleteSessionLog(sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('log:getCurrentSessionId', () => {
    return { success: true, sessionId: logger.getCurrentSessionId() };
  });

  // Current Run log handlers (이번 실행 로그)
  ipcMain.handle('log:getRunFiles', async () => {
    try {
      const files = await logger.getRunLogFiles();
      return { success: true, files };
    } catch (error) {
      return { success: false, error: (error as Error).message, files: [] };
    }
  });

  ipcMain.handle('log:getCurrentRunId', () => {
    return { success: true, runId: logger.getCurrentRunId() };
  });

  ipcMain.handle('log:readCurrentRunLog', async () => {
    try {
      const entries = await logger.readCurrentRunLog();
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: (error as Error).message, entries: [] };
    }
  });

  ipcMain.handle('log:readRunLog', async (_event, runId: string) => {
    try {
      const entries = await logger.readRunLog(runId);
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: (error as Error).message, entries: [] };
    }
  });

  ipcMain.handle('log:deleteRunLog', async (_event, runId: string) => {
    try {
      await logger.deleteRunLog(runId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ============ 시스템 ============

  // 시스템 정보
  ipcMain.handle('system:info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
    };
  });

  // 앱 재시작
  ipcMain.handle('app:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // 앱 종료
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  // ============ 자동 업데이트 ============

  // 현재 버전 가져오기
  ipcMain.handle('update:getVersion', () => {
    return app.getVersion();
  });

  // 다운로드 시작
  ipcMain.handle('update:startDownload', async () => {
    try {
      const { autoUpdater } = await import('electron-updater');
      autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // 설치 (재시작)
  ipcMain.handle('update:install', async () => {
    try {
      const { autoUpdater } = await import('electron-updater');
      autoUpdater.quitAndInstall();
    } catch (error) {
      logger.error('Failed to install update', { error });
    }
  });

  // 개발자 도구 토글
  ipcMain.handle('devTools:toggle', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools();
    return { success: true };
  });

  // 윈도우 리로드
  ipcMain.handle('window:reload', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.reload();
    return { success: true };
  });

  // ============ LLM ============

  // LLM endpoints 가져오기
  ipcMain.handle('llm:getEndpoints', () => {
    try {
      const result = configManager.getEndpoints();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Failed to get LLM endpoints', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // LLM endpoint 추가
  ipcMain.handle('llm:addEndpoint', async (_event, endpointData: Omit<EndpointConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const endpoint = await configManager.addEndpoint(endpointData);
      return { success: true, endpoint };
    } catch (error) {
      logger.error('Failed to add LLM endpoint', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // LLM endpoint 업데이트
  ipcMain.handle('llm:updateEndpoint', async (_event, endpointId: string, updates: Partial<EndpointConfig>) => {
    try {
      const success = await configManager.updateEndpoint(endpointId, updates);
      return { success };
    } catch (error) {
      logger.error('Failed to update LLM endpoint', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // LLM endpoint 삭제
  ipcMain.handle('llm:removeEndpoint', async (_event, endpointId: string) => {
    try {
      const success = await configManager.removeEndpoint(endpointId);
      return { success };
    } catch (error) {
      logger.error('Failed to remove LLM endpoint', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 현재 모델 설정 (endpoint 내 개별 모델)
  ipcMain.handle('llm:setCurrentModel', async (_event, modelId: string) => {
    try {
      const success = await configManager.setCurrentModel(modelId);
      return { success };
    } catch (error) {
      logger.error('Failed to set current LLM model', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 현재 endpoint 설정
  ipcMain.handle('llm:setCurrentEndpoint', async (_event, endpointId: string) => {
    try {
      const success = await configManager.setCurrentEndpoint(endpointId);
      return { success };
    } catch (error) {
      logger.error('Failed to set current LLM endpoint', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 연결 테스트
  ipcMain.handle('llm:testConnection', async (_event, baseUrl: string, apiKey: string | undefined, modelId: string) => {
    try {
      const result = await configManager.testConnection(baseUrl, apiKey, modelId);
      return result;
    } catch (error) {
      logger.error('Failed to test LLM connection', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 전체 health check
  ipcMain.handle('llm:healthCheckAll', async () => {
    try {
      await configManager.healthCheckAll();
      return { success: true };
    } catch (error) {
      logger.error('Failed to health check LLM endpoints', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 시스템 상태 가져오기
  ipcMain.handle('llm:getStatus', () => {
    try {
      const status = configManager.getStatus();
      return { success: true, status };
    } catch (error) {
      logger.error('Failed to get LLM status', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============ Chat (LLM) ============

  // 채팅 메시지 전송 (non-streaming)
  ipcMain.handle('chat:send', async (_event, messages: Message[]) => {
    logger.ipcHandle('chat:send', { messageCount: messages.length });
    try {
      const result = await llmClient.chat(messages, false);
      logger.flow('Chat send completed', { success: true });
      return { success: true, ...result };
    } catch (error) {
      logger.error('Chat send failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 채팅 메시지 전송 (streaming)
  ipcMain.handle('chat:sendStream', async (_event, messages: Message[]) => {
    logger.ipcHandle('chat:sendStream', { messageCount: messages.length });
    logger.httpStreamStart('POST', 'llm/chat');
    try {
      // Streaming은 IPC event로 청크 전송
      const result = await llmClient.chat(messages, true, (chunk, done) => {
        chatWindow?.webContents.send('chat:chunk', { chunk, done });
      });
      logger.httpStreamEnd(0, 0);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Chat stream failed', error);
      // 에러 발생시에도 done 이벤트 전송
      chatWindow?.webContents.send('chat:chunk', { chunk: '', done: true, error: true });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 간단한 메시지 전송
  ipcMain.handle('chat:sendMessage', async (_event, userMessage: string, systemPrompt?: string, stream?: boolean) => {
    try {
      if (stream) {
        const content = await llmClient.sendMessage(userMessage, systemPrompt, true, (chunk, done) => {
          chatWindow?.webContents.send('chat:chunk', { chunk, done });
        });
        return { success: true, content };
      } else {
        const content = await llmClient.sendMessage(userMessage, systemPrompt, false);
        return { success: true, content };
      }
    } catch (error) {
      logger.error('Send message failed', error);
      if (stream) {
        chatWindow?.webContents.send('chat:chunk', { chunk: '', done: true, error: true });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 요청 취소
  ipcMain.handle('chat:abort', () => {
    try {
      llmClient.abort();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 요청 활성 상태 확인
  ipcMain.handle('chat:isActive', () => {
    return llmClient.isRequestActive();
  });

  // ============ Compact ============

  // 대화 압축 실행
  ipcMain.handle('compact:execute', async (_event, messages: Message[], context: CompactContext) => {
    try {
      const result = await compactConversation(messages, context);
      return result;
    } catch (error) {
      logger.error('Compact execution failed', error);
      return {
        success: false,
        originalMessageCount: messages.length,
        newMessageCount: messages.length,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 압축 가능 여부 확인
  ipcMain.handle('compact:canCompact', (_event, messages: Message[]) => {
    return canCompact(messages);
  });

  // ============ Usage Tracking ============

  // 사용량 요약 가져오기
  ipcMain.handle('usage:getSummary', () => {
    try {
      return { success: true, summary: usageTracker.getSummary() };
    } catch (error) {
      logger.error('Failed to get usage summary', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 일별 통계 가져오기
  ipcMain.handle('usage:getDailyStats', (_event, days: number = 30) => {
    try {
      return { success: true, stats: usageTracker.getDailyStats(days) };
    } catch (error) {
      logger.error('Failed to get daily stats', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 세션 사용량 리셋
  ipcMain.handle('usage:resetSession', () => {
    try {
      usageTracker.resetSession();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 전체 사용량 데이터 삭제
  ipcMain.handle('usage:clearData', () => {
    try {
      usageTracker.clearData();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============ Tools ============

  // 도구 그룹 목록 가져오기
  ipcMain.handle('tools:getGroups', () => {
    try {
      return { success: true, groups: toolManager.getToolGroups() };
    } catch (error) {
      logger.error('Failed to get tool groups', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 사용 가능한 도구 그룹만 가져오기
  ipcMain.handle('tools:getAvailable', () => {
    try {
      return { success: true, groups: toolManager.getAvailableToolGroups() };
    } catch (error) {
      logger.error('Failed to get available tool groups', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 활성화된 도구 그룹 가져오기
  ipcMain.handle('tools:getEnabled', () => {
    try {
      return { success: true, groups: toolManager.getEnabledToolGroups() };
    } catch (error) {
      logger.error('Failed to get enabled tool groups', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 도구 그룹 활성화
  ipcMain.handle('tools:enable', async (_event, groupId: string) => {
    try {
      return await toolManager.enableToolGroup(groupId);
    } catch (error) {
      logger.error('Failed to enable tool group', { groupId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 도구 그룹 비활성화
  ipcMain.handle('tools:disable', async (_event, groupId: string) => {
    try {
      return await toolManager.disableToolGroup(groupId);
    } catch (error) {
      logger.error('Failed to disable tool group', { groupId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 도구 그룹 토글
  ipcMain.handle('tools:toggle', async (_event, groupId: string) => {
    try {
      return await toolManager.toggleToolGroup(groupId);
    } catch (error) {
      logger.error('Failed to toggle tool group', { groupId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 도구 요약 가져오기
  ipcMain.handle('tools:getSummary', () => {
    try {
      return { success: true, ...toolManager.getSummary() };
    } catch (error) {
      logger.error('Failed to get tool summary', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 도구 그룹 활성화 여부 확인
  ipcMain.handle('tools:isEnabled', (_event, groupId: string) => {
    return toolManager.isEnabled(groupId);
  });

  // ============ Agent ============

  // Pending ask user resolver
  let pendingAskUserResolve: ((response: AskUserResponse) => void) | null = null;

  // Agent 실행
  ipcMain.handle('agent:run', async (
    _event,
    userMessage: string,
    existingMessages: Message[],
    config: AgentConfig
  ) => {
    logger.ipcHandle('agent:run', { messageLength: userMessage.length, existingMessagesCount: existingMessages.length, config });
    try {
      // Set main window for agent IPC
      setAgentMainWindow(chatWindow);
      setAgentTaskWindow(taskWindow);

      // Set session ID for logging
      const currentSession = sessionManager.getCurrentSession();
      if (currentSession) {
        logger.setSessionId(currentSession.id);
      }

      // Setup callbacks for IPC communication
      const callbacks: AgentCallbacks = {
        onAskUser: async (request: AskUserRequest): Promise<AskUserResponse> => {
          // Send question to renderer
          chatWindow?.webContents.send('agent:askUser', request);

          // Wait for user response
          return new Promise((resolve) => {
            pendingAskUserResolve = resolve;
          });
        },
      };

      const result = await runAgent(userMessage, existingMessages, config, callbacks);
      return { ...result, success: result.success };
    } catch (error) {
      logger.error('Agent run failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Agent 중단
  ipcMain.handle('agent:abort', () => {
    try {
      abortAgent();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Agent 실행 상태 확인
  ipcMain.handle('agent:isRunning', () => {
    return isAgentRunning();
  });

  // 에이전트 상태 초기화 (Clear Chat 시 호출)
  ipcMain.handle('agent:clearState', () => {
    // Context tracker 초기화
    contextTracker.reset();

    // TODO 초기화
    setCurrentTodos([]);

    // Supervised Mode 승인 목록 초기화
    clearAlwaysApprovedTools();

    // 모든 윈도우에 초기화 브로드캐스트
    broadcastToAll('agent:contextUpdate', {
      usagePercentage: 0,
      currentTokens: 0,
      maxTokens: 128000,
    });
    broadcastToAll('agent:todoUpdate', []);

    logger.info('Agent state cleared (clear chat)');
    return { success: true };
  });

  // 현재 TODO 목록 가져오기
  ipcMain.handle('agent:getTodos', () => {
    return getCurrentTodos();
  });

  // TODO 목록 설정
  ipcMain.handle('agent:setTodos', (_event, todos: TodoItem[]) => {
    setCurrentTodos(todos);
    return { success: true };
  });

  // 간단한 채팅 (도구 없이)
  ipcMain.handle('agent:simpleChat', async (
    _event,
    userMessage: string,
    existingMessages: Message[],
    systemPrompt?: string,
    stream?: boolean
  ) => {
    try {
      if (stream) {
        const result = await simpleChat(userMessage, existingMessages, systemPrompt, (chunk) => {
          chatWindow?.webContents.send('agent:streamChunk', chunk);
        });
        return { success: true, ...result };
      } else {
        const result = await simpleChat(userMessage, existingMessages, systemPrompt);
        return { success: true, ...result };
      }
    } catch (error) {
      logger.error('Simple chat failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 사용자 질문 응답 (ask_to_user 도구 응답)
  // NOTE: renderer sends selectedOption as { label, value } object but main expects string
  ipcMain.handle('agent:respondToQuestion', (_event, response: unknown) => {
    if (pendingAskUserResolve) {
      // Normalize response: convert object format to string format
      const rawResponse = response as {
        selectedOption: string | { label?: string; value?: string };
        isOther: boolean;
        customText?: string;
      };

      const normalizedResponse: AskUserResponse = {
        selectedOption:
          typeof rawResponse.selectedOption === 'string'
            ? rawResponse.selectedOption
            : rawResponse.selectedOption?.value ||
              rawResponse.selectedOption?.label ||
              '',
        isOther: rawResponse.isOther,
        customText: rawResponse.customText,
      };

      logger.debug('Ask user response normalized', {
        original: rawResponse.selectedOption,
        normalized: normalizedResponse.selectedOption,
      });

      pendingAskUserResolve(normalizedResponse);
      pendingAskUserResolve = null;
    }
    return { success: true };
  });

  // Tool approval 응답 (Supervised Mode)
  ipcMain.handle('agent:respondToApproval', (_event, response: {
    id: string;
    result: 'approve' | 'always' | { reject: true; comment: string };
  }) => {
    logger.ipcHandle('agent:respondToApproval', { requestId: response.id, result: response.result });

    // Pass through the result as-is:
    // - 'approve': single approval
    // - 'always': remember for session (don't convert to null!)
    // - { reject: true, comment }: rejection
    handleToolApprovalResponse(response.id, response.result);
    return { success: true };
  });

  // 내부적으로 ask_to_user가 호출될 때 사용하는 이벤트
  ipcMain.on('agent:askUserQuestion', (_event, request: AskUserRequest) => {
    // 이 이벤트는 agent에서 직접 발생시키지 않음
    // askUserCallback에서 IPC를 통해 renderer에 질문을 보냄
    chatWindow?.webContents.send('agent:askUser', request);
  });

  // ============ Documentation ============

  // 문서 정보 가져오기
  ipcMain.handle('docs:getInfo', async () => {
    return await getDocsInfo();
  });

  // 문서 다운로드
  ipcMain.handle('docs:download', async (_event, sourceId: string) => {
    const progressCallback = (progress: DownloadProgress) => {
      chatWindow?.webContents.send('docs:downloadProgress', progress);
    };
    return await downloadDocs(sourceId, progressCallback);
  });

  // 문서 삭제
  ipcMain.handle('docs:delete', async (_event, sourceId: string) => {
    return await deleteDocs(sourceId);
  });

  // 문서 폴더 열기
  ipcMain.handle('docs:openFolder', async () => {
    return await openDocsFolder();
  });

  logger.info('IPC handlers registered');
}

/**
 * IPC 핸들러 정리
 */
export async function cleanupIpcHandlers(): Promise<void> {
  // Agent 중단
  if (isAgentRunning()) {
    abortAgent();
  }

  // PowerShell 매니저 종료
  powerShellManager.terminate();

  // 세션 매니저 정리
  await sessionManager.cleanup();

  // 모든 핸들러 제거
  ipcMain.removeAllListeners();

  logger.info('IPC handlers cleaned up');
}
