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
      (args['copies'] ?? 1) as number,
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
// Excel Export to CSV
// =============================================================================

const EXCEL_EXPORT_CSV_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_export_csv',
    description: `Export the current sheet to CSV file. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to CSV' },
        path: { type: 'string', description: 'Output CSV file path' },
        sheet: { type: 'string', description: 'Sheet name (optional, exports active sheet if not specified)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeExcelExportCSV(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_export_csv', args);
  try {
    const response = await excelClient.excelExportCsv(
      args['path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_export_csv', args, { path: response['path'] || args['path'] }, Date.now() - startTime);
      return { success: true, result: `Exported to CSV: ${response['path'] || args['path']}` };
    }
    logger.toolError('excel_export_csv', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to export to CSV' };
  } catch (error) {
    logger.toolError('excel_export_csv', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to export to CSV: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelExportCSVTool: LLMSimpleTool = {
  definition: EXCEL_EXPORT_CSV_DEFINITION,
  execute: executeExcelExportCSV,
  categories: OFFICE_CATEGORIES,
  description: 'Export Excel to CSV',
};

// =============================================================================
// Excel Export to JSON
// =============================================================================

const EXCEL_EXPORT_JSON_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_export_json',
    description: `Export a range to JSON file. First row is treated as headers for object keys.
Each subsequent row becomes a JSON object in the array.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to JSON' },
        range: { type: 'string', description: 'Data range including headers (e.g., "A1:D10")' },
        path: { type: 'string', description: 'Output JSON file path' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'path'],
    },
  },
};

async function executeExcelExportJSON(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_export_json', args);
  try {
    const response = await excelClient.excelExportJson(
      args['range'] as string,
      args['path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_export_json', args, { path: response['path'], rows: response['rows'] }, Date.now() - startTime);
      return { success: true, result: `Exported ${response['rows'] || 'data'} rows to JSON: ${response['path'] || args['path']}` };
    }
    logger.toolError('excel_export_json', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to export to JSON' };
  } catch (error) {
    logger.toolError('excel_export_json', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to export to JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelExportJSONTool: LLMSimpleTool = {
  definition: EXCEL_EXPORT_JSON_DEFINITION,
  execute: executeExcelExportJSON,
  categories: OFFICE_CATEGORIES,
  description: 'Export Excel range to JSON',
};

// =============================================================================
// Excel Import CSV
// =============================================================================

const EXCEL_IMPORT_CSV_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_import_csv',
    description: `Import CSV file into the worksheet. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are importing CSV' },
        path: { type: 'string', description: 'CSV file path to import' },
        dest_cell: { type: 'string', description: 'Destination cell (e.g., "A1")' },
        delimiter: { type: 'string', description: 'Delimiter character: comma (default), tab, semicolon, space' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'path', 'dest_cell'],
    },
  },
};

async function executeExcelImportCSV(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_import_csv', args);
  try {
    const delimiterMap: Record<string, string> = {
      'comma': ',',
      'tab': String.fromCharCode(9),
      'semicolon': ';',
      'space': ' ',
    };
    const delimiter = delimiterMap[args['delimiter'] as string] || (args['delimiter'] as string) || ',';

    const response = await excelClient.excelImportCsv(
      args['path'] as string,
      args['dest_cell'] as string,
      delimiter,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_import_csv', args, { dest_cell: args['dest_cell'], source: response['source'] }, Date.now() - startTime);
      return { success: true, result: `CSV imported to ${args['dest_cell']} from: ${response['source'] || args['path']}` };
    }
    logger.toolError('excel_import_csv', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to import CSV' };
  } catch (error) {
    logger.toolError('excel_import_csv', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to import CSV: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelImportCSVTool: LLMSimpleTool = {
  definition: EXCEL_IMPORT_CSV_DEFINITION,
  execute: executeExcelImportCSV,
  categories: OFFICE_CATEGORIES,
  description: 'Import CSV into Excel',
};

// =============================================================================
// Export All Export Tools
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  excelExportPDFTool,
  excelPrintTool,
  excelExportCSVTool,
  excelExportJSONTool,
  excelImportCSVTool,
];
