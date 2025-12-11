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
import { TODO_TOOLS } from './todo-tools.js';

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
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "현재 인증 로직이 어떻게 구현되어 있는지 확인해볼게요"
- "에러가 발생한 파일을 열어서 문제를 찾아볼게요"
- "프로젝트 설정을 파악하기 위해 package.json을 확인해볼게요"
- "수정하기 전에 기존 코드가 어떻게 되어있는지 먼저 볼게요"`,
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
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "인증 서비스를 담당할 새 파일을 만들게요"
- "테스트 설정 파일이 없어서 새로 생성할게요"
- "API 라우터를 분리하기 위해 새 파일을 만들게요"
- "컴포넌트를 새로 작성해서 추가할게요"`,
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
        error: `파일이 이미 존재합니다: ${displayPath}. 기존 파일을 수정하려면 edit_file을 사용하세요.`,
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
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "버그가 있는 부분을 수정할게요"
- "요청하신 대로 함수 이름을 변경할게요"
- "import 구문을 추가해서 의존성을 연결할게요"
- "타입 에러가 나는 부분을 고쳐볼게요"`,
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
        error: `파일이 존재하지 않습니다: ${displayPath}. 새 파일을 만들려면 create_file을 사용하세요.`,
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
          error: `줄 번호가 범위를 벗어났습니다: ${edit.line_number} (파일은 ${lines.length}줄)\n\n💡 read_file로 파일 내용을 확인한 후 다시 시도하세요.`,
        };
      }

      const currentLine = lines[lineIdx];
      if (currentLine !== edit.original_text) {
        return {
          success: false,
          error: `줄 ${edit.line_number}의 내용이 일치하지 않습니다.\n예상: "${edit.original_text}"\n실제: "${currentLine}"\n\n💡 read_file로 파일 내용을 확인한 후 다시 시도하세요.`,
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
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "프로젝트 구조를 파악하기 위해 폴더를 살펴볼게요"
- "어떤 파일들이 있는지 확인해볼게요"
- "src 폴더 안에 뭐가 있는지 볼게요"
- "관련 파일을 찾기 위해 디렉토리를 확인할게요"`,
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
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "설정 파일이 어디 있는지 찾아볼게요"
- "테스트 파일들을 검색해볼게요"
- "TypeScript 파일들이 어디에 있는지 확인할게요"
- "관련된 컴포넌트 파일을 찾아볼게요"`,
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
 * tell_to_user Tool Definition
 * Used for sending status messages to the user during task execution
 */
const TELL_TO_USER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'tell_to_user',
    description: `Send a message directly to the user to explain what you're doing or provide status updates.
