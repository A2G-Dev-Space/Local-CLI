/**
 * Orchestration Module Export
 *
 * Central export for plan execution functionality
 */

// Plan Executor
export { PlanExecutor, default } from './plan-executor';

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
