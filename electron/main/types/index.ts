/**
 * Types Index
 *
 * Central export for all Electron main process types
 */

// Core types
export type {
  Message,
  ToolCall,
  ToolDefinition,
  LLMResponse,
  LLMStreamChunk,
  ChatRequestOptions,
  StreamCallback,
  RetryConfig,
} from '../core/llm';

export type {
  AppConfig,
} from '../core/config';

export type {
  ChatMessage,
  Session,
  SessionSummary,
} from '../core/session';

export type {
  CompactResult,
  CompactContext,
  ContextUsage,
  RecentFile,
} from '../core/compact';

// Orchestration types
export type {
  TodoItem,
  ExecutorConfig,
  ExecutorCallbacks,
  ExecutionResult,
  ToolCallRecord,
  AskUserRequest,
  AskUserResponse,
  ExecutorState,
} from '../orchestration/types';

// Agent types
export type {
  PlanningResult,
} from '../agents/planner';

// Tool types
export type {
  ToolParameter,
  ToolResult,
  ToolContext,
  CoreToolGroupId,
  OptionalToolGroupId,
  ToolGroupId,
  ToolGroup,
  ToolRegistry as IToolRegistry,
} from '../tools/types';

// Error types
export type {
  ErrorDetails,
  ErrorOptions,
} from '../errors';
