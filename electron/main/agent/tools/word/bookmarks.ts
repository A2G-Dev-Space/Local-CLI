/**
 * Word Bookmark Tools
 *
 * Bookmark operations: addBookmark, getBookmarks, deleteBookmark, gotoBookmark
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Add Bookmark
// =============================================================================

const WORD_ADD_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_bookmark',
    description: `Add a bookmark to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a bookmark' },
        name: { type: 'string', description: 'Bookmark name (no spaces allowed)' },
        text: { type: 'string', description: 'Text to bookmark (optional, uses selection if not provided)' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordAddBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAddBookmark(
      args['name'] as string,
      args['text'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Bookmark "${args['name']}" added` };
    }
    return { success: false, error: response.error || 'Failed to add bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to add bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddBookmarkTool: LLMSimpleTool = {
  definition: WORD_ADD_BOOKMARK_DEFINITION,
  execute: executeWordAddBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Add bookmark to Word document',
};

// =============================================================================
// Word Get Bookmarks
// =============================================================================

const WORD_GET_BOOKMARKS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_bookmarks',
    description: `Get all bookmarks in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are getting bookmarks' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetBookmarks(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetBookmarks();
    if (response.success) {
      const bookmarks = response['bookmarks'] as string[];
      return { success: true, result: `Bookmarks: ${bookmarks?.join(', ') || 'none'}` };
    }
    return { success: false, error: response.error || 'Failed to get bookmarks' };
  } catch (error) {
    return { success: false, error: `Failed to get bookmarks: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetBookmarksTool: LLMSimpleTool = {
  definition: WORD_GET_BOOKMARKS_DEFINITION,
  execute: executeWordGetBookmarks,
  categories: OFFICE_CATEGORIES,
  description: 'Get bookmarks from Word document',
};

// =============================================================================
// Word Delete Bookmark
// =============================================================================

const WORD_DELETE_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_bookmark',
    description: `Delete a bookmark from the Word document.`,
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
  try {
    const response = await wordClient.wordDeleteBookmark(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Bookmark "${args['name']}" deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to delete bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteBookmarkTool: LLMSimpleTool = {
  definition: WORD_DELETE_BOOKMARK_DEFINITION,
  execute: executeWordDeleteBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Delete bookmark from Word document',
};

// =============================================================================
// Word Goto Bookmark
// =============================================================================

const WORD_GOTO_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto_bookmark',
    description: `Navigate to a bookmark in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating to the bookmark' },
        name: { type: 'string', description: 'Bookmark name to navigate to' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordGotoBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGotoBookmark(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Navigated to bookmark "${args['name']}"` };
    }
    return { success: false, error: response.error || 'Failed to goto bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to goto bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGotoBookmarkTool: LLMSimpleTool = {
  definition: WORD_GOTO_BOOKMARK_DEFINITION,
  execute: executeWordGotoBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Navigate to bookmark in Word',
};

// =============================================================================
// Export Bookmark Tools
// =============================================================================

export const bookmarksTools: LLMSimpleTool[] = [
  wordAddBookmarkTool,
  wordGetBookmarksTool,
  wordDeleteBookmarkTool,
  wordGotoBookmarkTool,
];
