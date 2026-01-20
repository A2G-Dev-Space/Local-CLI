/**
 * Word Undo/Redo Tools
 *
 * Undo/Redo operations: undo, redo
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Undo
// =============================================================================

const WORD_UNDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_undo',
    description: `Undo the last action(s) in the Word document.`,
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
  try {
    const times = (args['times'] as number) || 1;
    const response = await wordClient.wordUndo(times);
    if (response.success) {
      return { success: true, result: `Undone ${times} action(s)` };
    }
    return { success: false, error: response.error || 'Failed to undo' };
  } catch (error) {
    return { success: false, error: `Failed to undo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordUndoTool: LLMSimpleTool = {
  definition: WORD_UNDO_DEFINITION,
  execute: executeWordUndo,
  categories: OFFICE_CATEGORIES,
  description: 'Undo actions in Word',
};

// =============================================================================
// Word Redo
// =============================================================================

const WORD_REDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_redo',
    description: `Redo the last undone action(s) in the Word document.`,
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
  try {
    const times = (args['times'] as number) || 1;
    const response = await wordClient.wordRedo(times);
    if (response.success) {
      return { success: true, result: `Redone ${times} action(s)` };
    }
    return { success: false, error: response.error || 'Failed to redo' };
  } catch (error) {
    return { success: false, error: `Failed to redo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRedoTool: LLMSimpleTool = {
  definition: WORD_REDO_DEFINITION,
  execute: executeWordRedo,
  categories: OFFICE_CATEGORIES,
  description: 'Redo actions in Word',
};

// =============================================================================
// Export Undo/Redo Tools
// =============================================================================

export const undoRedoTools: LLMSimpleTool[] = [
  wordUndoTool,
  wordRedoTool,
];
