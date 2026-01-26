/**
 * Excel Export Tools
 *
 * Tools for exporting Excel to PDF and printing
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Export to PDF
// =============================================================================

const EXCEL_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_export_pdf',
    description: `Export workbook or sheet to PDF. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        path: { type: 'string', description: 'Output PDF file path' },
        sheet: { type: 'string', description: 'Sheet name (optional, exports entire workbook if not specified)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeExcelExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_export_pdf', args);
  try {
    const response = await excelClient.excelExportPDF(
      args['path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_export_pdf', args, { path: response['path'] || args['path'] }, Date.now() - startTime);
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    logger.toolError('excel_export_pdf', args, new Error(response.error || 'Failed to export to PDF'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    logger.toolError('excel_export_pdf', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelExportPDFTool: LLMSimpleTool = {
  definition: EXCEL_EXPORT_PDF_DEFINITION,
  execute: executeExcelExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export Excel to PDF',
};

// =============================================================================
// Excel Print
// =============================================================================

const EXCEL_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_print',
    description: `Print workbook or sheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are printing' },
        copies: { type: 'number', description: 'Number of copies (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional, prints entire workbook if not specified)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelPrint(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_print', args);
  try {
    const response = await excelClient.excelPrint(
      args['copies'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_print', args, { copies: args['copies'] ?? 1 }, Date.now() - startTime);
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    logger.toolError('excel_print', args, new Error(response.error || 'Failed to print'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    logger.toolError('excel_print', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to print: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPrintTool: LLMSimpleTool = {
  definition: EXCEL_PRINT_DEFINITION,
  execute: executeExcelPrint,
  categories: OFFICE_CATEGORIES,
  description: 'Print Excel',
};

// =============================================================================
// Export All Export Tools
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  excelExportPDFTool,
  excelPrintTool,
];
