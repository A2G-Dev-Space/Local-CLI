/**
 * Excel Comments Tools
 *
 * Tools for managing cell comments in Excel
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
  try {
    const response = await excelClient.excelAddComment(
      args['cell'] as string,
      args['text'] as string,
      undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Comment added to ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelGetComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      if (response['has_comment']) {
        return { success: true, result: `Comment at ${args['cell']}: "${response['text']}"` };
      }
      return { success: true, result: `No comment at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to get comment' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelDeleteComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Comment deleted from ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
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
// Export all comment tools
// =============================================================================

export const commentsTools: LLMSimpleTool[] = [
  excelAddCommentTool,
  excelGetCommentTool,
  excelDeleteCommentTool,
];
