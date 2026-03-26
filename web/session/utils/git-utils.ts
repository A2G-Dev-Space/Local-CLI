/**
 * Git Utils
 * Git 관련 유틸리티 함수들
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 주어진 시작 디렉토리부터 상위 디렉토리를 탐색하여 .git 디렉토리가 있는지 확인
 * @param startDir 탐색 시작 디렉토리 (기본: process.cwd())
 * @returns Git 리포지토리 내에 있는지 여부
 */
export function detectGitRepo(startDir: string = process.cwd()): boolean {
  let currentDir = startDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return true;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) { // eslint-disable-line no-constant-condition
      // 루트 디렉토리 도달
      return false;
    }

    currentDir = parentDir;
  }
}
