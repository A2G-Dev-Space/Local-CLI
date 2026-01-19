/**
 * Word Export Tools
 *
 * Export-related tools for Microsoft Word (PDF export, Print)
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { wordClient } from '../word-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
  try {
    const response = await wordClient.wordExportToPDF(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordExportPDFTool: LLMSimpleTool = {
  definition: WORD_EXPORT_PDF_DEFINITION,
  execute: executeWordExportPDF,
  categories: OFFICE_CATEGORIES as ToolCategory[],
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
  try {
    const response = await wordClient.wordPrint(args['copies'] as number ?? 1);
    if (response.success) {
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    return { success: false, error: `Failed to print: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordPrintTool: LLMSimpleTool = {
  definition: WORD_PRINT_DEFINITION,
  execute: executeWordPrint,
  categories: OFFICE_CATEGORIES as ToolCategory[],
  description: 'Print Word document',
};

// =============================================================================
// Export Tools Array
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  wordExportPDFTool,
  wordPrintTool,
];
