/**
 * Word Lists Tools
 *
 * Tools for creating bullet and numbered lists in Word documents.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Create Bullet List
// =============================================================================

const WORD_CREATE_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_bullet_list',
    description: `Create a bullet list with the specified items.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating bullet list' },
        items: { type: 'array', items: { type: 'string' }, description: 'List items' },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_create_bullet_list', args);
  try {
    const response = await wordClient.wordCreateBulletList(args['items'] as string[]);
    if (response.success) {
      logger.toolSuccess('word_create_bullet_list', args, { itemCount: (args['items'] as string[])?.length }, Date.now() - startTime);
      return { success: true, result: response.message || 'Bullet list created' };
    }
    logger.toolError('word_create_bullet_list', args, new Error(response.error || 'Failed to create bullet list'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to create bullet list' };
  } catch (error) {
    logger.toolError('word_create_bullet_list', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to create bullet list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateBulletListTool: LLMSimpleTool = {
  definition: WORD_CREATE_BULLET_LIST_DEFINITION,
  execute: executeWordCreateBulletList,
  categories: OFFICE_CATEGORIES,
  description: 'Create Word bullet list',
};

// =============================================================================
// Word Create Numbered List
// =============================================================================

const WORD_CREATE_NUMBERED_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_numbered_list',
    description: `Create a numbered list with the specified items.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating numbered list' },
        items: { type: 'array', items: { type: 'string' }, description: 'List items' },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateNumberedList(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_create_numbered_list', args);
  try {
    const response = await wordClient.wordCreateNumberedList(args['items'] as string[]);
    if (response.success) {
      logger.toolSuccess('word_create_numbered_list', args, { itemCount: (args['items'] as string[])?.length }, Date.now() - startTime);
      return { success: true, result: response.message || 'Numbered list created' };
    }
    logger.toolError('word_create_numbered_list', args, new Error(response.error || 'Failed to create numbered list'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to create numbered list' };
  } catch (error) {
    logger.toolError('word_create_numbered_list', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to create numbered list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateNumberedListTool: LLMSimpleTool = {
  definition: WORD_CREATE_NUMBERED_LIST_DEFINITION,
  execute: executeWordCreateNumberedList,
  categories: OFFICE_CATEGORIES,
  description: 'Create Word numbered list',
};

// =============================================================================
// Export All Lists Tools
// =============================================================================

export const listsTools: LLMSimpleTool[] = [
  wordCreateBulletListTool,
  wordCreateNumberedListTool,
];
