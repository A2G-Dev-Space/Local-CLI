/**
 * File System Tools (LLM Simple)
 *
 * LLM이 파일 시스템과 상호작용할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';

// Safety limits
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'coverage',
  '.cache',
  'build',
  '__pycache__',
]);
const MAX_DEPTH = 5;
const MAX_FILES = 100;

/**
 * read_file Tool Definition
 */
const READ_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the contents of a file. Only text files are supported.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the file to read',
        },
      },
      required: ['file_path'],
    },
  },
};

/**
 * Internal: Execute read_file
 */
async function _executeReadFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;

  try {
    // Remove @ prefix if present
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    const resolvedPath = path.resolve(cleanPath);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    return {
      success: true,
      result: content,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

    if (err.code === 'ENOENT') {
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${displayPath}`,
      };
    } else if (err.code === 'EACCES') {
      return {
        success: false,
        error: `파일 읽기 권한이 없습니다: ${displayPath}`,
      };
    } else {
      return {
        success: false,
        error: `파일 읽기 실패: ${err.message}`,
      };
    }
  }
}

/**
 * read_file LLM Simple Tool
 */
export const readFileTool: LLMSimpleTool = {
  definition: READ_FILE_DEFINITION,
  execute: _executeReadFile,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Read file contents',
};

/**
 * write_file Tool Definition
 */
const WRITE_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write content to a file. Overwrites if file exists.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
  },
};

/**
 * Internal: Execute write_file
 */
async function _executeWriteFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const content = args['content'] as string;

  try {
    // Remove @ prefix if present
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    const resolvedPath = path.resolve(cleanPath);

    // Create directory if it doesn't exist
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');

    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: true,
      result: `파일이 성공적으로 작성되었습니다: ${displayPath}`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: false,
      error: `파일 쓰기 실패 (${displayPath}): ${err.message}`,
    };
  }
}

/**
 * write_file LLM Simple Tool
 */
export const writeFileTool: LLMSimpleTool = {
  definition: WRITE_FILE_DEFINITION,
  execute: _executeWriteFile,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Write content to file',
};

/**
 * list_files Tool Definition
 */
const LIST_FILES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: 'List files and folders in a directory.',
    parameters: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively (default: false)',
        },
      },
      required: [],
    },
  },
};

/**
 * Get files recursively with safety limits
 */
async function getFilesRecursively(
  dirPath: string,
  baseDir: string = dirPath,
  depth: number = 0,
  fileCount: { count: number } = { count: 0 }
): Promise<Array<{ name: string; type: string; path: string }>> {
  // Safety: depth limit
  if (depth > MAX_DEPTH) {
    return [];
  }

  // Safety: file count limit
  if (fileCount.count >= MAX_FILES) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: Array<{ name: string; type: string; path: string }> = [];

  for (const entry of entries) {
    if (fileCount.count >= MAX_FILES) {
      break;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Safety: exclude heavy directories
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      files.push({
        name: entry.name,
        type: 'directory',
        path: relativePath,
      });
      fileCount.count++;

      // Recursive call with increased depth
      const subFiles = await getFilesRecursively(fullPath, baseDir, depth + 1, fileCount);
      files.push(...subFiles);
    } else {
      files.push({
        name: entry.name,
        type: 'file',
        path: relativePath,
      });
      fileCount.count++;
    }
  }

  return files;
}

/**
 * Internal: Execute list_files
 */
async function _executeListFilesInternal(args: Record<string, unknown>): Promise<ToolResult> {
  const directoryPath = (args['directory_path'] as string) || '.';
  const recursive = (args['recursive'] as boolean) || false;

  try {
    const resolvedPath = path.resolve(directoryPath);

    if (recursive) {
      const files = await getFilesRecursively(resolvedPath);
      return {
        success: true,
        result: JSON.stringify(files, null, 2),
      };
    } else {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(directoryPath, entry.name),
      }));

      return {
        success: true,
        result: JSON.stringify(files, null, 2),
      };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return {
        success: false,
        error: `디렉토리를 찾을 수 없습니다: ${directoryPath}`,
      };
    } else {
      return {
        success: false,
        error: `디렉토리 읽기 실패: ${err.message}`,
      };
    }
  }
}

/**
 * list_files LLM Simple Tool
 */
export const listFilesTool: LLMSimpleTool = {
  definition: LIST_FILES_DEFINITION,
  execute: _executeListFilesInternal,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'List directory contents',
};

/**
 * find_files Tool Definition
 */
const FIND_FILES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'find_files',
    description: 'Search for files by filename pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Filename pattern to search for (e.g., *.ts, package.json)',
        },
        directory_path: {
          type: 'string',
          description: 'Directory path to start search from (default: current directory)',
        },
      },
      required: ['pattern'],
    },
  },
};

/**
 * Find files recursively with safety limits
 */
async function findFilesRecursively(
  dirPath: string,
  regex: RegExp,
  baseDir: string,
  depth: number = 0,
  fileCount: { count: number } = { count: 0 }
): Promise<Array<{ name: string; path: string }>> {
  // Safety: depth limit
  if (depth > MAX_DEPTH) {
    return [];
  }

  // Safety: file count limit
  if (fileCount.count >= MAX_FILES) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const matchedFiles: Array<{ name: string; path: string }> = [];

  for (const entry of entries) {
    if (fileCount.count >= MAX_FILES) {
      break;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Safety: exclude heavy directories
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      // Recursive call with increased depth
      const subFiles = await findFilesRecursively(fullPath, regex, baseDir, depth + 1, fileCount);
      matchedFiles.push(...subFiles);
    } else if (regex.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath);
      matchedFiles.push({
        name: entry.name,
        path: relativePath,
      });
      fileCount.count++;
    }
  }

  return matchedFiles;
}

/**
 * Internal: Execute find_files
 */
async function _executeFindFilesInternal(args: Record<string, unknown>): Promise<ToolResult> {
  const pattern = args['pattern'] as string;
  const directoryPath = (args['directory_path'] as string) || '.';

  try {
    const resolvedPath = path.resolve(directoryPath);

    // Convert pattern to regex (simple glob support)
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    const matchedFiles = await findFilesRecursively(resolvedPath, regex, resolvedPath);

    if (matchedFiles.length === 0) {
      return {
        success: true,
        result: `패턴 "${pattern}"과 일치하는 파일을 찾지 못했습니다.`,
      };
    }

    return {
      success: true,
      result: JSON.stringify(matchedFiles, null, 2),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return {
      success: false,
      error: `파일 검색 실패: ${err.message}`,
    };
  }
}

/**
 * find_files LLM Simple Tool
 */
export const findFilesTool: LLMSimpleTool = {
  definition: FIND_FILES_DEFINITION,
  execute: _executeFindFilesInternal,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Search files by pattern',
};

/**
 * All file tools
 */
export const FILE_SIMPLE_TOOLS: LLMSimpleTool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  findFilesTool,
];

/**
 * Tool definitions for LLM (backward compatible)
 */
export const FILE_TOOLS: ToolDefinition[] = FILE_SIMPLE_TOOLS.map((tool) => tool.definition);

/**
 * Execute file tool by name (backward compatible)
 */
export async function executeFileTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = FILE_SIMPLE_TOOLS.find((t) => t.definition.function.name === toolName);

  if (!tool) {
    return {
      success: false,
      error: `알 수 없는 도구: ${toolName}`,
    };
  }

  return tool.execute(args);
}

// ============================================================
// Backward Compatible Function Exports
// These functions maintain compatibility with existing code
// ============================================================

/**
 * Execute read_file (backward compatible)
 * @deprecated Use readFileTool.execute() instead
 */
export async function executeReadFile(filePath: string): Promise<ToolResult> {
  return readFileTool.execute({ file_path: filePath });
}

/**
 * Execute write_file (backward compatible)
 * @deprecated Use writeFileTool.execute() instead
 */
export async function executeWriteFile(filePath: string, content: string): Promise<ToolResult> {
  return writeFileTool.execute({ file_path: filePath, content });
}

/**
 * Execute list_files (backward compatible)
 * @deprecated Use listFilesTool.execute() instead
 */
export async function executeListFiles(
  directoryPath: string = '.',
  recursive: boolean = false
): Promise<ToolResult> {
  return listFilesTool.execute({ directory_path: directoryPath, recursive });
}

/**
 * Execute find_files (backward compatible)
 * @deprecated Use findFilesTool.execute() instead
 */
export async function executeFindFiles(
  pattern: string,
  directoryPath: string = '.'
): Promise<ToolResult> {
  return findFilesTool.execute({ pattern, directory_path: directoryPath });
}

// Re-export ToolExecutionResult type for backward compatibility
export type ToolExecutionResult = ToolResult;
