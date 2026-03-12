/**
 * Word Selection & Cursor Tools
 *
 * Tools for text selection and cursor movement:
 * - word_delete_text: Delete text by position range
 * - word_get_selection: Get current selection info
 * - word_select_range: Select text by position
 * - word_move_cursor: Move cursor by unit
 * - word_move_cursor_to: Move cursor to start/end
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Delete Text
// =============================================================================

const WORD_DELETE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_text',
    description: `Delete text from the document by specifying start and end positions.
Position is a character index starting from 0.
Use word_get_selection or word_find_all to get positions.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this text' },
        start: { type: 'number', description: 'Start position (0-based character index)' },
        end: { type: 'number', description: 'End position (0-based character index)' },
      },
      required: ['reason', 'start', 'end'],
    },
  },
};

async function executeWordDeleteText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_text', args);
  try {
    const response = await wordClient.wordDeleteText(
      args['start'] as number,
      args['end'] as number
    );
    if (response.success) {
      logger.toolSuccess('word_delete_text', args, { deleted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'Text deleted' };
    }
    logger.toolError('word_delete_text', args, new Error(response.error || 'Failed to delete text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete text' };
  } catch (error) {
    logger.toolError('word_delete_text', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteTextTool: LLMSimpleTool = {
  definition: WORD_DELETE_TEXT_DEFINITION,
  execute: executeWordDeleteText,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word text by position',
};

// =============================================================================
// Word Get Selection
// =============================================================================

const WORD_GET_SELECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_selection',
    description: `Get detailed information about the current selection.
Returns: text, start position, end position, font name, font size.
Useful before delete/format operations.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need selection info' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetSelection(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_selection', _args);
  try {
    const response = await wordClient.wordGetSelection();
    if (response.success) {
      logger.toolSuccess('word_get_selection', _args, { hasSelection: !!response['text'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Selection Info:
- Text: "${response['text'] || '(none)'}"
- Start: ${response['start']}
- End: ${response['end']}
- Font: ${response['font_name']} ${response['font_size']}pt`,
      };
    }
    logger.toolError('word_get_selection', _args, new Error(response.error || 'Failed to get selection'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get selection' };
  } catch (error) {
    logger.toolError('word_get_selection', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get selection: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetSelectionTool: LLMSimpleTool = {
  definition: WORD_GET_SELECTION_DEFINITION,
  execute: executeWordGetSelection,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word selection info',
};

// =============================================================================
// Word Select Range
// =============================================================================

const WORD_SELECT_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_select_range',
    description: `Select a range of text by specifying start and end positions.
Position is a character index starting from 0.
After selecting, you can apply formatting or delete.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting this range' },
        start: { type: 'number', description: 'Start position (0-based character index)' },
        end: { type: 'number', description: 'End position (0-based character index)' },
      },
      required: ['reason', 'start', 'end'],
    },
  },
};

async function executeWordSelectRange(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_select_range', args);
  try {
    const response = await wordClient.wordSelectRange(
      args['start'] as number,
      args['end'] as number
    );
    if (response.success) {
      logger.toolSuccess('word_select_range', args, { selected: true }, Date.now() - startTime);
      return { success: true, result: `Selected: "${response['text'] || ''}"` };
    }
    logger.toolError('word_select_range', args, new Error(response.error || 'Failed to select range'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to select range' };
  } catch (error) {
    logger.toolError('word_select_range', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to select range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSelectRangeTool: LLMSimpleTool = {
  definition: WORD_SELECT_RANGE_DEFINITION,
  execute: executeWordSelectRange,
  categories: OFFICE_CATEGORIES,
  description: 'Select Word text range',
};

// =============================================================================
// Word Move Cursor
// =============================================================================

const WORD_MOVE_CURSOR_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_move_cursor',
    description: `Move the cursor by a specified unit and count.
Positive count = move right/forward, negative count = move left/backward.
Set extend=true to extend selection while moving (like Shift+Arrow).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving the cursor' },
        unit: { type: 'string', enum: ['character', 'word', 'line', 'paragraph'], description: 'Unit of movement' },
        count: { type: 'number', description: 'Number of units to move (positive=right, negative=left)' },
        extend: { type: 'boolean', description: 'Extend selection while moving (default: false)' },
      },
      required: ['reason', 'unit', 'count'],
    },
  },
};

async function executeWordMoveCursor(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_move_cursor', args);
  try {
    const response = await wordClient.wordMoveCursor(
      args['unit'] as 'character' | 'word' | 'line' | 'paragraph',
      args['count'] as number,
      args['extend'] as boolean | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_move_cursor', args, { position: response['position'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Cursor moved' };
    }
    logger.toolError('word_move_cursor', args, new Error(response.error || 'Failed to move cursor'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to move cursor' };
  } catch (error) {
    logger.toolError('word_move_cursor', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to move cursor: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordMoveCursorTool: LLMSimpleTool = {
  definition: WORD_MOVE_CURSOR_DEFINITION,
  execute: executeWordMoveCursor,
  categories: OFFICE_CATEGORIES,
  description: 'Move Word cursor',
};

// =============================================================================
// Word Move Cursor To
// =============================================================================

const WORD_MOVE_CURSOR_TO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_move_cursor_to',
    description: `Move the cursor to the start or end of the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving the cursor' },
        position: { type: 'string', enum: ['start', 'end'], description: 'Where to move the cursor' },
      },
      required: ['reason', 'position'],
    },
  },
};

async function executeWordMoveCursorTo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_move_cursor_to', args);
  try {
    const response = await wordClient.wordMoveCursorTo(args['position'] as 'start' | 'end');
    if (response.success) {
      logger.toolSuccess('word_move_cursor_to', args, { position: response['position'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Cursor moved' };
    }
    logger.toolError('word_move_cursor_to', args, new Error(response.error || 'Failed to move cursor'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to move cursor' };
  } catch (error) {
    logger.toolError('word_move_cursor_to', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to move cursor: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordMoveCursorToTool: LLMSimpleTool = {
  definition: WORD_MOVE_CURSOR_TO_DEFINITION,
  execute: executeWordMoveCursorTo,
  categories: OFFICE_CATEGORIES,
  description: 'Move Word cursor to start/end',
};

// =============================================================================
// Export All Selection Tools
// =============================================================================

export const selectionTools: LLMSimpleTool[] = [
  wordDeleteTextTool,
  wordGetSelectionTool,
  wordSelectRangeTool,
  wordMoveCursorTool,
  wordMoveCursorToTool,
];
