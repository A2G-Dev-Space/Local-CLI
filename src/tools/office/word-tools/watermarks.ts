/**
 * Word Watermark Tools
 *
 * Tools for managing watermarks in Word documents.
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { wordClient } from '../word-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Word Add Watermark
// =============================================================================

const WORD_ADD_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_watermark',
    description: `Add a text watermark to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding watermark' },
        text: { type: 'string', description: 'Watermark text' },
        font_name: { type: 'string', description: 'Font name (default: Arial)' },
        font_size: { type: 'number', description: 'Font size (default: 72)' },
        color: { type: 'string', description: 'Color as hex (default: light gray)' },
        semitransparent: { type: 'boolean', description: 'Make semitransparent (default: true)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddWatermark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAddWatermark(args['text'] as string, {
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      color: args['color'] as string | undefined,
      semitransparent: args['semitransparent'] as boolean | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Watermark added' };
    }
    return { success: false, error: response.error || 'Failed to add watermark' };
  } catch (error) {
    return { success: false, error: `Failed to add watermark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddWatermarkTool: LLMSimpleTool = {
  definition: WORD_ADD_WATERMARK_DEFINITION,
  execute: executeWordAddWatermark,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word watermark',
};

// =============================================================================
// Word Remove Watermark
// =============================================================================

const WORD_REMOVE_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_remove_watermark',
    description: `Remove watermark from the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing watermark' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRemoveWatermark(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordRemoveWatermark();
    if (response.success) {
      return { success: true, result: 'Watermark removed' };
    }
    return { success: false, error: response.error || 'Failed to remove watermark' };
  } catch (error) {
    return { success: false, error: `Failed to remove watermark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRemoveWatermarkTool: LLMSimpleTool = {
  definition: WORD_REMOVE_WATERMARK_DEFINITION,
  execute: executeWordRemoveWatermark,
  categories: OFFICE_CATEGORIES,
  description: 'Remove Word watermark',
};

// =============================================================================
// Export Watermarks Tools
// =============================================================================

export const watermarksTools: LLMSimpleTool[] = [
  wordAddWatermarkTool,
  wordRemoveWatermarkTool,
];
