/**
 * Documentation Search System Agent Tool
 *
 * System이 조건에 따라 자동 호출하는 도구
 * Sub-LLM을 사용하여 ~/.local-cli/docs에서 문서를 검색
 *
 * Category: System Agent Tool
 */

import { LLMClient } from '../../../core/llm/llm-client.js';
import { SystemAgentTool, SystemContext, ToolResult, ToolCategory } from '../../types.js';
import { executeDocsSearchAgent, initializeDocsDirectory, addDocumentationFile } from '../../../core/knowledge/docs-search-agent.js';

/**
 * Keywords that trigger documentation search
 */
const DOCS_TRIGGER_KEYWORDS = [
  // English
  'docs', 'documentation', 'manual', 'reference', 'guide', 'tutorial',
  'how to', 'how do i', 'what is', 'explain', 'help with',
  // Korean
  '문서', '매뉴얼', '가이드', '튜토리얼', '설명', '도움말', '어떻게',
  // Framework-specific
  'agno', 'langchain', 'llamaindex', 'crewai', 'autogen',
];

/**
 * Check if message contains documentation-related keywords
 */
function shouldTriggerDocsSearch(context: SystemContext): boolean {
  const lowerMessage = context.userMessage.toLowerCase();

  // Check for explicit documentation request keywords
  for (const keyword of DOCS_TRIGGER_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Execute documentation search with LLM client
 */
async function executeDocsSearch(
  context: SystemContext,
  llmClient: LLMClient
): Promise<ToolResult> {
  try {
    const result = await executeDocsSearchAgent(llmClient, context.userMessage);

    if (result.success) {
      return {
        success: true,
        result: result.result,
        metadata: {
          toolName: 'docs-search',
          query: context.userMessage,
        },
      };
    } else {
      return {
        success: false,
        error: result.error || 'Documentation search failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in docs search',
    };
  }
}

/**
 * Documentation Search System Agent Tool
 */
export const docsSearchTool: SystemAgentTool = {
  name: 'docs-search',
  execute: executeDocsSearch,
  triggerCondition: shouldTriggerDocsSearch,
  categories: ['system-agent'] as ToolCategory[],
  requiresSubLLM: true,
  description: 'Search local documentation using Sub-LLM with bash tools',
};

/**
 * Re-export initialization functions for convenience
 */
export {
  initializeDocsDirectory,
  addDocumentationFile,
};

/**
 * All System Agent Tools (docs-related)
 */
export const DOCS_SYSTEM_AGENT_TOOLS: SystemAgentTool[] = [docsSearchTool];
