/**
 * Word Navigation Tools
 *
 * Navigation operations: getSelection, selectAll, goto, getSelectedText
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Get Selection
// =============================================================================

const WORD_GET_SELECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_selection',
    description: `Get information about the current selection in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need selection information' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetSelection(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetSelection();
    if (response.success) {
      return {
        success: true,
        result: JSON.stringify({
          start: response['start'],
          end: response['end'],
          text: response['text'],
        }, null, 2),
      };
    }
    return { success: false, error: response.error || 'Failed to get selection' };
  } catch (error) {
    return { success: false, error: `Failed to get selection: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetSelectionTool: LLMSimpleTool = {
  definition: WORD_GET_SELECTION_DEFINITION,
  execute: executeWordGetSelection,
  categories: OFFICE_CATEGORIES,
  description: 'Get selection info in Word',
};

// =============================================================================
// Word Select All
// =============================================================================

const WORD_SELECT_ALL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_select_all',
    description: `Select all content in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting all' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSelectAll(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSelectAll();
    if (response.success) {
      return { success: true, result: 'All content selected' };
    }
    return { success: false, error: response.error || 'Failed to select all' };
  } catch (error) {
    return { success: false, error: `Failed to select all: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSelectAllTool: LLMSimpleTool = {
  definition: WORD_SELECT_ALL_DEFINITION,
  execute: executeWordSelectAll,
  categories: OFFICE_CATEGORIES,
  description: 'Select all in Word document',
};

// =============================================================================
// Word Goto
// =============================================================================

const WORD_GOTO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto',
    description: `Navigate to a specific location in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating' },
        what: {
          type: 'string',
          enum: ['page', 'line', 'bookmark'],
          description: 'What to navigate to',
        },
        target: {
          type: ['number', 'string'],
          description: 'Target (page/line number, or bookmark name)',
        },
      },
      required: ['reason', 'what', 'target'],
    },
  },
};

async function executeWordGoto(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGoto(
      args['what'] as 'page' | 'line' | 'bookmark',
      args['target'] as number | string
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
  description: 'Navigate in Word document',
};

// =============================================================================
// Word Get Selected Text
// =============================================================================

const WORD_GET_SELECTED_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_selected_text',
    description: `Get the currently selected text in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the selected text' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetSelectedText(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetSelectedText();
    if (response.success) {
      const text = response['text'] as string;
      return { success: true, result: text || '(no selection)' };
    }
    return { success: false, error: response.error || 'Failed to get selected text' };
  } catch (error) {
    return { success: false, error: `Failed to get selected text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetSelectedTextTool: LLMSimpleTool = {
  definition: WORD_GET_SELECTED_TEXT_DEFINITION,
  execute: executeWordGetSelectedText,
  categories: OFFICE_CATEGORIES,
  description: 'Get selected text in Word',
};

// =============================================================================
// Export Navigation Tools
// =============================================================================

export const navigationTools: LLMSimpleTool[] = [
  wordGetSelectionTool,
  wordSelectAllTool,
  wordGotoTool,
  wordGetSelectedTextTool,
];
