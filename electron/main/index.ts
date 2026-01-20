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
import { fileURLToPath } from 'url';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { logger, LogLevel } from './logger';
import { setupIpcHandlers, setMainWindow, cleanupIpcHandlers } from './ipc-handlers';
import { powerShellManager } from './powershell-manager';
import { configManager } from './config-manager';
import { sessionManager } from './session-manager';
import { toolManager } from './tool-manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GPU 관련 문제 해결을 위한 플래그 설정
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

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

// GPU 프로세스 크래시 시 재시작 비활성화 (보안)
app.disableHardwareAcceleration();

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
    mainWindow?.webContents.send('window:focus', true);
  });

  mainWindow.on('blur', () => {
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
    mainWindow = null;
  });

  logger.info('Main window created', {
    width: defaultWidth,
    height: defaultHeight,
    isDev,
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

  logger.info('System theme changed', { theme: isDark ? 'dark' : 'light' });
});

// ============ Auto Updater 설정 ============

function setupAutoUpdater(): void {
  // 개발 모드에서는 비활성화
  if (isDev) {
    logger.info('Auto-updater disabled in development mode');
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
    logger.info('Checking for updates...');
    mainWindow?.webContents.send('update:checking');
  });

  // 업데이트 가능
  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', { version: info.version });
    mainWindow?.webContents.send('update:available', info);

    // Release Notes 파싱
    let releaseNotes = '';
    if (info.releaseNotes) {
      if (typeof info.releaseNotes === 'string') {
        releaseNotes = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotes = info.releaseNotes.map((note: { note?: string | null }) => note.note || '').join('\n');
      }
    }

    const message = `새 버전 v${info.version}이 출시되었습니다.\n\n` +
      (releaseNotes ? `📋 변경사항:\n${releaseNotes}\n\n` : '') +
      '지금 다운로드하시겠습니까?';

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 가능',
      message,
      buttons: ['다운로드', '나중에'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', () => {
    logger.info('No updates available');
    mainWindow?.webContents.send('update:not-available');
  });

  // 다운로드 진행률
  autoUpdater.on('download-progress', (progress) => {
    logger.info('Download progress', { percent: progress.percent });
    mainWindow?.webContents.send('update:download-progress', progress);
  });

  // 다운로드 완료
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', { version: info.version });
    mainWindow?.webContents.send('update:downloaded', info);

    // Release Notes 파싱
    let releaseNotes = '';
    if (info.releaseNotes) {
      if (typeof info.releaseNotes === 'string') {
        releaseNotes = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotes = info.releaseNotes.map((note: { note?: string | null }) => note.note || '').join('\n');
      }
    }

    const message = `v${info.version} 업데이트가 준비되었습니다.\n\n` +
      (releaseNotes ? `📋 변경사항:\n${releaseNotes}\n\n` : '') +
      '지금 재시작하여 업데이트를 적용하시겠습니까?';

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 준비 완료',
      message,
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // 에러 처리
  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error', { error: error.message });
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

  logger.info('Application starting', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isDev,
    configPath: configManager.getConfigPath(),
    sessionsDir: sessionManager.getSessionsDirectory(),
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
  logger.info('Application shutting down');

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
