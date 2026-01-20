/**
 * Word Export Tools
 *
 * Export operations: exportToPDF, print, getDocumentInfo
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Export to PDF
// =============================================================================

const WORD_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_export_pdf',
    description: `Export the active Word document to PDF format.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        output_path: { type: 'string', description: 'Path for the PDF output file' },
      },
      required: ['reason', 'output_path'],
    },
  },
};

async function executeWordExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordExportToPDF(args['output_path'] as string);
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${args['output_path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordExportPDFTool: LLMSimpleTool = {
  definition: WORD_EXPORT_PDF_DEFINITION,
  execute: executeWordExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export Word document to PDF',
};

// =============================================================================
// Word Print
// =============================================================================

const WORD_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_print',
    description: `Print the active Word document.`,
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
    const copies = (args['copies'] as number) || 1;
    const response = await wordClient.wordPrint(copies);
    if (response.success) {
      return { success: true, result: `Printing ${copies} copie(s)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
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
// Word Get Document Info
// =============================================================================

const WORD_GET_DOCUMENT_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_document_info',
    description: `Get information about the active Word document (page count, word count, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need document info' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetDocumentInfo(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordGetDocumentInfo();
    if (response.success) {
      return {
        success: true,
        result: JSON.stringify({
          name: response['name'],
          path: response['path'],
          pages: response['pages'],
          words: response['words'],
          characters: response['characters'],
          paragraphs: response['paragraphs'],
        }, null, 2),
      };
    }
    return { success: false, error: response.error || 'Failed to get document info' };
  } catch (error) {
    return { success: false, error: `Failed to get document info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetDocumentInfoTool: LLMSimpleTool = {
  definition: WORD_GET_DOCUMENT_INFO_DEFINITION,
  execute: executeWordGetDocumentInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word document information',
};

// =============================================================================
// Export Tools
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  wordExportPDFTool,
  wordPrintTool,
  wordGetDocumentInfoTool,
];
