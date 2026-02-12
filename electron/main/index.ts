/**
 * Electron Main Process
 * - 모던한 프레임리스 디자인
 * - 커스텀 타이틀바 지원
 * - 다크/라이트 테마 지원
 * - 보안 best practices
 * - 전역 에러 핸들링
 */

import { app, BrowserWindow, shell, nativeTheme, crashReporter, dialog, screen } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { logger, LogLevel } from './utils/logger';
import { setupIpcHandlers, setChatWindow, setTaskWindow, cleanupIpcHandlers } from './ipc-handlers';
import { powerShellManager } from './powershell-manager';
import { configManager } from './core/config';
import { sessionManager } from './core/session';
import { toolManager } from './tool-manager';
import { reportError } from './core/telemetry/error-reporter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GPU 가속 활성화 (성능 최적화)
// 참고: disable-gpu를 사용하면 모든 렌더링이 CPU에서 처리되어 매우 느려짐
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist'); // 블랙리스트 무시하고 GPU 사용

// Electron-vite에서 제공하는 환경 변수
const RENDERER_DIST = path.join(__dirname, '../renderer');
const VITE_DEV_SERVER_URL = process.env['ELECTRON_RENDERER_URL'];
const isDev = !!VITE_DEV_SERVER_URL;

// 윈도우 참조 (Chat: 메인, Task: 보조)
let chatWindow: BrowserWindow | null = null;
let taskWindow: BrowserWindow | null = null;

// ============ 작업 디렉토리 보정 (Portable 실행 시 temp 경로 방지) ============

const cwd = process.cwd();
const tempDir = os.tmpdir().toLowerCase();
if (cwd.toLowerCase().startsWith(tempDir) || cwd.toLowerCase().includes('\\temp\\')) {
  const home = os.homedir();
  try {
    process.chdir(home);
    logger.info('Working directory corrected from temp to home', { from: cwd, to: home });
  } catch {
    // fallback: keep current directory
  }
}

// ============ 크래시 리포터 설정 ============

crashReporter.start({
  productName: 'Local CLI (For Windows)',
  submitURL: '', // 크래시 리포트 서버 URL (선택적)
  uploadToServer: false, // 로컬에만 저장
  compress: true,
});

// ============ 전역 에러 핸들링 ============

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
  });
  reportError(error, { type: 'uncaughtException' }).catch(() => {});

  // 개발 모드에서는 에러 표시
  if (isDev) {
    console.error('Uncaught Exception:', error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
  reportError(reason, { type: 'unhandledRejection' }).catch(() => {});

  if (isDev) {
    console.error('Unhandled Rejection:', reason);
  }
});

// ============ 보안 설정 ============

// 참고: app.disableHardwareAcceleration()은 성능을 심하게 저하시키므로 사용하지 않음
// GPU 가속이 활성화되어야 부드러운 스크롤, 애니메이션, 타이핑 반응이 가능함

// 렌더러 프로세스 재사용 비활성화 (보안)
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

// Windows 전용 최적화
if (process.platform === 'win32') {
  app.setAppUserModelId('com.local-cli.powershell-ui');
}

// ============ 공통 webPreferences ============

