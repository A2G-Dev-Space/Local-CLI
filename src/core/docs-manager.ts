/**
 * Docs Manager
 *
 * llms.txt 기반 문서 다운로드 및 관리
 * - llms.txt 파싱하여 문서 URL 추출
 * - 카테고리별 자동 분류
 * - 병렬 다운로드 (동시 20개)
 * - 자동 재시도 (최대 3회)
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';
import { logger } from '../utils/logger.js';

const DOCS_DIR = path.join(os.homedir(), '.local-cli', 'docs');
const CONCURRENT_DOWNLOADS = 20;
const MAX_RETRIES = 3;

/**
 * 문서 소스 정의
 */
export interface DocsSource {
  id: string;
  name: string;
  description: string;
  llmsTxtUrl: string;
  baseUrl?: string;  // URL prefix (agno용)
  targetDir: string;
  categoryMapping: Record<string, string>;
  urlFilter?: (url: string) => boolean;  // URL 필터링 (adk용)
  urlConverter?: (url: string) => string;  // URL 변환 (adk용 raw URL 변환)
  filenameGenerator?: (url: string, title: string) => string;  // 파일명 생성 커스텀
}

/**
 * ADK 카테고리 매핑
 */
const ADK_CATEGORY_MAPPING: Record<string, string> = {
  'docs/agents/': 'agents',
  'docs/tools/': 'tools',
  'docs/sessions/': 'sessions',
  'docs/deploy/': 'deploy',
  'docs/streaming/': 'streaming',
  'docs/callbacks/': 'callbacks',
  'docs/mcp/': 'mcp',
  'docs/observability/': 'observability',
  'docs/get-started/': 'get-started',
  'docs/tutorials/': 'tutorials',
  'docs/runtime/': 'runtime',
  'docs/events/': 'events',
  'docs/context/': 'context',
  'docs/artifacts/': 'artifacts',
  'docs/evaluate/': 'evaluate',
  'docs/safety/': 'safety',
  'docs/api-reference/': 'api-reference',
  'docs/community': 'community',
  'docs/contributing': 'community',
};

/**
 * AGNO 카테고리 매핑
 */
const AGNO_CATEGORY_MAPPING: Record<string, string> = {
  'agent-os/': 'agent',
  'concepts/agents/': 'agent',
  'concepts/agents/memory.md': 'memory',
  'agent-os/features/memories.md': 'memory',
  'concepts/agents/sessions.md': 'memory',
  'reference/memory/': 'memory',
  'concepts/agents/knowledge.md': 'rag',
  'agent-os/features/knowledge-management.md': 'rag',
  'reference/knowledge/': 'rag',
  'agent-os/mcp/': 'mcp',
  'concepts/agents/tools.md': 'tools',
  'reference/tools/': 'tools',
  'concepts/db/': 'database',
  'reference/storage/': 'database',
  'reference/vector_db/': 'vector_db',
  'reference/workflows/': 'workflows',
  'concepts/workflows/': 'workflows',
  'reference/models/': 'models',
  'concepts/agents/storage.md': 'storage',
  'reference/teams/': 'teams',
  'concepts/agents/guardrails/': 'guardrails',
  'templates/': 'templates',
  'tutorials/': 'tutorials',
};

/**
 * GitHub URL을 raw content URL로 변환
 */
function convertToRawUrl(url: string): string {
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }
  return url;
}

/**
 * 개발팀이 사전 정의한 문서 소스들
 */
export const AVAILABLE_SOURCES: DocsSource[] = [
  {
    id: 'agno',
    name: 'Agno Framework',
    description: 'Agno AI Agent Framework 문서',
    llmsTxtUrl: 'https://docs.agno.com/llms.txt',
    baseUrl: 'https://docs.agno.com',
    targetDir: 'agent_framework/agno',
    categoryMapping: AGNO_CATEGORY_MAPPING,
  },
  {
    id: 'adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit 문서',
    llmsTxtUrl: 'https://raw.githubusercontent.com/google/adk-python/main/llms.txt',
    targetDir: 'agent_framework/adk',
    categoryMapping: ADK_CATEGORY_MAPPING,
    urlFilter: (url: string) => url.includes('github.com/google/adk-docs') && url.endsWith('.md'),
    urlConverter: convertToRawUrl,
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
 * 문서 엔트리
 */
interface DocEntry {
  title: string;
  url: string;
  rawUrl: string;
  category: string;
}

/**
 * HTTP 요청으로 파일 다운로드
 */
function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) {
          return reject(new Error(`Redirect without Location header: ${url}`));
        }
        return downloadFile(location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', reject);
  });
}

/**
 * URL에서 카테고리 결정
 */
