/**
 * Docs Search Agent for Electron
 * Searches local documentation using LLM
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { logger } from '../../logger';
import {
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
} from '../../prompts/agents/docs-search-decision';

// =============================================================================
// Types
// =============================================================================

export interface DocsSearchResult {
  success: boolean;
  results?: Array<{
    path: string;
    content: string;
    relevance: number;
  }>;
  error?: string;
}

// =============================================================================
// Docs Search Decision
// =============================================================================

/**
 * Check if docs search is needed for the request
 */
export async function shouldSearchDocs(
  userMessage: string,
  folderStructure: string,
  llmClient: {
    sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string>;
  }
): Promise<boolean> {
  logger.enter('shouldSearchDocs', { messageLength: userMessage.length });

  // Simple keyword-based check first
  const docKeywords = [
    'documentation', 'docs', 'api', 'reference', 'guide', 'tutorial',
    'how to', 'example', 'usage', 'adk', 'agno', 'framework',
  ];

  const lowerMessage = userMessage.toLowerCase();
  const hasDocKeyword = docKeywords.some((kw) => lowerMessage.includes(kw));

  // Also check for framework-specific keywords
  const frameworkKeywords = ['agent', 'tool', 'memory', 'session', 'knowledge', 'rag'];
  const hasFrameworkKeyword = frameworkKeywords.some((kw) => lowerMessage.includes(kw));

  // If no relevant keywords, skip docs search
  if (!hasDocKeyword && !hasFrameworkKeyword) {
    logger.exit('shouldSearchDocs', { decision: false, reason: 'no-keywords' });
    return false;
  }

  // For more complex cases, ask LLM
  try {
    const prompt = buildDocsSearchDecisionPrompt(folderStructure, userMessage);

    const response = await llmClient.sendMessage(prompt);

    const decision = parseDocsSearchDecision(response);

    if (decision === null) {
      // Invalid response, default to false
      logger.warn('Invalid docs search decision response', { response });
      return false;
    }

    logger.exit('shouldSearchDocs', { decision });
    return decision;
  } catch (error) {
    logger.warn('Failed to determine docs search decision, defaulting to false', error as Error);
    return false;
  }
}

/**
 * Create a docs search decision function with bound LLM client
 */
export function createDocsSearchDecider(
  llmClient: {
    sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string>;
  },
  folderStructure: string
): (userMessage: string) => Promise<boolean> {
  return (userMessage: string) => shouldSearchDocs(userMessage, folderStructure, llmClient);
}

// =============================================================================
// Export
// =============================================================================

export default {
  shouldSearchDocs,
  createDocsSearchDecider,
};
