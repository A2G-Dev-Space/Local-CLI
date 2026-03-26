/**
 * OAuth Login for CLI
 *
 * Dashboard(main)의 OAuth 인증을 CLI에서 수행하는 모듈
 *
 * 플로우:
 * 1. CLI가 로컬 HTTP 서버 시작 (랜덤 포트)
 * 2. 브라우저 열기: http://<dashboard>/api/auth/cli-login?port=<port>&state=<state>
 * 3. 사용자가 OAuth 로그인 완료
 * 4. Dashboard가 http://localhost:<port>/callback?token=<jwt>&state=<state> 리다이렉트
 * 5. CLI가 토큰 수신 → ~/.hanseol/credentials.json 저장
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { CREDENTIALS_FILE_PATH, LOCAL_HOME_DIR } from '../../constants.js';
import { reportError } from '../telemetry/error-reporter.js';

export interface DashboardCredentials {
  dashboardUrl: string;
  token: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
  issuedAt: string;
  expiresAt: string;
  plan?: {
    name: string;
    displayName: string;
    tier: string;
  } | null;
}

/**
 * Dashboard 인증 정보 로드
 */
export async function loadCredentials(): Promise<DashboardCredentials | null> {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE_PATH, 'utf-8');
    const creds = JSON.parse(data) as DashboardCredentials;

    // 만료 확인
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
      return null;
    }

    return creds;
  } catch (error) {
    reportError(error, { type: 'authError', method: 'loadCredentials' }).catch(() => {});
    return null;
  }
}

/**
 * Dashboard 인증 정보 저장
 */
export async function saveCredentials(creds: DashboardCredentials): Promise<void> {
  await fs.mkdir(LOCAL_HOME_DIR, { recursive: true });
  await fs.writeFile(CREDENTIALS_FILE_PATH, JSON.stringify(creds, null, 2), 'utf-8');
  // 파일 권한 600 (소유자만 읽기/쓰기)
  await fs.chmod(CREDENTIALS_FILE_PATH, 0o600);
}

/**
 * Dashboard 인증 정보 삭제
 */
export async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(CREDENTIALS_FILE_PATH);
  } catch (error) {
    reportError(error, { type: 'authError', method: 'clearCredentials' }).catch(() => {});
    // 파일 없으면 무시
  }
}

/**
 * 서버에서 토큰 갱신
 *
 * POST ${dashboardUrl}/api/auth/refresh 호출
 * 성공 시 새 JWT 디코딩 → credentials.json 갱신 → 새 creds 반환
 * 실패 시 null 반환
 */
export async function refreshTokenFromServer(
  _creds: DashboardCredentials,
): Promise<DashboardCredentials | null> {
  // No-op: local-web has no Dashboard to refresh tokens from
  return null;
}

/**
 * JWT 페이로드 파싱 (검증 없이 디코딩만)
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch (error) {
    reportError(error, { type: 'authError', method: 'parseJwtPayload' }).catch(() => {});
    return null;
  }
}

/**
 * 사용 가능한 포트 찾기
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to find available port')));
      }
    });
    server.on('error', reject);
  });
}

/**
 * 브라우저 열기 (크로스 플랫폼)
 */
async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      await execAsync(`open "${url}"`);
    } else if (platform === 'win32') {
      await execAsync(`start "" "${url}"`);
    } else {
      // Linux (including WSL)
      // WSL 감지: /proc/version에 microsoft 문자열 포함
      const { readFileSync } = await import('fs');
      let isWSL = false;
      try {
        const procVersion = readFileSync('/proc/version', 'utf-8');
        isWSL = /microsoft/i.test(procVersion);
      } catch {
        // /proc/version 읽기 실패 → 순수 Linux
      }

      if (isWSL) {
        // WSL: Windows 브라우저로 열기
        try {
          await execAsync(`cmd.exe /c start "" "${url.replace(/&/g, '^&')}"`);
        } catch {
          try {
            await execAsync(`wslview "${url}"`);
          } catch {
            await execAsync(`explorer.exe "${url}"`);
          }
        }
      } else {
        // 순수 Linux
        try {
          await execAsync(`xdg-open "${url}"`);
        } catch {
          await execAsync(`sensible-browser "${url}"`);
        }
      }
    }
  } catch (error) {
    reportError(error, { type: 'authError', method: 'openBrowser' }).catch(() => {});
    // 브라우저 열기 실패 시 URL 출력
    // (호출자가 처리)
    throw new Error('BROWSER_OPEN_FAILED');
  }
}

