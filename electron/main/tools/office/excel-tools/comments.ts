/**
 * Excel Comments Tools
 *
 * Tools for managing cell comments in Excel
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Add Comment
// =============================================================================

const EXCEL_ADD_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_comment',
    description: `Add a comment to a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        text: { type: 'string', description: 'Comment text' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'text'],
    },
  },
};

async function executeExcelAddComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_add_comment', args);
  try {
    const response = await excelClient.excelAddComment(
      args['cell'] as string,
      args['text'] as string,
      undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_add_comment', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: `Comment added to ${args['cell']}` };
    }
    logger.toolError('excel_add_comment', args, new Error(response.error || 'Failed to add comment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    logger.toolError('excel_add_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddCommentTool: LLMSimpleTool = {
  definition: EXCEL_ADD_COMMENT_DEFINITION,
  execute: executeExcelAddComment,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel comment',
};

// =============================================================================
// Excel Get Comment
// =============================================================================

const EXCEL_GET_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_comment',
    description: `Get comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelGetComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_get_comment', args);
  try {
    const response = await excelClient.excelGetComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      if (response['has_comment']) {
        logger.toolSuccess('excel_get_comment', args, { cell: args['cell'], hasComment: true }, Date.now() - startTime);
        return { success: true, result: `Comment at ${args['cell']}: "${response['text']}"` };
      }
      logger.toolSuccess('excel_get_comment', args, { cell: args['cell'], hasComment: false }, Date.now() - startTime);
      return { success: true, result: `No comment at ${args['cell']}` };
    }
    logger.toolError('excel_get_comment', args, new Error(response.error || 'Failed to get comment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get comment' };
  } catch (error) {
    logger.toolError('excel_get_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetCommentTool: LLMSimpleTool = {
  definition: EXCEL_GET_COMMENT_DEFINITION,
  execute: executeExcelGetComment,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel comment',
};

// =============================================================================
// Excel Delete Comment
// =============================================================================

const EXCEL_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_comment',
    description: `Delete comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelDeleteComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_delete_comment', args);
  try {
    const response = await excelClient.excelDeleteComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_delete_comment', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: `Comment deleted from ${args['cell']}` };
    }
    logger.toolError('excel_delete_comment', args, new Error(response.error || 'Failed to delete comment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    logger.toolError('excel_delete_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteCommentTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COMMENT_DEFINITION,
  execute: executeExcelDeleteComment,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel comment',
};

// =============================================================================
// Excel Edit Comment
// =============================================================================

const EXCEL_EDIT_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_edit_comment',
    description: `Edit an existing comment in a cell. Returns error if cell has no comment.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are editing comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        text: { type: 'string', description: 'New comment text' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'text'],
    },
  },
};

async function executeExcelEditComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_edit_comment', args);
  try {
    const response = await excelClient.excelEditComment(
      args['cell'] as string,
      args['text'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_edit_comment', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: `Comment updated in ${args['cell']}` };
    }
    logger.toolError('excel_edit_comment', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to edit comment' };
  } catch (error) {
    logger.toolError('excel_edit_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to edit comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelEditCommentTool: LLMSimpleTool = {
  definition: EXCEL_EDIT_COMMENT_DEFINITION,
  execute: executeExcelEditComment,
  categories: OFFICE_CATEGORIES,
  description: 'Edit Excel comment',
};

// =============================================================================
// Export all comment tools
// =============================================================================

export const commentsTools: LLMSimpleTool[] = [
  excelAddCommentTool,
  excelGetCommentTool,
  excelDeleteCommentTool,
  excelEditCommentTool,
];