function getCategory(url: string, categoryMapping: Record<string, string>): string {
  const lowerUrl = url.toLowerCase();

  // 경로 기반 카테고리 매핑
  for (const [pattern, category] of Object.entries(categoryMapping)) {
    if (lowerUrl.includes(pattern.toLowerCase())) {
      return category;
    }
  }

  // 키워드 기반 분류
  if (lowerUrl.includes('agent')) return 'agents';
  if (lowerUrl.includes('tool')) return 'tools';
  if (lowerUrl.includes('memory') || lowerUrl.includes('session')) return 'memory';
  if (lowerUrl.includes('deploy')) return 'deploy';
  if (lowerUrl.includes('stream')) return 'streaming';
  if (lowerUrl.includes('tutorial')) return 'tutorials';
  if (lowerUrl.includes('model')) return 'models';

  return 'other';
}

/**
 * 파일명 생성
 */
function getFilename(url: string, _title: string): string {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1] || 'index';

  // 경로에서 prefix 추출 (workflow-agents 등)
  const docsIndex = parts.findIndex(part => part === 'docs');
  if (docsIndex !== -1 && docsIndex < parts.length - 2) {
    const subPath = parts.slice(docsIndex + 1, -1);
    if (subPath.length > 1) {
      const prefix = subPath.slice(1).join('_');
      const baseFilename = lastPart.endsWith('.md')
        ? lastPart.replace(/\.md$/, '')
        : lastPart;

      if (baseFilename === 'index') {
        return `${prefix}.md`;
      }
      return `${prefix}_${baseFilename}.md`;
    }
  }

  // models/{model_name}/* 처리
  const modelsIndex = parts.findIndex(part => part === 'models');
  if (modelsIndex !== -1 && modelsIndex < parts.length - 2) {
    const modelName = parts[modelsIndex + 1];
    if (modelName && modelName !== 'models') {
      const baseFilename = lastPart.endsWith('.md')
        ? lastPart.replace(/\.md$/, '')
        : lastPart;
      return `${modelName}_${baseFilename}.md`;
    }
  }

  if (!lastPart.endsWith('.md')) {
    return `${lastPart}.md`;
  }

  return lastPart;
}

/**
 * llms.txt 파싱
 */
async function parseLlmsTxt(content: string, source: DocsSource): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Markdown 링크 형식: - [Title](URL) 또는 [Title](URL)
    const match = line.match(/^-?\s*\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      const title = match[1]!;
      let url = match[2]!;

      // URL 필터링
      if (source.urlFilter && !source.urlFilter(url)) {
        continue;
      }

      // baseUrl 적용
      if (source.baseUrl && !url.startsWith('http')) {
        url = `${source.baseUrl}/${url.replace(/^\//, '')}`;
      }

      // URL 변환 (raw URL 등)
      const rawUrl = source.urlConverter ? source.urlConverter(url) : url;

      // 카테고리 결정
      const category = getCategory(url, source.categoryMapping);

      entries.push({ title, url, rawUrl, category });
    }
  }

  return entries;
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

    let totalFiles = 0;
    let totalBytes = 0;
    const installedSources: string[] = [];

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
        if (entry.isFile()) {
          totalFiles++;
          totalBytes += fs.statSync(fullPath).size;
        } else if (entry.isDirectory()) {
          scanDirectory(fullPath);
        }
      }
    };

    scanDirectory(DOCS_DIR);

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const result = {
      path: DOCS_DIR,
      exists: true,
      totalFiles,
      totalSize: formatSize(totalBytes),
      installedSources,
    };

    logger.exit('getDocsInfo', result);
    return result;
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
 * 사용 가능한 문서 소스 목록 반환
 */
export function getAvailableSources(): DocsSource[] {
  return AVAILABLE_SOURCES;
}

/**
 * 문서 다운로드 결과
 */
export interface DownloadResult {
  success: boolean;
  message: string;
  downloadedFiles?: number;
  skippedFiles?: number;
  failedFiles?: number;
  targetPath?: string;
}

/**
 * 진행 상황 콜백
 */
export type ProgressCallback = (progress: {
  current: number;
  total: number;
  status: 'success' | 'fail' | 'skip';
  filename: string;
  category: string;
}) => void;

/**
 * 사전 정의된 소스에서 문서 다운로드
 */