Use this tool to communicate with the user during task execution.
The message will be displayed immediately in the UI.`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: `A natural, conversational message for the user (in user's language).
Examples:
- "파일들을 분석하고 있어요, 잠시만 기다려주세요"
- "설정 파일을 찾았어요! 이제 수정해볼게요"
- "테스트를 실행해봤는데 2개가 실패했네요. 원인을 찾아볼게요"
- "작업이 거의 끝나가요, 마무리 중이에요"`,
        },
      },
      required: ['message'],
    },
  },
};

/**
 * Callback for tell_to_user messages
 */
type TellToUserCallback = (message: string) => void;
let tellToUserCallback: TellToUserCallback | null = null;

/**
 * Set callback for tell_to_user messages
 */
export function setTellToUserCallback(callback: TellToUserCallback | null): void {
  tellToUserCallback = callback;
}

/**
 * Internal: Execute tell_to_user
 */
async function _executeTellToUser(args: Record<string, unknown>): Promise<ToolResult> {
  const message = args['message'] as string;

  // Call the callback to display message in UI
  if (tellToUserCallback) {
    tellToUserCallback(message);
  }

  return {
    success: true,
    result: `Message sent to user: ${message}`,
  };
}

/**
 * tell_to_user LLM Simple Tool
 */
export const tellToUserTool: LLMSimpleTool = {
  definition: TELL_TO_USER_DEFINITION,
  execute: _executeTellToUser,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Send message to user',
};

/**
 * All file tools
 */
export const FILE_SIMPLE_TOOLS: LLMSimpleTool[] = [
  readFileTool,
  createFileTool,
  editFileTool,
  listFilesTool,
  findFilesTool,
  tellToUserTool,
];

/**
 * All tools including TODO management
 */
export const ALL_SIMPLE_TOOLS: LLMSimpleTool[] = [
  ...FILE_SIMPLE_TOOLS,
  ...TODO_TOOLS,
];

/**
 * Tool definitions for LLM (includes file + TODO tools)
 */
export const FILE_TOOLS: ToolDefinition[] = ALL_SIMPLE_TOOLS.map((tool) => tool.definition);

/**
 * Callback for tool execution events (reason display to user)
 */
type ToolExecutionCallback = (toolName: string, reason: string, args: Record<string, unknown>) => void;
let toolExecutionCallback: ToolExecutionCallback | null = null;

/**
 * Callback for tool response events
 */
type ToolResponseCallback = (toolName: string, success: boolean, result: string) => void;
let toolResponseCallback: ToolResponseCallback | null = null;

/**
 * Callback for plan created events
 */
type PlanCreatedCallback = (todoTitles: string[]) => void;
let planCreatedCallback: PlanCreatedCallback | null = null;

/**
 * Callback for todo start events
 */
type TodoStartCallback = (title: string) => void;
let todoStartCallback: TodoStartCallback | null = null;

/**
 * Callback for todo complete events
 */
type TodoCompleteCallback = (title: string) => void;
let todoCompleteCallback: TodoCompleteCallback | null = null;

/**
 * Callback for todo fail events
 */
type TodoFailCallback = (title: string) => void;
let todoFailCallback: TodoFailCallback | null = null;

/**
 * Set callback for tool execution events
 */
export function setToolExecutionCallback(callback: ToolExecutionCallback | null): void {
  toolExecutionCallback = callback;
}

/**
 * Set callback for tool response events
 */
export function setToolResponseCallback(callback: ToolResponseCallback | null): void {
  toolResponseCallback = callback;
}

/**
 * Set callback for plan created events
 */
export function setPlanCreatedCallback(callback: PlanCreatedCallback | null): void {
  planCreatedCallback = callback;
}

/**
 * Set callback for todo start events
 */
export function setTodoStartCallback(callback: TodoStartCallback | null): void {
  todoStartCallback = callback;
}

/**
 * Set callback for todo complete events
 */
export function setTodoCompleteCallback(callback: TodoCompleteCallback | null): void {
  todoCompleteCallback = callback;
}

/**
 * Set callback for todo fail events
 */
export function setTodoFailCallback(callback: TodoFailCallback | null): void {
  todoFailCallback = callback;
}

/**
 * Get current tool execution callback
 */
export function getToolExecutionCallback(): ToolExecutionCallback | null {
  return toolExecutionCallback;
}

/**
 * Emit plan created event
 */
export function emitPlanCreated(todoTitles: string[]): void {
  if (planCreatedCallback) {
    planCreatedCallback(todoTitles);
  }
}

/**
 * Emit todo start event
 */
export function emitTodoStart(title: string): void {
  if (todoStartCallback) {
    todoStartCallback(title);
  }
}

/**
 * Emit todo complete event
 */
export function emitTodoComplete(title: string): void {
  if (todoCompleteCallback) {
    todoCompleteCallback(title);
  }
}

/**
 * Emit todo fail event
 */
export function emitTodoFail(title: string): void {
  if (todoFailCallback) {
    todoFailCallback(title);
  }
}

/**
 * Callback for compact events
 */
type CompactCallback = (originalCount: number, newCount: number) => void;
let compactCallback: CompactCallback | null = null;

/**
 * Set callback for compact events
 */
export function setCompactCallback(callback: CompactCallback | null): void {
  compactCallback = callback;
}

/**
 * Emit compact event
 */
export function emitCompact(originalCount: number, newCount: number): void {
  if (compactCallback) {
    compactCallback(originalCount, newCount);
  }
}

/**
 * Callback for assistant response events (final LLM response)
 */
type AssistantResponseCallback = (content: string) => void;
let assistantResponseCallback: AssistantResponseCallback | null = null;

/**
 * Set callback for assistant response events
 */
export function setAssistantResponseCallback(callback: AssistantResponseCallback | null): void {
  assistantResponseCallback = callback;
}

/**
 * Emit assistant response event
 */
export function emitAssistantResponse(content: string): void {
  if (assistantResponseCallback) {
    assistantResponseCallback(content);
  }
}

/**
 * Execute tool by name (includes file tools + TODO tools)
 */
export async function executeFileTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = ALL_SIMPLE_TOOLS.find((t) => t.definition.function.name === toolName);

  if (!tool) {
    return {
      success: false,
      error: `알 수 없는 도구: ${toolName}`,
    };
  }

  // Extract reason from args (not required for TODO tools)
  const reason = args['reason'] as string | undefined;

  // Call the callback to notify UI about tool execution (pass all args)
  // Skip for TODO tools which don't have reason parameter
  if (toolExecutionCallback && reason) {
    toolExecutionCallback(toolName, reason, args);
  }

  // Execute the tool
  const result = await tool.execute(args);

  // Call the response callback to notify UI about tool result (전체 내용 전달)
  // Skip response callback for TODO tools to avoid cluttering UI
  const isTodoTool = ['update_todos', 'get_todo_list'].includes(toolName);
  if (toolResponseCallback && !isTodoTool) {
    const resultText = result.success
      ? (result.result || '')
      : (result.error || 'Unknown error');
    toolResponseCallback(toolName, result.success, resultText);
  }

  return result;
}

