/**
 * PowerPoint Text Tools
 *
 * Text operations: writeText, readSlide, addTextbox, setFont, setTextAlignment,
 * setBulletList, setLineSpacing, setPlaceholderText, getPlaceholders
 * Total: 9 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Write Text
// =============================================================================

const PPT_WRITE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_write_text',
    description: `Write text to a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are writing text' },
        slide_number: { type: 'number', description: 'Slide number (1-based)' },
        shape_index: { type: 'number', description: 'Shape index (1-based)' },
        text: { type: 'string', description: 'Text to write' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'text'],
    },
  },
};

async function executePPTWriteText(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointWriteText(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Text written successfully' }; }
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptWriteTextTool: LLMSimpleTool = {
  definition: PPT_WRITE_TEXT_DEFINITION, execute: executePPTWriteText, categories: OFFICE_CATEGORIES, description: 'Write text in PowerPoint',
};

// =============================================================================
// PowerPoint Read Slide
// =============================================================================

const PPT_READ_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_read_slide',
    description: `Read all text content from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are reading this slide' },
        slide_number: { type: 'number', description: 'Slide number (1-based)' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTReadSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointReadSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to read slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptReadSlideTool: LLMSimpleTool = {
  definition: PPT_READ_SLIDE_DEFINITION, execute: executePPTReadSlide, categories: OFFICE_CATEGORIES, description: 'Read slide content in PowerPoint',
};

// =============================================================================
// PowerPoint Add Textbox
// =============================================================================

const PPT_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_textbox',
    description: `Add a textbox to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a textbox' },
        slide_number: { type: 'number', description: 'Slide number' },
        text: { type: 'string', description: 'Text for the textbox' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 300)' },
        height: { type: 'number', description: 'Height in points (default: 50)' },
      },
      required: ['reason', 'slide_number', 'text'],
    },
  },
};

async function executePPTAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddTextbox(
      args['slide_number'] as number,
      args['text'] as string,
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      (args['width'] as number) || 300,
      (args['height'] as number) || 50
    );
    if (response.success) {
      return { success: true, result: `Textbox added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddTextboxTool: LLMSimpleTool = {
  definition: PPT_ADD_TEXTBOX_DEFINITION, execute: executePPTAddTextbox, categories: OFFICE_CATEGORIES, description: 'Add textbox in PowerPoint',
};

// =============================================================================
// PowerPoint Set Font
// =============================================================================

const PPT_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_font',
    description: `Set font properties for a shape's text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing font' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold' },
        italic: { type: 'boolean', description: 'Italic' },
        color: { type: 'string', description: 'Font color as hex' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetFont(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Font properties updated' }; }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetFontTool: LLMSimpleTool = {
  definition: PPT_SET_FONT_DEFINITION, execute: executePPTSetFont, categories: OFFICE_CATEGORIES, description: 'Set font in PowerPoint',
};

// =============================================================================
// PowerPoint Set Text Alignment
// =============================================================================

const PPT_SET_TEXT_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_text_alignment',
    description: `Set text alignment for a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing alignment' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Vertical alignment' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'horizontal'],
    },
  },
};

async function executePPTSetTextAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTextAlignment(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['horizontal'] as 'left' | 'center' | 'right' | 'justify',
      args['vertical'] as 'top' | 'middle' | 'bottom' | undefined
    );
    if (response.success) { return { success: true, result: 'Text alignment updated' }; }
    return { success: false, error: response.error || 'Failed to set text alignment' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTextAlignmentTool: LLMSimpleTool = {
  definition: PPT_SET_TEXT_ALIGNMENT_DEFINITION, execute: executePPTSetTextAlignment, categories: OFFICE_CATEGORIES, description: 'Set text alignment in PowerPoint',
};

// =============================================================================
// PowerPoint Set Bullet List
// =============================================================================

const PPT_SET_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_bullet_list',
    description: `Set bullet or numbered list style for text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting bullet style' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        bullet_type: { type: 'string', enum: ['none', 'bullet', 'numbered'], description: 'Bullet type' },
        bullet_char: { type: 'string', description: 'Custom bullet character (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'bullet_type'],
    },
  },
};

async function executePPTSetBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetBulletList(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['bullet_type'] as 'none' | 'bullet' | 'numbered',
      args['bullet_char'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Bullet style set to ${args['bullet_type']}` }; }
    return { success: false, error: response.error || 'Failed to set bullet list' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetBulletListTool: LLMSimpleTool = {
  definition: PPT_SET_BULLET_LIST_DEFINITION, execute: executePPTSetBulletList, categories: OFFICE_CATEGORIES, description: 'Set bullet list in PowerPoint',
};

// =============================================================================
// PowerPoint Set Line Spacing
// =============================================================================

const PPT_SET_LINE_SPACING_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_line_spacing',
    description: `Set line spacing for text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing line spacing' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        line_spacing: { type: 'number', description: 'Line spacing value' },
        space_after: { type: 'number', description: 'Space after paragraphs (optional)' },
        space_before: { type: 'number', description: 'Space before paragraphs (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'line_spacing'],
    },
  },
};

async function executePPTSetLineSpacing(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetLineSpacing(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['line_spacing'] as number,
      args['space_after'] as number | undefined,
      args['space_before'] as number | undefined
    );
    if (response.success) { return { success: true, result: 'Line spacing updated' }; }
    return { success: false, error: response.error || 'Failed to set line spacing' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetLineSpacingTool: LLMSimpleTool = {
  definition: PPT_SET_LINE_SPACING_DEFINITION, execute: executePPTSetLineSpacing, categories: OFFICE_CATEGORIES, description: 'Set line spacing in PowerPoint',
};

// =============================================================================
// PowerPoint Set Placeholder Text
// =============================================================================

const PPT_SET_PLACEHOLDER_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_placeholder_text',
    description: `Set text in a slide placeholder (title, subtitle, body, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting placeholder text' },
        slide_number: { type: 'number', description: 'Slide number' },
        placeholder_type: {
          type: 'string',
          enum: ['title', 'subtitle', 'body', 'footer', 'slideNumber', 'date'],
          description: 'Type of placeholder',
        },
        text: { type: 'string', description: 'Text to set' },
      },
      required: ['reason', 'slide_number', 'placeholder_type', 'text'],
    },
  },
};

async function executePPTSetPlaceholderText(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetPlaceholderText(
      args['slide_number'] as number,
      args['placeholder_type'] as 'title' | 'subtitle' | 'body' | 'footer' | 'slideNumber' | 'date',
      args['text'] as string
    );
    if (response.success) { return { success: true, result: `${args['placeholder_type']} placeholder text set` }; }
    return { success: false, error: response.error || 'Failed to set placeholder text' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetPlaceholderTextTool: LLMSimpleTool = {
  definition: PPT_SET_PLACEHOLDER_TEXT_DEFINITION, execute: executePPTSetPlaceholderText, categories: OFFICE_CATEGORIES, description: 'Set placeholder text in PowerPoint',
};

// =============================================================================
// PowerPoint Get Placeholders
// =============================================================================

const PPT_GET_PLACEHOLDERS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_placeholders',
    description: `Get all placeholders on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need placeholder info' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTGetPlaceholders(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetPlaceholders(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get placeholders' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetPlaceholdersTool: LLMSimpleTool = {
  definition: PPT_GET_PLACEHOLDERS_DEFINITION, execute: executePPTGetPlaceholders, categories: OFFICE_CATEGORIES, description: 'Get placeholders in PowerPoint',
};

// =============================================================================
// Export Text Tools
// =============================================================================

export const textTools: LLMSimpleTool[] = [
  pptWriteTextTool,
  pptReadSlideTool,
  pptAddTextboxTool,
  pptSetFontTool,
  pptSetTextAlignmentTool,
  pptSetBulletListTool,
  pptSetLineSpacingTool,
  pptSetPlaceholderTextTool,
  pptGetPlaceholdersTool,
];
