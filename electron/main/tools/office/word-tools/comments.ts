/**
 * Word Comments Tools
 *
 * Tools for managing comments in Word documents
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Add Comment
// =============================================================================

const WORD_ADD_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_comment',
    description: `Add a comment to the current selection.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a comment' },
        text: { type: 'string', description: 'Comment text' },
        author: { type: 'string', description: 'Author name (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_comment', args);
  try {
    const response = await wordClient.wordAddComment(
      args['text'] as string,
      args['author'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_add_comment', args, { added: true }, Date.now() - startTime);
      return { success: true, result: 'Comment added' };
    }
    logger.toolError('word_add_comment', args, new Error(response.error || 'Failed to add comment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    logger.toolError('word_add_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddCommentTool: LLMSimpleTool = {
  definition: WORD_ADD_COMMENT_DEFINITION,
  execute: executeWordAddComment,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word comment',
};

// =============================================================================
// Word Get Comments
// =============================================================================

const WORD_GET_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_comments',
    description: `Get all comments in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need comments' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetComments(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_comments', _args);
  try {
    const response = await wordClient.wordGetComments();
    if (response.success) {
      const comments = response['comments'] as Array<{ index: number; author: string; text: string; scope: string }> || [];
      const count = response['count'] as number || 0;
      logger.toolSuccess('word_get_comments', _args, { count }, Date.now() - startTime);
      if (count === 0) {
        return { success: true, result: 'No comments found' };
      }
      const list = comments.map(c => `[${c.index}] ${c.author}: "${c.text}" (on: "${c.scope?.slice(0, 30)}...")`).join('\n');
      return { success: true, result: `${count} comments:\n${list}` };
    }
    logger.toolError('word_get_comments', _args, new Error(response.error || 'Failed to get comments'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get comments' };
  } catch (error) {
    logger.toolError('word_get_comments', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetCommentsTool: LLMSimpleTool = {
  definition: WORD_GET_COMMENTS_DEFINITION,
  execute: executeWordGetComments,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word comments',
};

// =============================================================================
// Word Delete Comment
// =============================================================================

const WORD_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_comment',
    description: `Delete a comment by index.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting comment' },
        index: { type: 'number', description: 'Comment index (1-based)' },
      },
      required: ['reason', 'index'],
    },
  },
};

async function executeWordDeleteComment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_comment', args);
  try {
    const response = await wordClient.wordDeleteComment(args['index'] as number);
    if (response.success) {
      logger.toolSuccess('word_delete_comment', args, { index: args['index'] }, Date.now() - startTime);
      return { success: true, result: `Comment ${args['index']} deleted` };
    }
    logger.toolError('word_delete_comment', args, new Error(response.error || 'Failed to delete comment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    logger.toolError('word_delete_comment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteCommentTool: LLMSimpleTool = {
  definition: WORD_DELETE_COMMENT_DEFINITION,
  execute: executeWordDeleteComment,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word comment',
};

// =============================================================================
// Word Delete All Comments
// =============================================================================

const WORD_DELETE_ALL_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_all_comments',
    description: `Delete all comments in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting all comments' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordDeleteAllComments(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_all_comments', _args);
  try {
    const response = await wordClient.wordDeleteAllComments();
    if (response.success) {
      logger.toolSuccess('word_delete_all_comments', _args, { deleted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'All comments deleted' };
    }
    logger.toolError('word_delete_all_comments', _args, new Error(response.error || 'Failed to delete comments'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete comments' };
  } catch (error) {
    logger.toolError('word_delete_all_comments', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteAllCommentsTool: LLMSimpleTool = {
  definition: WORD_DELETE_ALL_COMMENTS_DEFINITION,
  execute: executeWordDeleteAllComments,
  categories: OFFICE_CATEGORIES,
  description: 'Delete all Word comments',
};

// =============================================================================
// Export All Comment Tools
// =============================================================================

export const commentsTools: LLMSimpleTool[] = [
  wordAddCommentTool,
  wordGetCommentsTool,
  wordDeleteCommentTool,
  wordDeleteAllCommentsTool,
];
