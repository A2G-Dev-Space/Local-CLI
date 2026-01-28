/**
 * Excel Pivot Table Tools
 *
 * Pivot table management tools for Excel.
 * Tools: createPivotTable, addPivotField, refreshPivotTable
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

// =============================================================================
// Excel Create Pivot Table
// =============================================================================

const EXCEL_CREATE_PIVOT_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create_pivot_table',
    description: `Create a pivot table from a data range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a pivot table' },
        source_range: { type: 'string', description: 'Source data range including headers (e.g., "A1:D100")' },
        dest_cell: { type: 'string', description: 'Destination cell for the pivot table (e.g., "F1")' },
        table_name: { type: 'string', description: 'Name for the pivot table (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'source_range', 'dest_cell'],
    },
  },
};

async function executeExcelCreatePivotTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCreatePivotTable(
      args['source_range'] as string,
      args['dest_cell'] as string,
      args['table_name'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Pivot table created: ${response['table_name']}` };
    }
    return { success: false, error: response.error || 'Failed to create pivot table' };
  } catch (error) {
    return { success: false, error: `Failed to create pivot table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreatePivotTableTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_PIVOT_TABLE_DEFINITION,
  execute: executeExcelCreatePivotTable,
  categories: OFFICE_CATEGORIES,
  description: 'Create Excel pivot table',
};

// =============================================================================
// Excel Add Pivot Field
// =============================================================================

const EXCEL_ADD_PIVOT_FIELD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_pivot_field',
    description: `Add a field to a pivot table (as row, column, data value, or filter).
IMPORTANT: field_name must exactly match the column header in source data (case-sensitive).
aggregate_function only applies when orientation is 'data'.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding this field' },
        table_name: { type: 'string', description: 'Name of the pivot table' },
        field_name: { type: 'string', description: 'Name of the field (must exactly match column header from source data)' },
        orientation: { type: 'string', enum: ['row', 'column', 'data', 'page'], description: 'Field orientation: row (rows area), column (columns area), data (values area), page (filter area)' },
        aggregate_function: { type: 'string', enum: ['sum', 'count', 'average', 'max', 'min'], description: 'Aggregate function (only for data orientation, default: sum)' },
      },
      required: ['reason', 'table_name', 'field_name', 'orientation'],
    },
  },
};

async function executeExcelAddPivotField(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAddPivotField(
      args['table_name'] as string,
      args['field_name'] as string,
      args['orientation'] as 'row' | 'column' | 'data' | 'page',
      args['aggregate_function'] as 'sum' | 'count' | 'average' | 'max' | 'min' | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Field '${args['field_name']}' added as ${args['orientation']}` };
    }
    return { success: false, error: response.error || 'Failed to add pivot field' };
  } catch (error) {
    return { success: false, error: `Failed to add pivot field: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddPivotFieldTool: LLMSimpleTool = {
  definition: EXCEL_ADD_PIVOT_FIELD_DEFINITION,
  execute: executeExcelAddPivotField,
  categories: OFFICE_CATEGORIES,
  description: 'Add field to Excel pivot table',
};

// =============================================================================
// Excel Refresh Pivot Table
// =============================================================================

const EXCEL_REFRESH_PIVOT_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_refresh_pivot_table',
    description: `Refresh a pivot table to update with latest source data.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are refreshing the pivot table' },
        table_name: { type: 'string', description: 'Name of the pivot table to refresh' },
      },
      required: ['reason', 'table_name'],
    },
  },
};

async function executeExcelRefreshPivotTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelRefreshPivotTable(args['table_name'] as string);
    if (response.success) {
      return { success: true, result: response.message || `Pivot table '${args['table_name']}' refreshed` };
    }
    return { success: false, error: response.error || 'Failed to refresh pivot table' };
  } catch (error) {
    return { success: false, error: `Failed to refresh pivot table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRefreshPivotTableTool: LLMSimpleTool = {
  definition: EXCEL_REFRESH_PIVOT_TABLE_DEFINITION,
  execute: executeExcelRefreshPivotTable,
  categories: OFFICE_CATEGORIES,
  description: 'Refresh Excel pivot table',
};

// =============================================================================
// Excel Delete Pivot Field
// =============================================================================

const EXCEL_DELETE_PIVOT_FIELD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_pivot_field',
    description: `Remove a field from a pivot table. The field is hidden from the pivot table but remains available for re-adding.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing this field' },
        table_name: { type: 'string', description: 'Name of the pivot table' },
        field_name: { type: 'string', description: 'Name of the field to remove' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'table_name', 'field_name'],
    },
  },
};

async function executeExcelDeletePivotField(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeletePivotField(
      args['table_name'] as string,
      args['field_name'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Field '${args['field_name']}' removed from pivot table '${args['table_name']}'` };
    }
    return { success: false, error: response.error || 'Failed to delete pivot field' };
  } catch (error) {
    return { success: false, error: `Failed to delete pivot field: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeletePivotFieldTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_PIVOT_FIELD_DEFINITION,
  execute: executeExcelDeletePivotField,
  categories: OFFICE_CATEGORIES,
  description: 'Remove field from Excel pivot table',
};

// =============================================================================
// Export: Pivot Table Tools Array
// =============================================================================

export const pivotTableTools: LLMSimpleTool[] = [
  excelCreatePivotTableTool,
  excelAddPivotFieldTool,
  excelRefreshPivotTableTool,
  excelDeletePivotFieldTool,
];
