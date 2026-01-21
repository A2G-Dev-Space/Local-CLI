/**
 * Tools Module Export
 *
 * Central export for all tools functionality
 */

// Types (local definitions)
export type {
  ToolParameter,
  ToolDefinition,
  ToolResult,
  ToolContext,
  CoreToolGroupId,
  OptionalToolGroupId,
  ToolGroupId,
  ToolGroup,
  ToolRegistry as IToolRegistry,
} from './types';

// Registry
export { toolRegistry } from './registry';
export type { OptionalToolGroup, EnableResult } from './registry';

// LLM Tools
export {
  FILE_TOOLS,
  setWorkingDirectory,
  getWorkingDirectory,
  POWERSHELL_TOOLS,
  TODO_TOOLS,
  setTodoWriteCallback,
  setGetTodosCallback,
  setFinalResponseCallback,
  clearFinalResponseCallbacks,
  USER_TOOLS,
  setTellToUserCallback,
  setAskUserCallback,
  DOCS_TOOLS,
} from './llm';

// Browser Tools
export { BROWSER_TOOLS } from './browser';

// Office Tools
export { WORD_TOOLS } from './office/word';
export { EXCEL_TOOLS } from './office/excel';
export { POWERPOINT_TOOLS } from './office/powerpoint';
