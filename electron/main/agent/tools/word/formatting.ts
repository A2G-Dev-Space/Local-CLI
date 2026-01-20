/**
 * Word Formatting Tools
 *
 * Formatting operations: setFont, setParagraph, setStyle
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Set Font
// =============================================================================

const WORD_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_font',
    description: `Set font properties for selected text or at cursor position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing font' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "Malgun Gothic")' },
        font_size: { type: 'number', description: 'Font size in points' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        underline: { type: 'boolean', description: 'Underline text' },
        color: { type: 'string', description: 'Font color as hex (e.g., "#FF0000")' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetFont({
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      bold: args['bold'] as boolean | undefined,
      italic: args['italic'] as boolean | undefined,
      underline: args['underline'] as boolean | undefined,
      color: args['color'] as string | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Font properties updated' };
    }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetFontTool: LLMSimpleTool = {
  definition: WORD_SET_FONT_DEFINITION,
  execute: executeWordSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set font properties in Word',
};

// =============================================================================
// Word Set Paragraph
// =============================================================================

const WORD_SET_PARAGRAPH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_paragraph',
    description: `Set paragraph formatting for selected text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing paragraph format' },
        alignment: {
          type: 'string',
          enum: ['left', 'center', 'right', 'justify'],
          description: 'Text alignment',
        },
        line_spacing: { type: 'number', description: 'Line spacing multiplier (e.g., 1.5, 2.0)' },
        space_before: { type: 'number', description: 'Space before paragraph in points' },
        space_after: { type: 'number', description: 'Space after paragraph in points' },
        first_line_indent: { type: 'number', description: 'First line indent in points' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetParagraph(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetParagraph({
      alignment: args['alignment'] as 'left' | 'center' | 'right' | 'justify' | undefined,
      lineSpacing: args['line_spacing'] as number | undefined,
      spaceBefore: args['space_before'] as number | undefined,
      spaceAfter: args['space_after'] as number | undefined,
      firstLineIndent: args['first_line_indent'] as number | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Paragraph formatting updated' };
    }
    return { success: false, error: response.error || 'Failed to set paragraph' };
  } catch (error) {
    return { success: false, error: `Failed to set paragraph: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetParagraphTool: LLMSimpleTool = {
  definition: WORD_SET_PARAGRAPH_DEFINITION,
  execute: executeWordSetParagraph,
  categories: OFFICE_CATEGORIES,
  description: 'Set paragraph formatting in Word',
};

// =============================================================================
// Word Set Style
// =============================================================================

const WORD_SET_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_style',
    description: `Apply a Word style to the selection.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying a style' },
        style: { type: 'string', description: 'Style name (e.g., "Normal", "Heading 1", "Heading 2", "Title")' },
        preserve_korean_font: { type: 'boolean', description: 'Preserve Korean font after applying style (default: true)' },
      },
      required: ['reason', 'style'],
    },
  },
};

async function executeWordSetStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetStyle(
      args['style'] as string,
      args['preserve_korean_font'] !== false
    );
    if (response.success) {
      return { success: true, result: `Style "${args['style']}" applied` };
    }
    return { success: false, error: response.error || 'Failed to apply style' };
  } catch (error) {
    return { success: false, error: `Failed to apply style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetStyleTool: LLMSimpleTool = {
  definition: WORD_SET_STYLE_DEFINITION,
  execute: executeWordSetStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Apply style to Word selection',
};

// =============================================================================
// Export Formatting Tools
// =============================================================================

export const formattingTools: LLMSimpleTool[] = [
  wordSetFontTool,
  wordSetParagraphTool,
  wordSetStyleTool,
];
