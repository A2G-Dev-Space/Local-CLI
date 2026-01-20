/**
 * Electron Agent Tools - Main Barrel Export
 *
 * Central export for all tool modules (CLI style)
 *
 * Total: 214 tools
 *
 * Core Tools (always available): 14
 * - File: 6 tools (read, create, edit, list, find, search)
 * - PowerShell: 4 tools (powershell, background_start, background_read, background_stop)
 * - Todo: 1 tool (write_todos)
 * - User: 2 tools (tell_to_user, ask_to_user)
 * - Docs: 1 tool (call_docs_search_agent)
 *
 * Optional Tools (enabled via toolRegistry.enableToolGroup()):
 * - Browser: 18 tools
 * - Word: 52 tools
 * - Excel: 62 tools
 * - PowerPoint: 68 tools
 */

// =============================================================================
// Type Exports
// =============================================================================

export * from './common';

// =============================================================================
// Tool Registry (Main Entry Point)
// =============================================================================

export {
  toolRegistry,
  initializeToolRegistry,
  setWorkingDirectory,
  getWorkingDirectory,
  // Callback setters
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
  // Types
  type TodoItem,
  type TodoWriteCallback,
  type TellToUserCallback,
  type AskUserCallback,
  type AskUserRequest,
  type AskUserResponse,
  type EnableResult,
  type OptionalToolGroup,
} from './registry';

// =============================================================================
// Core Tool Exports (for direct access if needed)
// =============================================================================

// File Tools
export { FILE_TOOLS, readFileTool, createFileTool, editFileTool, listFilesTool, findFilesTool, searchContentTool } from './file';

// PowerShell Tools
export { POWERSHELL_TOOLS, powershellTool, powershellBackgroundStartTool, powershellBackgroundReadTool, powershellBackgroundStopTool } from './powershell';

// Todo Tools
export { TODO_TOOLS, writeTodosTool } from './todo';

// User Tools
export { USER_TOOLS, tellToUserTool, askToUserTool } from './user';

// Docs Tools
export { DOCS_TOOLS, docsSearchTool } from './docs';

// =============================================================================
// Optional Tool Exports (for direct access if needed)
// =============================================================================

// Browser Tools (18)
export { BROWSER_TOOLS } from './browser';

// Word Tools (52)
export { WORD_TOOLS } from './word';

// Excel Tools (62)
export { EXCEL_TOOLS } from './excel';

// PowerPoint Tools (68)
export { POWERPOINT_TOOLS } from './powerpoint';

// =============================================================================
// Combined Tool Arrays
// =============================================================================

import { FILE_TOOLS } from './file';
import { POWERSHELL_TOOLS } from './powershell';
import { TODO_TOOLS } from './todo';
import { USER_TOOLS } from './user';
import { DOCS_TOOLS } from './docs';
import { BROWSER_TOOLS } from './browser';
import { WORD_TOOLS } from './word';
import { EXCEL_TOOLS } from './excel';
import { POWERPOINT_TOOLS } from './powerpoint';
import type { LLMSimpleTool } from './common';

/**
 * All Core Tools (always available)
 * Total: 14 tools
 */
export const CORE_TOOLS: LLMSimpleTool[] = [
  ...FILE_TOOLS,       // 6
  ...POWERSHELL_TOOLS, // 4
  ...TODO_TOOLS,       // 1
  ...USER_TOOLS,       // 2
  ...DOCS_TOOLS,       // 1
];

/**
 * All Optional Tools (Office + Browser)
 * Total: 200 tools
 */
export const OPTIONAL_TOOLS: LLMSimpleTool[] = [
  ...BROWSER_TOOLS,    // 18
  ...WORD_TOOLS,       // 52
  ...EXCEL_TOOLS,      // 62
  ...POWERPOINT_TOOLS, // 68
];

/**
 * All Tools Combined
 * Total: 214 tools
 */
export const ALL_TOOLS: LLMSimpleTool[] = [
  ...CORE_TOOLS,
  ...OPTIONAL_TOOLS,
];

/**
 * Tool counts for debugging/logging
 */
export const TOOL_COUNTS = {
  // Core
  file: FILE_TOOLS.length,
  powershell: POWERSHELL_TOOLS.length,
  todo: TODO_TOOLS.length,
  user: USER_TOOLS.length,
  docs: DOCS_TOOLS.length,
  coreTotal: CORE_TOOLS.length,
  // Optional
  browser: BROWSER_TOOLS.length,
  word: WORD_TOOLS.length,
  excel: EXCEL_TOOLS.length,
  powerpoint: POWERPOINT_TOOLS.length,
  optionalTotal: OPTIONAL_TOOLS.length,
  // Grand Total
  total: ALL_TOOLS.length,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get tool by name from ALL_TOOLS
 */
export function getTool(name: string): LLMSimpleTool | undefined {
  return ALL_TOOLS.find((tool) => tool.definition.function.name === name);
}

/**
 * Get all tool definitions for LLM
 */
export function getAllToolDefinitions() {
  return ALL_TOOLS.map((tool) => tool.definition);
}
