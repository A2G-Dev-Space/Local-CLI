/**
 * Core Module Export
 *
 * Central export for all core functionality:
 * - LLM Client with retry logic
 * - Config Manager
 * - Session Manager
 * - Compact Manager with Context Tracker
 *
 * NOTE: All modules re-export from ROOT level files for consistency
 */

// LLM
export {
  llmClient,
} from './llm';

export type {
  Message,
  ToolCall,
  ToolDefinition,
  LLMResponse,
  LLMStreamChunk,
  ChatRequestOptions,
  StreamCallback,
  RetryConfig,
} from './llm';

// Config
export {
  configManager,
} from './config';

export type {
  AppConfig,
} from './config';

// Session
export {
  sessionManager,
} from './session';

export type {
  ChatMessage,
  Session,
  SessionSummary,
  SessionLogEntry,
  SessionTodoItem,
} from './session';

// Compact
export {
  compactConversation,
  canCompact,
  ContextTracker,
  getContextTracker,
  resetContextTracker,
  getCompactSystemPrompt,
  buildCompactUserPrompt,
  buildCompactedMessages,
} from './compact';

export type {
  CompactResult,
  CompactContext,
  ContextUsage,
  RecentFile,
} from './compact';
