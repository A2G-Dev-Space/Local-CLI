/**
 * Documentation Search Executor
 *
 * LLM-based decision for triggering documentation search.
 * Shows folder structure to LLM and asks Yes/No for search decision.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LLMClient } from '../../core/llm/llm-client.js';
import { Message } from '../../types/index.js';
import {
  executeDocsSearchAgent,
  initializeDocsDirectory,
  addDocumentationFile,
} from './index.js';
import {
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
} from '../../prompts/agents/docs-search-decision.js';
import { logger } from '../../utils/logger.js';

/**
 * Base path for documentation
 */
const DOCS_BASE_PATH = path.join(os.homedir(), '.local-cli', 'docs');

/**
 * Maximum retries for invalid Yes/No response
 */
const MAX_DECISION_RETRIES = 2;

/**
 * Get top-level folder structure of docs directory
 * Returns a formatted string showing folders and files
 */
async function getDocsFolderStructure(): Promise<string> {
  try {
    const entries = await fs.readdir(DOCS_BASE_PATH, { withFileTypes: true });

    const lines: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        lines.push(`[DIR]  ${entry.name}/`);

        // Also list immediate children of directories
        try {
          const subPath = path.join(DOCS_BASE_PATH, entry.name);
          const subEntries = await fs.readdir(subPath, { withFileTypes: true });

          for (const subEntry of subEntries.slice(0, 5)) {
            if (subEntry.isDirectory()) {
              lines.push(`       ├── ${subEntry.name}/`);
            } else {
              lines.push(`       ├── ${subEntry.name}`);
            }
          }

          if (subEntries.length > 5) {
            lines.push(`       └── ... (${subEntries.length - 5} more)`);
          }
        } catch {
          // Ignore errors reading subdirectories
        }
      } else if (entry.isFile()) {
        lines.push(`[FILE] ${entry.name}`);
      }
    }

    if (lines.length === 0) {
      return '(empty - no documentation available)';
    }

    return lines.join('\n');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return '(docs directory does not exist)';
    }
    return '(error reading docs directory)';
  }
}

/**
 * Ask LLM whether to search documentation
 * @returns true if should search, false if not
 */
async function shouldSearchDocs(
  llmClient: LLMClient,
  userMessage: string
): Promise<boolean> {
  logger.enter('shouldSearchDocs', { messageLength: userMessage.length });

  // Get folder structure
  const folderStructure = await getDocsFolderStructure();

  // If no docs available, skip search
  if (
    folderStructure.includes('empty') ||
    folderStructure.includes('does not exist')
  ) {
    logger.flow('No docs available, skipping search decision');
    logger.exit('shouldSearchDocs', { decision: false, reason: 'no-docs' });
    return false;
  }

  // Build prompt
  const prompt = buildDocsSearchDecisionPrompt(folderStructure, userMessage);

  const messages: Message[] = [
    { role: 'user', content: prompt },
  ];

  let retries = 0;

  while (retries <= MAX_DECISION_RETRIES) {
    logger.flow(`Asking LLM for docs search decision (attempt ${retries + 1})`);

    const response = await llmClient.chatCompletion({
      messages,
      temperature: 0.1, // Low temperature for consistent Yes/No
      max_tokens: 10, // Only need Yes or No
    });

    const content = response.choices[0]?.message?.content || '';
    logger.debug('LLM decision response', { content });

    const decision = parseDocsSearchDecision(content);

    if (decision !== null) {
      logger.exit('shouldSearchDocs', { decision, attempts: retries + 1 });
      return decision;
    }

    // Invalid response, retry
    retries++;
    if (retries <= MAX_DECISION_RETRIES) {
      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: DOCS_SEARCH_DECISION_RETRY_PROMPT });
      logger.warn('Invalid decision response, retrying', { response: content });
    }
  }

  // Default to false if all retries failed
  logger.warn('All decision retries failed, defaulting to no search');
  logger.exit('shouldSearchDocs', { decision: false, reason: 'retries-exhausted' });
  return false;
}

/**
 * Perform documentation search if LLM decides it's needed
 * @param llmClient LLM client instance
 * @param userMessage User's message
 * @param currentMessages Current conversation messages
 * @returns Updated messages and whether search was performed
 */
export async function performDocsSearchIfNeeded(
  llmClient: LLMClient,
  userMessage: string,
  currentMessages: Message[]
): Promise<{ messages: Message[]; performed: boolean }> {
  logger.enter('performDocsSearchIfNeeded', {
    messageLength: userMessage.length,
    currentMessageCount: currentMessages.length,
  });

  // Ask LLM if we should search docs
  const shouldSearch = await shouldSearchDocs(llmClient, userMessage);

  if (!shouldSearch) {
    logger.flow('LLM decided not to search docs');
    logger.exit('performDocsSearchIfNeeded', { performed: false });
    return { messages: currentMessages, performed: false };
  }

  logger.flow('LLM decided to search docs, executing search agent');
  logger.startTimer('docs-search-execution');

  const searchResult = await executeDocsSearchAgent(llmClient, userMessage);

  const elapsed = logger.endTimer('docs-search-execution');

  if (searchResult.success && searchResult.result) {
    logger.flow('Docs search completed successfully');
    logger.debug('DocsSearch result', {
      resultLength: searchResult.result.length,
      duration: `${elapsed}ms`,
    });

    // Add search result to messages
    const updatedMessages: Message[] = [
      ...currentMessages,
      {
        role: 'assistant' as const,
        content: `[Documentation Search Complete]\n${searchResult.result}`,
      },
    ];

    logger.exit('performDocsSearchIfNeeded', { performed: true });
    return { messages: updatedMessages, performed: true };
  } else {
    logger.warn('Docs search failed or returned no results', {
      error: searchResult.error,
    });
    logger.exit('performDocsSearchIfNeeded', { performed: false, error: searchResult.error });
    return { messages: currentMessages, performed: false };
  }
}

/**
 * Re-export initialization functions for convenience
 */
export { initializeDocsDirectory, addDocumentationFile };

export default performDocsSearchIfNeeded;
