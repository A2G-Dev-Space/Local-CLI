/**
 * LOCAL-CLI Constants (Electron)
 *
 * CLI parity: src/constants.ts
 * Windows native paths used for Electron
 */

import * as path from 'path';
import * as os from 'os';

/**
 * LOCAL-CLI 홈 디렉토리
 * Windows: %USERPROFILE%\.local-cli\
 * Linux/WSL: ~/.local-cli/
 */
export const LOCAL_HOME_DIR = path.join(os.homedir(), '.local-cli');

// Backward compatibility alias
export const OPEN_HOME_DIR = LOCAL_HOME_DIR;

/**
 * 설정 파일 경로
 * ~/.local-cli/config.json
 */
export const CONFIG_FILE_PATH = path.join(LOCAL_HOME_DIR, 'config.json');

/**
 * 문서 디렉토리
 * ~/.local-cli/docs/
 */
export const DOCS_DIR = path.join(LOCAL_HOME_DIR, 'docs');

/**
 * 백업 디렉토리
 * ~/.local-cli/backups/
 */
export const BACKUPS_DIR = path.join(LOCAL_HOME_DIR, 'backups');

/**
 * 프로젝트별 로그 디렉토리
 * ~/.local-cli/projects/
 */
export const PROJECTS_DIR = path.join(LOCAL_HOME_DIR, 'projects');

/**
 * LLM 요청 시 X-Service-Id 헤더로 전송
 * CLI와 Electron이 서로 다른 값을 사용
 */
export const SERVICE_ID = 'local-cli-ui';

/**
 * Application version (injected from package.json)
 * CLI parity: src/constants.ts
 */
export const APP_VERSION = '4.5.5';

/**
 * Dashboard URL (injected from package.json via inject-version.js)
 */
export const DASHBOARD_URL = 'https://3.39.170.84.nip.io';

/**
 * ONCE URL (injected from package.json)
 * AI 기반 노트/지식 관리 시스템
 */
export const ONCE_URL = 'https://3.39.170.84.nip.io:5090';

/**
 * FREE URL (injected from package.json)
 * AI 기반 업무 기록 시스템
 */
export const FREE_URL = 'https://3.39.170.84.nip.io:6090';

/**
 * Credentials 파일 경로 (CLI와 공유)
 * ~/.local-cli/credentials.json
 */
export const CREDENTIALS_FILE_PATH = path.join(LOCAL_HOME_DIR, 'credentials.json');

/**
 * CLI Server 포트 (Electron ↔ CLI 통신)
 * DEV: 19523 / PROD: 19524 / nexus-coder: 19525
 */
export const CLI_SERVER_PORT = 19524;
