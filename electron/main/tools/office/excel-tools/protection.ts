/**
 * Excel Protection Tools
 *
 * Tools for protecting and unprotecting Excel worksheets
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Protect Sheet
// =============================================================================

const EXCEL_PROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_protect_sheet',
    description: `Protect a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are protecting sheet' },
        password: { type: 'string', description: 'Protection password (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional, protects active sheet)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelProtectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_protect_sheet', args);
  try {
    const response = await excelClient.excelProtectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_protect_sheet', args, { sheet: args['sheet'] }, Date.now() - startTime);
      return { success: true, result: 'Sheet protected' };
    }
    logger.toolError('excel_protect_sheet', args, new Error(response.error || 'Failed to protect sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to protect sheet' };
  } catch (error) {
    logger.toolError('excel_protect_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to protect sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelProtectSheetTool: LLMSimpleTool = {
  definition: EXCEL_PROTECT_SHEET_DEFINITION,
  execute: executeExcelProtectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Protect Excel sheet',
};

// =============================================================================
// Excel Unprotect Sheet
// =============================================================================

const EXCEL_UNPROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_unprotect_sheet',
    description: `Unprotect a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are unprotecting sheet' },
        password: { type: 'string', description: 'Protection password (if protected)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelUnprotectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_unprotect_sheet', args);
  try {
    const response = await excelClient.excelUnprotectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_unprotect_sheet', args, { sheet: args['sheet'] }, Date.now() - startTime);
      return { success: true, result: 'Sheet unprotected' };
    }
    logger.toolError('excel_unprotect_sheet', args, new Error(response.error || 'Failed to unprotect sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to unprotect sheet' };
  } catch (error) {
    logger.toolError('excel_unprotect_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to unprotect sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUnprotectSheetTool: LLMSimpleTool = {
  definition: EXCEL_UNPROTECT_SHEET_DEFINITION,
  execute: executeExcelUnprotectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Unprotect Excel sheet',
};

// =============================================================================
// Export
// =============================================================================

export const protectionTools: LLMSimpleTool[] = [
  excelProtectSheetTool,
  excelUnprotectSheetTool,
];
