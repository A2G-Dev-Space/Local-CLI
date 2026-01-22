/**
 * Core Module Export
 *
 * Central export for all core functionality.
 * CLI parity: src/core/ (structure matches)
 */

// LLM
export {
  llmClient,
  LLMClient,
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
  ColorPalette,
  FontSize,
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
  contextTracker,
  getContextTracker,
  resetContextTracker,
  COMPACT_SYSTEM_PROMPT,
  buildCompactUserPrompt,
  buildCompactedMessages,
  CompactManager,
} from './compact';

export type {
  CompactResult,
  CompactContext,
  ContextUsageInfo,
  RecentFile,
} from './compact';

// Docs Manager (CLI parity)
export * from './docs-manager';

// Usage Tracker (CLI parity)
export * from './usage-tracker';
