/**
 * Word Footnotes & Endnotes Tools
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Add Footnote
// =============================================================================

const WORD_ADD_FOOTNOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_footnote',
    description: `Add a footnote at the current cursor position.
Footnotes appear at the bottom of the page.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a footnote' },
        text: { type: 'string', description: 'Footnote text' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddFootnote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_footnote', args);
  try {
    const response = await wordClient.wordAddFootnote(args['text'] as string);
    if (response.success) {
      logger.toolSuccess('word_add_footnote', args, { index: response['index'] }, Date.now() - startTime);
      return { success: true, result: `Footnote ${response['index']} added` };
    }
    logger.toolError('word_add_footnote', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add footnote' };
  } catch (error) {
    logger.toolError('word_add_footnote', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add footnote: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddFootnoteTool: LLMSimpleTool = {
  definition: WORD_ADD_FOOTNOTE_DEFINITION,
  execute: executeWordAddFootnote,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word footnote',
};

// =============================================================================
// Word Add Endnote
// =============================================================================

const WORD_ADD_ENDNOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_endnote',
    description: `Add an endnote at the current cursor position.
Endnotes appear at the end of the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an endnote' },
        text: { type: 'string', description: 'Endnote text' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddEndnote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_endnote', args);
  try {
    const response = await wordClient.wordAddEndnote(args['text'] as string);
    if (response.success) {
      logger.toolSuccess('word_add_endnote', args, { index: response['index'] }, Date.now() - startTime);
      return { success: true, result: `Endnote ${response['index']} added` };
    }
    logger.toolError('word_add_endnote', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add endnote' };
  } catch (error) {
    logger.toolError('word_add_endnote', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add endnote: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddEndnoteTool: LLMSimpleTool = {
  definition: WORD_ADD_ENDNOTE_DEFINITION,
  execute: executeWordAddEndnote,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word endnote',
};

// =============================================================================
// Word Get Footnotes
// =============================================================================

const WORD_GET_FOOTNOTES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_footnotes',
    description: `Get all footnotes in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need footnotes' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetFootnotes(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_footnotes', _args);
  try {
    const response = await wordClient.wordGetFootnotes();
    if (response.success) {
      const footnotes = response['footnotes'] as Array<{ index: number; text: string; reference_text: string }> || [];
      const count = response['count'] as number || 0;
      logger.toolSuccess('word_get_footnotes', _args, { count }, Date.now() - startTime);

      if (count === 0) return { success: true, result: 'No footnotes found' };

      const list = footnotes.map(fn => `[${fn.index}] "${fn.text}"`).join('\n');
      return { success: true, result: `${count} footnote(s):\n${list}` };
    }
    logger.toolError('word_get_footnotes', _args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get footnotes' };
  } catch (error) {
    logger.toolError('word_get_footnotes', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get footnotes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetFootnotesTool: LLMSimpleTool = {
  definition: WORD_GET_FOOTNOTES_DEFINITION,
  execute: executeWordGetFootnotes,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word footnotes',
};

// =============================================================================
// Word Get Endnotes
// =============================================================================

const WORD_GET_ENDNOTES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_endnotes',
    description: `Get all endnotes in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need endnotes' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetEndnotes(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_endnotes', _args);
  try {
    const response = await wordClient.wordGetEndnotes();
    if (response.success) {
      const endnotes = response['endnotes'] as Array<{ index: number; text: string; reference_text: string }> || [];
      const count = response['count'] as number || 0;
      logger.toolSuccess('word_get_endnotes', _args, { count }, Date.now() - startTime);

      if (count === 0) return { success: true, result: 'No endnotes found' };

      const list = endnotes.map(en => `[${en.index}] "${en.text}"`).join('\n');
      return { success: true, result: `${count} endnote(s):\n${list}` };
    }
    logger.toolError('word_get_endnotes', _args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get endnotes' };
  } catch (error) {
    logger.toolError('word_get_endnotes', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get endnotes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetEndnotesTool: LLMSimpleTool = {
  definition: WORD_GET_ENDNOTES_DEFINITION,
  execute: executeWordGetEndnotes,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word endnotes',
};

// =============================================================================
// Word Delete Footnote
// =============================================================================

const WORD_DELETE_FOOTNOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_footnote',
    description: `Delete a footnote by index.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this footnote' },
        index: { type: 'number', description: 'Footnote index (1-based)' },
      },
      required: ['reason', 'index'],
    },
  },
};

async function executeWordDeleteFootnote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_footnote', args);
  try {
    const response = await wordClient.wordDeleteFootnote(args['index'] as number);
    if (response.success) {
      logger.toolSuccess('word_delete_footnote', args, { deleted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'Footnote deleted' };
    }
    logger.toolError('word_delete_footnote', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete footnote' };
  } catch (error) {
    logger.toolError('word_delete_footnote', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete footnote: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteFootnoteTool: LLMSimpleTool = {
  definition: WORD_DELETE_FOOTNOTE_DEFINITION,
  execute: executeWordDeleteFootnote,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word footnote',
};

// =============================================================================
// Word Delete Endnote
// =============================================================================

const WORD_DELETE_ENDNOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_endnote',
    description: `Delete an endnote by index.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this endnote' },
        index: { type: 'number', description: 'Endnote index (1-based)' },
      },
      required: ['reason', 'index'],
    },
  },
};

async function executeWordDeleteEndnote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_endnote', args);
  try {
    const response = await wordClient.wordDeleteEndnote(args['index'] as number);
    if (response.success) {
      logger.toolSuccess('word_delete_endnote', args, { deleted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'Endnote deleted' };
    }
    logger.toolError('word_delete_endnote', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete endnote' };
  } catch (error) {
    logger.toolError('word_delete_endnote', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete endnote: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteEndnoteTool: LLMSimpleTool = {
  definition: WORD_DELETE_ENDNOTE_DEFINITION,
  execute: executeWordDeleteEndnote,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word endnote',
};

// =============================================================================
// Export All Footnotes/Endnotes Tools
// =============================================================================

export const footnotesTools: LLMSimpleTool[] = [
  wordAddFootnoteTool,
  wordAddEndnoteTool,
  wordGetFootnotesTool,
  wordGetEndnotesTool,
  wordDeleteFootnoteTool,
  wordDeleteEndnoteTool,
];
