/**
 * Nexus Coder Constants
 *
 * 프로젝트 전역 상수 정의
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Nexus Coder 홈 디렉토리
 * ~/.nexus-coder/
 */
export const NEXUS_HOME_DIR = path.join(os.homedir(), '.nexus-coder');

// Backward compatibility aliases
export const LOCAL_HOME_DIR = NEXUS_HOME_DIR;
export const OPEN_HOME_DIR = NEXUS_HOME_DIR;

/**
 * 설정 파일 경로
 * ~/.nexus-coder/config.json
 */
export const CONFIG_FILE_PATH = path.join(NEXUS_HOME_DIR, 'config.json');

/**
 * 인증 파일 경로
 * ~/.nexus-coder/auth.json
 */
export const AUTH_FILE_PATH = path.join(NEXUS_HOME_DIR, 'auth.json');

/**
 * 인증서 디렉토리
 * ~/.nexus-coder/cert/
 */
export const CERT_DIR = path.join(NEXUS_HOME_DIR, 'cert');

/**
 * 엔드포인트 설정 파일 경로
 * ~/.nexus-coder/endpoints.json
 */
export const ENDPOINTS_FILE_PATH = path.join(NEXUS_HOME_DIR, 'endpoints.json');

/**
 * 문서 디렉토리
 * ~/.nexus-coder/docs/
 */
export const DOCS_DIR = path.join(NEXUS_HOME_DIR, 'docs');

/**
 * 백업 디렉토리
 * ~/.nexus-coder/backups/
 */
export const BACKUPS_DIR = path.join(NEXUS_HOME_DIR, 'backups');

/**
 * 프로젝트별 로그 디렉토리
 * ~/.nexus-coder/projects/
 */
export const PROJECTS_DIR = path.join(NEXUS_HOME_DIR, 'projects');

/**
 * 기본 엔드포인트 ID
 */
export const DEFAULT_ENDPOINT_ID = 'ep-default';

/**
 * 기본 모델 ID
 */
export const DEFAULT_MODEL_ID = 'default-model';

/**
 * 지원되는 파일 확장자
 */
export const SUPPORTED_TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.json',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.java',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.html',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.sh',
  '.bash',
  '.zsh',
];

/**
 * 앱 버전
 */
export const APP_VERSION = '1.0.0';

/**
 * 앱 이름
 */
export const APP_NAME = 'Nexus Coder';

/**
 * SSO 설정
 */
export const SSO_CONFIG = {
  baseUrl: 'https://genai.samsungds.net:36810',
  ssoPath: '/sso',
  certFileName: 'cert.cer',
};

/**
 * Admin Server 설정 (환경변수로 오버라이드 가능)
 */
export const ADMIN_SERVER_URL = process.env['NEXUS_ADMIN_URL'] || 'http://localhost:4090';
