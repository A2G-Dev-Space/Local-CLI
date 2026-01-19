/**
 * Word Navigation Tools
 *
 * Navigation-related tools for Microsoft Word:
 * - word_goto: Navigate to page, line, or bookmark
 * - word_get_document_info: Get document statistics
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { wordClient } from '../word-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Word Goto
// =============================================================================

const WORD_GOTO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto',
    description: `Navigate to a specific page, line, or bookmark.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating' },
        what: { type: 'string', enum: ['page', 'line', 'bookmark'], description: 'Navigation target type' },
        target: { type: 'string', description: 'Page/line number or bookmark name' },
      },
      required: ['reason', 'what', 'target'],
    },
  },
};

async function executeWordGoto(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const target = args['what'] === 'bookmark' ? args['target'] as string : parseInt(args['target'] as string);
    const response = await wordClient.wordGoto(
      args['what'] as 'page' | 'line' | 'bookmark',
      target
    );
    if (response.success) {
      return { success: true, result: `Navigated to ${args['what']} ${args['target']}` };
    }
    return { success: false, error: response.error || 'Failed to navigate' };
  } catch (error) {
    return { success: false, error: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGotoTool: LLMSimpleTool = {
  definition: WORD_GOTO_DEFINITION,
  execute: executeWordGoto,
  categories: OFFICE_CATEGORIES,
  description: 'Navigate in Word',
};

// =============================================================================
// Word Get Document Info
// =============================================================================

const WORD_GET_DOCUMENT_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_document_info',
    description: `Get document statistics (pages, words, characters, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need document info' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetDocumentInfo(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetDocumentInfo();
    if (response.success) {
      return {
        success: true,
        result: `Document: ${response['name']}
Pages: ${response['pages']}
Words: ${response['words']}
Characters: ${response['characters']}
Characters (with spaces): ${response['characters_with_spaces']}
Paragraphs: ${response['paragraphs']}
Lines: ${response['lines']}
Saved: ${response['saved'] ? 'Yes' : 'No'}
Read-only: ${response['read_only'] ? 'Yes' : 'No'}`,
      };
    }
    return { success: false, error: response.error || 'Failed to get document info' };
  } catch (error) {
    return { success: false, error: `Failed to get document info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetDocumentInfoTool: LLMSimpleTool = {
  definition: WORD_GET_DOCUMENT_INFO_DEFINITION,
  execute: executeWordGetDocumentInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word document info',
};

// =============================================================================
// Export Navigation Tools
// =============================================================================

export const navigationTools: LLMSimpleTool[] = [
  wordGotoTool,
  wordGetDocumentInfoTool,
];