const commonWebPreferences = {
  preload: path.join(__dirname, '../preload/index.mjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  devTools: true,
};

const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  : path.join(__dirname, '../../build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

// 윈도우 URL 로드 헬퍼
function loadWindowURL(win: BrowserWindow, windowType: string): void {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}?window=${windowType}`);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      query: { window: windowType },
    });
  }
}

// 윈도우 bounds 저장/복원
function saveWindowBounds(key: string, win: BrowserWindow): void {
  try {
    const bounds = win.getBounds();
    (configManager as { set(key: string, value: unknown): void }).set(`windowBounds.${key}`, bounds);
  } catch {
    // ignore
  }
}

function getWindowBounds(key: string): Electron.Rectangle | null {
  try {
    const bounds = (configManager as { get(key: string): unknown }).get(`windowBounds.${key}`) as Electron.Rectangle | undefined;
    return bounds || null;
  } catch {
    return null;
  }
}

// ============ Chat 윈도우 생성 (메인) ============

async function createChatWindow(): Promise<void> {
  const savedBounds = getWindowBounds('chat');
  const defaultWidth = 820;
  const defaultHeight = 620;
  const taskWindowWidth = 400;

  // 저장된 bounds가 없으면 Chat + Task 양쪽이 화면에 들어오도록 배치
  let chatX: number | undefined = savedBounds?.x;
  let chatY: number | undefined = savedBounds?.y;
  let shouldCenter = false;
  if (!savedBounds) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;
    const totalWidth = defaultWidth + 10 + taskWindowWidth; // Chat + gap + Task

    if (totalWidth <= workArea.width) {
      // 두 윈도우가 모두 들어감 → Chat을 왼쪽에 배치
      chatX = workArea.x + Math.floor((workArea.width - totalWidth) / 2);
      chatY = workArea.y + Math.floor((workArea.height - defaultHeight) / 2);
    } else {
      // 공간 부족 → Chat만 중앙 배치
      shouldCenter = true;
    }
  }

  chatWindow = new BrowserWindow({
    width: savedBounds?.width || defaultWidth,
    height: savedBounds?.height || defaultHeight,
    x: chatX,
    y: chatY,
    minWidth: 480,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    transparent: false,
    icon: appIcon,
    webPreferences: commonWebPreferences,
    show: true,
    center: shouldCenter,
  });

  setChatWindow(chatWindow);

  if (isDev) {
    chatWindow.webContents.once('did-finish-load', () => {
      chatWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  chatWindow.on('maximize', () => {
    chatWindow?.webContents.send('window:maximizeChange', true);
  });

  chatWindow.on('unmaximize', () => {
    chatWindow?.webContents.send('window:maximizeChange', false);
  });

  chatWindow.on('focus', () => {
    logger.windowFocus({ windowId: chatWindow?.id });
    chatWindow?.webContents.send('window:focus', true);
    chatWindow?.flashFrame(false);
  });

  chatWindow.on('blur', () => {
    logger.windowBlur({ windowId: chatWindow?.id });
    chatWindow?.webContents.send('window:focus', false);
  });

  chatWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  chatWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(VITE_DEV_SERVER_URL || '') && !url.startsWith('file://')) {
      event.preventDefault();
      logger.warn('Navigation blocked', { url });
    }
  });

  loadWindowURL(chatWindow, 'chat');

  // Chat 닫힘 = 앱 종료
  chatWindow.on('close', () => {
    saveWindowBounds('chat', chatWindow!);
  });

  chatWindow.on('closed', () => {
    logger.windowClose({ windowId: 'chat' });
    chatWindow = null;
    // Task 윈도우도 정리 후 종료
    if (taskWindow && !taskWindow.isDestroyed()) {
      taskWindow.destroy();
      taskWindow = null;
    }
    app.quit();
  });

  logger.windowCreate({
    id: chatWindow.id,
    width: savedBounds?.width || defaultWidth,
    height: savedBounds?.height || defaultHeight,
    isDev,
    frame: false,
    titleBarStyle: 'hidden',
  });
}

// ============ Task 윈도우 생성 (보조) ============

async function createTaskWindow(): Promise<void> {
  const savedBounds = getWindowBounds('task');

  // 저장된 bounds 없으면 Chat 윈도우 오른쪽에 배치 (화면 경계 검사 포함)
  const taskWidth = savedBounds?.width || 400;
  const taskHeight = savedBounds?.height || 600;
  let x: number | undefined = savedBounds?.x;
  let y: number | undefined = savedBounds?.y;
  if (!savedBounds && chatWindow) {
    const chatBounds = chatWindow.getBounds();
    const display = screen.getDisplayMatching(chatBounds);
    const workArea = display.workArea;

    // Chat 오른쪽에 배치 시도
    const idealX = chatBounds.x + chatBounds.width + 10;
    if (idealX + taskWidth <= workArea.x + workArea.width) {
      x = idealX;
      y = chatBounds.y;
    } else {
      // 오른쪽에 공간 없으면 Chat 왼쪽에 배치
      const leftX = chatBounds.x - taskWidth - 10;
      if (leftX >= workArea.x) {
        x = leftX;
        y = chatBounds.y;
      } else {
        // 양쪽 다 불가능하면 화면 오른쪽 끝에 정렬
        x = workArea.x + workArea.width - taskWidth;
        y = chatBounds.y;
      }
    }
  }

  taskWindow = new BrowserWindow({
    width: savedBounds?.width || 400,
    height: savedBounds?.height || 600,
    x,
    y,
    minWidth: 300,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    transparent: false,
    icon: appIcon,
    webPreferences: commonWebPreferences,
    show: true, // 앱 시작 시 Task 윈도우도 함께 표시
  });

  setTaskWindow(taskWindow);

  taskWindow.on('maximize', () => {
    taskWindow?.webContents.send('window:maximizeChange', true);
  });

  taskWindow.on('unmaximize', () => {
    taskWindow?.webContents.send('window:maximizeChange', false);
  });

  taskWindow.on('focus', () => {
    taskWindow?.webContents.send('window:focus', true);
    taskWindow?.flashFrame(false);
  });

  taskWindow.on('blur', () => {
    taskWindow?.webContents.send('window:focus', false);
  });

  taskWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  loadWindowURL(taskWindow, 'task');

  // Task 닫기 = hide (destroy가 아님, 재표시 가능)
  taskWindow.on('close', (e) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      e.preventDefault();
      saveWindowBounds('task', taskWindow!);
      taskWindow!.hide();
    }
    // Chat이 이미 닫힌 경우에는 정상적으로 destroy됨
  });

  logger.windowCreate({
    id: taskWindow.id,
    width: savedBounds?.width || 400,
    height: savedBounds?.height || 600,
    isDev,
    frame: false,
    titleBarStyle: 'hidden',
  });
}

// ============ 테마 변경 감지 ============

nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  const themeValue = isDark ? 'dark' : 'light';
  const bgColor = isDark ? '#1e1e1e' : '#ffffff';

  // 양쪽 윈도우에 테마 변경 전달
  chatWindow?.webContents.send('theme:change', themeValue);
  taskWindow?.webContents.send('theme:change', themeValue);

  if (chatWindow) chatWindow.setBackgroundColor(bgColor);
  if (taskWindow) taskWindow.setBackgroundColor(bgColor);

  logger.systemThemeChange({ theme: themeValue, isDark });
});

// ============ Auto Updater 설정 ============

function setupAutoUpdater(): void {
  // 개발 모드에서는 비활성화
  if (isDev) {
    logger.info('Auto-updater disabled in development mode');
    return;
  }

  // Check if app-update.yml exists (only created by electron-builder with publish config)
  const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
  if (!fs.existsSync(updateConfigPath)) {
    logger.info('Auto-updater disabled: app-update.yml not found (standalone deployment)');
    return;
  }

  // 로그 설정
  autoUpdater.logger = {
    info: (message: string) => logger.info(`[AutoUpdater] ${message}`),
    warn: (message: string) => logger.warn(`[AutoUpdater] ${message}`),
    error: (message: string) => logger.error(`[AutoUpdater] ${message}`),
    debug: (message: string) => logger.debug(`[AutoUpdater] ${message}`),
  };

  // 자동 다운로드 비활성화 (사용자 확인 후 다운로드)
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // 업데이트 확인 시작
  autoUpdater.on('checking-for-update', () => {
    logger.updateCheckStart();
    chatWindow?.webContents.send('update:checking');
  });

  // 업데이트 가능 - renderer로만 전달 (커스텀 UI 사용)
  autoUpdater.on('update-available', (info) => {
    logger.updateAvailable({ version: info.version, releaseDate: info.releaseDate });
    chatWindow?.webContents.send('update:available', info);
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', () => {
    logger.info('No updates available');
    chatWindow?.webContents.send('update:not-available');
  });

  // 다운로드 진행률
  autoUpdater.on('download-progress', (progress) => {
    logger.updateDownloadProgress({ percent: progress.percent, bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total });
    chatWindow?.webContents.send('update:download-progress', progress);
  });

  // 다운로드 완료 - renderer로만 전달 (커스텀 UI 사용)
  autoUpdater.on('update-downloaded', (info) => {
    logger.updateDownloadComplete({ version: info.version });
    chatWindow?.webContents.send('update:downloaded', info);
  });

  // 에러 처리
  autoUpdater.on('error', (error) => {
    logger.updateError({ error: error.message, stack: error.stack });
    chatWindow?.webContents.send('update:error', error.message);
  });

  // 앱 시작 후 업데이트 확인 (5초 후)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      logger.error('Failed to check for updates', { error: error.message });
    });
  }, 5000);
}

// ============ 앱 초기화 ============

app.whenReady().then(async () => {
  // 로거 초기화
  await logger.initialize({
    logLevel: isDev ? LogLevel.DEBUG : LogLevel.INFO,
    consoleOutput: isDev,
  });

  // Config 초기화
  await configManager.initialize();

  // Session Manager 초기화
  await sessionManager.initialize();

  // Tool Manager 초기화 (저장된 도구 그룹 활성화)
  await toolManager.initialize();

  // appReady 로깅 (상세 시스템 이벤트)
  logger.appReady({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isDev,
    configPath: configManager.getConfigPath(),
    sessionsDir: sessionManager.getSessionsDirectory(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  });

  // IPC 핸들러 등록
  setupIpcHandlers();

  // 윈도우 생성 (Chat 메인 + Task 보조)
  await createChatWindow();
  await createTaskWindow();

  // Auto Updater 설정
  setupAutoUpdater();

  // macOS: 독 아이콘 클릭 시 창 재생성
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createChatWindow();
      await createTaskWindow();
    }
  });
});

// ============ 앱 종료 처리 ============

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱 종료 전 정리
app.on('before-quit', async () => {
  logger.appBeforeQuit({ reason: 'user_initiated' });

  // PowerShell 세션 종료
  await powerShellManager.terminate();

  // IPC 핸들러 정리
  cleanupIpcHandlers();

  // 이미지 임시 파일 정리
  try {
    const tempImageDir = path.join(os.tmpdir(), 'hanseol-images');
    if (fs.existsSync(tempImageDir)) {
      fs.rmSync(tempImageDir, { recursive: true, force: true });
    }
  } catch (err) {
    logger.errorSilent('Failed to clean up temp image directory', err);
  }

  // 로거 종료
  await logger.shutdown();
});

// 렌더러 프로세스 크래시 처리
app.on('render-process-gone', (_event, _webContents, details) => {
  logger.fatal('Renderer process crashed', {
    reason: details.reason,
    exitCode: details.exitCode,
  });

  // 개발 모드에서는 자동 재시작
  if (isDev && chatWindow) {
    chatWindow.reload();
  }
});

// GPU 프로세스 크래시 처리
app.on('child-process-gone', (_event, details) => {
  if (details.type === 'GPU') {
    logger.error('GPU process crashed', {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  }
});

// ============ 싱글 인스턴스 보장 ============

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 두 번째 인스턴스 실행 시 Chat 창 포커스
    if (chatWindow) {
      if (chatWindow.isMinimized()) {
        chatWindow.restore();
      }
      chatWindow.focus();
    }
  });
}
