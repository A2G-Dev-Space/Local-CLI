/**
 * Excel Media Tools
 *
 * Tools for adding images and hyperlinks to Excel worksheets
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
      return { success: true, result: `Image added at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelAddHyperlink(
      args['cell'] as string,
      args['url'] as string,
      args['display_text'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Hyperlink added to ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
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
// Excel Remove Image
// =============================================================================

const EXCEL_REMOVE_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_remove_image',
    description: `Remove an image from the worksheet by its name.
Use excel_get_images first to get image names.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing image' },
        image_name: { type: 'string', description: 'Image name (from excel_get_images)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'image_name'],
    },
  },
};

async function executeExcelRemoveImage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelRemoveImage(
      args['image_name'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Image '${args['image_name']}' removed` };
    }
    return { success: false, error: response.error || 'Failed to remove image' };
  } catch (error) {
    return { success: false, error: `Failed to remove image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRemoveImageTool: LLMSimpleTool = {
  definition: EXCEL_REMOVE_IMAGE_DEFINITION,
  execute: executeExcelRemoveImage,
  categories: OFFICE_CATEGORIES,
  description: 'Remove Excel image',
};

// =============================================================================
// Excel Get Images
// =============================================================================

const EXCEL_GET_IMAGES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_images',
    description: `Get all images in the worksheet. Returns image names, positions, and sizes.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need image list' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetImages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetImages(
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get images' };
  } catch (error) {
    return { success: false, error: `Failed to get images: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetImagesTool: LLMSimpleTool = {
  definition: EXCEL_GET_IMAGES_DEFINITION,
  execute: executeExcelGetImages,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel images list',
};

// =============================================================================
// Excel Get Hyperlinks
// =============================================================================

const EXCEL_GET_HYPERLINKS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_hyperlinks',
    description: `Get all hyperlinks in the worksheet. Returns cell address, URL, display text, and screen tip for each.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need hyperlink list' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetHyperlinks(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetHyperlinks(
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get hyperlinks' };
  } catch (error) {
    return { success: false, error: `Failed to get hyperlinks: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetHyperlinksTool: LLMSimpleTool = {
  definition: EXCEL_GET_HYPERLINKS_DEFINITION,
  execute: executeExcelGetHyperlinks,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel hyperlinks list',
};

// =============================================================================
// Excel Delete Hyperlink
// =============================================================================

const EXCEL_DELETE_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_hyperlink',
    description: `Delete a hyperlink from a cell. The cell content remains but hyperlink is removed.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting hyperlink' },
        cell: { type: 'string', description: 'Cell address containing hyperlink (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelDeleteHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeleteHyperlink(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Hyperlink deleted from ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to delete hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed to delete hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteHyperlinkTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_HYPERLINK_DEFINITION,
  execute: executeExcelDeleteHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel hyperlink',
};

// =============================================================================
// Excel Edit Hyperlink
// =============================================================================

const EXCEL_EDIT_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_edit_hyperlink',
    description: `Edit an existing hyperlink's URL or display text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are editing hyperlink' },
        cell: { type: 'string', description: 'Cell address containing hyperlink (e.g., "A1")' },
        url: { type: 'string', description: 'New URL (optional)' },
        display_text: { type: 'string', description: 'New display text (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelEditHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelEditHyperlink(
      args['cell'] as string,
      args['url'] as string | undefined,
      args['display_text'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Hyperlink updated in ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to edit hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed to edit hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelEditHyperlinkTool: LLMSimpleTool = {
  definition: EXCEL_EDIT_HYPERLINK_DEFINITION,
  execute: executeExcelEditHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Edit Excel hyperlink',
};

// =============================================================================
// Export all media tools
// =============================================================================

export const mediaTools: LLMSimpleTool[] = [
  excelAddImageTool,
  excelAddHyperlinkTool,
  excelRemoveImageTool,
  excelGetImagesTool,
  excelGetHyperlinksTool,
  excelDeleteHyperlinkTool,
  excelEditHyperlinkTool,
];
