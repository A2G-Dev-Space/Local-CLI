/**
 * Hanseol Constants
 *
 * 프로젝트 전역 상수 정의
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Hanseol 홈 디렉토리
 * ~/.hanseol/
 */
export const LOCAL_HOME_DIR = path.join(os.homedir(), '.hanseol');

// Backward compatibility alias
export const OPEN_HOME_DIR = LOCAL_HOME_DIR;

/**
 * 설정 파일 경로
 * ~/.hanseol/config.json
 */
export const CONFIG_FILE_PATH = path.join(LOCAL_HOME_DIR, 'config.json');

/**
 * 문서 디렉토리
 * ~/.hanseol/docs/
 */
export const DOCS_DIR = path.join(LOCAL_HOME_DIR, 'docs');

/**
 * 백업 디렉토리
 * ~/.hanseol/backups/
 */
export const BACKUPS_DIR = path.join(LOCAL_HOME_DIR, 'backups');

/**
 * 프로젝트별 로그 디렉토리
 * ~/.hanseol/projects/
 */
export const PROJECTS_DIR = path.join(LOCAL_HOME_DIR, 'projects');


/**
 * Application version (injected from package.json)
 */
export const APP_VERSION = '3.3.3';
