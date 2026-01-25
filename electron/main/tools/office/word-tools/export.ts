/**
 * Word Export Tools
 *
 * Export-related tools for Microsoft Word (PDF export, Print)
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Export to PDF
// =============================================================================

const WORD_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_export_pdf',
    description: `Export the document to PDF. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        path: { type: 'string', description: 'Output PDF file path. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_export_pdf', args);
  try {
    const response = await wordClient.wordExportToPDF(args['path'] as string);
    if (response.success) {
      logger.toolSuccess('word_export_pdf', args, { path: response['path'] || args['path'] }, Date.now() - startTime);
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    logger.toolError('word_export_pdf', args, new Error(response.error || 'Failed to export to PDF'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    logger.toolError('word_export_pdf', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordExportPDFTool: LLMSimpleTool = {
  definition: WORD_EXPORT_PDF_DEFINITION,
  execute: executeWordExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export Word to PDF',
};

// =============================================================================
// Word Print
// =============================================================================

const WORD_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_print',
    description: `Print the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are printing' },
        copies: { type: 'number', description: 'Number of copies (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordPrint(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_print', args);
  try {
    const response = await wordClient.wordPrint(args['copies'] as number ?? 1);
    if (response.success) {
      logger.toolSuccess('word_print', args, { copies: args['copies'] ?? 1 }, Date.now() - startTime);
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    logger.toolError('word_print', args, new Error(response.error || 'Failed to print'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    logger.toolError('word_print', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to print: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordPrintTool: LLMSimpleTool = {
  definition: WORD_PRINT_DEFINITION,
  execute: executeWordPrint,
  categories: OFFICE_CATEGORIES,
  description: 'Print Word document',
};

// =============================================================================
// Export Tools Array
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  wordExportPDFTool,
  wordPrintTool,
];
