/**
 * Hanseol Web Session Constants
 *
 * Docker 컨테이너 내 웹 세션용 상수 정의
 */

import * as path from 'path';

/**
 * Docker container workspace root
 */
export const WORKSPACE_DIR = '/workspace';

/**
 * Hanseol Web 홈 디렉토리
 * /workspace/.hanseol-web/
 */
export const LOCAL_HOME_DIR = '/workspace/.hanseol-web/';

// Backward compatibility alias
export const OPEN_HOME_DIR = LOCAL_HOME_DIR;

/**
 * 설정 파일 경로
 */
export const CONFIG_FILE_PATH = path.join(LOCAL_HOME_DIR, 'config.json');

/**
 * 문서 디렉토리
 */
export const DOCS_DIR = path.join(LOCAL_HOME_DIR, 'docs');

/**
 * 백업 디렉토리
 */
export const BACKUPS_DIR = path.join(LOCAL_HOME_DIR, 'backups');

/**
 * 프로젝트별 로그 디렉토리
 */
export const PROJECTS_DIR = path.join(LOCAL_HOME_DIR, 'projects');

/**
 * Dashboard 인증 정보 파일 경로
 */
export const CREDENTIALS_FILE_PATH = path.join(LOCAL_HOME_DIR, 'credentials.json');

/**
 * Application name
 */
export const APP_NAME = 'local-web';

/**
 * LLM 요청 시 X-Service-Id 헤더로 전송
 */
export const SERVICE_ID = 'local-web';

/**
 * Application version (injected at build)
 */
export const APP_VERSION = '5.3.7';

/**
 * LLM configuration (from environment)
 */
export const LLM_ENDPOINT_URL = process.env.LLM_ENDPOINT_URL || '';
export const LLM_API_KEY = process.env.LLM_API_KEY || '';
export const LLM_MODEL_ID = process.env.LLM_MODEL_ID || '';

/**
 * WebSocket port for session communication
 */
export const SESSION_WS_PORT = parseInt(process.env.SESSION_WS_PORT || '3001');

/**
 * API callback URL (internal Docker network)
 */
export const API_CALLBACK_URL = process.env.API_CALLBACK_URL || 'http://api:3000';
