/**
 * Docs Manager for Electron Agent
 * llms.txt based documentation download and management
 *
 * CLI parity: src/core/docs-manager.ts
 *
 * - Parse llms.txt to extract document URLs
 * - Auto-categorize by path
 * - Parallel downloads (20 concurrent)
 * - Auto-retry (max 3 times)
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { app, shell } from 'electron';
import { logger } from '../utils/logger';

// =============================================================================
// Constants
// =============================================================================

// IMPORTANT: Use same path as CLI for consistency
// UI downloads docs here, so agent must search the same location
const DOCS_DIR = path.join(app.getPath('home'), '.local-cli', 'docs');
const CONCURRENT_DOWNLOADS = 20;
const MAX_RETRIES = 3;

// =============================================================================
// Types
// =============================================================================

export interface DocsSource {
  id: string;
  name: string;
  description: string;
  llmsTxtUrl: string;
  baseUrl?: string;
  targetDir: string;
  categoryMapping: Record<string, string>;
  urlFilter?: (url: string) => boolean;
  urlConverter?: (url: string) => string;
}

export interface DocsInfo {
  path: string;
  exists: boolean;
  totalFiles: number;
  totalSize: string;
  installedSources: string[];
}

export interface DownloadResult {
  success: boolean;
  message: string;
  downloadedFiles?: number;
  skippedFiles?: number;
  failedFiles?: number;
  targetPath?: string;
}

interface DocEntry {
  title: string;
  url: string;
  rawUrl: string;
  category: string;
}

export type ProgressCallback = (progress: {
  current: number;
  total: number;
  status: 'success' | 'fail' | 'skip';
  filename: string;
  category: string;
}) => void;

// =============================================================================
// Category Mappings
// =============================================================================

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

// =============================================================================
// Available Sources
// =============================================================================

function convertToRawUrl(url: string): string {
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
}

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

// =============================================================================
// Helper Functions
// =============================================================================

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

function getCategory(url: string, categoryMapping: Record<string, string>): string {
  const lowerUrl = url.toLowerCase();

  for (const [pattern, category] of Object.entries(categoryMapping)) {
    if (lowerUrl.includes(pattern.toLowerCase())) {
      return category;
    }
  }

  // Keyword-based fallback
  if (lowerUrl.includes('agent')) return 'agents';
  if (lowerUrl.includes('tool')) return 'tools';
  if (lowerUrl.includes('memory') || lowerUrl.includes('session')) return 'memory';
  if (lowerUrl.includes('deploy')) return 'deploy';
  if (lowerUrl.includes('stream')) return 'streaming';
  if (lowerUrl.includes('tutorial')) return 'tutorials';
  if (lowerUrl.includes('model')) return 'models';

  return 'other';
}

function getFilename(url: string, _title: string): string {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1] || 'index';

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

  if (!lastPart.endsWith('.md')) {
    return `${lastPart}.md`;
  }

  return lastPart;
}

async function parseLlmsTxt(content: string, source: DocsSource): Promise<DocEntry[]> {
  const entries: DocEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-?\s*\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      const title = match[1]!;
      let url = match[2]!;

      if (source.urlFilter && !source.urlFilter(url)) {
        continue;
      }

      if (source.baseUrl && !url.startsWith('http')) {
        url = `${source.baseUrl}/${url.replace(/^\//, '')}`;
      }

      const rawUrl = source.urlConverter ? source.urlConverter(url) : url;
      const category = getCategory(url, source.categoryMapping);

      entries.push({ title, url, rawUrl, category });
    }
  }

  return entries;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get docs directory info
 */
export async function getDocsInfo(): Promise<DocsInfo> {
  logger.enter('getDocsInfo');

  try {
    const exists = fsSync.existsSync(DOCS_DIR);

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
      if (fsSync.existsSync(sourcePath)) {
        installedSources.push(source.id);
      }
    }

    const scanDirectory = (dir: string) => {
      if (!fsSync.existsSync(dir)) return;
      const entries = fsSync.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          totalFiles++;
          totalBytes += fsSync.statSync(fullPath).size;
        } else if (entry.isDirectory()) {
          scanDirectory(fullPath);
        }
      }
    };

    scanDirectory(DOCS_DIR);

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
 * Get available doc sources
 */
export function getAvailableSources(): DocsSource[] {
  return AVAILABLE_SOURCES;
}

/**
 * Download docs from a source
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
      message: `Unknown source: ${sourceId}\nAvailable sources: ${availableIds}`,
    };
  }

  try {
    // 1. Download llms.txt
    logger.flow('Downloading llms.txt');
    const llmsContent = await downloadFile(source.llmsTxtUrl);

    // 2. Parse document list
    logger.flow('Parsing llms.txt');
    const entries = await parseLlmsTxt(llmsContent, source);

    if (entries.length === 0) {
      return {
        success: false,
        message: 'No documents found in llms.txt',
      };
    }

    // 3. Create directories
    const targetPath = path.join(DOCS_DIR, source.targetDir);
    const categories = new Set(entries.map(e => e.category));

    for (const category of categories) {
      const dir = path.join(targetPath, category);
      await fs.mkdir(dir, { recursive: true });
    }

    // 4. Parallel download
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    let completedCount = 0;

    const activeDownloads = new Set<Promise<void>>();

    const downloadSingleFile = async (entry: DocEntry): Promise<void> => {
      const filename = getFilename(entry.url, entry.title);
      const filePath = path.join(targetPath, entry.category, filename);

      try {
        // Skip if already exists
        try {
          await fs.access(filePath);
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
          // File doesn't exist, proceed with download
        }

        // Retry logic
        let retries = MAX_RETRIES;
        let content: string | null = null;

        while (retries > 0) {
          try {
            content = await downloadFile(entry.rawUrl);
            break;
          } catch (e) {
            retries--;
            logger.warn(`Download attempt failed for ${entry.rawUrl}`, {
              error: e instanceof Error ? e.message : String(e),
              retriesLeft: retries
            });
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!content) {
          throw new Error('Failed after retries');
        }

        // Add metadata
        const markdownContent = `# ${entry.title}

> Original: [${entry.title}](${entry.url})
> Category: ${entry.category}
> Downloaded: ${new Date().toISOString()}

---

${content}`;

        await fs.writeFile(filePath, markdownContent, 'utf-8');
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

    // Execute parallel downloads
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

    const result: DownloadResult = {
      success: true,
      message: `${source.name} docs download complete`,
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
      message: `Download failed: ${errorMessage}`,
    };
  }
}

/**
 * Get docs directory path
 */
