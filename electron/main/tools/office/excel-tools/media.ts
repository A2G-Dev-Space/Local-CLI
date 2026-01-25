/**
 * Excel Media Tools
 *
 * Tools for adding images and hyperlinks to Excel worksheets
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Add Image
// =============================================================================

const EXCEL_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_image',
    description: `Add an image to the worksheet. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding image' },
        image_path: { type: 'string', description: 'Image file path' },
        cell: { type: 'string', description: 'Cell to position image (e.g., "A1")' },
        width: { type: 'number', description: 'Image width (optional)' },
        height: { type: 'number', description: 'Image height (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'image_path', 'cell'],
    },
  },
};

async function executeExcelAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_add_image', args);
  try {
    const response = await excelClient.excelAddImage(
      args['image_path'] as string,
      args['cell'] as string,
      {
        width: args['width'] as number | undefined,
        height: args['height'] as number | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('excel_add_image', args, { cell: args['cell'], imagePath: args['image_path'] }, Date.now() - startTime);
      return { success: true, result: `Image added at ${args['cell']}` };
    }
    logger.toolError('excel_add_image', args, new Error(response.error || 'Failed to add image'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    logger.toolError('excel_add_image', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddImageTool: LLMSimpleTool = {
  definition: EXCEL_ADD_IMAGE_DEFINITION,
  execute: executeExcelAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel image',
};

// =============================================================================
// Excel Add Hyperlink
// =============================================================================

const EXCEL_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_hyperlink',
    description: `Add a hyperlink to a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding hyperlink' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        url: { type: 'string', description: 'URL to link to' },
        display_text: { type: 'string', description: 'Display text (optional, defaults to URL)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'url'],
    },
  },
};

async function executeExcelAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_add_hyperlink', args);
  try {
    const response = await excelClient.excelAddHyperlink(
      args['cell'] as string,
      args['url'] as string,
      args['display_text'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_add_hyperlink', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: `Hyperlink added to ${args['cell']}` };
    }
    logger.toolError('excel_add_hyperlink', args, new Error(response.error || 'Failed to add hyperlink'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    logger.toolError('excel_add_hyperlink', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddHyperlinkTool: LLMSimpleTool = {
  definition: EXCEL_ADD_HYPERLINK_DEFINITION,
  execute: executeExcelAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel hyperlink',
};

// =============================================================================
// Export all media tools
// =============================================================================

export const mediaTools: LLMSimpleTool[] = [
  excelAddImageTool,
  excelAddHyperlinkTool,
];
