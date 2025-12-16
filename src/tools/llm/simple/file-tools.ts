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
 * Edit operation interface
 */
interface EditOperation {
  line_number: number;
  original_text: string;
  new_text: string;
}

/**
 * edit_file Tool Definition
 * Used for modifying EXISTING files only. Use create_file for new files.
 */
const EDIT_FILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit an EXISTING file by replacing specific lines.
IMPORTANT: Only use this for files that already exist. For new files, use create_file.

HOW TO USE:
1. First use read_file to see the current content and line numbers
2. Identify the exact lines you want to change
3. Provide edits as a list of operations

Each edit operation requires:
- line_number: The line number to edit (1-based)
- original_text: The EXACT current text on that line (must match exactly)
- new_text: The new text to replace it with (use empty string "" to delete the line)

EXAMPLES:
1. Change line 5 from "const x = 1;" to "const x = 2;":
   {"line_number": 5, "original_text": "const x = 1;", "new_text": "const x = 2;"}

2. Delete line 10:
   {"line_number": 10, "original_text": "// delete this", "new_text": ""}

3. Multiple edits (change lines 3 and 7):
   [
     {"line_number": 3, "original_text": "old text", "new_text": "new text"},
     {"line_number": 7, "original_text": "another old", "new_text": "another new"}
   ]

IMPORTANT:
- original_text must match EXACTLY (including whitespace)
- Line numbers are 1-based
- Process edits from highest line number to lowest to avoid line number shifts`,
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
- "Adding the import statement to connect the dependency"
- "Fixing the type error"`,
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the existing file to edit',
        },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              line_number: {
                type: 'number',
                description: 'Line number to edit (1-based)',
              },
              original_text: {
                type: 'string',
                description: 'Exact current text on that line (must match exactly)',
              },
              new_text: {
                type: 'string',
                description: 'New text to replace with (use empty string to delete)',
              },
            },
            required: ['line_number', 'original_text', 'new_text'],
          },
          description: 'List of edit operations to apply',
        },
      },
      required: ['reason', 'file_path', 'edits'],
    },
  },
};

/**
 * Internal: Execute edit_file
 */
async function _executeEditFile(args: Record<string, unknown>): Promise<ToolResult> {
  const filePath = args['file_path'] as string;
  const edits = args['edits'] as EditOperation[];

  try {
    const cleanPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    const resolvedPath = path.resolve(cleanPath);
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;

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
    const lines = originalContent.split('\n');

    // Validate and sort edits (process from highest line number to lowest)
    const sortedEdits = [...edits].sort((a, b) => b.line_number - a.line_number);

    // Track changes for diff output
    const changes: Array<{
      lineNumber: number;
      original: string;
      updated: string;
    }> = [];

    // Apply edits
    for (const edit of sortedEdits) {
      const lineIdx = edit.line_number - 1; // Convert to 0-based

      if (lineIdx < 0 || lineIdx >= lines.length) {
        return {
          success: false,
          error: `Line number out of range: ${edit.line_number} (file has ${lines.length} lines)\n\n💡 Use read_file to check file content and try again.`,
        };
      }

      const currentLine = lines[lineIdx];
      if (currentLine !== edit.original_text) {
        return {
          success: false,
          error: `Line ${edit.line_number} content does not match.\nExpected: "${edit.original_text}"\nActual: "${currentLine}"\n\n💡 Use read_file to check file content and try again.`,
        };
      }

      // Record the change
      changes.push({
        lineNumber: edit.line_number,
        original: edit.original_text,
        updated: edit.new_text,
      });

      // Apply the edit
      if (edit.new_text === '') {
        // Delete the line
        lines.splice(lineIdx, 1);
      } else {
        // Replace the line
        lines[lineIdx] = edit.new_text;
      }
    }

    // Write the modified content
    const newContent = lines.join('\n');
    await fs.writeFile(resolvedPath, newContent, 'utf-8');

    // Generate diff output
    const additions = changes.filter(c => c.updated !== '').length;
    const deletions = changes.filter(c => c.updated === '' || c.original !== '').length;

    // Sort changes by line number for display
    changes.sort((a, b) => a.lineNumber - b.lineNumber);

    // Build diff lines for display
    const diffLines: string[] = [];
    for (const change of changes) {
      // Show removed line
      if (change.original) {
        diffLines.push(`${change.lineNumber} - ${change.original}`);
      }
      // Show added line
      if (change.updated) {
        diffLines.push(`${change.lineNumber} + ${change.updated}`);
      }
    }

    return {
      success: true,
      result: JSON.stringify({
        action: 'edited',
        file: displayPath,
        additions: additions,
        deletions: deletions,
        message: `Updated ${displayPath} with ${additions} additions and ${deletions} removals`,
        diff: diffLines,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const displayPath = filePath.startsWith('@') ? filePath.slice(1) : filePath;
    return {
      success: false,
      error: `파일 편집 실패 (${displayPath}): ${err.message}`,
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

