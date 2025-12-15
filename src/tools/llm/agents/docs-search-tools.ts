/**
 * Documentation Search Agent Tools
 *
 * Tools specifically designed for the docs search agent.
 * These are LLM-callable tools used by the sub-LLM during documentation search.
 *
 * Category: LLM Agent Tools (used by sub-LLM)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition } from '../../../types/index.js';

// Reuse tell_to_user callback from file-tools
// This will be set by PlanExecuteApp and shared across all tools
export { setTellToUserCallback } from '../simple/file-tools.js';

/**
 * Base path for documentation
 */
const DOCS_BASE_PATH = path.join(os.homedir(), '.local-cli', 'docs');

/**
 * list_directory Tool Definition
 * Lists contents of a directory in the docs folder
 */
export const LIST_DIRECTORY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_directory',
    description: `List contents of a directory in ~/.local-cli/docs.
Returns folder names (directories) and file names with their types.
Use this to navigate the hierarchical documentation structure.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A brief explanation of why you're listing this directory.
Examples:
- "Looking for agent framework documentation"
- "Exploring available tutorials"
- "Finding API reference files"`,
        },
        path: {
          type: 'string',
          description: 'Relative path from ~/.local-cli/docs. Use "" or "/" for root.',
        },
      },
      required: ['reason', 'path'],
    },
  },
};

/**
 * read_docs_file Tool Definition
 * Reads entire content of a documentation file (scoped to docs directory)
 */
export const READ_DOCS_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_docs_file',
    description: `Read the entire contents of a documentation file.
Use this after identifying relevant files via list_directory.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A brief explanation of why you're reading this file.
Examples:
- "Reading the main overview to understand the framework"
- "Getting details about configuration options"
- "Checking example code for this feature"`,
        },
        path: {
          type: 'string',
          description: 'Relative path to the file from ~/.local-cli/docs',
        },
      },
      required: ['reason', 'path'],
    },
  },
};

/**
 * preview_file Tool Definition
 * Reads first N lines of a file to check relevance
 */
export const PREVIEW_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'preview_file',
    description: `Read the first N lines of a file to quickly check if it's relevant.
Use this before reading the entire file to save time on large documents.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A brief explanation of why you're previewing this file.
Examples:
- "Checking if this file covers the topic I need"
- "Previewing to see the document structure"
- "Quick look to verify this is the right file"`,
        },
        path: {
          type: 'string',
          description: 'Relative path to the file from ~/.local-cli/docs',
        },
        lines: {
          type: 'number',
          description: 'Number of lines to preview (default: 30, max: 100)',
        },
      },
      required: ['reason', 'path'],
    },
  },
};

/**
 * tell_to_user Tool Definition
 * Sends intermediate progress message to the user
 */
export const TELL_TO_USER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'tell_to_user',
    description: `Send a progress update to the user during the search.
Use this to inform the user about what you're doing or what you've found so far.
Keep messages concise and informative.`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Progress message to show the user',
        },
      },
      required: ['message'],
    },
  },
};

/**
 * submit_findings Tool Definition
 * Terminates the search and returns the final report
 */
export const SUBMIT_FINDINGS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'submit_findings',
    description: `Submit your final findings and terminate the search.
Call this when you have gathered enough information to answer the user's question.
This is the ONLY way to complete the search - you must call this when done.`,
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'A concise summary of what was found (1-3 sentences)',
        },
        findings: {
          type: 'string',
          description: 'Detailed findings formatted in markdown. Include relevant code snippets, explanations, and citations.',
        },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file paths that were referenced',
        },
      },
      required: ['summary', 'findings', 'sources'],
    },
  },
};

/**
 * All docs search tools
 */
export const DOCS_SEARCH_TOOLS: ToolDefinition[] = [
  LIST_DIRECTORY_TOOL,
  READ_DOCS_FILE_TOOL,
  PREVIEW_FILE_TOOL,
  TELL_TO_USER_TOOL,
  SUBMIT_FINDINGS_TOOL,
];

/**
 * Tool executor type
 */
export type DocsToolExecutor = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<{ success: boolean; result?: string; error?: string; terminate?: boolean }>;

