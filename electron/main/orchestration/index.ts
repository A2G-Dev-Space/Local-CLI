/**
 * Orchestration Module Export
 *
 * Central export for plan execution functionality
 */

// IPC Agent (Electron-specific wrapper for ipc-handlers)
export {
  runAgent,
  runAgentStream,
  simpleChat,
  abortAgent,
  isAgentRunning,
  getCurrentTodos,
  setCurrentTodos,
  setAgentMainWindow,
  handleToolApprovalResponse,
  clearAlwaysApprovedTools,
  type AgentConfig,
  type AgentCallbacks,
  type AgentResult,
} from './ipc-agent';

// Types
export type {
  TodoItem,
  ExecutorConfig,
  ExecutorCallbacks,
  ExecutionResult,
  ToolCallRecord,
  AskUserRequest,
  AskUserResponse,
  ExecutorState,
} from './types';

// Utilities
export {
  validateToolMessages,
  truncateMessages,
  estimateTokenCount,
  buildTodoContext,
  areTodosComplete,
  getNextPendingTodo,
  markTodoInProgress,
  markTodoCompleted,
  markTodoFailed,
  parseToolArguments,
} from './utils';
