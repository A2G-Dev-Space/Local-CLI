/**
 * PowerPoint Notes and Placeholder Tools
 *
 * Tools for managing speaker notes, placeholders, and slide layouts in PowerPoint.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// PowerPoint Add Note
// =============================================================================

const POWERPOINT_ADD_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_note',
    description: `Add speaker notes to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        note_text: { type: 'string', description: 'Note text' },
      },
      required: ['slide_number', 'note_text'],
    },
  },
};

async function executePowerPointAddNote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_note', args);
  try {
    const response = await powerpointClient.powerpointAddNote(
      args['slide_number'] as number,
      args['note_text'] as string
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_note', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Note added' };
    }
    logger.toolError('powerpoint_add_note', args, new Error(response.error || 'Failed to add note'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add note' };
  } catch (error) {
    logger.toolError('powerpoint_add_note', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add note: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddNoteTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_NOTE_DEFINITION,
  execute: executePowerPointAddNote,
  categories: OFFICE_CATEGORIES,
  description: 'Add speaker notes',
};

// =============================================================================
// PowerPoint Get Note
// =============================================================================

const POWERPOINT_GET_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_note',
    description: `Get speaker notes from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointGetNote(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_note', args);
  try {
    const response = await powerpointClient.powerpointGetNote(args['slide_number'] as number);
    if (response.success) {
      logger.toolSuccess('powerpoint_get_note', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: `Note: ${response['note']}` };
    }
    logger.toolError('powerpoint_get_note', args, new Error(response.error || 'Failed to get note'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get note' };
  } catch (error) {
    logger.toolError('powerpoint_get_note', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get note: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetNoteTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_NOTE_DEFINITION,
  execute: executePowerPointGetNote,
  categories: OFFICE_CATEGORIES,
  description: 'Get speaker notes',
};

// =============================================================================
// PowerPoint Set Placeholder Text
// =============================================================================

const POWERPOINT_SET_PLACEHOLDER_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_placeholder_text',
    description: `Set text in a slide placeholder (title, subtitle, body, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        placeholder_type: { type: 'string', enum: ['title', 'subtitle', 'body', 'footer', 'slideNumber', 'date'], description: 'Placeholder type' },
        text: { type: 'string', description: 'Text to set' },
      },
      required: ['slide_number', 'placeholder_type', 'text'],
    },
  },
};

async function executePowerPointSetPlaceholderText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_placeholder_text', args);
  try {
    const response = await powerpointClient.powerpointSetPlaceholderText(
      args['slide_number'] as number,
      args['placeholder_type'] as 'title' | 'subtitle' | 'body' | 'footer' | 'slideNumber' | 'date',
      args['text'] as string
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_placeholder_text', args, { slideNumber: args['slide_number'], placeholderType: args['placeholder_type'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Placeholder text set' };
    }
    logger.toolError('powerpoint_set_placeholder_text', args, new Error(response.error || 'Failed to set placeholder text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set placeholder text' };
  } catch (error) {
    logger.toolError('powerpoint_set_placeholder_text', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set placeholder text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetPlaceholderTextTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_PLACEHOLDER_TEXT_DEFINITION,
  execute: executePowerPointSetPlaceholderText,
  categories: OFFICE_CATEGORIES,
  description: 'Set placeholder text',
};

// =============================================================================
// PowerPoint Get Placeholders
// =============================================================================

const POWERPOINT_GET_PLACEHOLDERS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_placeholders',
    description: `Get list of placeholders on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointGetPlaceholders(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_placeholders', args);
  try {
    const response = await powerpointClient.powerpointGetPlaceholders(args['slide_number'] as number);
    if (response.success) {
      logger.toolSuccess('powerpoint_get_placeholders', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    logger.toolError('powerpoint_get_placeholders', args, new Error(response.error || 'Failed to get placeholders'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get placeholders' };
  } catch (error) {
    logger.toolError('powerpoint_get_placeholders', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get placeholders: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetPlaceholdersTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_PLACEHOLDERS_DEFINITION,
  execute: executePowerPointGetPlaceholders,
  categories: OFFICE_CATEGORIES,
  description: 'Get placeholders on slide',
};

// =============================================================================
// PowerPoint Get Slide Layouts
// =============================================================================

const POWERPOINT_GET_SLIDE_LAYOUTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_layouts',
    description: `Get available slide layouts.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

async function executePowerPointGetSlideLayouts(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_slide_layouts', _args);
  try {
    const response = await powerpointClient.powerpointGetSlideLayouts();
    if (response.success) {
      logger.toolSuccess('powerpoint_get_slide_layouts', _args, {}, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    logger.toolError('powerpoint_get_slide_layouts', _args, new Error(response.error || 'Failed to get slide layouts'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get slide layouts' };
  } catch (error) {
    logger.toolError('powerpoint_get_slide_layouts', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get slide layouts: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSlideLayoutsTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SLIDE_LAYOUTS_DEFINITION,
  execute: executePowerPointGetSlideLayouts,
  categories: OFFICE_CATEGORIES,
  description: 'Get available slide layouts',
};

// =============================================================================
// Export All Notes Tools
// =============================================================================

export const notesTools: LLMSimpleTool[] = [
  powerpointAddNoteTool,
  powerpointGetNoteTool,
  powerpointSetPlaceholderTextTool,
  powerpointGetPlaceholdersTool,
  powerpointGetSlideLayoutsTool,
];
