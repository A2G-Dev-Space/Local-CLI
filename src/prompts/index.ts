/**
 * Prompts Index
 *
 * Central export for all system prompts and shared rules.
 */

// Shared rules
export { LANGUAGE_PRIORITY_RULE, LANGUAGE_PRIORITY_SHORT } from './shared/language-rules.js';
export {
  AVAILABLE_TOOLS,
  AVAILABLE_TOOLS_WITH_TODO,
  TOOL_REASON_GUIDE,
  FILE_MODIFICATION_RULES,
} from './shared/tool-usage.js';
export { CODEBASE_FIRST_RULE, CODEBASE_FIRST_SHORT } from './shared/codebase-rules.js';

// System prompts
export { PLAN_EXECUTE_SYSTEM_PROMPT } from './system/plan-execute.js';
export { COMPACT_SYSTEM_PROMPT } from './system/compact.js';

// Agent prompts
export { PLANNING_SYSTEM_PROMPT } from './agents/planning.js';
// CLASSIFIER_SYSTEM_PROMPT removed - classification no longer used
export { DOCS_SEARCH_SYSTEM_PROMPT, buildDocsSearchUserMessage } from './agents/docs-search.js';
export {
  DOCS_SEARCH_DECISION_PROMPT,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
} from './agents/docs-search-decision.js';
