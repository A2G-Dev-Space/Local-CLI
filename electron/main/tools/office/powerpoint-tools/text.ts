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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index (1=title, 2=content)' },
        text: { type: 'string', description: 'Text to write' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'text'],
    },
  },
};

async function executePowerPointWriteText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_write_text', args);
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const response = await powerpointClient.powerpointWriteText(
      slideNum,
      shapeIndex,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] != null ? Number(args['font_size']) : undefined,
        bold: args['bold'] != null ? Boolean(args['bold']) : undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_write_text', args, { slideNumber: slideNum, shapeIndex }, Date.now() - startTime);
      return { success: true, result: `Text written to slide ${slideNum}, shape ${shapeIndex}` };
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
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointReadSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_read_slide', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointReadSlide(slideNum);
    if (response.success) {
      const texts = response['texts'] as Array<{ shape_index: number; shape_name: string; text: string }> || [];
      const textContent = texts.map(t => `[Shape ${t.shape_index}] ${t.text}`).join('\n');
      logger.toolSuccess('powerpoint_read_slide', args, { slideNumber: slideNum, shapeCount: response['shape_count'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Slide ${slideNum} (${response['shape_count']} shapes):\n${textContent || '(no text content)'}`,
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
        slide_number: { type: 'number', description: 'Slide number' },
        text: { type: 'string', description: 'Text content' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 300)' },
        height: { type: 'number', description: 'Height in points (default: 50)' },
      },
      required: ['reason', 'slide_number', 'text'],
    },
  },
};

async function executePowerPointAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_textbox', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddTextbox(
      slideNum,
      args['text'] as string,
      args['left'] != null ? Number(args['left']) : 100,
      args['top'] != null ? Number(args['top']) : 100,
      args['width'] != null ? Number(args['width']) : 300,
      args['height'] != null ? Number(args['height']) : 50
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_textbox', args, { slideNumber: slideNum, shapeIndex: response['shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Textbox added to slide ${slideNum} (shape index: ${response['shape_index']})` };
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        color: { type: 'string', description: 'Font color as hex' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_font', args);
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const response = await powerpointClient.powerpointSetFont(
      slideNum,
      shapeIndex,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] != null ? Number(args['font_size']) : undefined,
        bold: args['bold'] != null ? Boolean(args['bold']) : undefined,
        italic: args['italic'] != null ? Boolean(args['italic']) : undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_font', args, { slideNumber: slideNum, shapeIndex }, Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are setting text alignment' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Vertical alignment' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'horizontal'],
    },
  },
};

async function executePowerPointSetTextAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_text_alignment', args);
  try {
    const response = await powerpointClient.powerpointSetTextAlignment(
      Number(args['slide_number']),
      Number(args['shape_index']),
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
        reason: { type: 'string', description: 'Why you are setting bullet list style' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        bullet_type: { type: 'string', enum: ['none', 'bullet', 'numbered'], description: 'Bullet type' },
        bullet_char: { type: 'string', description: 'Custom bullet character (e.g., "•", "→")' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'bullet_type'],
    },
  },
};

async function executePowerPointSetBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_bullet_list', args);
  try {
    const response = await powerpointClient.powerpointSetBulletList(
      Number(args['slide_number']),
      Number(args['shape_index']),
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
        reason: { type: 'string', description: 'Why you are setting line spacing' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        line_spacing: { type: 'number', description: 'Line spacing multiplier (e.g., 1.5 for 1.5x)' },
        space_after: { type: 'number', description: 'Space after paragraph in points' },
        space_before: { type: 'number', description: 'Space before paragraph in points' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'line_spacing'],
    },
  },
};

async function executePowerPointSetLineSpacing(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_line_spacing', args);
  try {
    const response = await powerpointClient.powerpointSetLineSpacing(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['line_spacing']),
      args['space_after'] != null ? Number(args['space_after']) : undefined,
      args['space_before'] != null ? Number(args['space_before']) : undefined
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
        reason: { type: 'string', description: 'Why you are setting textbox border' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        weight: { type: 'number', description: 'Border weight in points' },
        style: { type: 'string', enum: ['solid', 'dash', 'dot'], description: 'Border style' },
        visible: { type: 'boolean', description: 'Border visibility (false to remove)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxBorder(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_textbox_border', args);
  try {
    const response = await powerpointClient.powerpointSetTextboxBorder(
      Number(args['slide_number']),
      Number(args['shape_index']),
      {
        color: args['color'] as string | undefined,
        weight: args['weight'] != null ? Number(args['weight']) : undefined,
        style: args['style'] as 'solid' | 'dash' | 'dot' | undefined,
        visible: args['visible'] != null ? Boolean(args['visible']) : undefined,
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
        reason: { type: 'string', description: 'Why you are setting textbox fill' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Fill color (hex: #RRGGBB)' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
        visible: { type: 'boolean', description: 'Fill visibility (false to remove)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxFill(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_textbox_fill', args);
  try {
    const response = await powerpointClient.powerpointSetTextboxFill(
      Number(args['slide_number']),
      Number(args['shape_index']),
      {
        color: args['color'] as string | undefined,
        transparency: args['transparency'] != null ? Number(args['transparency']) : undefined,
        visible: args['visible'] != null ? Boolean(args['visible']) : undefined,
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
// PowerPoint Find Replace Text
// =============================================================================

const POWERPOINT_FIND_REPLACE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_find_replace_text',
    description: `Find and replace text in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are finding and replacing text' },
        find_text: { type: 'string', description: 'Text to find' },
        replace_text: { type: 'string', description: 'Text to replace with' },
        slide_number: { type: 'number', description: 'Specific slide (optional, default: all slides)' },
        match_case: { type: 'boolean', description: 'Case-sensitive match (default: false)' },
      },
      required: ['reason', 'find_text', 'replace_text'],
    },
  },
};

async function executePowerPointFindReplaceText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_find_replace_text', args);
  try {
    const response = await powerpointClient.powerpointFindReplaceText(
      args['find_text'] as string,
      args['replace_text'] as string,
      {
        slideNumber: args['slide_number'] != null ? Number(args['slide_number']) : undefined,
        matchCase: args['match_case'] != null ? Boolean(args['match_case']) : undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_find_replace_text', args, { replacements: response['replacements'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Replaced ${response['replacements']} occurrence(s)` };
    }
    logger.toolError('powerpoint_find_replace_text', args, new Error(response.error || 'Failed to find/replace text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to find/replace text' };
  } catch (error) {
    logger.toolError('powerpoint_find_replace_text', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to find/replace text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointFindReplaceTextTool: LLMSimpleTool = {
  definition: POWERPOINT_FIND_REPLACE_TEXT_DEFINITION,
  execute: executePowerPointFindReplaceText,
  categories: OFFICE_CATEGORIES,
  description: 'Find and replace text',
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
  powerpointFindReplaceTextTool,
];
