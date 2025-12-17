/**
 * Docs Search Agent Tool
 *
 * LLM이 tool_call로 documentation search agent를 호출할 수 있는 도구
 * DocsSearchAgent를 실행하고 결과를 반환
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { executeDocsSearchAgent } from '../../../agents/docs-search/index.js';
import { logger } from '../../../utils/logger.js';

/**
 * LLM Client getter (set from plan-executor to avoid circular dependency)
 */
let llmClientGetter: (() => import('../../../core/llm/llm-client.js').LLMClient | null) | null = null;

/**
 * Set the LLM client getter function
 */
export function setDocsSearchLLMClientGetter(
  getter: () => import('../../../core/llm/llm-client.js').LLMClient | null
): void {
  llmClientGetter = getter;
}

/**
 * Clear the LLM client getter
 */
export function clearDocsSearchLLMClientGetter(): void {
  llmClientGetter = null;
}

/**
 * Tool Definition
 */
const DOCS_SEARCH_AGENT_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'call_docs_search_agent',
    description: `Search local documentation in ~/.local-cli/docs directory.

Use this tool when:
- You need to find information in local documentation
- The task requires consulting project-specific docs
- User asks about topics that might be covered in local docs

The agent will:
1. Navigate the docs directory structure
2. Read relevant documentation files
3. Return a summary with findings and sources

Note: Only call this tool once per conversation - the results will be available for subsequent tasks.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're searching for.
Examples:
- "Searching local docs for API authentication examples"
- "Looking up configuration options in project documentation"
- "Finding relevant code patterns from local references"`,
        },
        query: {
          type: 'string',
          description: 'The search query describing what information you need from the documentation',
        },
      },
      required: ['reason', 'query'],
    },
  },
};

/**
 * Docs Search Agent Tool
 */
export const docsSearchAgentTool: LLMSimpleTool = {
  definition: DOCS_SEARCH_AGENT_TOOL_DEFINITION,
  categories: ['llm-simple'] as ToolCategory[],

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args['query'] as string;
    const reason = args['reason'] as string;

    logger.enter('docsSearchAgentTool.execute', { query, reason });

    // Validate query
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        error: 'query is required and must be a string',
      };
    }

    // Get LLM client
    if (!llmClientGetter) {
      logger.error('LLM client getter not set for docs search agent tool');
      return {
        success: false,
        error: 'Documentation search is not available (internal configuration error)',
      };
    }

    const llmClient = llmClientGetter();
    if (!llmClient) {
      logger.error('LLM client is null');
      return {
        success: false,
        error: 'Documentation search is not available (LLM client not initialized)',
      };
    }

    try {
      logger.flow('Executing docs search agent', { query });

      const result = await executeDocsSearchAgent(llmClient, query);

      if (result.success && result.result) {
        logger.exit('docsSearchAgentTool.execute', { success: true, resultLength: result.result.length });

        return {
          success: true,
          result: result.result,
        };
      } else {
        logger.warn('Docs search agent returned no results', { error: result.error });

        return {
          success: false,
          error: result.error || 'No documentation found for the given query',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('docsSearchAgentTool.execute failed', error as Error);

      return {
        success: false,
        error: `Documentation search failed: ${errorMessage}`,
      };
    }
  },
};

export default docsSearchAgentTool;
