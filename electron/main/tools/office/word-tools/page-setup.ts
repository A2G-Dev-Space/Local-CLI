/**
 * Word Page Setup Tools
 *
 * Page setup related tools: margins, orientation, page size, columns
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/index';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Set Page Margins
// =============================================================================

const WORD_SET_PAGE_MARGINS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_margins',
    description: `Set page margins (in points, 72 points = 1 inch).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting margins' },
        top: { type: 'number', description: 'Top margin in points' },
        bottom: { type: 'number', description: 'Bottom margin in points' },
        left: { type: 'number', description: 'Left margin in points' },
        right: { type: 'number', description: 'Right margin in points' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetPageMargins(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_set_page_margins', args);
  try {
    const response = await wordClient.wordSetPageMargins({
      top: args['top'] as number | undefined,
      bottom: args['bottom'] as number | undefined,
      left: args['left'] as number | undefined,
      right: args['right'] as number | undefined,
    });
    if (response.success) {
      logger.toolSuccess('word_set_page_margins', args, { updated: true }, Date.now() - startTime);
      return { success: true, result: 'Page margins updated' };
    }
    logger.toolError('word_set_page_margins', args, new Error(response.error || 'Failed to set margins'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set margins' };
  } catch (error) {
    logger.toolError('word_set_page_margins', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set margins: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageMarginsTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_MARGINS_DEFINITION,
  execute: executeWordSetPageMargins,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page margins',
};

// =============================================================================
// Word Set Page Orientation
// =============================================================================

const WORD_SET_PAGE_ORIENTATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_orientation',
    description: `Set page orientation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing orientation' },
        orientation: { type: 'string', enum: ['portrait', 'landscape'], description: 'Page orientation' },
      },
      required: ['reason', 'orientation'],
    },
  },
};

async function executeWordSetPageOrientation(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_set_page_orientation', args);
  try {
    const response = await wordClient.wordSetPageOrientation(args['orientation'] as 'portrait' | 'landscape');
    if (response.success) {
      logger.toolSuccess('word_set_page_orientation', args, { orientation: args['orientation'] }, Date.now() - startTime);
      return { success: true, result: `Page orientation set to ${args['orientation']}` };
    }
    logger.toolError('word_set_page_orientation', args, new Error(response.error || 'Failed to set orientation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set orientation' };
  } catch (error) {
    logger.toolError('word_set_page_orientation', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set orientation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageOrientationTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_ORIENTATION_DEFINITION,
  execute: executeWordSetPageOrientation,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page orientation',
};

// =============================================================================
// Word Set Page Size
// =============================================================================

const WORD_SET_PAGE_SIZE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_size',
    description: `Set page size.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing page size' },
        size: { type: 'string', enum: ['A4', 'Letter', 'Legal', 'A3', 'B5', 'custom'], description: 'Page size' },
        width: { type: 'number', description: 'Custom width in points (for custom size)' },
        height: { type: 'number', description: 'Custom height in points (for custom size)' },
      },
      required: ['reason', 'size'],
    },
  },
};

async function executeWordSetPageSize(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_set_page_size', args);
  try {
    const response = await wordClient.wordSetPageSize(
      args['size'] as 'A4' | 'Letter' | 'Legal' | 'A3' | 'B5' | 'custom',
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_set_page_size', args, { size: args['size'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Page size updated' };
    }
    logger.toolError('word_set_page_size', args, new Error(response.error || 'Failed to set page size'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set page size' };
  } catch (error) {
    logger.toolError('word_set_page_size', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set page size: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageSizeTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_SIZE_DEFINITION,
  execute: executeWordSetPageSize,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page size',
};

// =============================================================================
// Word Set Columns
// =============================================================================

const WORD_SET_COLUMNS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_columns',
    description: `Set the number of columns for the document layout.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting columns' },
        count: { type: 'number', description: 'Number of columns (1-4)' },
        spacing: { type: 'number', description: 'Spacing between columns in points (optional)' },
      },
      required: ['reason', 'count'],
    },
  },
};

async function executeWordSetColumns(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_set_columns', args);
  try {
    const response = await wordClient.wordSetColumns(
      args['count'] as number,
      args['spacing'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_set_columns', args, { count: args['count'] }, Date.now() - startTime);
      return { success: true, result: `Columns set to ${args['count']}` };
    }
    logger.toolError('word_set_columns', args, new Error(response.error || 'Failed to set columns'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set columns' };
  } catch (error) {
    logger.toolError('word_set_columns', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set columns: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetColumnsTool: LLMSimpleTool = {
  definition: WORD_SET_COLUMNS_DEFINITION,
  execute: executeWordSetColumns,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word columns',
};

// =============================================================================
// Export All Page Setup Tools
// =============================================================================

export const pageSetupTools: LLMSimpleTool[] = [
  wordSetPageMarginsTool,
  wordSetPageOrientationTool,
  wordSetPageSizeTool,
  wordSetColumnsTool,
];
