/**
 * LLM Agent Tools Index
 *
 * LLM이 tool_call로 호출하는 도구들 (Sub-LLM 사용)
 * CLI parity: src/tools/llm/agents/index.ts
 */

import type { LLMAgentTool } from '../../types';

// Docs Search Agent Tools (used by DocsSearchAgent sub-LLM)
export {
  DOCS_SEARCH_TOOLS,
  LIST_DIRECTORY_TOOL,
  READ_DOCS_FILE_TOOL,
  PREVIEW_FILE_TOOL,
  TELL_TO_USER_TOOL,
  SUBMIT_FINDINGS_TOOL,
  createDocsToolExecutor,
  setTellToUserCallback,
} from './docs-search-tools';

export type { DocsToolExecutor } from './docs-search-tools';

/**
 * Placeholder for future LLM agent tool implementations
 * These are tools that require a Sub-LLM to execute
 */
export const LLM_AGENT_TOOLS: LLMAgentTool[] = [];
