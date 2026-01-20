/**
 * Excel Protection Tools
 *
 * Protection operations: protectSheet, unprotectSheet
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Protect Sheet
// =============================================================================

const EXCEL_PROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_protect_sheet',
    description: `Protect a worksheet from editing.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are protecting the sheet' },
        password: { type: 'string', description: 'Protection password (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional, defaults to active sheet)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelProtectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelProtectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Sheet protected' }; }
    return { success: false, error: response.error || 'Failed to protect sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelProtectSheetTool: LLMSimpleTool = {
  definition: EXCEL_PROTECT_SHEET_DEFINITION, execute: executeExcelProtectSheet, categories: OFFICE_CATEGORIES, description: 'Protect sheet in Excel',
};

// =============================================================================
// Excel Unprotect Sheet
// =============================================================================

const EXCEL_UNPROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_unprotect_sheet',
    description: `Remove protection from a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are unprotecting the sheet' },
        password: { type: 'string', description: 'Protection password (if set)' },
        sheet: { type: 'string', description: 'Sheet name (optional, defaults to active sheet)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelUnprotectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelUnprotectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Sheet unprotected' }; }
    return { success: false, error: response.error || 'Failed to unprotect sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUnprotectSheetTool: LLMSimpleTool = {
  definition: EXCEL_UNPROTECT_SHEET_DEFINITION, execute: executeExcelUnprotectSheet, categories: OFFICE_CATEGORIES, description: 'Unprotect sheet in Excel',
};

// =============================================================================
// Export Protection Tools
// =============================================================================

export const protectionTools: LLMSimpleTool[] = [
  excelProtectSheetTool,
  excelUnprotectSheetTool,
];
