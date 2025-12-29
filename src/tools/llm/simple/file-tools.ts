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
import { bashTool } from './bash-tool.js';

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
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Checking how the current authentication logic is implemented"
- "Opening the file where the error occurred to find the problem"
- "Checking package.json to understand the project setup"
- "Looking at the existing code before making changes"`,
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the file to read',
        },
      },
      required: ['reason', 'file_path'],
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
        error: `File not found: ${displayPath}`,
      };
    } else if (err.code === 'EACCES') {
      return {
        success: false,
        error: `Permission denied reading file: ${displayPath}`,
      };
    } else {
      return {
        success: false,
        error: `Failed to read file: ${err.message}`,
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
 * create_file Tool Definition
 * Used for creating NEW files only. Use edit_file for existing files.
 */
const CREATE_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_file',
    description: `Create a NEW file with the given content.
IMPORTANT: Only use this for files that do NOT exist yet.
For modifying existing files, use edit_file instead.
If the file already exists, this tool will fail.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Creating a new file for the authentication service"
- "Creating a new test config file since one doesn't exist"
- "Creating a new file to separate the API router"
- "Adding a new component file"`,
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

/**
 * Internal: Execute create_file
 */
async function _executeCreateFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const content = args['content'] as string;

  try {
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    const resolvedPath = path.resolve(cleanPath);
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

    // Check if file already exists
    try {
      await fs.access(resolvedPath);
      return {
        success: false,
        error: `File already exists: ${displayPath}. Use edit_file to modify existing files.`,
      };
    } catch {
      // File doesn't exist, which is what we want
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');

    const lines = content.split('\n').length;
    return {
      success: true,
      result: JSON.stringify({
        action: 'created',
        file: displayPath,
        lines: lines,
        message: `Created ${displayPath} (${lines} lines)`,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: false,
      error: `파일 생성 실패 (${displayPath}): ${err.message}`,
    };
  }
}

/**
 * create_file LLM Simple Tool
 */
export const createFileTool: LLMSimpleTool = {
  definition: CREATE_FILE_DEFINITION,
  execute: _executeCreateFile,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Create a new file',
};

/**
 * edit_file Tool Definition
 * Used for modifying EXISTING files only. Use create_file for new files.
 * Claude Code style: old_string/new_string based replacement
 */
const EDIT_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit an EXISTING file by replacing a specific text block.
IMPORTANT: Only use this for files that already exist. For new files, use create_file.

HOW TO USE:
1. First use read_file to see the current content
2. Copy the EXACT text block you want to change (can be multiple lines)
3. Provide old_string (text to find) and new_string (replacement)

RULES:
- old_string must match EXACTLY (including whitespace and indentation)
- old_string must be UNIQUE in the file (if it appears multiple times, use replace_all: true)
- Both old_string and new_string can be multi-line
- To delete text, use empty string "" for new_string

EXAMPLES:
1. Change a single line:
   old_string: "const x = 1;"
   new_string: "const x = 2;"

2. Change multiple lines at once:
   old_string: "function foo() {\\n  return 1;\\n}"
   new_string: "function foo() {\\n  return 2;\\n}"

3. Delete a line:
   old_string: "// delete this line\\n"
   new_string: ""

4. Replace all occurrences:
   old_string: "oldName"
   new_string: "newName"
   replace_all: true`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Fixing the buggy section"