/**
 * Create tool executor for docs search agent
 * @param onTellUser Callback for tell_to_user messages (uses existing file-tools callback)
 * @param onComplete Callback for submit_findings
 */
export function createDocsToolExecutor(
  onTellUser?: (message: string) => void,
  onComplete?: (summary: string, findings: string, sources: string[]) => void
): DocsToolExecutor {
  return async (toolName: string, args: Record<string, unknown>) => {
    switch (toolName) {
      case 'list_directory':
        return executeListDirectory(args);

      case 'read_docs_file':
        return executeReadDocsFile(args);

      case 'preview_file':
        return executePreviewFile(args);

      case 'tell_to_user': {
        const message = args['message'] as string;
        onTellUser?.(message);
        return { success: true, result: 'Message sent to user' };
      }

      case 'submit_findings': {
        const summary = args['summary'] as string;
        const findings = args['findings'] as string;
        const sources = (args['sources'] as string[]) || [];
        onComplete?.(summary, findings, sources);
        return {
          success: true,
          result: 'Findings submitted',
          terminate: true,
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  };
}

/**
 * Execute list_directory tool
 */
async function executeListDirectory(
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const relativePath = (args['path'] as string) || '';
    const targetPath = path.join(DOCS_BASE_PATH, relativePath);

    // Security check: ensure path is within docs directory
    const resolvedPath = path.resolve(targetPath);
    if (!resolvedPath.startsWith(DOCS_BASE_PATH)) {
      return { success: false, error: 'Access denied: path outside docs directory' };
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    const result: string[] = [];
    const dirs: string[] = [];
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(`[DIR]  ${entry.name}/`);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        files.push(`[FILE] ${entry.name}${ext === '.md' ? ' (markdown)' : ''}`);
      }
    }

    // Sort and combine: directories first, then files
    dirs.sort();
    files.sort();
    result.push(...dirs, ...files);

    if (result.length === 0) {
      return { success: true, result: '(empty directory)' };
    }

    return { success: true, result: result.join('\n') };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: false, error: 'Directory not found' };
    }
    return { success: false, error: `Failed to list directory: ${err.message}` };
  }
}

/**
 * Execute read_docs_file tool
 */
async function executeReadDocsFile(
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const relativePath = args['path'] as string;
    const targetPath = path.join(DOCS_BASE_PATH, relativePath);

    // Security check
    const resolvedPath = path.resolve(targetPath);
    if (!resolvedPath.startsWith(DOCS_BASE_PATH)) {
      return { success: false, error: 'Access denied: path outside docs directory' };
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');

    // Limit content size to prevent token overflow
    const MAX_CONTENT_LENGTH = 30000;
    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        success: true,
        result: content.slice(0, MAX_CONTENT_LENGTH) +
          `\n\n... [TRUNCATED: File is ${content.length} characters, showing first ${MAX_CONTENT_LENGTH}]`,
      };
    }

    return { success: true, result: content };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: false, error: 'File not found' };
    }
    return { success: false, error: `Failed to read file: ${err.message}` };
  }
}

/**
 * Execute preview_file tool
 */
async function executePreviewFile(
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const relativePath = args['path'] as string;
    let lines = (args['lines'] as number) || 30;
    lines = Math.min(Math.max(lines, 1), 100); // Clamp between 1 and 100

    const targetPath = path.join(DOCS_BASE_PATH, relativePath);

    // Security check
    const resolvedPath = path.resolve(targetPath);
    if (!resolvedPath.startsWith(DOCS_BASE_PATH)) {
      return { success: false, error: 'Access denied: path outside docs directory' };
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');
    const allLines = content.split('\n');
    const previewLines = allLines.slice(0, lines);

    let result = previewLines.join('\n');
    if (allLines.length > lines) {
      result += `\n\n... [PREVIEW: Showing ${lines} of ${allLines.length} lines]`;
    }

    return { success: true, result };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { success: false, error: 'File not found' };
    }
    return { success: false, error: `Failed to preview file: ${err.message}` };
  }
}

export default DOCS_SEARCH_TOOLS;
