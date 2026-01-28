/**
 * Word Track Changes Tools
 *
 * Tools for managing document revisions:
 * - word_set_track_changes: Enable/disable track changes
 * - word_get_track_changes: Get track changes status and revisions
 * - word_accept_all_revisions: Accept all revisions
 * - word_reject_all_revisions: Reject all revisions
 * - word_handle_revision: Accept or reject a specific revision
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { wordClient } from '../word-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Word Set Track Changes
// =============================================================================

const WORD_SET_TRACK_CHANGES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_track_changes',
    description: `Enable or disable track changes (revision tracking) in the document.
When enabled, all edits are marked as revisions that can be accepted or rejected.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing track changes setting' },
        enabled: { type: 'boolean', description: 'Whether to enable (true) or disable (false) track changes' },
      },
      required: ['reason', 'enabled'],
    },
  },
};

async function executeWordSetTrackChanges(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetTrackChanges(args['enabled'] as boolean);
    if (response.success) {
      return { success: true, result: response.message || 'Track changes setting updated' };
    }
    return { success: false, error: response.error || 'Failed to set track changes' };
  } catch (error) {
    return { success: false, error: `Failed to set track changes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTrackChangesTool: LLMSimpleTool = {
  definition: WORD_SET_TRACK_CHANGES_DEFINITION,
  execute: executeWordSetTrackChanges,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word track changes',
};

// =============================================================================
// Word Get Track Changes
// =============================================================================

const WORD_GET_TRACK_CHANGES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_track_changes',
    description: `Get track changes status and list all revisions in the document.
Returns: track changes enabled status, revision count, and details of each revision.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need track changes info' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetTrackChanges(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetTrackChanges();
    if (response.success) {
      const revisions = response['revisions'] as Array<{
        index: number;
        author: string;
        type: number;
        text: string;
        date: string;
      }> || [];
      const count = response['revision_count'] as number || 0;

      if (count === 0) {
        return {
          success: true,
          result: `Track Changes: ${response['track_revisions'] ? 'Enabled' : 'Disabled'}\nNo revisions found.`,
        };
      }

      // Revision type mapping
      const typeMap: Record<number, string> = {
        1: 'Insert',
        2: 'Delete',
        3: 'Property Change',
      };

      const list = revisions.map(r =>
        `[${r.index}] ${typeMap[r.type] || 'Unknown'} by ${r.author} (${r.date}): "${r.text?.slice(0, 50)}${(r.text?.length || 0) > 50 ? '...' : ''}"`
      ).join('\n');

      return {
        success: true,
        result: `Track Changes: ${response['track_revisions'] ? 'Enabled' : 'Disabled'}\n${count} revision(s):\n${list}`,
      };
    }
    return { success: false, error: response.error || 'Failed to get track changes' };
  } catch (error) {
    return { success: false, error: `Failed to get track changes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetTrackChangesTool: LLMSimpleTool = {
  definition: WORD_GET_TRACK_CHANGES_DEFINITION,
  execute: executeWordGetTrackChanges,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word track changes',
};

// =============================================================================
// Word Accept All Revisions
// =============================================================================

const WORD_ACCEPT_ALL_REVISIONS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_accept_all_revisions',
    description: `Accept all tracked revisions in the document.
This will finalize all changes and remove revision marks.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are accepting all revisions' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordAcceptAllRevisions(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAcceptAllRevisions();
    if (response.success) {
      return { success: true, result: response.message || 'All revisions accepted' };
    }
    return { success: false, error: response.error || 'Failed to accept revisions' };
  } catch (error) {
    return { success: false, error: `Failed to accept revisions: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAcceptAllRevisionsTool: LLMSimpleTool = {
  definition: WORD_ACCEPT_ALL_REVISIONS_DEFINITION,
  execute: executeWordAcceptAllRevisions,
  categories: OFFICE_CATEGORIES,
  description: 'Accept all Word revisions',
};

// =============================================================================
// Word Reject All Revisions
// =============================================================================

const WORD_REJECT_ALL_REVISIONS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_reject_all_revisions',
    description: `Reject all tracked revisions in the document.
This will revert all changes and remove revision marks.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are rejecting all revisions' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRejectAllRevisions(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordRejectAllRevisions();
    if (response.success) {
      return { success: true, result: response.message || 'All revisions rejected' };
    }
    return { success: false, error: response.error || 'Failed to reject revisions' };
  } catch (error) {
    return { success: false, error: `Failed to reject revisions: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRejectAllRevisionsTool: LLMSimpleTool = {
  definition: WORD_REJECT_ALL_REVISIONS_DEFINITION,
  execute: executeWordRejectAllRevisions,
  categories: OFFICE_CATEGORIES,
  description: 'Reject all Word revisions',
};

// =============================================================================
// Word Handle Revision
// =============================================================================

const WORD_HANDLE_REVISION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_handle_revision',
    description: `Accept or reject a specific revision by index.
Use word_get_track_changes first to get revision indices.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are handling this revision' },
        index: { type: 'number', description: 'Revision index (1-based)' },
        accept: { type: 'boolean', description: 'True to accept, false to reject' },
      },
      required: ['reason', 'index', 'accept'],
    },
  },
};

async function executeWordHandleRevision(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordHandleRevision(
      args['index'] as number,
      args['accept'] as boolean
    );
    if (response.success) {
      return { success: true, result: response.message || 'Revision handled' };
    }
    return { success: false, error: response.error || 'Failed to handle revision' };
  } catch (error) {
    return { success: false, error: `Failed to handle revision: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordHandleRevisionTool: LLMSimpleTool = {
  definition: WORD_HANDLE_REVISION_DEFINITION,
  execute: executeWordHandleRevision,
  categories: OFFICE_CATEGORIES,
  description: 'Handle Word revision',
};

// =============================================================================
// Export All Track Changes Tools
// =============================================================================

export const trackChangesTools: LLMSimpleTool[] = [
  wordSetTrackChangesTool,
  wordGetTrackChangesTool,
  wordAcceptAllRevisionsTool,
  wordRejectAllRevisionsTool,
  wordHandleRevisionTool,
];