/**
 * OAuth 로그인 실행
 *
 * @param dashboardUrl Dashboard URL (예: http://ec2-ip:4090)
 * @param timeoutMs 타임아웃 (기본 5분)
 * @returns DashboardCredentials 또는 null (취소/타임아웃)
 */
export async function performOAuthLogin(
  dashboardUrl: string,
  timeoutMs: number = 300000,
): Promise<DashboardCredentials | null> {
  // 1. 상태값 생성 (CSRF 방지)
  const state = crypto.randomUUID();

  // 2. 로컬 콜백 서버 포트 확보
  const port = await findAvailablePort();

  // 3. Promise로 토큰 수신 대기
  return new Promise<DashboardCredentials | null>((resolve) => {
    let resolved = false;
    let server: http.Server;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          server?.close();
        } catch {
          // ignore
        }
      }
    };

    // 타임아웃
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(null);
      }
    }, timeoutMs);

    // 콜백 서버 생성
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const receivedState = url.searchParams.get('state');

        // State 검증
        if (receivedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(createHtmlPage('인증 실패', '잘못된 state 값입니다. 다시 시도해주세요.', false));
          return;
        }

        if (!token) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(createHtmlPage('인증 실패', '토큰이 없습니다. 다시 시도해주세요.', false));
          return;
        }

        // JWT 디코딩 (검증은 서버측에서 이미 완료)
        const payload = parseJwtPayload(token);

        // 성공 응답
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createHtmlPage('인증 완료!', 'CLI로 돌아가세요. 이 창을 닫아도 됩니다.', true));

        // 인증 정보 생성
        const now = new Date();
        const expiresAt = payload?.['exp']
          ? new Date((payload['exp'] as number) * 1000)
          : new Date(now.getTime() + 24 * 60 * 60 * 1000); // 기본 24시간

        const creds: DashboardCredentials = {
          dashboardUrl: dashboardUrl.replace(/\/$/, ''),
          token,
          email: (payload?.['email'] as string) || null,
          displayName: (payload?.['displayName'] as string) || null,
          provider: (payload?.['provider'] as string) || null,
          issuedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };

        // 인증 정보 저장
        await saveCredentials(creds);

        clearTimeout(timeout);
        cleanup();
        resolve(creds);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, '127.0.0.1', async () => {
      // 4. 브라우저에서 Dashboard CLI 로그인 페이지 열기
      const loginUrl = `${dashboardUrl.replace(/\/$/, '')}/api/auth/cli-login?port=${port}&state=${state}`;

      console.log('\n  Dashboard OAuth 로그인을 시작합니다.');
      console.log(`  브라우저가 열리지 않으면 아래 URL을 직접 열어주세요:\n`);
      console.log(`  ${loginUrl}\n`);

      try {
        await openBrowser(loginUrl);
      } catch {
        // 브라우저 열기 실패 - URL은 이미 출력됨
      }

      console.log('  로그인 완료를 기다리고 있습니다...\n');
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      console.error('  로컬 서버 오류:', err.message);
      resolve(null);
    });
  });
}

/**
 * 콜백 HTML 페이지 생성
 */
function createHtmlPage(title: string, message: string, success: boolean): string {
  const color = success ? '#10b981' : '#ef4444';
  const icon = success ? '&#10004;' : '&#10008;';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>한설 CLI - ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 48px 32px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; color: ${color}; margin-bottom: 16px; }
    h1 { font-size: 24px; color: #1a1a1a; margin: 0 0 8px; }
    p { color: #666; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  ${success ? '<script>setTimeout(() => window.close(), 3000)</script>' : ''}
</body>
</html>`;
}