- "Changing the function name as requested"
- "Adding the import statement"
- "Fixing the type error"`,
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the existing file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace (can be multi-line)',
        },
        new_string: {
          type: 'string',
          description: 'The new text to replace with (can be multi-line, use "" to delete)',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace ALL occurrences of old_string. Default is false (requires unique match).',
        },
      },
      required: ['reason', 'file_path', 'old_string', 'new_string'],
    },
  },
};

/**
 * Internal: Execute edit_file (Claude Code style - old_string/new_string)
 */
async function _executeEditFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const oldString = args['old_string'] as string;
  const newString = args['new_string'] as string;
  const replaceAll = args['replace_all'] as boolean | undefined;

  // Compute displayPath once at the top for use in both try and catch
  const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
  const displayPath = cleanPath;

  try {
    const resolvedPath = path.resolve(cleanPath);

    // Validate old_string is not empty
    if (!oldString) {
      return {
        success: false,
        error: 'old_string cannot be empty.',
      };
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return {
        success: false,
        error: `File does not exist: ${displayPath}. Use create_file to create new files.`,
      };
    }

    // Read current content
    const originalContent = await fs.readFile(resolvedPath, 'utf-8');

    // Check if old_string exists in the file
    if (!originalContent.includes(oldString)) {
      // Try to provide helpful context
      const lines = originalContent.split('\n');
      const preview = lines.slice(0, 20).map((l, i) => `${i + 1}: ${l}`).join('\n');
      return {
        success: false,
        error: `old_string not found in file.\n\nSearched for:\n"${oldString.slice(0, 200)}${oldString.length > 200 ? '...' : ''}"\n\nFile preview (first 20 lines):\n${preview}\n\n💡 Use read_file to check the exact content and try again.`,
      };
    }

    // Count occurrences
    const occurrences = originalContent.split(oldString).length - 1;

    // If not replace_all, old_string must be unique
    if (!replaceAll && occurrences > 1) {
      return {
        success: false,
        error: `old_string appears ${occurrences} times in the file. Either:\n1. Make old_string more specific (include more context)\n2. Use replace_all: true to replace all occurrences\n\n💡 Include surrounding lines to make the match unique.`,
      };
    }

    // Perform replacement
    let newContent: string;
    if (replaceAll) {
      newContent = originalContent.split(oldString).join(newString);
    } else {
      // Replace only first occurrence (which should be unique)
      newContent = originalContent.replace(oldString, newString);
    }

    // Write the modified content
    await fs.writeFile(resolvedPath, newContent, 'utf-8');

    // Calculate diff stats (split once, reuse)
    const oldLinesArr = oldString.split('\n');
    const newLinesArr = newString.split('\n');
    const replacements = replaceAll ? occurrences : 1;

    // Build simple diff preview
    const diffPreview: string[] = [];
    const oldPreview = oldLinesArr.slice(0, 5);
    const newPreview = newLinesArr.slice(0, 5);

    oldPreview.forEach(line => diffPreview.push(`- ${line}`));
    if (oldLinesArr.length > 5) diffPreview.push('- ...');
    newPreview.forEach(line => diffPreview.push(`+ ${line}`));
    if (newLinesArr.length > 5) diffPreview.push('+ ...');

    return {
      success: true,
      result: JSON.stringify({
        action: 'edited',
        file: displayPath,
        replacements: replacements,
        oldLines: oldLinesArr.length,
        newLines: newLinesArr.length,
        message: replaceAll
          ? `Replaced ${replacements} occurrence(s) in ${displayPath}`
          : `Updated ${displayPath}`,
        diff: diffPreview,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return {
      success: false,
      error: `File edit failed (${displayPath}): ${err.message}`,
    };
  }
}

/**
 * edit_file LLM Simple Tool
 */
export const editFileTool: LLMSimpleTool = {
  definition: EDIT_FILE_DEFINITION,
  execute: _executeEditFile,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Edit an existing file',
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
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Looking at the folder structure to understand the project"
- "Checking what files are available"
- "Seeing what's inside the src folder"
- "Checking the directory to find related files"`,
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

    // Skip hidden files/directories (starting with .)
    if (entry.name.startsWith('.')) {
      continue;
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
        error: `Directory not found: ${directoryPath}`,
      };
    } else {
      return {
        success: false,
        error: `Failed to read directory: ${err.message}`,
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
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "Looking for where the config files are located"
- "Searching for test files"
- "Checking where TypeScript files are"
- "Finding related component files"`,
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

    // Skip hidden files/directories (starting with .)
    if (entry.name.startsWith('.')) {
      continue;
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
        result: `No files found matching pattern "${pattern}".`,
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
      error: `File search failed: ${err.message}`,
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
 * File operation tools (read, create, edit, list, find)
 */
export const FILE_TOOLS: LLMSimpleTool[] = [
  readFileTool,
  createFileTool,
  editFileTool,
  listFilesTool,
  findFilesTool,
];

/**
 * System utility tools (bash)
 */
export const SYSTEM_TOOLS: LLMSimpleTool[] = [
  bashTool,
];

// Re-export user interaction tools
export {
  USER_INTERACTION_TOOLS,
  tellToUserTool,
  askToUserTool,
  setTellToUserCallback,
  setAskUserCallback,
  clearAskUserCallback,
  hasAskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
  type AskUserCallback,
} from './user-interaction-tools.js';

/**
 * @deprecated Use FILE_TOOLS, USER_INTERACTION_TOOLS, SYSTEM_TOOLS separately
 */
export { FILE_TOOLS as FILE_SIMPLE_TOOLS };

// Re-export from simple-tool-executor for backward compatibility
export {
  // Callback setters
  setToolExecutionCallback,
  setToolResponseCallback,
  setPlanCreatedCallback,
  setTodoStartCallback,
  setTodoCompleteCallback,
  setTodoFailCallback,
  setToolApprovalCallback,
  setCompactCallback,
  setAssistantResponseCallback,
  setReasoningCallback,
  // Callback getters & emitters
  getToolExecutionCallback,
  requestToolApproval,
  emitPlanCreated,
  emitTodoStart,
  emitTodoComplete,
  emitTodoFail,
  emitCompact,
  emitAssistantResponse,
  emitReasoning,
  // Tool executor
  executeSimpleTool,
  executeFileTool,
  // Types
  type ToolApprovalResult,
} from './simple-tool-executor.js';

