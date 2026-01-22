/**
 * Compact Module
 *
 * Provides auto-compact functionality for managing context window usage.
 *
 * CLI parity: src/core/compact/index.ts
 */

// Context tracking
export {
  contextTracker,
  getContextTracker,
  resetContextTracker,
  type ContextUsageInfo,
  type RecentFile,
} from './context-tracker';

// Compact prompts and utilities
export {
  COMPACT_SYSTEM_PROMPT,
  buildCompactUserPrompt,
  buildCompactedMessages,
  type CompactContext,
} from './compact-prompts';

// Compact manager
export {
  CompactManager,
  type CompactResult,
} from './compact-manager';
