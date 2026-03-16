/**
 * Browser Profile Manager
 *
 * 서브에이전트용 영구 브라우저 프로필 관리 + 인증 흐름 핸들링.
 * raw 브라우저 도구(port 9222, 임시 프로필)와 완전히 분리.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import { LOCAL_HOME_DIR } from '../../constants.js';
import { BrowserClient } from '../../tools/browser/browser-client.js';
import { getPlatform, getPowerShellPath } from '../../utils/platform-utils.js';
import { logger } from '../../utils/logger.js';

const PROFILE_DIR_NAME = 'browser-profile';
const SUB_AGENT_CDP_PORT = 9223;

export interface LoginIndicators {
  /** URL에 이 문자열이 포함되면 로그인 페이지 */
  urlPatterns: string[];
  /** title에 이 문자열이 포함되면 로그인 페이지 */
  titlePatterns: string[];
}

export const ATLASSIAN_LOGIN_INDICATORS: LoginIndicators = {
  urlPatterns: ['/login', '/authenticate', '/sso/', '/saml/'],
  titlePatterns: ['Log in', 'Sign in', '로그인', 'SSO'],
};

/**
 * 영구 프로필 디렉토리 경로 반환
 */
export function getProfileDir(): string {
  const platform = getPlatform();
  if (platform === 'wsl') {
    // WSL: Windows 쪽에 프로필 저장 (Chrome이 Windows에서 실행되므로)
    // spawnSync로 sh 우회 → $env:LOCALAPPDATA가 PowerShell에서 직접 해석됨
    try {
      const psPath = getPowerShellPath();
      const psScript = "$d = Join-Path $env:LOCALAPPDATA 'local-cli-browser-profile'; if(-not(Test-Path $d)){New-Item -ItemType Directory -Path $d -Force | Out-Null}; Write-Output $d";
      const result = spawnSync(psPath, ['-NoProfile', '-Command', psScript], {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const profileDir = (result.stdout || '').trim();
      if (profileDir && profileDir.includes('\\')) {
        return profileDir; // e.g. "C:\Users\gkstm\AppData\Local\local-cli-browser-profile"
      }
    } catch { /* fall through to fallback */ }
    // 폴백: wslvar로 LOCALAPPDATA 조회
    try {
      const result = spawnSync('wslvar', ['LOCALAPPDATA'], { encoding: 'utf-8', timeout: 5000 });
      const localAppData = (result.stdout || '').trim();
      if (localAppData) {
        return `${localAppData}\\local-cli-browser-profile`;
      }
    } catch { /* fall through */ }
    return 'C:\\Users\\Default\\AppData\\Local\\local-cli-browser-profile';
  }
  if (platform === 'native-windows') {
    const dir = path.join(process.env['LOCALAPPDATA'] || LOCAL_HOME_DIR, PROFILE_DIR_NAME);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
  // Native Linux: 로컬 홈 디렉토리 하위
  const dir = path.join(LOCAL_HOME_DIR, PROFILE_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 서브에이전트 전용 CDP 포트
 */
export function getSubAgentCdpPort(): number {
  return SUB_AGENT_CDP_PORT;
}

// 싱글톤 BrowserClient (서브에이전트 전용)
let subAgentClient: BrowserClient | null = null;

/**
 * 서브에이전트 전용 BrowserClient 반환 (싱글톤)
 */
export function getSubAgentBrowserClient(): BrowserClient {
  if (!subAgentClient) {
    subAgentClient = new BrowserClient();
  }
  return subAgentClient;
}

/**
 * 서브에이전트 브라우저 시작 (headless, 영구 프로필)
 * Returns { success, error? } with detailed error message for user feedback.
 */
export async function launchSubAgentBrowser(headless: boolean = true): Promise<{ success: boolean; error?: string }> {
  const client = getSubAgentBrowserClient();

  if (await client.isRunning()) {
    return { success: true };
  }

  const result = await client.launch({
    headless,
    userDataDir: getProfileDir(),
    cdpPort: SUB_AGENT_CDP_PORT,
  });

  if (!result.success) {
    const errorMsg = result.details || result.error || 'Unknown browser launch error';
    return { success: false, error: errorMsg };
  }

  return { success: true };
}

/**
 * 서브에이전트 브라우저 종료
 */
export async function closeSubAgentBrowser(): Promise<void> {
  const client = getSubAgentBrowserClient();
  if (await client.isRunning()) {
    await client.close();
  }
}

/**
 * 인증 상태 확인 및 로그인 처리
 *
 * 흐름:
 * 1. headless로 baseUrl 접근
 * 2. URL/title로 로그인 페이지 감지
 * 3. 로그인 필요 → visible 모드로 전환 → 사용자 수동 로그인 → headless로 복귀
 */
export async function ensureAuthenticated(
  baseUrl: string,
  indicators: LoginIndicators
): Promise<{ success: boolean; error?: string }> {
  const client = getSubAgentBrowserClient();

  // 1. 브라우저가 안 떠있으면 headless로 시작
  if (!(await client.isRunning())) {
    const launched = await launchSubAgentBrowser(true);
    if (!launched.success) {
      return { success: false, error: launched.error || 'Failed to launch browser' };
    }
  }

  // 2. baseUrl로 이동
  const navResult = await client.navigate(baseUrl);
  if (!navResult.success) {
    return { success: false, error: `Navigation failed: ${navResult.error}` };
  }

  // 잠시 대기 (리다이렉트 완료)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. 로그인 상태 확인
  const pageInfo = await client.getPageInfo();
  const currentUrl = (pageInfo as { url?: string }).url || '';
  const currentTitle = (pageInfo as { title?: string }).title || '';

  const isLoginPage = isOnLoginPage(currentUrl, currentTitle, indicators);

  if (!isLoginPage) {
    logger.info('[BrowserProfileManager] Already authenticated');
    return { success: true };
  }

  // 4. 로그인 필요 → visible 모드로 전환
  logger.info('[BrowserProfileManager] Login required, switching to visible mode...');
  await client.close();
  await new Promise(resolve => setTimeout(resolve, 1000));

  const visibleLaunched = await client.launch({
    headless: false,
    userDataDir: getProfileDir(),
    cdpPort: SUB_AGENT_CDP_PORT,
  });

  if (!visibleLaunched.success) {
    return { success: false, error: 'Failed to launch visible browser for login' };
  }

  // 5. 로그인 페이지로 이동
  await client.navigate(baseUrl);

  // 6. 로그인 완료 대기 (최대 120초 폴링)
  logger.info('[BrowserProfileManager] Waiting for user to log in (up to 120s)...');
  const loginTimeout = 120_000;
  const loginStart = Date.now();

  while (Date.now() - loginStart < loginTimeout) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const info = await client.getPageInfo();
    const url = (info as { url?: string }).url || '';
    const title = (info as { title?: string }).title || '';

    if (!isOnLoginPage(url, title, indicators)) {
      logger.info('[BrowserProfileManager] Login detected, switching back to headless...');

      // 7. visible 닫고 headless로 복귀 (쿠키 보존)
      await client.close();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const headlessLaunched = await launchSubAgentBrowser(true);
      if (!headlessLaunched.success) {
        return { success: false, error: headlessLaunched.error || 'Failed to relaunch headless after login' };
      }

      return { success: true };
    }
  }

  // 타임아웃
  await client.close();
  return { success: false, error: 'Login timeout (120s). Please try again.' };
}

/**
 * 현재 페이지가 로그인 페이지인지 판단
 */
function isOnLoginPage(url: string, title: string, indicators: LoginIndicators): boolean {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();

  for (const pattern of indicators.urlPatterns) {
    if (urlLower.includes(pattern.toLowerCase())) return true;
  }
  for (const pattern of indicators.titlePatterns) {
    if (titleLower.includes(pattern.toLowerCase())) return true;
  }

  return false;
}
