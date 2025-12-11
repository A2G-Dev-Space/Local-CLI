/**
 * useFileList Hook
 *
 * Load and filter file list for file browser
 */

import { useMemo } from 'react';
import { executeListFiles } from '../../tools/llm/simple/file-tools.js';

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

interface UseFileListOptions {
  filter?: string;
  maxResults?: number;
  cachedFiles?: FileItem[]; // Use pre-loaded file list for instant display
}

interface UseFileListResult {
  files: FileItem[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

/**
 * Load and process file list from file system
 * This should be called once at app startup and cached
 */
export async function loadFileList(): Promise<FileItem[]> {
  try {
    // Get recursive file list from current directory
    const result = await executeListFiles('.', true);

    if (!result.success) {
      console.error('Failed to load files:', result.error);
      return [];
    }

    // Parse JSON result
    const files = JSON.parse(result.result || '[]') as FileItem[];

    // Filter out node_modules and hidden files/directories
    const filteredFiles = files.filter((file) => {
      const pathParts = file.path.split('/');
      // Exclude node_modules, .git, and other common exclusions
      return !pathParts.some((part) =>
        part.startsWith('.') ||
        part === 'node_modules' ||
        part === 'dist' ||
        part === 'build' ||
        part === 'coverage'
      );
    });

    // ============================================================
    // TODO: Directory Navigation Feature
    // ============================================================
    // Currently, directories are excluded from the file browser
    // because there's no directory processing logic implemented yet.
    //
    // To enable directory navigation in the future:
    // 1. Remove or comment out the filter below
    // 2. Implement directory selection handler in FileBrowser.tsx
    // 3. Add logic to navigate into selected directory
    // 4. Update atFileProcessor.ts to handle directory paths
    //
    // For now, only show files to prevent errors when directories
    // are selected.
    // ============================================================
    const filesOnly = filteredFiles.filter((file) => file.type === 'file');

    // Sort files alphabetically
    // (When directories are enabled, uncomment the sorting logic below)
    filesOnly.sort((a, b) => {
      // if (a.type === b.type) {
      //   return a.path.localeCompare(b.path);
      // }
      // return a.type === 'directory' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    return filesOnly;
  } catch (err) {
    console.error('Error loading file list:', err);
    return [];
  }
}

/**
 * Custom hook to filter pre-loaded file list
 * This hook expects cachedFiles to be provided for instant filtering
 */
export function useFileList(options: UseFileListOptions = {}): UseFileListResult {
  const { filter = '', maxResults = 10, cachedFiles = [] } = options;

  // Use cached files if provided, otherwise empty (no loading in this hook)
  const allFiles = cachedFiles;
  const loading = false; // Loading is handled externally
  const error = null;

  // Filter files based on search pattern (memoized for performance)
  const filteredFiles = useMemo(() => {
    if (!filter) return allFiles;

    const lowerFilter = filter.toLowerCase();
    return allFiles.filter((file) =>
      file.path.toLowerCase().includes(lowerFilter)
    );
  }, [allFiles, filter]);

  // Limit results (memoized)
  const limitedFiles = useMemo(() => {
    return filteredFiles.slice(0, maxResults);
  }, [filteredFiles, maxResults]);

  return {
    files: limitedFiles,
    loading,
    error,
    totalCount: filteredFiles.length,
  };
}
