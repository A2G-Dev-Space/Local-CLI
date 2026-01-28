/**
 * Excel Table (ListObject) Tools
 *
 * Tools for creating and managing Excel Tables.
 * Tools: create_table, delete_table, get_tables, add_table_column
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

// =============================================================================
// Excel Create Table
// =============================================================================

const EXCEL_CREATE_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create_table',
    description: `Create an Excel Table (ListObject) from a data range.
Tables enable structured references, auto-filtering, and automatic formatting.
The range should include headers in the first row.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating this table' },
        range: { type: 'string', description: 'Data range including headers (e.g., "A1:D10")' },
        table_name: { type: 'string', description: 'Name for the table (e.g., "SalesData")' },
        has_headers: { type: 'boolean', description: 'True if first row contains headers (default: true)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'table_name'],
    },
  },
};

async function executeExcelCreateTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCreateTable(
      args['range'] as string,
      args['table_name'] as string,
      args['has_headers'] !== false,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Table '${args['table_name']}' created` };
    }
    return { success: false, error: response.error || 'Failed to create table' };
  } catch (error) {
    return { success: false, error: `Failed to create table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreateTableTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_TABLE_DEFINITION,
  execute: executeExcelCreateTable,
  categories: OFFICE_CATEGORIES,
  description: 'Create Excel Table from range',
};

// =============================================================================
// Excel Delete Table
// =============================================================================

const EXCEL_DELETE_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_table',
    description: `Delete an Excel Table by name. The data remains but table formatting and features are removed.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this table' },
        table_name: { type: 'string', description: 'Name of the table to delete' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'table_name'],
    },
  },
};

async function executeExcelDeleteTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeleteTable(
      args['table_name'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Table '${args['table_name']}' deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete table' };
  } catch (error) {
    return { success: false, error: `Failed to delete table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteTableTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_TABLE_DEFINITION,
  execute: executeExcelDeleteTable,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel Table',
};

// =============================================================================
// Excel Get Tables
// =============================================================================

const EXCEL_GET_TABLES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_tables',
    description: `Get all Excel Tables in the sheet. Returns table names, ranges, row/column counts, and styles.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are listing tables' },
        sheet: { type: 'string', description: 'Sheet name (optional, default: active sheet)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetTables(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetTables(args['sheet'] as string | undefined);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get tables' };
  } catch (error) {
    return { success: false, error: `Failed to get tables: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetTablesTool: LLMSimpleTool = {
  definition: EXCEL_GET_TABLES_DEFINITION,
  execute: executeExcelGetTables,
  categories: OFFICE_CATEGORIES,
  description: 'Get all Excel Tables in sheet',
};

// =============================================================================
// Excel Add Table Column
// =============================================================================

const EXCEL_ADD_TABLE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_table_column',
    description: `Add a new column to an existing Excel Table.
Can include a calculated formula using structured references like [@Column1].`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding this column' },
        table_name: { type: 'string', description: 'Name of the table' },
        column_name: { type: 'string', description: 'Name for the new column' },
        formula: { type: 'string', description: 'Formula for calculated column (e.g., "=[@Price]*[@Quantity]")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'table_name', 'column_name'],
    },
  },
};

async function executeExcelAddTableColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAddTableColumn(
      args['table_name'] as string,
      args['column_name'] as string,
      args['formula'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Column '${args['column_name']}' added` };
    }
    return { success: false, error: response.error || 'Failed to add table column' };
  } catch (error) {
    return { success: false, error: `Failed to add table column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddTableColumnTool: LLMSimpleTool = {
  definition: EXCEL_ADD_TABLE_COLUMN_DEFINITION,
  execute: executeExcelAddTableColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Add column to Excel Table',
};

// =============================================================================
// Export all table tools
// =============================================================================

export const tablesTools: LLMSimpleTool[] = [
  excelCreateTableTool,
  excelDeleteTableTool,
  excelGetTablesTool,
  excelAddTableColumnTool,
];
