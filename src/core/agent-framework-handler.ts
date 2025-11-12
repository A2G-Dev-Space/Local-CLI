/**
 * Agent Framework Handler
 * 
 * Handles framework-specific functionality:
 * - Framework keyword detection (ADK, AGNO)
 * - Documentation search trigger logic
 * - Integration with docs search agent
 */

import { LLMClient } from './llm-client.js';
import { Message } from '../types/index.js';
import { executeDocsSearchAgent } from './docs-search-agent.js';
import { logger } from '../utils/logger.js';

/**
 * Framework detection result
 */
export interface FrameworkDetection {
  framework: 'adk' | 'agno' | null;
  category: string | null;
  basePath: string;
}

/**
 * AGNO category configuration
 */
interface AgnoCategoryConfig {
  category: string;
  keywords: string[];
}

/**
 * AGNO category mappings
 */
const AGNO_CATEGORIES: AgnoCategoryConfig[] = [
  {
    category: 'agent',
    keywords: ['agent', '에이전트'],
  },
  {
    category: 'models',
    keywords: ['model', 'llm', '모델', 'gemini', 'openai', 'litellm'],
  },
  {
    category: 'rag',
    keywords: ['rag', 'retrieval', '검색'],
  },
  {
    category: 'workflows',
    keywords: ['workflow', '워크플로우'],
  },
  {
    category: 'teams',
    keywords: ['team', '팀'],
  },
  {
    category: 'memory',
    keywords: ['memory', '메모리'],
  },
  {
    category: 'database',
    keywords: ['database', 'db', '데이터베이스'],
  },
];

/**
 * Framework path constants
 */
export const FRAMEWORK_PATHS = {
  adk: 'agent_framework/adk',
  agno: 'agent_framework/agno',
} as const;

/**
 * Get all framework paths for documentation
 * @returns Array of framework path descriptions
 */
export function getFrameworkPathsForDocs(): Array<{ name: string; path: string }> {
  return [
    { name: 'ADK Agent', path: `${FRAMEWORK_PATHS.adk}/` },
    { name: 'AGNO Agent', path: `${FRAMEWORK_PATHS.agno}/agent/` },
    { name: 'AGNO Models', path: `${FRAMEWORK_PATHS.agno}/models/` },
    { name: 'AGNO RAG', path: `${FRAMEWORK_PATHS.agno}/rag/` },
    { name: 'AGNO Workflows', path: `${FRAMEWORK_PATHS.agno}/workflows/` },
    { name: 'AGNO Teams', path: `${FRAMEWORK_PATHS.agno}/teams/` },
    { name: 'AGNO Memory', path: `${FRAMEWORK_PATHS.agno}/memory/` },
    { name: 'AGNO Database', path: `${FRAMEWORK_PATHS.agno}/database/` },
  ];
}


/**
 * Build AGNO framework path
 */
function buildAgnoPath(category: string | null): string {
  if (!category) {
    return FRAMEWORK_PATHS.agno;
  }
  return `${FRAMEWORK_PATHS.agno}/${category}`;
}

/**
 * Detect AGNO category from query
 */
function detectAgnoCategory(query: string): AgnoCategoryConfig | null {
  for (const config of AGNO_CATEGORIES) {
    if (config.keywords.some(keyword => query.includes(keyword))) {
      return config;
    }
  }
  return null;
}

/**
 * Detect framework keywords and return relevant directory path
 * Supports both Korean and English keywords
 * @param query User query string
 * @returns Framework detection result with path
 */
export function detectFrameworkPath(query: string): FrameworkDetection {
  const lowerQuery = query.toLowerCase();

  // ADK detection
  if (lowerQuery.includes('adk')) {
    return {
      framework: 'adk',
      category: null,
      basePath: FRAMEWORK_PATHS.adk,
    };
  }

  // AGNO detection
  if (lowerQuery.includes('agno')) {
    const categoryConfig = detectAgnoCategory(lowerQuery);

    if (categoryConfig) {
      return {
        framework: 'agno',
        category: categoryConfig.category,
        basePath: buildAgnoPath(categoryConfig.category),
      };
    }

    // Default to general agno
    return {
      framework: 'agno',
      category: null,
      basePath: FRAMEWORK_PATHS.agno,
    };
  }

  return {
    framework: null,
    category: null,
    basePath: '',
  };
}

/**
 * Check if query contains agent framework keywords
 * Uses detectFrameworkPath internally for consistency
 * @param query User query string
 * @returns true if framework keywords (adk, agno) are detected
 */
export function shouldPerformDocsSearch(query: string): boolean {
  const detection = detectFrameworkPath(query);
  return detection.framework !== null;
}

/**
 * Perform documentation search if framework keywords are detected
 * @param llmClient LLM client instance
 * @param query User query string
 * @param currentMessages Current message array
 * @returns Updated messages and whether docs search was performed
 */
export async function performDocsSearchIfNeeded(
  llmClient: LLMClient,
  query: string,
  currentMessages: Message[]
): Promise<{ messages: Message[]; performed: boolean }> {
  logger.enter('performDocsSearchIfNeeded', { queryLength: query.length, messageCount: currentMessages.length });

  // Check if docs search is needed
  logger.flow('Checking if docs search is needed');
  const shouldSearch = shouldPerformDocsSearch(query);

  logger.vars(
    { name: 'shouldSearch', value: shouldSearch },
    { name: 'query', value: query.substring(0, 50) + '...' }
  );

  if (!shouldSearch) {
    logger.flow('Docs search not needed - skipping');
    logger.exit('performDocsSearchIfNeeded', { performed: false });
    return { messages: currentMessages, performed: false };
  }

  logger.flow('Docs search triggered - detecting framework');
  const detection = detectFrameworkPath(query);

  logger.vars(
    { name: 'framework', value: detection.framework },
    { name: 'category', value: detection.category },
    { name: 'basePath', value: detection.basePath },
  );

  logger.info('📚 DocsSearch triggered', {
    query: query.substring(0, 100),
    framework: detection.framework,
    category: detection.category
  });
  console.log(`📚 Searching documentation for: ${query.substring(0, 50)}...`);

  logger.flow('Executing docs search agent');
  logger.startTimer('docs-search');

  const searchResult = await executeDocsSearchAgent(llmClient, query);

  const elapsed = logger.endTimer('docs-search');

  if (searchResult.success && searchResult.result) {
    logger.flow('Docs search completed successfully');

    logger.vars(
      { name: 'resultLength', value: searchResult.result.length },
      { name: 'elapsed', value: elapsed }
    );

    logger.debug('DocsSearch completed successfully', {
      resultLength: searchResult.result.length,
      duration: `${elapsed}ms`,
      context: 'agent-framework-handler'
    });

    // Add docs search result to messages
    logger.flow('Adding docs search result to messages');
    const updatedMessages = [
      ...currentMessages,
      {
        role: 'assistant' as const,
        content: `[Documentation Search Complete]\n${searchResult.result}`,
      },
    ];

    logger.exit('performDocsSearchIfNeeded', { performed: true, addedMessages: 1 });
    return { messages: updatedMessages, performed: true };
  } else {
    logger.flow('Docs search failed or returned no results');

    logger.warn('DocsSearch failed or returned no results', {
      error: searchResult.error,
      context: 'agent-framework-handler'
    });

    logger.exit('performDocsSearchIfNeeded', { performed: false, error: searchResult.error });
    return { messages: currentMessages, performed: false };
  }
}

