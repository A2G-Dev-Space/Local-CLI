/**
 * Docs Manager
 *
 * Phase 4: 문서 다운로드 및 관리
 * - 개발팀이 사전 정의한 문서 소스만 다운로드 가능
 * - 현재 지원: agno, adk (Google ADK)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

const DOCS_DIR = path.join(process.env['HOME'] || '.', '.local-cli', 'docs');

/**
 * 문서 소스 정의
 */
export interface DocsSource {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  branch?: string;
  subPath?: string;  // repo 내 특정 경로만 가져올 경우
  targetDir: string; // docs 내 저장될 디렉토리명
}

/**
 * 개발팀이 사전 정의한 문서 소스들
 * 새 소스 추가 시 여기에 추가
 */
export const AVAILABLE_SOURCES: DocsSource[] = [
  {
    id: 'agno',
    name: 'Agno Framework',
    description: 'Agno AI Agent Framework 문서',
    repoUrl: 'https://github.com/agno-agi/agno',
    branch: 'main',
    subPath: 'docs',
    targetDir: 'agent_framework/agno',
  },
  {
    id: 'adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit 문서',
    repoUrl: 'https://github.com/google/adk-python',
    branch: 'main',
    subPath: 'docs',
    targetDir: 'agent_framework/adk',
  },
];

/**
 * 문서 디렉토리 정보
 */
export interface DocsInfo {
  path: string;
  exists: boolean;
  totalFiles: number;
  totalSize: string;
  installedSources: string[];
}

/**
 * 문서 디렉토리 정보 조회
 */
export async function getDocsInfo(): Promise<DocsInfo> {
  logger.enter('getDocsInfo');

  try {
    const exists = fs.existsSync(DOCS_DIR);

    if (!exists) {
      logger.exit('getDocsInfo', { exists: false });
      return {
        path: DOCS_DIR,
        exists: false,
        totalFiles: 0,
        totalSize: '0 B',
        installedSources: [],
      };
    }

    // 파일 개수 및 크기 계산
    let totalFiles = 0;
    let totalBytes = 0;
    const installedSources: string[] = [];

    // 설치된 소스 확인
    for (const source of AVAILABLE_SOURCES) {
      const sourcePath = path.join(DOCS_DIR, source.targetDir);
      if (fs.existsSync(sourcePath)) {
        installedSources.push(source.id);
      }
    }

    const scanDirectory = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '.git') {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          totalFiles++;
          try {
            const stats = fs.statSync(fullPath);
            totalBytes += stats.size;
          } catch {
            // Ignore stat errors
          }
        }
      }
    };

    scanDirectory(DOCS_DIR);

    // 크기 포맷
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const info: DocsInfo = {
      path: DOCS_DIR,
      exists: true,
      totalFiles,
      totalSize: formatSize(totalBytes),
      installedSources,
    };

    logger.exit('getDocsInfo', info);
    return info;
  } catch (error) {
    logger.error('Failed to get docs info', error as Error);
    return {
      path: DOCS_DIR,
      exists: false,
      totalFiles: 0,
      totalSize: '0 B',
      installedSources: [],
    };
  }
}

/**
 * 문서 목록 조회
 */
export interface DocsListItem {
  name: string;
  type: 'file' | 'directory';
  size?: string;
  fileCount?: number;
}

export async function listDocsDirectory(subPath?: string): Promise<DocsListItem[]> {
  logger.enter('listDocsDirectory', { subPath });

  const targetPath = subPath ? path.join(DOCS_DIR, subPath) : DOCS_DIR;

  try {
    if (!fs.existsSync(targetPath)) {
      logger.exit('listDocsDirectory', { exists: false });
      return [];
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items: DocsListItem[] = [];

    for (const entry of entries) {
      if (entry.name === '.git') continue;  // Skip .git

      const fullPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        let fileCount = 0;
        const countFiles = (dir: string) => {
          if (!fs.existsSync(dir)) return;
          const subEntries = fs.readdirSync(dir, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.name === '.git') continue;
            if (subEntry.isFile()) fileCount++;
            else if (subEntry.isDirectory()) {
              countFiles(path.join(dir, subEntry.name));
            }
          }
        };
        countFiles(fullPath);

        items.push({
          name: entry.name,
          type: 'directory',
          fileCount,
        });
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        const formatSize = (bytes: number): string => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        items.push({
          name: entry.name,
          type: 'file',
          size: formatSize(stats.size),
        });
      }
    }

    logger.exit('listDocsDirectory', { itemCount: items.length });
    return items;
  } catch (error) {
    logger.error('Failed to list docs directory', error as Error);
    return [];
  }
}

