/**
 * Excel Comments Tools
 *
 * Comment operations: addComment, getComment, deleteComment
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

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
        reason: { type: 'string', description: 'Why you are adding a comment' },
        cell: { type: 'string', description: 'Cell to add comment (e.g., "A1")' },
        text: { type: 'string', description: 'Comment text' },
        author: { type: 'string', description: 'Author name (optional)' },
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
      args['author'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Comment added to ${args['cell']}` }; }
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddCommentTool: LLMSimpleTool = {
  definition: EXCEL_ADD_COMMENT_DEFINITION, execute: executeExcelAddComment, categories: OFFICE_CATEGORIES, description: 'Add comment in Excel',
};

// =============================================================================
// Excel Get Comment
// =============================================================================

const EXCEL_GET_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_comment',
    description: `Get the comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the comment' },
        cell: { type: 'string', description: 'Cell to get comment from' },
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
        return { success: true, result: `Comment: ${response['text']}` };
      }
      return { success: true, result: 'No comment found' };
    }
    return { success: false, error: response.error || 'Failed to get comment' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetCommentTool: LLMSimpleTool = {
  definition: EXCEL_GET_COMMENT_DEFINITION, execute: executeExcelGetComment, categories: OFFICE_CATEGORIES, description: 'Get comment in Excel',
};

// =============================================================================
// Excel Delete Comment
// =============================================================================

const EXCEL_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_comment',
    description: `Delete a comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the comment' },
        cell: { type: 'string', description: 'Cell to delete comment from' },
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
    if (response.success) { return { success: true, result: 'Comment deleted' }; }
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteCommentTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COMMENT_DEFINITION, execute: executeExcelDeleteComment, categories: OFFICE_CATEGORIES, description: 'Delete comment in Excel',
};

// =============================================================================
// Export Comments Tools
// =============================================================================

export const commentsTools: LLMSimpleTool[] = [
  excelAddCommentTool,
  excelGetCommentTool,
  excelDeleteCommentTool,
];
