/**
 * Word List Tools
 *
 * List operations: createBulletList, createNumberedList
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Create Bullet List
// =============================================================================

const WORD_CREATE_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_bullet_list',
    description: `Create a bullet list in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a bullet list' },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'List items (array of strings)',
        },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordCreateBulletList(args['items'] as string[]);
    if (response.success) {
      return { success: true, result: 'Bullet list created' };
    }
    return { success: false, error: response.error || 'Failed to create bullet list' };
  } catch (error) {
    return { success: false, error: `Failed to create bullet list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateBulletListTool: LLMSimpleTool = {
  definition: WORD_CREATE_BULLET_LIST_DEFINITION,
  execute: executeWordCreateBulletList,
  categories: OFFICE_CATEGORIES,
  description: 'Create bullet list in Word',
};

// =============================================================================
// Word Create Numbered List
// =============================================================================

const WORD_CREATE_NUMBERED_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_numbered_list',
    description: `Create a numbered list in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a numbered list' },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'List items (array of strings)',
        },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateNumberedList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordCreateNumberedList(args['items'] as string[]);
    if (response.success) {
      return { success: true, result: 'Numbered list created' };
    }
    return { success: false, error: response.error || 'Failed to create numbered list' };
  } catch (error) {
    return { success: false, error: `Failed to create numbered list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateNumberedListTool: LLMSimpleTool = {
  definition: WORD_CREATE_NUMBERED_LIST_DEFINITION,
  execute: executeWordCreateNumberedList,
  categories: OFFICE_CATEGORIES,
  description: 'Create numbered list in Word',
};

// =============================================================================
// Export List Tools
// =============================================================================

export const listsTools: LLMSimpleTool[] = [
  wordCreateBulletListTool,
  wordCreateNumberedListTool,
];
