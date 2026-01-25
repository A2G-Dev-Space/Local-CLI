/**
 * Word Undo/Redo Tools
 *
 * Tools for undoing and redoing actions in Word documents
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Undo
// =============================================================================

const WORD_UNDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_undo',
    description: `Undo the last action(s).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are undoing' },
        times: { type: 'number', description: 'Number of times to undo (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordUndo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_undo', args);
  try {
    const response = await wordClient.wordUndo(args['times'] as number ?? 1);
    if (response.success) {
      logger.toolSuccess('word_undo', args, { times: args['times'] ?? 1 }, Date.now() - startTime);
      return { success: true, result: response.message || 'Undo performed' };
    }
    logger.toolError('word_undo', args, new Error(response.error || 'Failed to undo'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to undo' };
  } catch (error) {
    logger.toolError('word_undo', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to undo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordUndoTool: LLMSimpleTool = {
  definition: WORD_UNDO_DEFINITION,
  execute: executeWordUndo,
  categories: OFFICE_CATEGORIES,
  description: 'Undo Word action',
};

// =============================================================================
// Word Redo
// =============================================================================

const WORD_REDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_redo',
    description: `Redo the last undone action(s).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are redoing' },
        times: { type: 'number', description: 'Number of times to redo (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRedo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_redo', args);
  try {
    const response = await wordClient.wordRedo(args['times'] as number ?? 1);
    if (response.success) {
      logger.toolSuccess('word_redo', args, { times: args['times'] ?? 1 }, Date.now() - startTime);
      return { success: true, result: response.message || 'Redo performed' };
    }
    logger.toolError('word_redo', args, new Error(response.error || 'Failed to redo'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to redo' };
  } catch (error) {
    logger.toolError('word_redo', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to redo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRedoTool: LLMSimpleTool = {
  definition: WORD_REDO_DEFINITION,
  execute: executeWordRedo,
  categories: OFFICE_CATEGORIES,
  description: 'Redo Word action',
};

// =============================================================================
// Export Undo/Redo Tools
// =============================================================================

export const undoRedoTools: LLMSimpleTool[] = [
  wordUndoTool,
  wordRedoTool,
];
