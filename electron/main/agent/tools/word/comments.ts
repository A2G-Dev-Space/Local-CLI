/**
 * Word Comment Tools
 *
 * Comment operations: addComment, getComments, deleteComment, deleteAllComments
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Add Comment
// =============================================================================

const WORD_ADD_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_comment',
    description: `Add a comment to the selected text in the Word document.`,
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
  try {
    const response = await wordClient.wordAddComment(
      args['text'] as string,
      args['author'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Comment added' };
    }
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    return { success: false, error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddCommentTool: LLMSimpleTool = {
  definition: WORD_ADD_COMMENT_DEFINITION,
  execute: executeWordAddComment,
  categories: OFFICE_CATEGORIES,
  description: 'Add comment to Word document',
};

// =============================================================================
// Word Get Comments
// =============================================================================

const WORD_GET_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_comments',
    description: `Get all comments from the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are getting comments' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetComments(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetComments();
    if (response.success) {
      const comments = response['comments'] as Array<{ author: string; text: string }>;
      if (!comments || comments.length === 0) {
        return { success: true, result: 'No comments found' };
      }
      const formatted = comments.map((c, i) => `${i + 1}. [${c.author}]: ${c.text}`).join('\n');
      return { success: true, result: `Comments:\n${formatted}` };
    }
    return { success: false, error: response.error || 'Failed to get comments' };
  } catch (error) {
    return { success: false, error: `Failed to get comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetCommentsTool: LLMSimpleTool = {
  definition: WORD_GET_COMMENTS_DEFINITION,
  execute: executeWordGetComments,
  categories: OFFICE_CATEGORIES,
  description: 'Get comments from Word document',
};

// =============================================================================
// Word Delete Comment
// =============================================================================

const WORD_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_comment',
    description: `Delete a specific comment from the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the comment' },
        index: { type: 'number', description: 'Comment index (1-based)' },
      },
      required: ['reason', 'index'],
    },
  },
};

async function executeWordDeleteComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordDeleteComment(args['index'] as number);
    if (response.success) {
      return { success: true, result: `Comment ${args['index']} deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    return { success: false, error: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteCommentTool: LLMSimpleTool = {
  definition: WORD_DELETE_COMMENT_DEFINITION,
  execute: executeWordDeleteComment,
  categories: OFFICE_CATEGORIES,
  description: 'Delete comment from Word document',
};

// =============================================================================
// Word Delete All Comments
// =============================================================================

const WORD_DELETE_ALL_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_all_comments',
    description: `Delete all comments from the Word document.`,
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
  try {
    const response = await wordClient.wordDeleteAllComments();
    if (response.success) {
      return { success: true, result: 'All comments deleted' };
    }
    return { success: false, error: response.error || 'Failed to delete all comments' };
  } catch (error) {
    return { success: false, error: `Failed to delete all comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteAllCommentsTool: LLMSimpleTool = {
  definition: WORD_DELETE_ALL_COMMENTS_DEFINITION,
  execute: executeWordDeleteAllComments,
  categories: OFFICE_CATEGORIES,
  description: 'Delete all comments from Word',
};

// =============================================================================
// Export Comment Tools
// =============================================================================

export const commentsTools: LLMSimpleTool[] = [
  wordAddCommentTool,
  wordGetCommentsTool,
  wordDeleteCommentTool,
  wordDeleteAllCommentsTool,
];
