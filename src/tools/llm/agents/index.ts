/**
 * LLM Agent Tools Index
 *
 * LLM이 tool_call로 호출하는 도구들 (Sub-LLM 사용)
 */

import { LLMAgentTool } from '../../types.js';

// Docs Search Agent Tools
export {
  DOCS_SEARCH_TOOLS,
  LIST_DIRECTORY_TOOL,
  READ_DOCS_FILE_TOOL,
  PREVIEW_FILE_TOOL,
  TELL_TO_USER_TOOL,
  SUBMIT_FINDINGS_TOOL,
  createDocsToolExecutor,
  type DocsToolExecutor,
} from './docs-search-tools.js';

// Placeholder for future LLM agent tool implementations
export const LLM_AGENT_TOOLS: LLMAgentTool[] = [];
