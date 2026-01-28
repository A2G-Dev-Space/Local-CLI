/**
 * Word Table of Contents Tools
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Insert TOC
// =============================================================================

const WORD_INSERT_TOC_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_toc',
    description: `Insert a table of contents at the current cursor position.
The TOC is automatically generated from heading styles (Heading 1, 2, 3, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a TOC' },
        upper_heading_level: { type: 'number', description: 'Include headings from this level (default: 1)' },
        lower_heading_level: { type: 'number', description: 'Include headings to this level (default: 3)' },
        use_hyperlinks: { type: 'boolean', description: 'Make TOC entries clickable (default: true)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertTOC(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_insert_toc', args);
  try {
    const response = await wordClient.wordInsertTOC({
      upperHeadingLevel: args['upper_heading_level'] as number | undefined,
      lowerHeadingLevel: args['lower_heading_level'] as number | undefined,
      useHyperlinks: args['use_hyperlinks'] as boolean | undefined,
    });
    if (response.success) {
      logger.toolSuccess('word_insert_toc', args, { inserted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'Table of contents inserted' };
    }
    logger.toolError('word_insert_toc', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert TOC' };
  } catch (error) {
    logger.toolError('word_insert_toc', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert TOC: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertTOCTool: LLMSimpleTool = {
  definition: WORD_INSERT_TOC_DEFINITION,
  execute: executeWordInsertTOC,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word TOC',
};

// =============================================================================
// Word Update TOC
// =============================================================================

const WORD_UPDATE_TOC_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_update_toc',
    description: `Update all tables of contents in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are updating the TOC' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordUpdateTOC(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_update_toc', _args);
  try {
    const response = await wordClient.wordUpdateTOC();
    if (response.success) {
      logger.toolSuccess('word_update_toc', _args, { updated: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'TOC updated' };
    }
    logger.toolError('word_update_toc', _args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to update TOC' };
  } catch (error) {
    logger.toolError('word_update_toc', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to update TOC: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordUpdateTOCTool: LLMSimpleTool = {
  definition: WORD_UPDATE_TOC_DEFINITION,
  execute: executeWordUpdateTOC,
  categories: OFFICE_CATEGORIES,
  description: 'Update Word TOC',
};

// =============================================================================
// Word Delete TOC
// =============================================================================

const WORD_DELETE_TOC_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_toc',
    description: `Delete all tables of contents from the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the TOC' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordDeleteTOC(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_toc', _args);
  try {
    const response = await wordClient.wordDeleteTOC();
    if (response.success) {
      logger.toolSuccess('word_delete_toc', _args, { deleted: true }, Date.now() - startTime);
      return { success: true, result: response.message || 'TOC deleted' };
    }
    logger.toolError('word_delete_toc', _args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete TOC' };
  } catch (error) {
    logger.toolError('word_delete_toc', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete TOC: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteTOCTool: LLMSimpleTool = {
  definition: WORD_DELETE_TOC_DEFINITION,
  execute: executeWordDeleteTOC,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word TOC',
};

// =============================================================================
// Export All TOC Tools
// =============================================================================

export const tocTools: LLMSimpleTool[] = [
  wordInsertTOCTool,
  wordUpdateTOCTool,
  wordDeleteTOCTool,
];
