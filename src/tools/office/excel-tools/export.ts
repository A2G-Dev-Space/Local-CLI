/**
 * Excel Export Tools
 *
 * Tools for exporting Excel to PDF and printing
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
  try {
    const response = await excelClient.excelExportPDF(
      args['path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelPrint(
      args['copies'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
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
