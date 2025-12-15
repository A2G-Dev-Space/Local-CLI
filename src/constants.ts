/**
 * LOCAL-CLI Constants
 *
 * 프로젝트 전역 상수 정의
 */

import * as path from 'path';
import * as os from 'os';

/**
 * LOCAL-CLI 홈 디렉토리
 * ~/.local-cli/
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
 * 엔드포인트 설정 파일 경로
 * ~/.local-cli/endpoints.json
 */
export const ENDPOINTS_FILE_PATH = path.join(LOCAL_HOME_DIR, 'endpoints.json');

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
 * 기본 엔드포인트 ID
 */
export const DEFAULT_ENDPOINT_ID = 'ep-gemini-default';

/**
 * 기본 모델 ID
 */
export const DEFAULT_MODEL_ID = 'gemini-2.0-flash';

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
export const APP_VERSION = '2.0.0';

/**
 * 앱 이름
 */
export const APP_NAME = 'LOCAL-CLI';
