/**
 * Prompts Index
 *
 * Central export for all system prompts and shared rules.
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

// Shared rules
export { LANGUAGE_PRIORITY_RULE, LANGUAGE_PRIORITY_SHORT } from './shared/language-rules';
export {
  AVAILABLE_TOOLS,
  AVAILABLE_TOOLS_WITH_TODO,
  TOOL_REASON_GUIDE,
  FILE_MODIFICATION_RULES,
} from './shared/tool-usage';
export { CODEBASE_FIRST_RULE, CODEBASE_FIRST_SHORT } from './shared/codebase-rules';
export { WINDOWS_POWERSHELL_RULES } from './shared/windows-rules';
export { GIT_COMMIT_RULES } from './shared/git-rules';

// System prompts
export { buildPlanExecutePrompt, buildSimpleChatPrompt } from './system/plan-execute';
export { COMPACT_SYSTEM_PROMPT } from './system/compact';

// Agent prompts
export { PLANNING_SYSTEM_PROMPT, buildPlanningSystemPrompt } from './agents/planning';
export {
  DOCS_SEARCH_DECISION_PROMPT,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
} from './agents/docs-search-decision';

// TODO context builder (for backwards compatibility)
export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Build TODO context string to inject into user message
 */
export function buildTodoContext(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return '';
  }

  const todoLines = todos.map((t) => {
    const statusEmoji =
      t.status === 'completed' ? '✅' :
      t.status === 'in_progress' ? '🔄' :
      t.status === 'failed' ? '❌' : '⬜';
    return `${statusEmoji} [${t.id}] ${t.title} (${t.status})`;
  });

  return `

---
## Current TODO List
${todoLines.join('\n')}
---
`;
}
