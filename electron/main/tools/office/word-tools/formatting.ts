/**
 * Word Formatting Tools
 *
 * Tools for font, paragraph, and break formatting in Word documents
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { OFFICE_CATEGORIES } from '../common/constants';

// =============================================================================
// Word Set Font
// =============================================================================

const WORD_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_font',
    description: `Set font properties for the current selection in Word.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
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
      return { success: true, result: 'Font properties set' };
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
  description: 'Set Word font properties',
};

// =============================================================================
// Word Set Paragraph
// =============================================================================

const WORD_SET_PARAGRAPH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_paragraph',
    description: `Set paragraph formatting for the current selection in Word.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting paragraph format' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Text alignment' },
        line_spacing: { type: 'number', description: 'Line spacing multiplier' },
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
      return { success: true, result: 'Paragraph formatting set' };
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
  description: 'Set Word paragraph format',
};

// =============================================================================
// Word Insert Break
// =============================================================================

const WORD_INSERT_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_break',
    description: `Insert a page break, line break, or section break.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a break' },
        break_type: { type: 'string', enum: ['page', 'line', 'section'], description: 'Type of break (default: page)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertBreak(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordInsertBreak(
      args['break_type'] as 'page' | 'line' | 'section' ?? 'page'
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
  description: 'Insert Word break',
};

// =============================================================================
// Export Formatting Tools
// =============================================================================

export const formattingTools: LLMSimpleTool[] = [
  wordSetFontTool,
  wordSetParagraphTool,
  wordInsertBreakTool,
];
