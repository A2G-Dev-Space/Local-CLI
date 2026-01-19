/**
 * PowerPoint Slide Tools
 *
 * Tools for managing slides in PowerPoint presentations:
 * add, delete, move, duplicate, hide, show, set layout, get count
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// PowerPoint Add Slide
// =============================================================================

const POWERPOINT_ADD_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_slide',
    description: `Add a new slide to the presentation.
Layout options:
1 = Title Slide
2 = Title and Content
3 = Section Header
4 = Two Content
5 = Comparison
6 = Title Only
7 = Blank`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a slide' },
        layout: { type: 'number', description: 'Slide layout (1-7, default: 2)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointAddSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const layout = args['layout'] as number ?? 2;
    const response = await powerpointClient.powerpointAddSlide(layout);
    if (response.success) {
      return { success: true, result: `Slide added (layout ${layout}), slide number: ${response['slide_number']}` };
    }
    return { success: false, error: response.error || 'Failed to add slide' };
  } catch (error) {
    return { success: false, error: `Failed to add slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_SLIDE_DEFINITION,
  execute: executePowerPointAddSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint slide',
};

// =============================================================================
// PowerPoint Delete Slide
// =============================================================================

const POWERPOINT_DELETE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_slide',
    description: `Delete a slide from the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this slide' },
        slide: { type: 'number', description: 'Slide number to delete' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointDeleteSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteSlide(args['slide'] as number);
    if (response.success) {
      return { success: true, result: `Slide ${args['slide']} deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete slide' };
  } catch (error) {
    return { success: false, error: `Failed to delete slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_SLIDE_DEFINITION,
  execute: executePowerPointDeleteSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Delete PowerPoint slide',
};

// =============================================================================
// PowerPoint Move Slide
// =============================================================================

const POWERPOINT_MOVE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_move_slide',
    description: `Move a slide to a different position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving this slide' },
        from_index: { type: 'number', description: 'Current slide number' },
        to_index: { type: 'number', description: 'Target position' },
      },
      required: ['reason', 'from_index', 'to_index'],
    },
  },
};

async function executePowerPointMoveSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointMoveSlide(
      args['from_index'] as number,
      args['to_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Slide moved from ${args['from_index']} to ${args['to_index']}` };
    }
    return { success: false, error: response.error || 'Failed to move slide' };
  } catch (error) {
    return { success: false, error: `Failed to move slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointMoveSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_MOVE_SLIDE_DEFINITION,
  execute: executePowerPointMoveSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Move PowerPoint slide',
};

// =============================================================================
// PowerPoint Duplicate Slide
// =============================================================================

const POWERPOINT_DUPLICATE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_duplicate_slide',
    description: `Duplicate a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number to duplicate' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointDuplicateSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDuplicateSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: `Slide duplicated. New slide index: ${response['new_slide_index']}` };
    }
    return { success: false, error: response.error || 'Failed to duplicate slide' };
  } catch (error) {
    return { success: false, error: `Failed to duplicate slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDuplicateSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_DUPLICATE_SLIDE_DEFINITION,
  execute: executePowerPointDuplicateSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Duplicate slide',
};

// =============================================================================
// PowerPoint Hide Slide
// =============================================================================

const POWERPOINT_HIDE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_hide_slide',
    description: `Hide a slide from slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointHideSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointHideSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: response.message || 'Slide hidden' };
    }
    return { success: false, error: response.error || 'Failed to hide slide' };
  } catch (error) {
    return { success: false, error: `Failed to hide slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointHideSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_HIDE_SLIDE_DEFINITION,
  execute: executePowerPointHideSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Hide slide from slideshow',
};

// =============================================================================
// PowerPoint Show Slide
// =============================================================================

const POWERPOINT_SHOW_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_show_slide',
    description: `Show a hidden slide in slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointShowSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointShowSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: response.message || 'Slide shown' };
    }
    return { success: false, error: response.error || 'Failed to show slide' };
  } catch (error) {
    return { success: false, error: `Failed to show slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointShowSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_SHOW_SLIDE_DEFINITION,
  execute: executePowerPointShowSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Show hidden slide',
};

// =============================================================================
// PowerPoint Set Slide Layout
// =============================================================================

const POWERPOINT_SET_SLIDE_LAYOUT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_slide_layout',
    description: `Set the layout of a slide. Common layouts: 1=Title, 2=Title+Content, 3=Section Header, 4=Two Content, 5=Comparison, 6=Title Only, 7=Blank`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        layout_index: { type: 'number', description: 'Layout index (1-12)' },
      },
      required: ['slide_number', 'layout_index'],
    },
  },
};

async function executePowerPointSetSlideLayout(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetSlideLayout(
      args['slide_number'] as number,
      args['layout_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Slide layout set' };
    }
    return { success: false, error: response.error || 'Failed to set slide layout' };
  } catch (error) {
    return { success: false, error: `Failed to set slide layout: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetSlideLayoutTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SLIDE_LAYOUT_DEFINITION,
  execute: executePowerPointSetSlideLayout,
  categories: OFFICE_CATEGORIES,
  description: 'Set slide layout',
};

// =============================================================================
// PowerPoint Get Slide Count
// =============================================================================

const POWERPOINT_GET_SLIDE_COUNT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_count',
    description: `Get the number of slides in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need slide count' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointGetSlideCount(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetSlideCount();
    if (response.success) {
      return { success: true, result: `Slide count: ${response['slide_count']}` };
    }
    return { success: false, error: response.error || 'Failed to get slide count' };
  } catch (error) {
    return { success: false, error: `Failed to get slide count: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSlideCountTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SLIDE_COUNT_DEFINITION,
  execute: executePowerPointGetSlideCount,
  categories: OFFICE_CATEGORIES,
  description: 'Get PowerPoint slide count',
};

// =============================================================================
// Export
// =============================================================================

export const slidesTools: LLMSimpleTool[] = [
  powerpointAddSlideTool,
  powerpointDeleteSlideTool,
  powerpointMoveSlideTool,
  powerpointDuplicateSlideTool,
  powerpointHideSlideTool,
  powerpointShowSlideTool,
  powerpointSetSlideLayoutTool,
  powerpointGetSlideCountTool,
];