/**
 * 문서 다운로드 결과
 */
export interface DownloadResult {
  success: boolean;
  message: string;
  downloadedFiles?: number;
  targetPath?: string;
}

/**
 * 사전 정의된 소스에서 문서 다운로드
 */
export async function downloadDocsFromSource(sourceId: string): Promise<DownloadResult> {
  logger.enter('downloadDocsFromSource', { sourceId });

  // 소스 찾기
  const source = AVAILABLE_SOURCES.find(s => s.id === sourceId);
  if (!source) {
    const availableIds = AVAILABLE_SOURCES.map(s => s.id).join(', ');
    logger.exit('downloadDocsFromSource', { success: false, reason: 'unknown source' });
    return {
      success: false,
      message: `알 수 없는 소스: ${sourceId}\n사용 가능한 소스: ${availableIds}`,
    };
  }

  try {
    // Ensure docs directory exists
    if (!fs.existsSync(DOCS_DIR)) {
      fs.mkdirSync(DOCS_DIR, { recursive: true });
    }

    const targetPath = path.join(DOCS_DIR, source.targetDir);

    // Check if git is available
    try {
      execSync('git --version', { stdio: 'pipe' });
    } catch {
      return {
        success: false,
        message: 'Git이 설치되어 있지 않습니다. Git을 설치한 후 다시 시도해주세요.',
      };
    }

    logger.debug('Downloading docs', { source: source.name, url: source.repoUrl });

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Remove existing if present
    if (fs.existsSync(targetPath)) {
      logger.flow('Removing existing directory');
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Clone with sparse checkout if subPath specified
    if (source.subPath) {
      // Create temp directory for sparse clone
      const tempDir = path.join(DOCS_DIR, `.temp-${source.id}`);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      logger.flow('Cloning with sparse checkout');
      const branch = source.branch || 'main';

      // Sparse checkout
      execSync(
        `git clone --depth 1 --filter=blob:none --sparse -b ${branch} "${source.repoUrl}" "${tempDir}"`,
        { stdio: 'pipe' }
      );
      execSync(
        `cd "${tempDir}" && git sparse-checkout set "${source.subPath}"`,
        { stdio: 'pipe' }
      );

      // Move subPath contents to target
      const sourcePath = path.join(tempDir, source.subPath);
      if (fs.existsSync(sourcePath)) {
        fs.renameSync(sourcePath, targetPath);
      } else {
        // If subPath doesn't exist, move entire repo
        fs.renameSync(tempDir, targetPath);
      }

      // Cleanup temp
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } else {
      // Full clone
      logger.flow('Cloning full repository');
      const branch = source.branch || 'main';
      execSync(
        `git clone --depth 1 -b ${branch} "${source.repoUrl}" "${targetPath}"`,
        { stdio: 'pipe' }
      );
    }

    // Remove .git directory to save space
    const gitDir = path.join(targetPath, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // Count downloaded files
    let fileCount = 0;
    const countFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          fileCount++;
        } else if (entry.isDirectory()) {
          countFiles(path.join(dir, entry.name));
        }
      }
    };
    countFiles(targetPath);

    const result: DownloadResult = {
      success: true,
      message: `${source.name} 문서 다운로드 완료`,
      downloadedFiles: fileCount,
      targetPath,
    };

    logger.exit('downloadDocsFromSource', result);
    return result;
  } catch (error) {
    logger.error('Failed to download docs', error as Error);
    return {
      success: false,
      message: `다운로드 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 사용 가능한 소스 목록 조회
 */
export function getAvailableSources(): DocsSource[] {
  return AVAILABLE_SOURCES;
}

/**
 * 문서 디렉토리 경로 조회
 */
export function getDocsPath(): string {
  return DOCS_DIR;
}
