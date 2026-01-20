/**
 * Agent Module Index
 * Exports all agent-related functionality
 */

// Tool definitions
export {
  getAllTools,
  getToolByName,
  getToolNames,
  getToolSummary,
  getToolsWithOptional,
  getToolSummaryWithOptional,
  FILE_TOOLS,
  SHELL_TOOLS,
  BACKGROUND_SHELL_TOOLS,
  TODO_TOOLS,
  DOCS_TOOLS,
  USER_TOOLS,
  OPTIONAL_TOOLS,
  BROWSER_TOOLS,
  WORD_TOOLS,
  EXCEL_TOOLS,
  POWERPOINT_TOOLS,
  type OptionalToolGroupId,
} from './tool-definitions';

// Browser Client
export { browserClient } from './browser-client';

// Office Client
export {
  wordClient,
  excelClient,
  powerPointClient,
} from './office-client';

// Tool executor
export {
  executeTool,
  parseToolArguments,
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
  setToolExecutionCallback,
  setWorkingDirectory,
  getWorkingDirectory,
  type ToolResult,
  type TodoItem,
  type AskUserRequest,
  type AskUserResponse,
  type TodoWriteCallback,
  type TellToUserCallback,
  type AskUserCallback,
  type ToolExecutionCallback,
} from './tool-executor';

// System prompt
export {
  buildPlanExecutePrompt,
  buildSimpleChatPrompt,
  buildTodoContext,
  LANGUAGE_PRIORITY_RULE,
  TOOL_REASON_GUIDE,
  CODEBASE_FIRST_RULE,
  WINDOWS_POWERSHELL_RULES,
} from './system-prompt';

// Agent
export {
  runAgent,
  runAgentStream,
  simpleChat,
  abortAgent,
  isAgentRunning,
  getCurrentTodos,
  setCurrentTodos,
  setAgentMainWindow,
  type AgentConfig,
  type AgentCallbacks,
  type AgentResult,
} from './agent';

// Planning LLM
export {
  PlanningLLM,
  type PlanningResult,
  type PlanningWithDocsResult,
} from './planning-llm';

// Context Tracker
export {
  ContextTracker,
  getContextTracker,
  resetContextTracker,
  type ContextUsage,
  type RecentFile,
} from './context-tracker';

// Docs Manager
export {
  getDocsInfo,
  getAvailableSources,
  downloadDocsFromSource,
  getDocsPath,
  hasDocsAvailable,
  AVAILABLE_SOURCES,
  type DocsSource,
  type DocsInfo,
  type DownloadResult,
  type ProgressCallback,
} from './docs-manager';

// Message Utilities
export {
  validateToolMessages,
  normalizeMessages,
  checkMessageValidity,
  prepareMessagesForStorage,
  getMessageStats,
  truncateMessages,
} from './message-utils';
