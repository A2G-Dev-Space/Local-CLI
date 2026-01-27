/**
 * Electron Main Process
 * - 모던한 프레임리스 디자인
 * - 커스텀 타이틀바 지원
 * - 다크/라이트 테마 지원
 * - 보안 best practices
 * - 전역 에러 핸들링
 */

import { app, BrowserWindow, shell, nativeTheme, crashReporter, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { logger, LogLevel } from './utils/logger';
import { setupIpcHandlers, setMainWindow, cleanupIpcHandlers } from './ipc-handlers';
import { powerShellManager } from './powershell-manager';
import { configManager } from './core/config';
import { sessionManager } from './core/session';
import { toolManager } from './tool-manager';

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

// 메인 윈도우 참조
let mainWindow: BrowserWindow | null = null;

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

// ============ 윈도우 생성 ============

async function createWindow(): Promise<void> {
  // 윈도우 상태 저장/복원을 위한 기본값
  const defaultWidth = 1400;
  const defaultHeight = 900;
  const minWidth = 800;
  const minHeight = 600;

  mainWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth,
    minHeight,

    // 프레임리스 디자인
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,

    // 투명 배경 (테마 전환 시 깜빡임 방지)
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    transparent: false,

    // 아이콘 설정 (Windows는 .ico 필요)
    // 패키징된 앱에서는 resources 폴더에서, 개발 모드에서는 build 폴더에서 로드
    icon: app.isPackaged
      ? path.join(process.resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
      : path.join(__dirname, '../../build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),

    // 웹 환경설정 (보안)
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 스크립트가 정상 동작하도록 false
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      devTools: true, // 디버깅을 위해 항상 활성화
    },

    // 창 표시 설정
    show: true,
    center: true,
  });

  // IPC 핸들러에 메인 윈도우 참조 전달
  setMainWindow(mainWindow);

  // 개발 모드에서 DevTools 열기
  if (isDev) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  // 최대화 상태 변경 이벤트 전달
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', false);
  });

  // 창 포커스 이벤트
  mainWindow.on('focus', () => {
    logger.windowFocus({ windowId: mainWindow?.id });
    mainWindow?.webContents.send('window:focus', true);
  });

  mainWindow.on('blur', () => {
    logger.windowBlur({ windowId: mainWindow?.id });
    mainWindow?.webContents.send('window:focus', false);
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 허용된 프로토콜만 열기
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 네비게이션 차단 (보안)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 개발 서버 URL만 허용
    if (!url.startsWith(VITE_DEV_SERVER_URL || '') && !url.startsWith('file://')) {
      event.preventDefault();
      logger.warn('Navigation blocked', { url });
    }
  });

  // 개발 서버 또는 빌드된 파일 로드
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // 창 닫힘 처리
  mainWindow.on('closed', () => {
    logger.windowClose({ windowId: 'main' });
    mainWindow = null;
  });

  logger.windowCreate({
    id: mainWindow.id,
    width: defaultWidth,
    height: defaultHeight,
    isDev,
    frame: false,
    titleBarStyle: 'hidden',
  });
}

// ============ 테마 변경 감지 ============

nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  mainWindow?.webContents.send('theme:change', isDark ? 'dark' : 'light');

  // 배경색 업데이트
  if (mainWindow) {
    mainWindow.setBackgroundColor(isDark ? '#1e1e1e' : '#ffffff');
  }

  logger.systemThemeChange({ theme: isDark ? 'dark' : 'light', isDark });
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
    mainWindow?.webContents.send('update:checking');
  });

  // 업데이트 가능 - renderer로만 전달 (커스텀 UI 사용)
  autoUpdater.on('update-available', (info) => {
    logger.updateAvailable({ version: info.version, releaseDate: info.releaseDate });
    mainWindow?.webContents.send('update:available', info);
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', () => {
    logger.info('No updates available');
    mainWindow?.webContents.send('update:not-available');
  });

  // 다운로드 진행률
  autoUpdater.on('download-progress', (progress) => {
    logger.updateDownloadProgress({ percent: progress.percent, bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total });
    mainWindow?.webContents.send('update:download-progress', progress);
  });

  // 다운로드 완료 - renderer로만 전달 (커스텀 UI 사용)
  autoUpdater.on('update-downloaded', (info) => {
    logger.updateDownloadComplete({ version: info.version });
    mainWindow?.webContents.send('update:downloaded', info);
  });

  // 에러 처리
  autoUpdater.on('error', (error) => {
    logger.updateError({ error: error.message, stack: error.stack });
    mainWindow?.webContents.send('update:error', error.message);
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

  // 메인 윈도우 생성
  await createWindow();

  // Auto Updater 설정
  setupAutoUpdater();

  // macOS: 독 아이콘 클릭 시 창 재생성
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
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
  if (isDev && mainWindow) {
    mainWindow.reload();
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
    // 두 번째 인스턴스 실행 시 기존 창 포커스
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
