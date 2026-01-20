/**
 * Excel Export Tools
 *
 * Export operations: exportPDF, print
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Export to PDF
// =============================================================================

const EXCEL_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_export_pdf',
    description: `Export the workbook or sheet to PDF format.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        output_path: { type: 'string', description: 'Path for the PDF output file' },
        sheet: { type: 'string', description: 'Sheet name to export (optional, exports entire workbook if not specified)' },
      },
      required: ['reason', 'output_path'],
    },
  },
};

async function executeExcelExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelExportPDF(
      args['output_path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${args['output_path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelExportPDFTool: LLMSimpleTool = {
  definition: EXCEL_EXPORT_PDF_DEFINITION, execute: executeExcelExportPDF, categories: OFFICE_CATEGORIES, description: 'Export Excel to PDF',
};

// =============================================================================
// Excel Print
// =============================================================================

const EXCEL_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_print',
    description: `Print the workbook or sheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are printing' },
        copies: { type: 'number', description: 'Number of copies (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name to print (optional, prints entire workbook if not specified)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelPrint(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const copies = (args['copies'] as number) || 1;
    const response = await excelClient.excelPrint(
      copies,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Printing ${copies} copie(s)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPrintTool: LLMSimpleTool = {
  definition: EXCEL_PRINT_DEFINITION, execute: executeExcelPrint, categories: OFFICE_CATEGORIES, description: 'Print Excel workbook',
};

// =============================================================================
// Export Tools
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  excelExportPDFTool,
  excelPrintTool,
];
