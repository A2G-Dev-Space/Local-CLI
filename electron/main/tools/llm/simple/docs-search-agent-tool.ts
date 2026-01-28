/**
 * Docs Search Agent Tool
 *
 * LLM이 tool_call로 documentation search agent를 호출할 수 있는 도구
 * CLI parity: src/tools/llm/simple/docs-search-agent-tool.ts
 *
 * DocsSearchAgent를 실행하고 결과를 반환
 */

import type { ToolDefinition } from '../../../core';
import type { LLMSimpleTool, ToolResult, ToolCategory } from '../../types';
import { logger } from '../../../utils/logger';

// Import will be connected when agents/docs-search is created in Phase 3
// import { executeDocsSearchAgent } from '../../../agents/docs-search';

/**
 * LLM Client type (to avoid circular dependency)
 */
type LLMClientType = import('../../../core').LLMClient;

/**
 * LLM Client getter (set from agent to avoid circular dependency)
 */
let llmClientGetter: (() => LLMClientType | null) | null = null;

/**
 * Set the LLM client getter function
 */
export function setDocsSearchLLMClientGetter(
  getter: () => LLMClientType | null
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
    description: `Search local documentation in ~/.hanseol/docs directory.

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
 * Execute docs search agent (placeholder until agents/docs-search is created)
 * This will be replaced with actual Sub-LLM based search in Phase 3
 */
async function executeDocsSearchAgent(
  _llmClient: LLMClientType,
  query: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  // Temporary: Use simple keyword search until agents/docs-search is implemented
  // This will be replaced with DocsSearchAgent.execute() in Phase 3

  const fs = await import('fs/promises');
  const fsSync = await import('fs');
  const path = await import('path');
  const { getDocsPath } = await import('../../../core/docs-manager');

  const docsPath = getDocsPath();

  if (!fsSync.existsSync(docsPath)) {
    return {
      success: false,
      error: 'Documentation not installed. Use the docs download feature in settings.',
    };
  }

  try {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const results: Array<{ file: string; title: string; excerpt: string; score: number }> = [];

    async function searchDir(dirPath: string, depth: number = 0): Promise<void> {
      if (depth > 5 || results.length >= 10) return;

      let entries;
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= 10) break;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await searchDir(fullPath, depth + 1);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lowerContent = content.toLowerCase();

            let score = 0;
            for (const keyword of keywords) {
              const matches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
              score += matches;
              if (entry.name.toLowerCase().includes(keyword)) {
                score += 5;
              }
            }

            if (score > 0) {
              const titleMatch = content.match(/^#\s+(.+)$/m);
              const title = titleMatch ? titleMatch[1] : entry.name.replace('.md', '');

              let excerpt = '';
              for (const keyword of keywords) {
                const idx = lowerContent.indexOf(keyword);
                if (idx !== -1) {
                  const start = Math.max(0, idx - 100);
                  const end = Math.min(content.length, idx + 200);
                  excerpt = content.substring(start, end).replace(/\n/g, ' ').trim();
                  if (start > 0) excerpt = '...' + excerpt;
                  if (end < content.length) excerpt = excerpt + '...';
                  break;
                }
              }

              results.push({
                file: fullPath,
                title,
                excerpt: excerpt || content.substring(0, 200) + '...',
                score,
              });
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    }

    await searchDir(docsPath);

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 5);

    if (topResults.length === 0) {
      return {
        success: true,
        result: `No documentation found for query: "${query}"`,
      };
    }

    // Format results
    const formattedParts: string[] = [];
    formattedParts.push(`## Summary\nFound ${topResults.length} relevant document(s) for "${query}"`);
    formattedParts.push('\n## Findings');

    for (const r of topResults) {
      formattedParts.push(`\n### ${r.title}`);
      formattedParts.push(`File: ${r.file}`);
      formattedParts.push(`\n${r.excerpt}`);
    }

    formattedParts.push('\n## Sources');
    topResults.forEach(r => formattedParts.push(`- ${r.file}`));

    return {
      success: true,
      result: formattedParts.join('\n'),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Docs search failed: ${errorMessage}` };
  }
}

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

    // Get LLM client (for future Sub-LLM based search)
    if (!llmClientGetter) {
      logger.warn('LLM client getter not set, using simple search');
    }

    const llmClient = llmClientGetter?.();

    try {
      logger.flow('Executing docs search agent', { query });

      // Use LLM client if available, otherwise use simple search
      const result = await executeDocsSearchAgent(llmClient as LLMClientType, query);

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
