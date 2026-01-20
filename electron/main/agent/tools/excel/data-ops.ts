/**
 * Excel Data Operations Tools
 *
 * Data operations: copyRange, pasteRange, clearRange, findReplace
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Copy Range
// =============================================================================

const EXCEL_COPY_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_copy_range',
    description: `Copy a range of cells to clipboard.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are copying this range' },
        range: { type: 'string', description: 'Range to copy (e.g., "A1:B10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelCopyRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCopyRange(
      args['range'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Range ${args['range']} copied` }; }
    return { success: false, error: response.error || 'Failed to copy range' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCopyRangeTool: LLMSimpleTool = {
  definition: EXCEL_COPY_RANGE_DEFINITION, execute: executeExcelCopyRange, categories: OFFICE_CATEGORIES, description: 'Copy range in Excel',
};

// =============================================================================
// Excel Paste Range
// =============================================================================

const EXCEL_PASTE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_paste_range',
    description: `Paste clipboard contents to a destination.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are pasting' },
        destination: { type: 'string', description: 'Destination cell (e.g., "C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'destination'],
    },
  },
};

async function executeExcelPasteRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelPasteRange(
      args['destination'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Pasted to ${args['destination']}` }; }
    return { success: false, error: response.error || 'Failed to paste' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPasteRangeTool: LLMSimpleTool = {
  definition: EXCEL_PASTE_RANGE_DEFINITION, execute: executeExcelPasteRange, categories: OFFICE_CATEGORIES, description: 'Paste in Excel',
};

// =============================================================================
// Excel Clear Range
// =============================================================================

const EXCEL_CLEAR_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_range',
    description: `Clear a range of cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing this range' },
        range: { type: 'string', description: 'Range to clear (e.g., "A1:B10")' },
        clear_type: {
          type: 'string',
          enum: ['all', 'contents', 'formats', 'comments'],
          description: 'What to clear (default: all)',
        },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const clearType = (args['clear_type'] as 'all' | 'contents' | 'formats' | 'comments') || 'all';
    const response = await excelClient.excelClearRange(
      args['range'] as string, clearType, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Range ${args['range']} cleared (${clearType})` }; }
    return { success: false, error: response.error || 'Failed to clear range' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearRangeTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_RANGE_DEFINITION, execute: executeExcelClearRange, categories: OFFICE_CATEGORIES, description: 'Clear range in Excel',
};

// =============================================================================
// Excel Find Replace
// =============================================================================

const EXCEL_FIND_REPLACE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_find_replace',
    description: `Find and replace text in cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are doing find/replace' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        match_case: { type: 'boolean', description: 'Match case (default: false)' },
        match_entire_cell: { type: 'boolean', description: 'Match entire cell contents (default: false)' },
        range: { type: 'string', description: 'Limit search to this range (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'find', 'replace'],
    },
  },
};

async function executeExcelFindReplace(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelFindReplace(
      args['find'] as string,
      args['replace'] as string,
      {
        matchCase: args['match_case'] as boolean | undefined,
        matchEntireCell: args['match_entire_cell'] as boolean | undefined,
        range: args['range'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Find and replace completed' }; }
    return { success: false, error: response.error || 'Failed to find/replace' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFindReplaceTool: LLMSimpleTool = {
  definition: EXCEL_FIND_REPLACE_DEFINITION, execute: executeExcelFindReplace, categories: OFFICE_CATEGORIES, description: 'Find and replace in Excel',
};

// =============================================================================
// Export Data Operations Tools
// =============================================================================

export const dataOpsTools: LLMSimpleTool[] = [
  excelCopyRangeTool,
  excelPasteRangeTool,
  excelClearRangeTool,
  excelFindReplaceTool,
];
