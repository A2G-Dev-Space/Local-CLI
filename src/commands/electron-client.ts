/**
 * Electron Client
 *
 * CLI에서 실행 중인 Electron 앱의 HTTP 서버와 통신.
 * Health check, 자동 시작, SSE 스트림 파싱.
 */

import http from 'http';
import { spawn, execSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { APP_NAME } from '../constants.js';

/** SSE 이벤트 */
export interface SSEEvent {
  event: string;
  data: unknown;
}

interface HealthResponse {
  status: string;
}

export class ElectronClient {
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  /**
   * Electron CLI Server가 실행 중인지 확인
   */
  async isRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/api/health`, { timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          try {
            const data = JSON.parse(body) as HealthResponse;
            resolve(data.status === 'ok');
          } catch {
            resolve(false);
          }
        });
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  /**
   * Electron 앱 자동 시작
   */
  async startElectron(): Promise<void> {
    const exePath = this.findElectronPath();
    if (!exePath) {
      throw new Error(
        `Electron 앱을 찾을 수 없습니다.\n` +
        `환경변수 HANSEOL_ELECTRON_PATH를 설정하거나 앱을 먼저 설치해주세요.`
      );
    }

    // 플랫폼별 시작
    if (this.isWSL()) {
      // WSL → PowerShell로 Windows exe 실행
      const winPath = this.wslToWinPath(exePath);
      spawn('powershell.exe', ['-Command', `Start-Process '${winPath}'`], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else {
      spawn(exePath, [], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }

    // 서버 준비 대기 (최대 30초)
    const maxWait = 30000;
    const interval = 1000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await this.sleep(interval);
      if (await this.isRunning()) return;
    }

    throw new Error('Electron 앱 시작 시간 초과 (30초)');
  }

  /**
   * 명령 실행 (POST + SSE 스트림 수신)
   */
  async execute(
    target: 'chat' | 'jarvis',
    prompt: string,
    onEvent?: (event: SSEEvent) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ prompt });

      const req = http.request({
        hostname: '127.0.0.1',
        port: this.port,
        path: `/api/${target}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 600000, // 10분 타임아웃
      }, (res) => {
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body}`)));
          return;
        }

        // SSE 파싱
        let buffer = '';
        let finalResponse = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 마지막 불완전한 라인 유지

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>;
                const sseEvent: SSEEvent = { event: currentEvent, data: parsed };

                if (onEvent) onEvent(sseEvent);

                if (currentEvent === 'result' && typeof parsed['response'] === 'string') {
                  finalResponse = parsed['response'];
                }
              } catch {
                // JSON 파싱 실패 무시
              }
              currentEvent = '';
            } else if (line === '') {
              currentEvent = '';
            }
          }
        });

        res.on('end', () => {
          resolve(finalResponse);
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('요청 시간 초과'));
      });

      req.write(postData);
      req.end();
    });
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  /**
   * Electron 실행 파일 탐지
   */
  private findElectronPath(): string | null {
    // 1. 환경변수
    if (process.env['HANSEOL_ELECTRON_PATH']) {
      const envPath = process.env['HANSEOL_ELECTRON_PATH'];
      if (fs.existsSync(envPath)) return envPath;
    }

    // 브랜드별 앱 이름 매핑
    const appNames: Record<string, string> = {
      'hanseol-dev': '한설 DEV',
      'hanseol': '한설',
      'nexus-coder': 'Nexus Bot (For Windows)',
    };
    const appDisplayName = appNames[APP_NAME] || APP_NAME;

    if (this.isWSL()) {
      // WSL: /mnt/c/Users/{USER}/AppData/Local/{앱이름}/{앱이름}.exe
      const winUser = this.getWindowsUsername();
      if (winUser) {
        const exePath = `/mnt/c/Users/${winUser}/AppData/Local/${appDisplayName}/${appDisplayName}.exe`;
        if (fs.existsSync(exePath)) return exePath;
      }
    } else if (process.platform === 'win32') {
      // Windows: %LOCALAPPDATA%\{앱이름}\{앱이름}.exe
      const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');
      const exePath = path.join(localAppData, appDisplayName, `${appDisplayName}.exe`);
      if (fs.existsSync(exePath)) return exePath;
    }

    return null;
  }

  private isWSL(): boolean {
    try {
      const release = os.release().toLowerCase();
      return release.includes('wsl') || release.includes('microsoft');
    } catch {
      return false;
    }
  }

  private getWindowsUsername(): string | null {
    try {
      const cmdPath = '/mnt/c/Windows/System32/cmd.exe';
      if (fs.existsSync(cmdPath)) {
        const result = execSync('cmd.exe /c echo %USERNAME%', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (result && !result.includes('%')) return result;
      }
      // Fallback: WSL 사용자 이름과 동일하다고 가정
      return process.env['USER'] || null;
    } catch {
      return null;
    }
  }

  private wslToWinPath(wslPath: string): string {
    // /mnt/c/Users/... → C:\Users\...
    const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
    if (match) {
      return `${match[1]!.toUpperCase()}:\\${match[2]!.replace(/\//g, '\\')}`;
    }
    return wslPath;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
