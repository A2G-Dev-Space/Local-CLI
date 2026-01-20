/**
 * Word Watermark Tools
 *
 * Watermark operations: addWatermark, removeWatermark
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Add Watermark
// =============================================================================

const WORD_ADD_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_watermark',
    description: `Add a text watermark to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a watermark' },
        text: { type: 'string', description: 'Watermark text (e.g., "DRAFT", "CONFIDENTIAL")' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        color: { type: 'string', description: 'Color as hex (optional, default: light gray)' },
        semitransparent: { type: 'boolean', description: 'Make watermark semi-transparent (default: true)' },
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
      return { success: true, result: `Watermark "${args['text']}" added` };
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
  description: 'Add watermark to Word document',
};

// =============================================================================
// Word Remove Watermark
// =============================================================================

const WORD_REMOVE_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_remove_watermark',
    description: `Remove watermark from the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing the watermark' },
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
  description: 'Remove watermark from Word document',
};

// =============================================================================
// Export Watermark Tools
// =============================================================================

export const watermarksTools: LLMSimpleTool[] = [
  wordAddWatermarkTool,
  wordRemoveWatermarkTool,
];
