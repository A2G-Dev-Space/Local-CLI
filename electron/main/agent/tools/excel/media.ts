/**
 * Excel Media Tools
 *
 * Media operations: addImage, addHyperlink
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Add Image
// =============================================================================

const EXCEL_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_image',
    description: `Add an image to the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        image_path: { type: 'string', description: 'Path to the image file' },
        cell: { type: 'string', description: 'Cell to place the image at (e.g., "A1")' },
        width: { type: 'number', description: 'Image width in pixels (optional)' },
        height: { type: 'number', description: 'Image height in pixels (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'image_path', 'cell'],
    },
  },
};

async function executeExcelAddImage(args: Record<string, unknown>): Promise<ToolResult> {
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
    if (response.success) { return { success: true, result: `Image added at ${args['cell']}` }; }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddImageTool: LLMSimpleTool = {
  definition: EXCEL_ADD_IMAGE_DEFINITION, execute: executeExcelAddImage, categories: OFFICE_CATEGORIES, description: 'Add image in Excel',
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
        reason: { type: 'string', description: 'Why you are adding a hyperlink' },
        cell: { type: 'string', description: 'Cell to add hyperlink (e.g., "A1")' },
        url: { type: 'string', description: 'URL or address to link to' },
        display_text: { type: 'string', description: 'Text to display (optional, defaults to URL)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'url'],
    },
  },
};

async function executeExcelAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAddHyperlink(
      args['cell'] as string,
      args['url'] as string,
      args['display_text'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Hyperlink added to ${args['cell']}` }; }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddHyperlinkTool: LLMSimpleTool = {
  definition: EXCEL_ADD_HYPERLINK_DEFINITION, execute: executeExcelAddHyperlink, categories: OFFICE_CATEGORIES, description: 'Add hyperlink in Excel',
};

// =============================================================================
// Export Media Tools
// =============================================================================

export const mediaTools: LLMSimpleTool[] = [
  excelAddImageTool,
  excelAddHyperlinkTool,
];
