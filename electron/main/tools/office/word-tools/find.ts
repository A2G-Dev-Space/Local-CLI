/**
 * Word Find Tools
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Find
// =============================================================================

const WORD_FIND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_find',
    description: `Find text in the document and select the first occurrence.
Returns the position (start, end) of the found text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are finding this text' },
        text: { type: 'string', description: 'Text to find' },
        match_case: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
        match_whole_word: { type: 'boolean', description: 'Match whole words only (default: false)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordFind(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_find', args);
  try {
    const response = await wordClient.wordFind(args['text'] as string, {
      matchCase: args['match_case'] as boolean | undefined,
      matchWholeWord: args['match_whole_word'] as boolean | undefined,
    });
    if (response.success) {
      logger.toolSuccess('word_find', args, { found: response['found'] }, Date.now() - startTime);
      if (response['found']) {
        return { success: true, result: `Found: "${response['text']}" at position ${response['start']}-${response['end']}` };
      } else {
        return { success: true, result: response['message'] || 'Text not found' };
      }
    }
    logger.toolError('word_find', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to find text' };
  } catch (error) {
    logger.toolError('word_find', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to find text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordFindTool: LLMSimpleTool = {
  definition: WORD_FIND_DEFINITION,
  execute: executeWordFind,
  categories: OFFICE_CATEGORIES,
  description: 'Find text in Word',
};

// =============================================================================
// Word Find All
// =============================================================================

const WORD_FIND_ALL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_find_all',
    description: `Find all occurrences of text in the document.
Returns the count and positions of all matches.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are finding all occurrences' },
        text: { type: 'string', description: 'Text to find' },
        match_case: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
        match_whole_word: { type: 'boolean', description: 'Match whole words only (default: false)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordFindAll(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_find_all', args);
  try {
    const response = await wordClient.wordFindAll(args['text'] as string, {
      matchCase: args['match_case'] as boolean | undefined,
      matchWholeWord: args['match_whole_word'] as boolean | undefined,
    });
    if (response.success) {
      const count = response['count'] as number || 0;
      const matches = response['matches'] as Array<{ start: number; end: number; text: string }> || [];
      logger.toolSuccess('word_find_all', args, { count }, Date.now() - startTime);

      if (count === 0) {
        return { success: true, result: `No matches found for "${args['text']}"` };
      }

      const list = matches.slice(0, 10).map((m, i) => `  ${i + 1}. Position ${m.start}-${m.end}: "${m.text}"`).join('\n');
      const more = count > 10 ? `\n  ... and ${count - 10} more` : '';

      return { success: true, result: `Found ${count} occurrence(s) of "${args['text']}":\n${list}${more}` };
    }
    logger.toolError('word_find_all', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to find text' };
  } catch (error) {
    logger.toolError('word_find_all', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to find text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordFindAllTool: LLMSimpleTool = {
  definition: WORD_FIND_ALL_DEFINITION,
  execute: executeWordFindAll,
  categories: OFFICE_CATEGORIES,
  description: 'Find all text in Word',
};

// =============================================================================
// Export All Find Tools
// =============================================================================

export const findTools: LLMSimpleTool[] = [
  wordFindTool,
  wordFindAllTool,
];
