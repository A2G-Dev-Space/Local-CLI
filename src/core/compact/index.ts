/**
 * Compact Module
 *
 * Provides auto-compact functionality for managing context window usage.
 */

// Context tracking
export {
  contextTracker,
  type ContextUsageInfo,
} from './context-tracker.js';

// Compact prompts and utilities
export {
  COMPACT_SYSTEM_PROMPT,
  buildCompactUserPrompt,
  buildCompactedMessages,
  type CompactContext,
} from './compact-prompts.js';

// Compact manager
export {
  CompactManager,
  type CompactResult,
} from './compact-manager.js';
