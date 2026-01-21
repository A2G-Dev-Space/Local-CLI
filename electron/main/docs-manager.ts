/**
 * Documentation Manager for Electron
 * Based on CLI's local docs feature
 */

import fs from 'fs';
import path from 'path';
import { shell, app } from 'electron';
import { logger } from './logger';

// Documentation source definition
export interface DocsSource {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  fileCount?: number;
  size?: string;
  llmsTxtUrl?: string;
}

// Documentation info
export interface DocsInfo {
  path: string;
  exists: boolean;
  totalFiles: number;
  totalSize: string;
  sources: DocsSource[];
}

// Download progress callback
export interface DownloadProgress {
  downloaded: number;
  total: number;
  current?: string;
}

// Available documentation sources (same as CLI)
const AVAILABLE_SOURCES: Array<{
  id: string;
  name: string;
  description: string;
  llmsTxtUrl: string;
}> = [
  {
    id: 'agno',
    name: 'Agno Framework',
    description: 'AI Agent Framework documentation - agents, memory, RAG, tools, workflows',
    llmsTxtUrl: 'https://docs.agno.com/llms.txt',
  },
  {
    id: 'adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit - agents, tools, sessions, deploy',
    llmsTxtUrl: 'https://google.github.io/adk-docs/llms.txt',
  },
];

/**
 * Get docs directory path
 */
function getDocsPath(): string {
  const userHome = app.getPath('home');
  return path.join(userHome, '.local-cli', 'docs');
}

/**
 * Format bytes to human readable size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get directory size recursively
 */
async function getDirSize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirSize(fullPath);
      } else {
        const stat = await fs.promises.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Ignore errors
  }
  return totalSize;
}

/**
 * Count files in directory recursively
 */
async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(fullPath);
      } else {
        count++;
      }
    }
  } catch {
    // Ignore errors
  }
  return count;
}

/**
 * Get documentation info
 */
export async function getDocsInfo(): Promise<{ success: boolean; info?: DocsInfo; error?: string }> {
  try {
    const docsPath = getDocsPath();
    const exists = fs.existsSync(docsPath);

    let totalFiles = 0;
    let totalSize = 0;

    const sources: DocsSource[] = [];

    for (const source of AVAILABLE_SOURCES) {
      const sourcePath = path.join(docsPath, source.id);
      const installed = fs.existsSync(sourcePath);
      let fileCount: number | undefined;
      let size: string | undefined;

      if (installed) {
        fileCount = await countFiles(sourcePath);
        const sizeBytes = await getDirSize(sourcePath);
        size = formatSize(sizeBytes);
        totalFiles += fileCount;
        totalSize += sizeBytes;
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
        path: docsPath,
        exists,
        totalFiles,
        totalSize: formatSize(totalSize),
        sources,
      },
    };
  } catch (error) {
    logger.error('Failed to get docs info', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Parse llms.txt to get list of files to download
 */
async function parseLlmsTxt(url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch llms.txt: ${response.status}`);
  }

  const content = await response.text();
  const baseUrl = url.replace('/llms.txt', '');
  const files: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Look for markdown file links
    if (trimmed.endsWith('.md') || trimmed.endsWith('.txt')) {
      files.push(trimmed.startsWith('http') ? trimmed : `${baseUrl}/${trimmed}`);
    } else if (trimmed.includes('.md') || trimmed.includes('.txt')) {
      // Try to extract URL from line
      const match = trimmed.match(/(https?:\/\/[^\s)]+\.(md|txt))/);
      if (match) {
        files.push(match[1]);
      }
    }
  }

  // Also include the llms.txt itself
  files.unshift(url);

  return files;
}

/**
 * Download documentation from a source
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
  try {
    const source = AVAILABLE_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      return { success: false, error: `Unknown source: ${sourceId}` };
    }

    const docsPath = getDocsPath();
    const targetPath = path.join(docsPath, sourceId);

    // Create directory if needed
    await fs.promises.mkdir(targetPath, { recursive: true });

    // Parse llms.txt to get file list
    const files = await parseLlmsTxt(source.llmsTxtUrl);

    if (files.length === 0) {
      return { success: false, error: 'No files found in llms.txt' };
    }

    let downloadedCount = 0;
    const total = files.length;

    // Download files in parallel (limit concurrency)
    const concurrency = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (fileUrl) => {
          try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
              logger.warn(`Failed to download ${fileUrl}: ${response.status}`);
              return;
            }

            const content = await response.text();
            const fileName = fileUrl.split('/').pop() || 'unknown.md';
            const filePath = path.join(targetPath, fileName);

            await fs.promises.writeFile(filePath, content, 'utf-8');
            downloadedCount++;

            onProgress?.({
              downloaded: downloadedCount,
              total,
              current: fileName,
            });
          } catch (err) {
            logger.warn(`Failed to download ${fileUrl}`, err);
          }
        })
      );
    }

    logger.info(`Downloaded ${downloadedCount} files for ${sourceId}`);

    return {
      success: true,
      message: `Downloaded ${downloadedCount} files`,
      downloadedFiles: downloadedCount,
      targetPath,
    };
  } catch (error) {
    logger.error('Failed to download docs', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
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

    const docsPath = getDocsPath();
    const targetPath = path.join(docsPath, sourceId);

    if (!fs.existsSync(targetPath)) {
      return { success: false, error: 'Documentation not installed' };
    }

    await fs.promises.rm(targetPath, { recursive: true, force: true });
    logger.info(`Deleted documentation: ${sourceId}`);

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete docs', error);
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
    const docsPath = getDocsPath();

    // Create directory if it doesn't exist
    if (!fs.existsSync(docsPath)) {
      await fs.promises.mkdir(docsPath, { recursive: true });
    }

    shell.openPath(docsPath);
    return { success: true };
  } catch (error) {
    logger.error('Failed to open docs folder', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
