/**
 * File Tools - Barrel Export
 *
 * File system operations for Electron Agent
 * Total: 6 tools (read, create, edit, list, find, search)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ToolDefinition } from '../../../llm-client';
import type { LLMSimpleTool, ToolResult } from '../common/types';
import { CORE_CATEGORIES } from '../common/constants';
import { sendFileEditEvent, sendFileCreateEvent } from '../../../ipc-handlers';

// Language detection from file extension
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.ps1': 'powershell',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sh': 'bash',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
  };
  return langMap[ext] || 'plaintext';
}

// =============================================================================
// Constants
// =============================================================================

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
const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LIMIT = 10000;

// Working directory management
let currentWorkingDirectory: string = process.cwd();

export function setWorkingDirectory(dir: string): void {
  currentWorkingDirectory = dir;
}

export function getWorkingDirectory(): string {
  return currentWorkingDirectory;
}

function resolvePath(filePath: string): string {
  const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
  if (path.isAbsolute(cleanPath)) {
    return cleanPath;
  }
  return path.resolve(currentWorkingDirectory, cleanPath);
}

function formatWithLineNumbers(content: string, startLine: number = 1): string {
  const lines = content.split('\n');
  const totalDigits = String(startLine + lines.length - 1).length;
  return lines
    .map((line, idx) => {
      const lineNum = startLine + idx;
      return `${String(lineNum).padStart(totalDigits)}→${line}`;
    })
    .join('\n');
}

// =============================================================================
// read_file Tool
// =============================================================================

const READ_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: `Read the contents of a file. Only text files are supported.
By default, reads up to ${DEFAULT_LINE_LIMIT} lines. Use offset/limit for large files.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are reading this file',
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the file to read',
        },
        offset: {
          type: 'number',
          description: 'Starting line number (1-based, default: 1)',
        },
        limit: {
          type: 'number',
          description: `Number of lines to read (default: ${DEFAULT_LINE_LIMIT}, max: ${MAX_LINE_LIMIT})`,
        },
      },
      required: ['reason', 'file_path'],
    },
  },
};

async function executeReadFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const offset = Math.max(1, (args['offset'] as number) || 1);
  const limit = Math.min(MAX_LINE_LIMIT, Math.max(1, (args['limit'] as number) || DEFAULT_LINE_LIMIT));

  try {
    const resolvedPath = resolvePath(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    const allLines = content.split('\n');
    const totalLines = allLines.length;
    const startIdx = offset - 1;
    const endIdx = Math.min(startIdx + limit, totalLines);
    const selectedLines = allLines.slice(startIdx, endIdx);

    const formattedContent = formatWithLineNumbers(selectedLines.join('\n'), offset);

    let result = formattedContent;

    if (totalLines > limit || offset > 1) {
      const header = `[File: ${filePath} | Lines ${offset}-${endIdx} of ${totalLines}]`;
      const hasMore = endIdx < totalLines;
      const footer = hasMore
        ? `\n[... ${totalLines - endIdx} more lines. Use offset=${endIdx + 1} to continue reading]`
        : '';
      result = `${header}\n${result}${footer}`;
    }

    return { success: true, result };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: false, error: `File not found: ${filePath}` };
    } else if (err.code === 'EACCES') {
      return { success: false, error: `Permission denied reading file: ${filePath}` };
    }
    return { success: false, error: `Failed to read file: ${err.message}` };
  }
}

export const readFileTool: LLMSimpleTool = {
  definition: READ_FILE_DEFINITION,
  execute: executeReadFile,
  categories: CORE_CATEGORIES,
  description: 'Read file contents',
};

// =============================================================================
// create_file Tool
// =============================================================================

const CREATE_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_file',
    description: `Create a NEW file with the given content.
IMPORTANT: Only use this for files that do NOT exist yet.
For modifying existing files, use edit_file instead.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are creating this file',
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the new file to create',
        },
        content: {
          type: 'string',
          description: 'Content to write to the new file',
        },
      },
      required: ['reason', 'file_path', 'content'],
    },
  },
};

async function executeCreateFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const content = args['content'] as string;

  try {
    const resolvedPath = resolvePath(filePath);

    try {
      await fs.access(resolvedPath);
      return {
        success: false,
        error: `File already exists: ${filePath}. Use edit_file to modify existing files.`,
      };
    } catch {
      // File doesn't exist - good
    }

    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');

    const lines = content.split('\n').length;
    const language = detectLanguage(filePath);

    // Emit file create event for diff view (safe call)
    try {
      sendFileCreateEvent({
        path: resolvedPath,
        content,
        language,
      });
    } catch (e) {
      // Silently ignore event emission errors
    }

    return {
      success: true,
      result: JSON.stringify({
        action: 'created',
        file: filePath,
        lines,
        message: `Created ${filePath} (${lines} lines)`,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { success: false, error: `Failed to create file (${filePath}): ${err.message}` };
  }
}

export const createFileTool: LLMSimpleTool = {
  definition: CREATE_FILE_DEFINITION,
  execute: executeCreateFile,
  categories: CORE_CATEGORIES,
  description: 'Create a new file',
};

// =============================================================================
// edit_file Tool
// =============================================================================

const EDIT_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit an EXISTING file by replacing a specific text block.
IMPORTANT: Only use this for files that already exist. For new files, use create_file.

HOW TO USE:
1. First use read_file to see the current content
2. Copy the EXACT text block you want to change
3. Provide old_string (text to find) and new_string (replacement)

RULES:
- old_string must match EXACTLY (including whitespace and indentation)
- old_string must be UNIQUE in the file (if it appears multiple times, use replace_all: true)`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are editing this file',
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the existing file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The new text to replace with',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace ALL occurrences of old_string',
        },
      },
      required: ['reason', 'file_path', 'old_string', 'new_string'],
    },
  },
};

async function executeEditFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const oldString = args['old_string'] as string;
  const newString = args['new_string'] as string;
  const replaceAll = args['replace_all'] as boolean | undefined;

  try {
    const resolvedPath = resolvePath(filePath);

    if (!oldString) {
      return { success: false, error: 'old_string cannot be empty.' };
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      return {
        success: false,
        error: `File does not exist: ${filePath}. Use create_file to create new files.`,
      };
    }

    const originalContent = await fs.readFile(resolvedPath, 'utf-8');

    if (!originalContent.includes(oldString)) {
      const lines = originalContent.split('\n');
      const preview = lines.slice(0, 20).map((l, i) => `${i + 1}: ${l}`).join('\n');
      return {
        success: false,
        error: `old_string not found in file.\n\nSearched for:\n"${oldString.slice(0, 200)}${oldString.length > 200 ? '...' : ''}"\n\nFile preview (first 20 lines):\n${preview}\n\n💡 Use read_file to check the exact content and try again.`,
      };
    }

    const occurrences = originalContent.split(oldString).length - 1;

    if (!replaceAll && occurrences > 1) {
      return {
        success: false,
        error: `old_string appears ${occurrences} times in the file. Either:\n1. Make old_string more specific\n2. Use replace_all: true to replace all occurrences`,
      };
    }

    let newContent: string;
    if (replaceAll) {
      newContent = originalContent.split(oldString).join(newString);
    } else {
      newContent = originalContent.replace(oldString, newString);
    }

    await fs.writeFile(resolvedPath, newContent, 'utf-8');

    const oldLinesArr = oldString.split('\n');
    const newLinesArr = newString.split('\n');
    const replacements = replaceAll ? occurrences : 1;
    const language = detectLanguage(filePath);

    // Emit file edit event for diff view (safe call)
    try {
      sendFileEditEvent({
        path: resolvedPath,
        originalContent,
        newContent,
        language,
      });
    } catch (e) {
      // Silently ignore event emission errors
    }

    const diffPreview: string[] = [];
    const oldPreview = oldLinesArr.slice(0, 5);
    const newPreview = newLinesArr.slice(0, 5);

    oldPreview.forEach((line) => diffPreview.push(`- ${line}`));
    if (oldLinesArr.length > 5) diffPreview.push('- ...');
    newPreview.forEach((line) => diffPreview.push(`+ ${line}`));
    if (newLinesArr.length > 5) diffPreview.push('+ ...');

    return {
      success: true,
      result: JSON.stringify({
        action: 'edited',
        file: filePath,
        replacements,
        oldLines: oldLinesArr.length,
        newLines: newLinesArr.length,
        message: replaceAll
          ? `Replaced ${replacements} occurrence(s) in ${filePath}`
          : `Updated ${filePath}`,
        diff: diffPreview,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { success: false, error: `File edit failed (${filePath}): ${err.message}` };
  }
}

export const editFileTool: LLMSimpleTool = {
  definition: EDIT_FILE_DEFINITION,
  execute: executeEditFile,
  categories: CORE_CATEGORIES,
  description: 'Edit an existing file',
};

// =============================================================================
// list_files Tool
// =============================================================================

const LIST_FILES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: 'List files and folders in a directory.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are listing files',
        },
        directory_path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

async function getFilesRecursively(
  dirPath: string,
  baseDir: string = dirPath,
  depth: number = 0,
  fileCount: { count: number } = { count: 0 }
): Promise<Array<{ name: string; type: string; path: string }>> {
  if (depth > MAX_DEPTH || fileCount.count >= MAX_FILES) {
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
    if (fileCount.count >= MAX_FILES) break;

    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      files.push({ name: entry.name, type: 'directory', path: relativePath });
      fileCount.count++;

      const subFiles = await getFilesRecursively(fullPath, baseDir, depth + 1, fileCount);
      files.push(...subFiles);
    } else {
      files.push({ name: entry.name, type: 'file', path: relativePath });
      fileCount.count++;
    }
  }

  return files;
}

async function executeListFiles(args: Record<string, unknown>): Promise<ToolResult> {
  const directoryPath = (args['directory_path'] as string) || '.';
  const recursive = (args['recursive'] as boolean) || false;

  try {
    const resolvedPath = resolvePath(directoryPath);

    if (recursive) {
      const files = await getFilesRecursively(resolvedPath);
      return { success: true, result: JSON.stringify(files, null, 2) };
    } else {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(directoryPath, entry.name),
      }));
      return { success: true, result: JSON.stringify(files, null, 2) };
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: false, error: `Directory not found: ${directoryPath}` };
    }
    return { success: false, error: `Failed to read directory: ${err.message}` };
  }
}

export const listFilesTool: LLMSimpleTool = {
  definition: LIST_FILES_DEFINITION,
  execute: executeListFiles,
  categories: CORE_CATEGORIES,
  description: 'List directory contents',
};

// =============================================================================
// find_files Tool
// =============================================================================

const FIND_FILES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'find_files',
    description: 'Search for files by filename pattern.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are searching for files',
        },
        pattern: {
          type: 'string',
          description: 'Filename pattern to search for (e.g., *.ts, package.json)',
        },
        directory_path: {
          type: 'string',
          description: 'Directory path to start search from (default: current directory)',
        },
      },
      required: ['reason', 'pattern'],
    },
  },
};

async function findFilesRecursively(
  dirPath: string,
  regex: RegExp,
  baseDir: string,
  depth: number = 0,
  fileCount: { count: number } = { count: 0 }
): Promise<Array<{ name: string; path: string }>> {
  if (depth > MAX_DEPTH || fileCount.count >= MAX_FILES) {
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
    if (fileCount.count >= MAX_FILES) break;

    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const subFiles = await findFilesRecursively(fullPath, regex, baseDir, depth + 1, fileCount);
      matchedFiles.push(...subFiles);
    } else if (regex.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath);
      matchedFiles.push({ name: entry.name, path: relativePath });
      fileCount.count++;
    }
  }

  return matchedFiles;
}

async function executeFindFiles(args: Record<string, unknown>): Promise<ToolResult> {
  const pattern = args['pattern'] as string;
  const directoryPath = (args['directory_path'] as string) || '.';

  try {
    const resolvedPath = resolvePath(directoryPath);

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');

    const matchedFiles = await findFilesRecursively(resolvedPath, regex, resolvedPath);

    if (matchedFiles.length === 0) {
      return { success: true, result: `No files found matching pattern "${pattern}".` };
    }

    return { success: true, result: JSON.stringify(matchedFiles, null, 2) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { success: false, error: `File search failed: ${err.message}` };
  }
}

export const findFilesTool: LLMSimpleTool = {
  definition: FIND_FILES_DEFINITION,
  execute: executeFindFiles,
  categories: CORE_CATEGORIES,
  description: 'Search files by pattern',
};

// =============================================================================
// search_content Tool
// =============================================================================

const SEARCH_CONTENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_content',
    description: 'Search for text pattern inside files.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you are searching for content',
        },
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        directory_path: {
          type: 'string',
          description: 'Directory path to search in (default: current directory)',
        },
        file_pattern: {
          type: 'string',
          description: 'File pattern to filter (e.g., *.ts)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
      required: ['reason', 'pattern'],
    },
  },
};

const TEXT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.scss',
  '.html', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.sh', '.bash', '.ps1', '.py', '.rb', '.go', '.rs', '.java', '.c',
  '.cpp', '.h', '.hpp', '.cs', '.php', '.vue', '.svelte',
];

async function searchContentRecursively(
  dirPath: string,
  searchRegex: RegExp,
  baseDir: string,
  fileRegex: RegExp | null,
  resultCount: { count: number },
  maxResults: number,
  depth: number = 0
): Promise<Array<{ file: string; line: number; content: string }>> {
  if (depth > MAX_DEPTH || resultCount.count >= maxResults) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: Array<{ file: string; line: number; content: string }> = [];

  for (const entry of entries) {
    if (resultCount.count >= maxResults) break;

    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const subResults = await searchContentRecursively(
        fullPath, searchRegex, baseDir, fileRegex, resultCount, maxResults, depth + 1
      );
      results.push(...subResults);
    } else {
      if (fileRegex && !fileRegex.test(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.includes(ext)) continue;

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(baseDir, fullPath);

        for (let i = 0; i < lines.length && resultCount.count < maxResults; i++) {
          if (searchRegex.test(lines[i])) {
            results.push({
              file: relativePath,
              line: i + 1,
              content: lines[i].trim().substring(0, 200),
            });
            resultCount.count++;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return results;
}

async function executeSearchContent(args: Record<string, unknown>): Promise<ToolResult> {
  const pattern = args['pattern'] as string;
  const directoryPath = (args['directory_path'] as string) || '.';
  const filePattern = args['file_pattern'] as string | undefined;
  const maxResults = (args['max_results'] as number) || 50;

  try {
    const resolvedPath = resolvePath(directoryPath);
    const searchRegex = new RegExp(pattern, 'gi');

    let fileRegex: RegExp | null = null;
    if (filePattern) {
      const regexPattern = filePattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      fileRegex = new RegExp(`^${regexPattern}$`, 'i');
    }

    const results = await searchContentRecursively(
      resolvedPath, searchRegex, resolvedPath, fileRegex, { count: 0 }, maxResults
    );

    if (results.length === 0) {
      return { success: true, result: `No matches found for pattern "${pattern}".` };
    }

    return { success: true, result: JSON.stringify(results, null, 2) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { success: false, error: `Content search failed: ${err.message}` };
  }
}

export const searchContentTool: LLMSimpleTool = {
  definition: SEARCH_CONTENT_DEFINITION,
  execute: executeSearchContent,
  categories: CORE_CATEGORIES,
  description: 'Search content in files',
};

// =============================================================================
// Export All File Tools
// =============================================================================

export const FILE_TOOLS: LLMSimpleTool[] = [
  readFileTool,
  createFileTool,
  editFileTool,
  listFilesTool,
  findFilesTool,
  searchContentTool,
];