export function getDocsPath(): string {
  return DOCS_DIR;
}

/**
 * Check if docs are available
 */
export async function hasDocsAvailable(): Promise<boolean> {
  const info = await getDocsInfo();
  return info.exists && info.totalFiles > 0;
}

// =============================================================================
// IPC-compatible types and functions (for ipc-handlers.ts)
// =============================================================================

/**
 * Download progress callback type (ipc-handlers compatibility)
 */
export interface DownloadProgress {
  downloaded: number;
  total: number;
  current?: string;
}

/**
 * IPC-compatible DocsSource type (with installed state)
 */
export interface IpcDocsSource {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  fileCount?: number;
  size?: string;
  llmsTxtUrl?: string;
}

/**
 * IPC-compatible DocsInfo type
 */
export interface IpcDocsInfo {
  path: string;
  exists: boolean;
  totalFiles: number;
  totalSize: string;
  sources: IpcDocsSource[];
}

/**
 * Get docs info for IPC (compatible with ipc-handlers.ts)
 */
export async function getDocsInfoForIpc(): Promise<{ success: boolean; info?: IpcDocsInfo; error?: string }> {
  try {
    const exists = fsSync.existsSync(DOCS_DIR);

    let totalFiles = 0;
    let totalBytes = 0;
    const sources: IpcDocsSource[] = [];

    for (const source of AVAILABLE_SOURCES) {
      const sourcePath = path.join(DOCS_DIR, source.targetDir);
      const installed = fsSync.existsSync(sourcePath);
      let fileCount: number | undefined;
      let size: string | undefined;

      if (installed) {
        // Count files and size
        const scanDir = (dir: string): { files: number; bytes: number } => {
          let files = 0;
          let bytes = 0;
          if (!fsSync.existsSync(dir)) return { files, bytes };
          const entries = fsSync.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile()) {
              files++;
              bytes += fsSync.statSync(fullPath).size;
            } else if (entry.isDirectory()) {
              const sub = scanDir(fullPath);
              files += sub.files;
              bytes += sub.bytes;
            }
          }
          return { files, bytes };
        };

        const stats = scanDir(sourcePath);
        fileCount = stats.files;
        size = formatSize(stats.bytes);
        totalFiles += stats.files;
        totalBytes += stats.bytes;
      }

      sources.push({
        id: source.id,
        name: source.name,
        description: source.description,
        installed,
        fileCount,
        size,
        llmsTxtUrl: source.llmsTxtUrl,
      });
    }

    return {
      success: true,
      info: {
        path: DOCS_DIR,
        exists,
        totalFiles,
        totalSize: formatSize(totalBytes),
        sources,
      },
    };
  } catch (error) {
    logger.error('Failed to get docs info', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Download docs (ipc-handlers.ts compatibility wrapper)
 */
export async function downloadDocs(
  sourceId: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{
  success: boolean;
  message?: string;
  downloadedFiles?: number;
  targetPath?: string;
  error?: string;
}> {
  const result = await downloadDocsFromSource(sourceId, onProgress ? (p) => {
    onProgress({
      downloaded: p.current,
      total: p.total,
      current: p.filename,
    });
  } : undefined);

  if (result.success) {
    return {
      success: true,
      message: result.message,
      downloadedFiles: result.downloadedFiles,
      targetPath: result.targetPath,
    };
  } else {
    return {
      success: false,
      error: result.message,
    };
  }
}

/**
 * Delete documentation source
 */
export async function deleteDocs(
  sourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const source = AVAILABLE_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      return { success: false, error: `Unknown source: ${sourceId}` };
    }

    const targetPath = path.join(DOCS_DIR, source.targetDir);

    if (!fsSync.existsSync(targetPath)) {
      return { success: false, error: 'Documentation not installed' };
    }

    await fs.rm(targetPath, { recursive: true, force: true });
    logger.info(`Deleted documentation: ${sourceId}`);

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete docs', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Open docs folder in file explorer
 */
export async function openDocsFolder(): Promise<{ success: boolean; error?: string }> {
  try {
    // Create directory if it doesn't exist
    if (!fsSync.existsSync(DOCS_DIR)) {
      await fs.mkdir(DOCS_DIR, { recursive: true });
    }

    shell.openPath(DOCS_DIR);
    return { success: true };
  } catch (error) {
    logger.error('Failed to open docs folder', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  getDocsInfo,
  getDocsInfoForIpc,
  getAvailableSources,
  downloadDocsFromSource,
  downloadDocs,
  deleteDocs,
  openDocsFolder,
  getDocsPath,
  hasDocsAvailable,
  AVAILABLE_SOURCES,
};
