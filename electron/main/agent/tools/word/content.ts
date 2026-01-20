/**
 * Word Content Tools
 *
 * Content operations: addImage, addHyperlink, findReplace, insertBreak, addTextbox, addShape
 * Total: 6 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Add Image
// =============================================================================

const WORD_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_image',
    description: `Insert an image into the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        path: { type: 'string', description: 'Path to the image file' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAddImage(
      args['path'] as string,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: 'Image inserted' };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddImageTool: LLMSimpleTool = {
  definition: WORD_ADD_IMAGE_DEFINITION,
  execute: executeWordAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add image to Word document',
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
        text: { type: 'string', description: 'Display text for the hyperlink' },
        url: { type: 'string', description: 'URL or file path for the hyperlink' },
      },
      required: ['reason', 'text', 'url'],
    },
  },
};

async function executeWordAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAddHyperlink(
      args['text'] as string,
      args['url'] as string
    );
    if (response.success) {
      return { success: true, result: 'Hyperlink added' };
    }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddHyperlinkTool: LLMSimpleTool = {
  definition: WORD_ADD_HYPERLINK_DEFINITION,
  execute: executeWordAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add hyperlink to Word document',
};

// =============================================================================
// Word Find Replace
// =============================================================================

const WORD_FIND_REPLACE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_find_replace',
    description: `Find and replace text in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are finding and replacing' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Text to replace with' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: true)' },
      },
      required: ['reason', 'find', 'replace'],
    },
  },
};

async function executeWordFindReplace(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordFindReplace(
      args['find'] as string,
      args['replace'] as string,
      args['replace_all'] !== false
    );
    if (response.success) {
      return { success: true, result: response.message || 'Find and replace completed' };
    }
    return { success: false, error: response.error || 'Failed to find and replace' };
  } catch (error) {
    return { success: false, error: `Failed to find and replace: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordFindReplaceTool: LLMSimpleTool = {
  definition: WORD_FIND_REPLACE_DEFINITION,
  execute: executeWordFindReplace,
  categories: OFFICE_CATEGORIES,
  description: 'Find and replace text in Word',
};

// =============================================================================
// Word Insert Break
// =============================================================================

const WORD_INSERT_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_break',
    description: `Insert a break (page, line, or section) into the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a break' },
        break_type: {
          type: 'string',
          enum: ['page', 'line', 'section'],
          description: 'Type of break to insert (default: page)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertBreak(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordInsertBreak(
      (args['break_type'] as 'page' | 'line' | 'section') || 'page'
    );
    if (response.success) {
      return { success: true, result: `${args['break_type'] || 'page'} break inserted` };
    }
    return { success: false, error: response.error || 'Failed to insert break' };
  } catch (error) {
    return { success: false, error: `Failed to insert break: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertBreakTool: LLMSimpleTool = {
  definition: WORD_INSERT_BREAK_DEFINITION,
  execute: executeWordInsertBreak,
  categories: OFFICE_CATEGORIES,
  description: 'Insert break in Word document',
};

// =============================================================================
// Word Add Textbox
// =============================================================================

const WORD_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_textbox',
    description: `Add a textbox to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a textbox' },
        text: { type: 'string', description: 'Text content for the textbox' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        fill_color: { type: 'string', description: 'Fill color as hex (optional)' },
        border_color: { type: 'string', description: 'Border color as hex (optional)' },
      },
      required: ['reason', 'text', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
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
        fillColor: args['fill_color'] as string | undefined,
        borderColor: args['border_color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Textbox added' };
    }
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTextboxTool: LLMSimpleTool = {
  definition: WORD_ADD_TEXTBOX_DEFINITION,
  execute: executeWordAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add textbox to Word document',
};

// =============================================================================
// Word Add Shape
// =============================================================================

const WORD_ADD_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_shape',
    description: `Add a shape to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a shape' },
        shape_type: {
          type: 'string',
          enum: ['rectangle', 'oval', 'roundedRectangle', 'triangle', 'diamond', 'arrow', 'line'],
          description: 'Type of shape to add',
        },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        fill_color: { type: 'string', description: 'Fill color as hex (optional)' },
        line_color: { type: 'string', description: 'Line color as hex (optional)' },
        text: { type: 'string', description: 'Text inside shape (optional)' },
      },
      required: ['reason', 'shape_type', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddShape(args: Record<string, unknown>): Promise<ToolResult> {
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
      return { success: true, result: `${args['shape_type']} shape added` };
    }
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
    return { success: false, error: `Failed to add shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddShapeTool: LLMSimpleTool = {
  definition: WORD_ADD_SHAPE_DEFINITION,
  execute: executeWordAddShape,
  categories: OFFICE_CATEGORIES,
  description: 'Add shape to Word document',
};

// =============================================================================
// Export Content Tools
// =============================================================================

export const contentTools: LLMSimpleTool[] = [
  wordAddImageTool,
  wordAddHyperlinkTool,
  wordFindReplaceTool,
  wordInsertBreakTool,
  wordAddTextboxTool,
  wordAddShapeTool,
];
