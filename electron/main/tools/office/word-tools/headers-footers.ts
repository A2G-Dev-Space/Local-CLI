/**
 * Word Headers and Footers Tools
 *
 * Tools for inserting headers, footers, and page numbers in Word documents
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Insert Header
// =============================================================================

const WORD_INSERT_HEADER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_header',
    description: `Insert header text to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting header' },
        text: { type: 'string', description: 'Header text' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordInsertHeader(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_insert_header', args);
  try {
    const response = await wordClient.wordInsertHeader(
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('word_insert_header', args, { inserted: true }, Date.now() - startTime);
      return { success: true, result: 'Header inserted' };
    }
    logger.toolError('word_insert_header', args, new Error(response.error || 'Failed to insert header'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert header' };
  } catch (error) {
    logger.toolError('word_insert_header', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert header: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertHeaderTool: LLMSimpleTool = {
  definition: WORD_INSERT_HEADER_DEFINITION,
  execute: executeWordInsertHeader,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word header',
};

// =============================================================================
// Word Insert Footer
// =============================================================================

const WORD_INSERT_FOOTER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_footer',
    description: `Insert footer text to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting footer' },
        text: { type: 'string', description: 'Footer text' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordInsertFooter(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_insert_footer', args);
  try {
    const response = await wordClient.wordInsertFooter(
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('word_insert_footer', args, { inserted: true }, Date.now() - startTime);
      return { success: true, result: 'Footer inserted' };
    }
    logger.toolError('word_insert_footer', args, new Error(response.error || 'Failed to insert footer'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert footer' };
  } catch (error) {
    logger.toolError('word_insert_footer', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert footer: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertFooterTool: LLMSimpleTool = {
  definition: WORD_INSERT_FOOTER_DEFINITION,
  execute: executeWordInsertFooter,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word footer',
};

// =============================================================================
// Word Insert Page Number
// =============================================================================

const WORD_INSERT_PAGE_NUMBER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_page_number',
    description: `Insert page numbers to the document footer.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting page numbers' },
        alignment: { type: 'string', enum: ['left', 'center', 'right'], description: 'Page number alignment (default: center)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertPageNumber(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_insert_page_number', args);
  try {
    const response = await wordClient.wordInsertPageNumber(
      args['alignment'] as 'left' | 'center' | 'right' ?? 'center'
    );
    if (response.success) {
      logger.toolSuccess('word_insert_page_number', args, { inserted: true }, Date.now() - startTime);
      return { success: true, result: 'Page numbers inserted' };
    }
    logger.toolError('word_insert_page_number', args, new Error(response.error || 'Failed to insert page numbers'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert page numbers' };
  } catch (error) {
    logger.toolError('word_insert_page_number', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert page numbers: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertPageNumberTool: LLMSimpleTool = {
  definition: WORD_INSERT_PAGE_NUMBER_DEFINITION,
  execute: executeWordInsertPageNumber,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word page numbers',
};

// =============================================================================
// Export Headers-Footers Tools
// =============================================================================

export const headersFootersTools: LLMSimpleTool[] = [
  wordInsertHeaderTool,
  wordInsertFooterTool,
  wordInsertPageNumberTool,
];
