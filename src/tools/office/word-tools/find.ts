/**
 * Word Find Tools
 *
 * Tools for finding text in documents:
 * - word_find: Find text and select it
 * - word_find_all: Find all occurrences of text
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { wordClient } from '../word-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Word Find
// =============================================================================

const WORD_FIND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_find',
    description: `Find text in the document and select the first occurrence.
Starts searching from the beginning of the document.
Returns the position (start, end) of the found text.
Use word_find_all to find all occurrences.`,
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
  try {
    const response = await wordClient.wordFind(args['text'] as string, {
      matchCase: args['match_case'] as boolean | undefined,
      matchWholeWord: args['match_whole_word'] as boolean | undefined,
    });
    if (response.success) {
      if (response['found']) {
        return {
          success: true,
          result: `Found: "${response['text']}" at position ${response['start']}-${response['end']}`,
        };
      } else {
        return { success: true, result: response['message'] || 'Text not found' };
      }
    }
    return { success: false, error: response.error || 'Failed to find text' };
  } catch (error) {
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
Returns the count and positions of all matches.
Useful before batch delete/replace operations.`,
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
  try {
    const response = await wordClient.wordFindAll(args['text'] as string, {
      matchCase: args['match_case'] as boolean | undefined,
      matchWholeWord: args['match_whole_word'] as boolean | undefined,
    });
    if (response.success) {
      const count = response['count'] as number || 0;
      const matches = response['matches'] as Array<{
        start: number;
        end: number;
        text: string;
      }> || [];

      if (count === 0) {
        return { success: true, result: `No matches found for "${args['text']}"` };
      }

      const list = matches.slice(0, 10).map((m, i) =>
        `  ${i + 1}. Position ${m.start}-${m.end}: "${m.text}"`
      ).join('\n');

      const more = count > 10 ? `\n  ... and ${count - 10} more` : '';

      return {
        success: true,
        result: `Found ${count} occurrence(s) of "${args['text']}":\n${list}${more}`,
      };
    }
    return { success: false, error: response.error || 'Failed to find text' };
  } catch (error) {
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
