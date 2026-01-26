/**
 * Word Bookmark Tools
 *
 * Bookmark-related tools for Microsoft Word
 * - addBookmark, getBookmarks, deleteBookmark, gotoBookmark
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/index';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Add Bookmark
// =============================================================================

const WORD_ADD_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_bookmark',
    description: `Add a bookmark at the current selection or with specified text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a bookmark' },
        name: { type: 'string', description: 'Bookmark name (no spaces)' },
        text: { type: 'string', description: 'Optional text to mark (will be selected)' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordAddBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_bookmark', args);
  try {
    const response = await wordClient.wordAddBookmark(
      args['name'] as string,
      args['text'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_add_bookmark', args, { name: args['name'] }, Date.now() - startTime);
      return { success: true, result: `Bookmark "${args['name']}" added` };
    }
    logger.toolError('word_add_bookmark', args, new Error(response.error || 'Failed to add bookmark'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add bookmark' };
  } catch (error) {
    logger.toolError('word_add_bookmark', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddBookmarkTool: LLMSimpleTool = {
  definition: WORD_ADD_BOOKMARK_DEFINITION,
  execute: executeWordAddBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word bookmark',
};

// =============================================================================
// Word Get Bookmarks
// =============================================================================

const WORD_GET_BOOKMARKS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_bookmarks',
    description: `Get all bookmarks in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need bookmark list' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetBookmarks(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_bookmarks', _args);
  try {
    const response = await wordClient.wordGetBookmarks();
    if (response.success) {
      const bookmarks = response['bookmarks'] as Array<{ name: string; text: string }> || [];
      logger.toolSuccess('word_get_bookmarks', _args, { count: bookmarks.length }, Date.now() - startTime);
      if (bookmarks.length === 0) {
        return { success: true, result: 'No bookmarks found' };
      }
      const list = bookmarks.map(b => `- ${b.name}: "${b.text}"`).join('\n');
      return { success: true, result: `Bookmarks:\n${list}` };
    }
    logger.toolError('word_get_bookmarks', _args, new Error(response.error || 'Failed to get bookmarks'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get bookmarks' };
  } catch (error) {
    logger.toolError('word_get_bookmarks', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get bookmarks: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetBookmarksTool: LLMSimpleTool = {
  definition: WORD_GET_BOOKMARKS_DEFINITION,
  execute: executeWordGetBookmarks,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word bookmarks',
};

// =============================================================================
// Word Delete Bookmark
// =============================================================================

const WORD_DELETE_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_bookmark',
    description: `Delete a bookmark from the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the bookmark' },
        name: { type: 'string', description: 'Bookmark name to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordDeleteBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_bookmark', args);
  try {
    const response = await wordClient.wordDeleteBookmark(args['name'] as string);
    if (response.success) {
      logger.toolSuccess('word_delete_bookmark', args, { name: args['name'] }, Date.now() - startTime);
      return { success: true, result: `Bookmark "${args['name']}" deleted` };
    }
    logger.toolError('word_delete_bookmark', args, new Error(response.error || 'Failed to delete bookmark'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete bookmark' };
  } catch (error) {
    logger.toolError('word_delete_bookmark', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteBookmarkTool: LLMSimpleTool = {
  definition: WORD_DELETE_BOOKMARK_DEFINITION,
  execute: executeWordDeleteBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word bookmark',
};

// =============================================================================
// Word Goto Bookmark
// =============================================================================

const WORD_GOTO_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto_bookmark',
    description: `Navigate to a bookmark in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating to bookmark' },
        name: { type: 'string', description: 'Bookmark name' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordGotoBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_goto_bookmark', args);
  try {
    const response = await wordClient.wordGotoBookmark(args['name'] as string);
    if (response.success) {
      logger.toolSuccess('word_goto_bookmark', args, { name: args['name'] }, Date.now() - startTime);
      return { success: true, result: `Moved to bookmark "${args['name']}"` };
    }
    logger.toolError('word_goto_bookmark', args, new Error(response.error || 'Failed to goto bookmark'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to goto bookmark' };
  } catch (error) {
    logger.toolError('word_goto_bookmark', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to goto bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGotoBookmarkTool: LLMSimpleTool = {
  definition: WORD_GOTO_BOOKMARK_DEFINITION,
  execute: executeWordGotoBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Goto Word bookmark',
};

// =============================================================================
// Export All Bookmark Tools
// =============================================================================

export const bookmarksTools: LLMSimpleTool[] = [
  wordAddBookmarkTool,
  wordGetBookmarksTool,
  wordDeleteBookmarkTool,
  wordGotoBookmarkTool,
];
