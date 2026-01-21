/**
 * Compact Module Export
 * Re-exports from ROOT level for backwards compatibility
 */

// From ROOT compact-manager.ts
export {
  compactConversation,
  canCompact,
  getCompactSystemPrompt,
  buildCompactUserPrompt,
  buildCompactedMessages,
} from '../../compact-manager';

export type { CompactResult, CompactContext } from '../../compact-manager';

// From agent/context-tracker.ts (the updated version with CLI parity)
export {
  ContextTracker,
  getContextTracker,
  resetContextTracker,
} from '../../agent/context-tracker';

export type { ContextUsage, RecentFile } from '../../agent/context-tracker';

// NOTE: compact-prompts.ts is no longer needed - functions are now in compact-manager.ts
// NOTE: CompactManager class is not exported - use compactConversation() function instead
