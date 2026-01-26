/**
 * PowerPoint Text Tools
 *
 * Tools for writing text, reading slides, adding textboxes,
 * and formatting text (font, alignment, bullets, spacing, border, fill).
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// PowerPoint Write Text
// =============================================================================

const POWERPOINT_WRITE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_write_text',
    description: `Write text to a shape on a slide.
Shape index 1 is usually the title placeholder, index 2 is the content placeholder.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are writing text' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index (1=title, 2=content)' },
        text: { type: 'string', description: 'Text to write' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'slide', 'shape', 'text'],
    },
  },
};

async function executePowerPointWriteText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_write_text', args);
  try {
    const response = await powerpointClient.powerpointWriteText(
      args['slide'] as number,
      args['shape'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_write_text', args, { slide: args['slide'], shape: args['shape'] }, Date.now() - startTime);
      return { success: true, result: `Text written to slide ${args['slide']}, shape ${args['shape']}` };
    }
    logger.toolError('powerpoint_write_text', args, new Error(response.error || 'Failed to write text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    logger.toolError('powerpoint_write_text', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to write text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointWriteTextTool: LLMSimpleTool = {
  definition: POWERPOINT_WRITE_TEXT_DEFINITION,
  execute: executePowerPointWriteText,
  categories: OFFICE_CATEGORIES,
  description: 'Write text to PowerPoint shape',
};

// =============================================================================
// PowerPoint Read Slide
// =============================================================================

const POWERPOINT_READ_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_read_slide',
    description: `Read all text content from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are reading this slide' },
        slide: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointReadSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_read_slide', args);
  try {
    const response = await powerpointClient.powerpointReadSlide(args['slide'] as number);
    if (response.success) {
      const texts = response['texts'] as Array<{ shape_index: number; shape_name: string; text: string }> || [];
      const textContent = texts.map(t => `[Shape ${t.shape_index}] ${t.text}`).join('\n');
      logger.toolSuccess('powerpoint_read_slide', args, { slide: args['slide'], shapeCount: response['shape_count'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Slide ${args['slide']} (${response['shape_count']} shapes):\n${textContent || '(no text content)'}`,
      };
    }
    logger.toolError('powerpoint_read_slide', args, new Error(response.error || 'Failed to read slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to read slide' };
  } catch (error) {
    logger.toolError('powerpoint_read_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to read slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointReadSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_READ_SLIDE_DEFINITION,
  execute: executePowerPointReadSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Read PowerPoint slide content',
};

// =============================================================================
// PowerPoint Add Textbox
// =============================================================================

const POWERPOINT_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_textbox',
    description: `Add a textbox to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a textbox' },
        slide: { type: 'number', description: 'Slide number' },
        text: { type: 'string', description: 'Text content' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 300)' },
        height: { type: 'number', description: 'Height in points (default: 50)' },
      },
      required: ['reason', 'slide', 'text'],
    },
  },
};

async function executePowerPointAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_textbox', args);
  try {
    const response = await powerpointClient.powerpointAddTextbox(
      args['slide'] as number,
      args['text'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number ?? 300,
      args['height'] as number ?? 50
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_textbox', args, { slide: args['slide'], shapeIndex: response['shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Textbox added to slide ${args['slide']} (shape index: ${response['shape_index']})` };
    }
    logger.toolError('powerpoint_add_textbox', args, new Error(response.error || 'Failed to add textbox'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    logger.toolError('powerpoint_add_textbox', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTextboxTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TEXTBOX_DEFINITION,
  execute: executePowerPointAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint textbox',
};

// =============================================================================
// PowerPoint Set Font
// =============================================================================

const POWERPOINT_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_font',
    description: `Set font properties for a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        color: { type: 'string', description: 'Font color as hex' },
      },
      required: ['reason', 'slide', 'shape'],
    },
  },
};

async function executePowerPointSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_font', args);
  try {
    const response = await powerpointClient.powerpointSetFont(
      args['slide'] as number,
      args['shape'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_font', args, { slide: args['slide'], shape: args['shape'] }, Date.now() - startTime);
      return { success: true, result: 'Font properties set' };
    }
    logger.toolError('powerpoint_set_font', args, new Error(response.error || 'Failed to set font'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    logger.toolError('powerpoint_set_font', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetFontTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_FONT_DEFINITION,
  execute: executePowerPointSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint font',
};

// =============================================================================
// PowerPoint Set Text Alignment
// =============================================================================

const POWERPOINT_SET_TEXT_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_text_alignment',
    description: `Set text alignment in a shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Vertical alignment' },
      },
      required: ['slide_number', 'shape_index', 'horizontal'],
    },
  },
};

async function executePowerPointSetTextAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_text_alignment', args);
  try {
    const response = await powerpointClient.powerpointSetTextAlignment(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['horizontal'] as 'left' | 'center' | 'right' | 'justify',
      args['vertical'] as 'top' | 'middle' | 'bottom' | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_text_alignment', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Text alignment set' };
    }
    logger.toolError('powerpoint_set_text_alignment', args, new Error(response.error || 'Failed to set text alignment'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set text alignment' };
  } catch (error) {
    logger.toolError('powerpoint_set_text_alignment', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set text alignment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextAlignmentTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXT_ALIGNMENT_DEFINITION,
  execute: executePowerPointSetTextAlignment,
  categories: OFFICE_CATEGORIES,
  description: 'Set text alignment',
};

// =============================================================================
// PowerPoint Set Bullet List
// =============================================================================

const POWERPOINT_SET_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_bullet_list',
    description: `Set bullet or numbered list style for text.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        bullet_type: { type: 'string', enum: ['none', 'bullet', 'numbered'], description: 'Bullet type' },
        bullet_char: { type: 'string', description: 'Custom bullet character (e.g., "•", "→")' },
      },
      required: ['slide_number', 'shape_index', 'bullet_type'],
    },
  },
};

async function executePowerPointSetBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_bullet_list', args);
  try {
    const response = await powerpointClient.powerpointSetBulletList(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['bullet_type'] as 'none' | 'bullet' | 'numbered',
      args['bullet_char'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_bullet_list', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'], bulletType: args['bullet_type'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Bullet style set' };
    }
    logger.toolError('powerpoint_set_bullet_list', args, new Error(response.error || 'Failed to set bullet style'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set bullet style' };
  } catch (error) {
    logger.toolError('powerpoint_set_bullet_list', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set bullet style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetBulletListTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_BULLET_LIST_DEFINITION,
  execute: executePowerPointSetBulletList,
  categories: OFFICE_CATEGORIES,
  description: 'Set bullet/numbered list',
};

// =============================================================================
// PowerPoint Set Line Spacing
// =============================================================================

const POWERPOINT_SET_LINE_SPACING_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_line_spacing',
    description: `Set line spacing for text.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        line_spacing: { type: 'number', description: 'Line spacing multiplier (e.g., 1.5 for 1.5x)' },
        space_after: { type: 'number', description: 'Space after paragraph in points' },
        space_before: { type: 'number', description: 'Space before paragraph in points' },
      },
      required: ['slide_number', 'shape_index', 'line_spacing'],
    },
  },
};

async function executePowerPointSetLineSpacing(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_line_spacing', args);
  try {
    const response = await powerpointClient.powerpointSetLineSpacing(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['line_spacing'] as number,
      args['space_after'] as number | undefined,
      args['space_before'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_line_spacing', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'], lineSpacing: args['line_spacing'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Line spacing set' };
    }
    logger.toolError('powerpoint_set_line_spacing', args, new Error(response.error || 'Failed to set line spacing'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set line spacing' };
  } catch (error) {
    logger.toolError('powerpoint_set_line_spacing', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set line spacing: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetLineSpacingTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_LINE_SPACING_DEFINITION,
  execute: executePowerPointSetLineSpacing,
  categories: OFFICE_CATEGORIES,
  description: 'Set line spacing',
};

// =============================================================================
// PowerPoint Set Textbox Border
// =============================================================================

const POWERPOINT_SET_TEXTBOX_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_border',
    description: `Set textbox border style.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        weight: { type: 'number', description: 'Border weight in points' },
        style: { type: 'string', enum: ['solid', 'dash', 'dot'], description: 'Border style' },
        visible: { type: 'boolean', description: 'Border visibility (false to remove)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxBorder(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_textbox_border', args);
  try {
    const response = await powerpointClient.powerpointSetTextboxBorder(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        weight: args['weight'] as number | undefined,
        style: args['style'] as 'solid' | 'dash' | 'dot' | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_textbox_border', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Textbox border updated' };
    }
    logger.toolError('powerpoint_set_textbox_border', args, new Error(response.error || 'Failed to set textbox border'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set textbox border' };
  } catch (error) {
    logger.toolError('powerpoint_set_textbox_border', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set textbox border: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextboxBorderTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXTBOX_BORDER_DEFINITION,
  execute: executePowerPointSetTextboxBorder,
  categories: OFFICE_CATEGORIES,
  description: 'Set textbox border',
};

// =============================================================================
// PowerPoint Set Textbox Fill
// =============================================================================

const POWERPOINT_SET_TEXTBOX_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_fill',
    description: `Set textbox background fill.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Fill color (hex: #RRGGBB)' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
        visible: { type: 'boolean', description: 'Fill visibility (false to remove)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxFill(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_textbox_fill', args);
  try {
    const response = await powerpointClient.powerpointSetTextboxFill(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        transparency: args['transparency'] as number | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_textbox_fill', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Textbox fill updated' };
    }
    logger.toolError('powerpoint_set_textbox_fill', args, new Error(response.error || 'Failed to set textbox fill'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set textbox fill' };
  } catch (error) {
    logger.toolError('powerpoint_set_textbox_fill', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set textbox fill: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextboxFillTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXTBOX_FILL_DEFINITION,
  execute: executePowerPointSetTextboxFill,
  categories: OFFICE_CATEGORIES,
  description: 'Set textbox background fill',
};

// =============================================================================
// Export
// =============================================================================

export const textTools: LLMSimpleTool[] = [
  powerpointWriteTextTool,
  powerpointReadSlideTool,
  powerpointAddTextboxTool,
  powerpointSetFontTool,
  powerpointSetTextAlignmentTool,
  powerpointSetBulletListTool,
  powerpointSetLineSpacingTool,
  powerpointSetTextboxBorderTool,
  powerpointSetTextboxFillTool,
];
