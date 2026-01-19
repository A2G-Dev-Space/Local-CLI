/**
 * Excel Named Ranges Tools
 *
 * Named range management tools for Excel.
 * Tools: createNamedRange, getNamedRanges, deleteNamedRange
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

// =============================================================================
// Excel Create Named Range
// =============================================================================

const EXCEL_CREATE_NAMED_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create_named_range',
    description: `Create a named range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating named range' },
        name: { type: 'string', description: 'Name for the range' },
        range: { type: 'string', description: 'Range address (e.g., "A1:B10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'name', 'range'],
    },
  },
};

async function executeExcelCreateNamedRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCreateNamedRange(
      args['name'] as string,
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Named range "${args['name']}" created` };
    }
    return { success: false, error: response.error || 'Failed to create named range' };
  } catch (error) {
    return { success: false, error: `Failed to create named range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreateNamedRangeTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_NAMED_RANGE_DEFINITION,
  execute: executeExcelCreateNamedRange,
  categories: OFFICE_CATEGORIES,
  description: 'Create Excel named range',
};

// =============================================================================
// Excel Get Named Ranges
// =============================================================================

const EXCEL_GET_NAMED_RANGES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_named_ranges',
    description: `Get all named ranges in the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need named ranges' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetNamedRanges(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetNamedRanges();
    if (response.success) {
      const ranges = response['named_ranges'] as Array<{ name: string; refersTo: string }> || [];
      if (ranges.length === 0) {
        return { success: true, result: 'No named ranges found' };
      }
      const list = ranges.map(r => `- ${r.name}: ${r.refersTo}`).join('\n');
      return { success: true, result: `Named ranges:\n${list}` };
    }
    return { success: false, error: response.error || 'Failed to get named ranges' };
  } catch (error) {
    return { success: false, error: `Failed to get named ranges: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetNamedRangesTool: LLMSimpleTool = {
  definition: EXCEL_GET_NAMED_RANGES_DEFINITION,
  execute: executeExcelGetNamedRanges,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel named ranges',
};

// =============================================================================
// Excel Delete Named Range
// =============================================================================

const EXCEL_DELETE_NAMED_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_named_range',
    description: `Delete a named range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting named range' },
        name: { type: 'string', description: 'Name of the range to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteNamedRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeleteNamedRange(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Named range "${args['name']}" deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete named range' };
  } catch (error) {
    return { success: false, error: `Failed to delete named range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteNamedRangeTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_NAMED_RANGE_DEFINITION,
  execute: executeExcelDeleteNamedRange,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel named range',
};

// =============================================================================
// Export: Named Ranges Tools Array
// =============================================================================

export const namedRangesTools: LLMSimpleTool[] = [
  excelCreateNamedRangeTool,
  excelGetNamedRangesTool,
  excelDeleteNamedRangeTool,
];