export async function downloadDocsFromSource(
  sourceId: string,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  logger.enter('downloadDocsFromSource', { sourceId });

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
    // 1. llms.txt 다운로드
    logger.flow('Downloading llms.txt');
    const llmsContent = await downloadFile(source.llmsTxtUrl);

    // 2. 문서 목록 파싱
    logger.flow('Parsing llms.txt');
    const entries = await parseLlmsTxt(llmsContent, source);

    if (entries.length === 0) {
      return {
        success: false,
        message: 'llms.txt에서 문서를 찾을 수 없습니다.',
      };
    }

    // 3. 디렉토리 생성
    const targetPath = path.join(DOCS_DIR, source.targetDir);
    const categories = new Set(entries.map(e => e.category));

    for (const category of categories) {
      const dir = path.join(targetPath, category);
      await fsPromises.mkdir(dir, { recursive: true });
    }

    // 4. 병렬 다운로드
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    let completedCount = 0;

    const activeDownloads = new Set<Promise<void>>();

    const downloadSingleFile = async (entry: DocEntry): Promise<void> => {
      const filename = source.filenameGenerator
        ? source.filenameGenerator(entry.url, entry.title)
        : getFilename(entry.url, entry.title);
      const filePath = path.join(targetPath, entry.category, filename);

      try {
        // 파일이 이미 존재하면 스킵
        try {
          await fsPromises.access(filePath);
          skipCount++;
          completedCount++;
          onProgress?.({
            current: completedCount,
            total: entries.length,
            status: 'skip',
            filename,
            category: entry.category,
          });
          return;
        } catch {
          // 파일이 없으면 다운로드 진행
        }

        // 재시도 로직
        let retries = MAX_RETRIES;
        let content: string | null = null;

        while (retries > 0) {
          try {
            content = await downloadFile(entry.rawUrl);
            break;
          } catch {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!content) {
          throw new Error('Failed after retries');
        }

        // 메타데이터 추가
        const markdownContent = `# ${entry.title}

> Original: [${entry.title}](${entry.url})
> Category: ${entry.category}
> Downloaded: ${new Date().toISOString()}

---

${content}`;

        await fsPromises.writeFile(filePath, markdownContent, 'utf-8');
        successCount++;
        completedCount++;
        onProgress?.({
          current: completedCount,
          total: entries.length,
          status: 'success',
          filename,
          category: entry.category,
        });
      } catch {
        failCount++;
        completedCount++;
        onProgress?.({
          current: completedCount,
          total: entries.length,
          status: 'fail',
          filename,
          category: entry.category,
        });
      }
    };

    // 병렬 다운로드 실행
    let currentIndex = 0;

    while (currentIndex < entries.length) {
      while (activeDownloads.size < CONCURRENT_DOWNLOADS && currentIndex < entries.length) {
        const entry = entries[currentIndex]!;
        currentIndex++;

        const downloadPromise = downloadSingleFile(entry).finally(() => {
          activeDownloads.delete(downloadPromise);
        });

        activeDownloads.add(downloadPromise);
      }

      if (activeDownloads.size > 0) {
        await Promise.race(activeDownloads);
      }
    }

    await Promise.all(activeDownloads);

    // 5. README 생성
    await generateReadme(targetPath, entries, source, categories);

    const result: DownloadResult = {
      success: true,
      message: `${source.name} 문서 다운로드 완료`,
      downloadedFiles: successCount,
      skippedFiles: skipCount,
      failedFiles: failCount,
      targetPath,
    };

    logger.exit('downloadDocsFromSource', result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Download failed', error as Error);
    return {
      success: false,
      message: `다운로드 실패: ${errorMessage}`,
    };
  }
}

/**
 * README 파일 생성
 */
async function generateReadme(
  targetPath: string,
  entries: DocEntry[],
  source: DocsSource,
  categories: Set<string>
): Promise<void> {
  // 카테고리별 README
  for (const category of categories) {
    const categoryEntries = entries.filter(e => e.category === category);
    const readmePath = path.join(targetPath, category, 'README.md');

    const readmeContent = `# ${category.toUpperCase()} 문서

${source.name}의 ${category} 관련 문서입니다.

## 문서 목록

${categoryEntries.map((e, idx) => `${idx + 1}. [${e.title}](${getFilename(e.url, e.title)})`).join('\n')}

총 ${categoryEntries.length}개 문서

---
> 자동 생성: ${new Date().toISOString()}
`;

    await fsPromises.writeFile(readmePath, readmeContent, 'utf-8');
  }

  // 메인 README
  const mainReadmePath = path.join(targetPath, 'README.md');
  const mainReadmeContent = `# ${source.name} 문서

카테고리별로 정리된 ${source.name} 문서입니다.

## 카테고리

${Array.from(categories).sort().map(category => {
  const count = entries.filter(e => e.category === category).length;
  return `- [${category}/](./${category}/) - ${count}개 문서`;
}).join('\n')}

## 통계

- 총 문서 수: ${entries.length}개
- 카테고리 수: ${categories.size}개

---
> 자동 생성: ${new Date().toISOString()}
`;

  await fsPromises.writeFile(mainReadmePath, mainReadmeContent, 'utf-8');
}

/**
 * 디렉토리 목록 조회 (DocsBrowser용)
 */
export interface DocsListItem {
  name: string;
  type: 'file' | 'directory';
  size?: string;
}

export async function listDocsDirectory(subPath?: string): Promise<DocsListItem[]> {
  logger.enter('listDocsDirectory', { subPath });

  try {
    const targetPath = subPath ? path.join(DOCS_DIR, subPath) : DOCS_DIR;

    if (!fs.existsSync(targetPath)) {
      logger.exit('listDocsDirectory', { exists: false });
      return [];
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items: DocsListItem[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        items.push({ name: entry.name, type: 'directory' });
      } else {
        const fullPath = path.join(targetPath, entry.name);
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
 * 문서 경로 반환
 */
export function getDocsPath(): string {
  return DOCS_DIR;
}
