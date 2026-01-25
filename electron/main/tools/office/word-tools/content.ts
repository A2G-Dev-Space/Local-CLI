/**
 * Word Content Tools
 *
 * Tools for adding content elements to Word documents:
 * - Images
 * - Hyperlinks
 * - Textboxes
 * - Shapes
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Add Image
// =============================================================================

const WORD_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_image',
    description: `Add an image to the Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        path: { type: 'string', description: 'Image file path. Can use Linux/WSL paths or Windows paths.' },
        width: { type: 'number', description: 'Image width in points (optional)' },
        height: { type: 'number', description: 'Image height in points (optional)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_image', args);
  try {
    const response = await wordClient.wordAddImage(
      args['path'] as string,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('word_add_image', args, { added: true }, Date.now() - startTime);
      return { success: true, result: 'Image added' };
    }
    logger.toolError('word_add_image', args, new Error(response.error || 'Failed to add image'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    logger.toolError('word_add_image', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddImageTool: LLMSimpleTool = {
  definition: WORD_ADD_IMAGE_DEFINITION,
  execute: executeWordAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word image',
};

// =============================================================================
// Word Add Hyperlink
// =============================================================================

const WORD_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_hyperlink',
    description: `Add a hyperlink to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a hyperlink' },
        text: { type: 'string', description: 'Display text' },
        url: { type: 'string', description: 'URL to link to' },
      },
      required: ['reason', 'text', 'url'],
    },
  },
};

async function executeWordAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_hyperlink', args);
  try {
    const response = await wordClient.wordAddHyperlink(
      args['text'] as string,
      args['url'] as string
    );
    if (response.success) {
      logger.toolSuccess('word_add_hyperlink', args, { text: args['text'] }, Date.now() - startTime);
      return { success: true, result: `Hyperlink added: ${args['text']}` };
    }
    logger.toolError('word_add_hyperlink', args, new Error(response.error || 'Failed to add hyperlink'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    logger.toolError('word_add_hyperlink', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddHyperlinkTool: LLMSimpleTool = {
  definition: WORD_ADD_HYPERLINK_DEFINITION,
  execute: executeWordAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word hyperlink',
};

// =============================================================================
// Word Add Textbox
// =============================================================================

const WORD_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_textbox',
    description: `Add a textbox to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding textbox' },
        text: { type: 'string', description: 'Textbox content' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        border_color: { type: 'string', description: 'Border color as hex' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
      },
      required: ['reason', 'text', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_textbox', args);
  try {
    const response = await wordClient.wordAddTextbox(
      args['text'] as string,
      args['left'] as number,
      args['top'] as number,
      args['width'] as number,
      args['height'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        borderColor: args['border_color'] as string | undefined,
        fillColor: args['fill_color'] as string | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('word_add_textbox', args, { shape_name: response['shape_name'] }, Date.now() - startTime);
      return { success: true, result: `Textbox added: ${response['shape_name']}` };
    }
    logger.toolError('word_add_textbox', args, new Error(response.error || 'Failed to add textbox'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    logger.toolError('word_add_textbox', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTextboxTool: LLMSimpleTool = {
  definition: WORD_ADD_TEXTBOX_DEFINITION,
  execute: executeWordAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word textbox',
};

// =============================================================================
// Word Add Shape
// =============================================================================

const WORD_ADD_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_shape',
    description: `Add a shape to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding shape' },
        shape_type: { type: 'string', enum: ['rectangle', 'oval', 'roundedRectangle', 'triangle', 'diamond', 'arrow', 'line'], description: 'Shape type' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
        line_color: { type: 'string', description: 'Line color as hex' },
        line_weight: { type: 'number', description: 'Line weight in points' },
      },
      required: ['reason', 'shape_type', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_add_shape', args);
  try {
    const response = await wordClient.wordAddShape(
      args['shape_type'] as 'rectangle' | 'oval' | 'roundedRectangle' | 'triangle' | 'diamond' | 'arrow' | 'line',
      args['left'] as number,
      args['top'] as number,
      args['width'] as number,
      args['height'] as number,
      {
        fillColor: args['fill_color'] as string | undefined,
        lineColor: args['line_color'] as string | undefined,
        lineWeight: args['line_weight'] as number | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('word_add_shape', args, { shape_name: response['shape_name'] }, Date.now() - startTime);
      return { success: true, result: `Shape added: ${response['shape_name']}` };
    }
    logger.toolError('word_add_shape', args, new Error(response.error || 'Failed to add shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
    logger.toolError('word_add_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddShapeTool: LLMSimpleTool = {
  definition: WORD_ADD_SHAPE_DEFINITION,
  execute: executeWordAddShape,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word shape',
};

// =============================================================================
// Export Content Tools
// =============================================================================

export const contentTools: LLMSimpleTool[] = [
  wordAddImageTool,
  wordAddHyperlinkTool,
  wordAddTextboxTool,
  wordAddShapeTool,
];
