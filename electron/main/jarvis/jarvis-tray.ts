/**
 * Jarvis Tray - 시스템 트레이 아이콘 + 컨텍스트 메뉴
 *
 * 트레이 아이콘으로 Jarvis 상태를 표시하고,
 * 우클릭 메뉴로 Jarvis 윈도우 열기, 폴링 트리거, 종료 등을 제공.
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import type { JarvisStatus } from './jarvis-types';

// =============================================================================
// Tray Manager
// =============================================================================

export class JarvisTray {
  private tray: Tray | null = null;
  private status: JarvisStatus = 'idle';

  // Callbacks set by index.ts
  private onShowJarvisWindow: (() => void) | null = null;
  private onShowChatWindow: (() => void) | null = null;
  private onPollNow: (() => void) | null = null;
  private onDisableJarvis: (() => void) | null = null;
  private onQuit: (() => void) | null = null;

  constructor(callbacks: {
    onShowJarvisWindow: () => void;
    onShowChatWindow: () => void;
    onPollNow: () => void;
    onDisableJarvis: () => void;
    onQuit: () => void;
  }) {
    this.onShowJarvisWindow = callbacks.onShowJarvisWindow;
    this.onShowChatWindow = callbacks.onShowChatWindow;
    this.onPollNow = callbacks.onPollNow;
    this.onDisableJarvis = callbacks.onDisableJarvis;
    this.onQuit = callbacks.onQuit;
  }

  /**
   * 트레이 아이콘 생성
   */
  create(): void {
    if (this.tray) return;

    // 16x16 기본 아이콘 (inline nativeImage — 별도 아이콘 파일 없이)
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('자비스 모드');

    this.updateContextMenu();

    // 더블클릭 → Jarvis 윈도우 열기
    this.tray.on('double-click', () => {
      this.onShowJarvisWindow?.();
    });

    logger.info('[JarvisTray] Tray created');
  }

  /**
   * 트레이 파괴
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      logger.info('[JarvisTray] Tray destroyed');
    }
  }

  /**
   * 상태 업데이트
   */
  setStatus(status: JarvisStatus): void {
    if (this.status !== status) {
      logger.info('[JarvisTray] Status changed', { from: this.status, to: status });
    }
    this.status = status;
    if (!this.tray) return;

    const tooltips: Record<JarvisStatus, string> = {
      idle: '자비스 모드 - 대기 중',
      polling: '자비스 모드 - 할 일 확인 중...',
      analyzing: '자비스 모드 - 분석 중...',
      executing: '자비스 모드 - 작업 실행 중...',
      waiting_user: '자비스 모드 - 사용자 응답 대기',
    };

    this.tray.setToolTip(tooltips[status] || '자비스 모드');
    this.updateContextMenu();
  }

  /**
   * 풍선 알림 표시 (Windows)
   */
  showBalloon(title: string, content: string): void {
    if (!this.tray) {
      logger.warn('[JarvisTray] showBalloon called but tray is null');
      return;
    }
    logger.info('[JarvisTray] Showing balloon', { title });
    this.tray.displayBalloon({
      title,
      content,
      iconType: 'info',
    });
  }

  /**
   * 트레이 아이콘이 존재하는지
   */
  isCreated(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  private updateContextMenu(): void {
    if (!this.tray) return;

    const statusLabels: Record<JarvisStatus, string> = {
      idle: '● 대기 중',
      polling: '◉ 확인 중...',
      analyzing: '◉ 분석 중...',
      executing: '⚡ 실행 중...',
      waiting_user: '⏳ 응답 대기',
    };

    const menu = Menu.buildFromTemplate([
      {
        label: `자비스 ${statusLabels[this.status]}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '자비스 열기',
        click: () => this.onShowJarvisWindow?.(),
      },
      {
        label: '채팅 열기',
        click: () => this.onShowChatWindow?.(),
      },
      { type: 'separator' },
      {
        label: '할 일 확인',
        click: () => this.onPollNow?.(),
        enabled: this.status === 'idle',
      },
      { type: 'separator' },
      {
        label: '자비스 끄기',
        click: () => this.onDisableJarvis?.(),
      },
      {
        label: '앱 종료',
        click: () => this.onQuit?.(),
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  /**
   * 16x16 트레이 아이콘 생성 (amber/gold 색상의 원)
   */
  private createTrayIcon(): Electron.NativeImage {
    // 기존 앱 아이콘 사용 (별도 Jarvis 아이콘은 Phase 3에서 디자인)
    const appIcon = app.isPackaged
      ? path.join(process.resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
      : path.join(__dirname, '../../../build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

    try {
      const icon = nativeImage.createFromPath(appIcon).resize({ width: 16, height: 16 });
      logger.info('[JarvisTray] Tray icon loaded', { path: appIcon, isEmpty: icon.isEmpty() });
      return icon;
    } catch (err) {
      logger.warn('[JarvisTray] Failed to load tray icon, using fallback', { path: appIcon, error: String(err) });
      return nativeImage.createEmpty();
    }
  }
}
