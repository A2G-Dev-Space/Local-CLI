/**
 * Word Tables Advanced Tools
 *
 * Advanced table manipulation tools:
 * - word_add_table_row, word_add_table_column, word_delete_table_row, word_delete_table_column, word_get_table_info
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Add Table Row
// =============================================================================

const WORD_ADD_TABLE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_table_row',
    description: `Add a new row to a Word table.
If position is specified, the row is inserted before that row index.
If position is not specified, the row is added at the end.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a row' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        position: { type: 'number', description: 'Row index to insert before (1-based, optional)' },
      },
      required: ['reason', 'table_index'],
    },
  },
};

async function executeWordAddTableRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_table_row', args);
  try {
    const response = await wordClient.wordAddTableRow(
      args['table_index'] as number,
      args['position'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_add_table_row', args, { total_rows: response['total_rows'] }, Date.now() - startTime);
      return { success: true, result: `${response.message}. Total rows: ${response['total_rows']}` };
    }
    logger.toolError('word_add_table_row', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add table row' };
  } catch (error) {
    logger.toolError('word_add_table_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add table row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTableRowTool: LLMSimpleTool = {
  definition: WORD_ADD_TABLE_ROW_DEFINITION,
  execute: executeWordAddTableRow,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word table row',
};

// =============================================================================
// Word Add Table Column
// =============================================================================

const WORD_ADD_TABLE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_table_column',
    description: `Add a new column to a Word table.
If position is specified, the column is inserted before that column index.
If position is not specified, the column is added at the end.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a column' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        position: { type: 'number', description: 'Column index to insert before (1-based, optional)' },
      },
      required: ['reason', 'table_index'],
    },
  },
};

async function executeWordAddTableColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_table_column', args);
  try {
    const response = await wordClient.wordAddTableColumn(
      args['table_index'] as number,
      args['position'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_add_table_column', args, { total_columns: response['total_columns'] }, Date.now() - startTime);
      return { success: true, result: `${response.message}. Total columns: ${response['total_columns']}` };
    }
    logger.toolError('word_add_table_column', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add table column' };
  } catch (error) {
    logger.toolError('word_add_table_column', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add table column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTableColumnTool: LLMSimpleTool = {
  definition: WORD_ADD_TABLE_COLUMN_DEFINITION,
  execute: executeWordAddTableColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word table column',
};

// =============================================================================
// Word Delete Table Row
// =============================================================================

const WORD_DELETE_TABLE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_table_row',
    description: `Delete a row from a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this row' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        row_index: { type: 'number', description: 'Row index to delete (1-based)' },
      },
      required: ['reason', 'table_index', 'row_index'],
    },
  },
};

async function executeWordDeleteTableRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_table_row', args);
  try {
    const response = await wordClient.wordDeleteTableRow(
      args['table_index'] as number,
      args['row_index'] as number
    );
    if (response.success) {
      logger.toolSuccess('word_delete_table_row', args, { remaining_rows: response['remaining_rows'] }, Date.now() - startTime);
      return { success: true, result: `${response.message}. Remaining rows: ${response['remaining_rows']}` };
    }
    logger.toolError('word_delete_table_row', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete table row' };
  } catch (error) {
    logger.toolError('word_delete_table_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete table row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteTableRowTool: LLMSimpleTool = {
  definition: WORD_DELETE_TABLE_ROW_DEFINITION,
  execute: executeWordDeleteTableRow,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word table row',
};

// =============================================================================
// Word Delete Table Column
// =============================================================================

const WORD_DELETE_TABLE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_table_column',
    description: `Delete a column from a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this column' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        col_index: { type: 'number', description: 'Column index to delete (1-based)' },
      },
      required: ['reason', 'table_index', 'col_index'],
    },
  },
};

async function executeWordDeleteTableColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_delete_table_column', args);
  try {
    const response = await wordClient.wordDeleteTableColumn(
      args['table_index'] as number,
      args['col_index'] as number
    );
    if (response.success) {
      logger.toolSuccess('word_delete_table_column', args, { remaining_columns: response['remaining_columns'] }, Date.now() - startTime);
      return { success: true, result: `${response.message}. Remaining columns: ${response['remaining_columns']}` };
    }
    logger.toolError('word_delete_table_column', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete table column' };
  } catch (error) {
    logger.toolError('word_delete_table_column', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete table column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteTableColumnTool: LLMSimpleTool = {
  definition: WORD_DELETE_TABLE_COLUMN_DEFINITION,
  execute: executeWordDeleteTableColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word table column',
};

// =============================================================================
// Word Get Table Info
// =============================================================================

const WORD_GET_TABLE_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_table_info',
    description: `Get information about a specific table in the document.
Returns: rows count, columns count, and style.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need table info' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
      },
      required: ['reason', 'table_index'],
    },
  },
};

async function executeWordGetTableInfo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_get_table_info', args);
  try {
    const response = await wordClient.wordGetTableInfo(args['table_index'] as number);
    if (response.success) {
      logger.toolSuccess('word_get_table_info', args, { rows: response['rows'], columns: response['columns'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Table ${response['table_index']} Info:
- Rows: ${response['rows']}
- Columns: ${response['columns']}
- Style: ${response['style'] || 'Default'}`,
      };
    }
    logger.toolError('word_get_table_info', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get table info' };
  } catch (error) {
    logger.toolError('word_get_table_info', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get table info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetTableInfoTool: LLMSimpleTool = {
  definition: WORD_GET_TABLE_INFO_DEFINITION,
  execute: executeWordGetTableInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word table info',
};

// =============================================================================
// Export All Advanced Table Tools
// =============================================================================

export const tablesAdvancedTools: LLMSimpleTool[] = [
  wordAddTableRowTool,
  wordAddTableColumnTool,
  wordDeleteTableRowTool,
  wordDeleteTableColumnTool,
  wordGetTableInfoTool,
];
