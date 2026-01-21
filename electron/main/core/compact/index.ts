/**
 * Compact Module Export
 */

export {
  CompactManager,
  compactConversation,
  canCompact,
  default,
} from './compact-manager';

export type { CompactResult } from './compact-manager';

export {
  ContextTracker,
  getContextTracker,
  resetContextTracker,
} from './context-tracker';

export type { ContextUsage, RecentFile } from './context-tracker';

export {
  getCompactSystemPrompt,
  buildCompactUserPrompt,
  buildCompactedMessages,
} from './compact-prompts';

export type { CompactContext } from './compact-prompts';
