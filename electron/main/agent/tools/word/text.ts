/**
 * Word Text Tools
 *
 * Text operations: write, read, deleteText
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Write
// =============================================================================

const WORD_WRITE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_write',
    description: `Write text content to the active Word document.
Text is appended at the current cursor position.
Korean text is automatically detected and uses appropriate font.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of what you are writing' },
        text: { type: 'string', description: 'Text content to write' },
        font_name: { type: 'string', description: 'Font name (optional, auto-detects Korean)' },
        font_size: { type: 'number', description: 'Font size in points (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
        italic: { type: 'boolean', description: 'Italic text (optional)' },
        new_paragraph: { type: 'boolean', description: 'Start new paragraph after text (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordWrite(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordWrite(args['text'] as string, {
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      bold: args['bold'] as boolean | undefined,
      italic: args['italic'] as boolean | undefined,
      newParagraph: args['new_paragraph'] as boolean | undefined,
    });
    if (response.success) {
      return { success: true, result: response.message || 'Text written to document' };
    }
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    return { success: false, error: `Failed to write text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordWriteTool: LLMSimpleTool = {
  definition: WORD_WRITE_DEFINITION,
  execute: executeWordWrite,
  categories: OFFICE_CATEGORIES,
  description: 'Write text to Word document',
};

// =============================================================================
// Word Read
// =============================================================================

const WORD_READ_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_read',
    description: `Read the text content from the active Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading the document' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRead(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordRead();
    if (response.success) {
      const content = response['content'] as string;
      const truncated = content && content.length > 10000
        ? content.slice(0, 10000) + '\n... (truncated)'
        : content;
      return { success: true, result: truncated || '(empty document)' };
    }
    return { success: false, error: response.error || 'Failed to read document' };
  } catch (error) {
    return { success: false, error: `Failed to read document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordReadTool: LLMSimpleTool = {
  definition: WORD_READ_DEFINITION,
  execute: executeWordRead,
  categories: OFFICE_CATEGORIES,
  description: 'Read Word document content',
};

// =============================================================================
// Word Delete Text
// =============================================================================

const WORD_DELETE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_text',
    description: `Delete text in a specified character range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are deleting text' },
        start: { type: 'number', description: 'Start character position (0-based)' },
        end: { type: 'number', description: 'End character position' },
      },
      required: ['reason', 'start', 'end'],
    },
  },
};

async function executeWordDeleteText(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordDeleteText(
      args['start'] as number,
      args['end'] as number
    );
    if (response.success) {
      return { success: true, result: 'Text deleted' };
    }
    return { success: false, error: response.error || 'Failed to delete text' };
  } catch (error) {
    return { success: false, error: `Failed to delete text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteTextTool: LLMSimpleTool = {
  definition: WORD_DELETE_TEXT_DEFINITION,
  execute: executeWordDeleteText,
  categories: OFFICE_CATEGORIES,
  description: 'Delete text in Word document',
};

// =============================================================================
// Export Text Tools
// =============================================================================

export const textTools: LLMSimpleTool[] = [
  wordWriteTool,
  wordReadTool,
  wordDeleteTextTool,
];
