/**
 * Nexus Coder Main Export
 *
 * 이 파일은 라이브러리로 사용될 때의 진입점입니다.
 * CLI 실행은 src/cli.ts를 사용합니다.
 */

import { createRequire } from 'module';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string; name: string };

export const version = packageJson.version;
export const name = packageJson.name;

/**
 * 추후 API로 사용될 함수들을 여기에 export합니다.
 */

// Placeholder for future exports
export {};
