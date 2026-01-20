/**
 * PowerPoint Slide Tools
 *
 * Slide operations: addSlide, deleteSlide, moveSlide, duplicateSlide, hideSlide,
 * showSlide, setSlideLayout, getSlideCount, getSlideLayouts
 * Total: 9 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Slide
// =============================================================================

const PPT_ADD_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_slide',
    description: `Add a new slide to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a slide' },
        layout: { type: 'number', description: 'Layout index (1=Title, 2=Title and Content, etc.)' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTAddSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const layout = (args['layout'] as number) || 1;
    const response = await powerpointClient.powerpointAddSlide(layout);
    if (response.success) {
      return { success: true, result: `Slide added: #${response['slide_number']} (layout ${layout})` };
    }
    return { success: false, error: response.error || 'Failed to add slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddSlideTool: LLMSimpleTool = {
  definition: PPT_ADD_SLIDE_DEFINITION, execute: executePPTAddSlide, categories: OFFICE_CATEGORIES, description: 'Add slide to PowerPoint',
};

// =============================================================================
// PowerPoint Delete Slide
// =============================================================================

const PPT_DELETE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_slide',
    description: `Delete a slide from the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this slide' },
        slide_number: { type: 'number', description: 'Slide number to delete (1-based)' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTDeleteSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteSlide(args['slide_number'] as number);
    if (response.success) { return { success: true, result: `Slide ${args['slide_number']} deleted` }; }
    return { success: false, error: response.error || 'Failed to delete slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDeleteSlideTool: LLMSimpleTool = {
  definition: PPT_DELETE_SLIDE_DEFINITION, execute: executePPTDeleteSlide, categories: OFFICE_CATEGORIES, description: 'Delete slide from PowerPoint',
};

// =============================================================================
// PowerPoint Move Slide
// =============================================================================

const PPT_MOVE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_move_slide',
    description: `Move a slide to a different position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving this slide' },
        from_index: { type: 'number', description: 'Current slide position' },
        to_index: { type: 'number', description: 'New slide position' },
      },
      required: ['reason', 'from_index', 'to_index'],
    },
  },
};

async function executePPTMoveSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointMoveSlide(
      args['from_index'] as number, args['to_index'] as number
    );
    if (response.success) { return { success: true, result: `Slide moved from ${args['from_index']} to ${args['to_index']}` }; }
    return { success: false, error: response.error || 'Failed to move slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptMoveSlideTool: LLMSimpleTool = {
  definition: PPT_MOVE_SLIDE_DEFINITION, execute: executePPTMoveSlide, categories: OFFICE_CATEGORIES, description: 'Move slide in PowerPoint',
};

// =============================================================================
// PowerPoint Duplicate Slide
// =============================================================================

const PPT_DUPLICATE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_duplicate_slide',
    description: `Duplicate a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are duplicating this slide' },
        slide_number: { type: 'number', description: 'Slide number to duplicate' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTDuplicateSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDuplicateSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: `Slide duplicated. New slide: #${response['new_slide_index']}` };
    }
    return { success: false, error: response.error || 'Failed to duplicate slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDuplicateSlideTool: LLMSimpleTool = {
  definition: PPT_DUPLICATE_SLIDE_DEFINITION, execute: executePPTDuplicateSlide, categories: OFFICE_CATEGORIES, description: 'Duplicate slide in PowerPoint',
};

// =============================================================================
// PowerPoint Hide Slide
// =============================================================================

const PPT_HIDE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_hide_slide',
    description: `Hide a slide from the slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding this slide' },
        slide_number: { type: 'number', description: 'Slide number to hide' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTHideSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointHideSlide(args['slide_number'] as number);
    if (response.success) { return { success: true, result: `Slide ${args['slide_number']} hidden` }; }
    return { success: false, error: response.error || 'Failed to hide slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptHideSlideTool: LLMSimpleTool = {
  definition: PPT_HIDE_SLIDE_DEFINITION, execute: executePPTHideSlide, categories: OFFICE_CATEGORIES, description: 'Hide slide in PowerPoint',
};

// =============================================================================
// PowerPoint Show Slide
// =============================================================================

const PPT_SHOW_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_show_slide',
    description: `Show a hidden slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing this slide' },
        slide_number: { type: 'number', description: 'Slide number to show' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTShowSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointShowSlide(args['slide_number'] as number);
    if (response.success) { return { success: true, result: `Slide ${args['slide_number']} shown` }; }
    return { success: false, error: response.error || 'Failed to show slide' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptShowSlideTool: LLMSimpleTool = {
  definition: PPT_SHOW_SLIDE_DEFINITION, execute: executePPTShowSlide, categories: OFFICE_CATEGORIES, description: 'Show hidden slide in PowerPoint',
};

// =============================================================================
// PowerPoint Set Slide Layout
// =============================================================================

const PPT_SET_SLIDE_LAYOUT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_slide_layout',
    description: `Change the layout of a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing the layout' },
        slide_number: { type: 'number', description: 'Slide number' },
        layout_index: { type: 'number', description: 'Layout index to apply' },
      },
      required: ['reason', 'slide_number', 'layout_index'],
    },
  },
};

async function executePPTSetSlideLayout(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetSlideLayout(
      args['slide_number'] as number, args['layout_index'] as number
    );
    if (response.success) { return { success: true, result: 'Slide layout changed' }; }
    return { success: false, error: response.error || 'Failed to set slide layout' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetSlideLayoutTool: LLMSimpleTool = {
  definition: PPT_SET_SLIDE_LAYOUT_DEFINITION, execute: executePPTSetSlideLayout, categories: OFFICE_CATEGORIES, description: 'Set slide layout in PowerPoint',
};

// =============================================================================
// PowerPoint Get Slide Count
// =============================================================================

const PPT_GET_SLIDE_COUNT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_count',
    description: `Get the total number of slides in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need slide count' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTGetSlideCount(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetSlideCount();
    if (response.success) {
      return { success: true, result: `Total slides: ${response['slide_count']}` };
    }
    return { success: false, error: response.error || 'Failed to get slide count' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetSlideCountTool: LLMSimpleTool = {
  definition: PPT_GET_SLIDE_COUNT_DEFINITION, execute: executePPTGetSlideCount, categories: OFFICE_CATEGORIES, description: 'Get slide count in PowerPoint',
};

// =============================================================================
// PowerPoint Get Slide Layouts
// =============================================================================

const PPT_GET_SLIDE_LAYOUTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_layouts',
    description: `Get available slide layouts.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need layout list' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTGetSlideLayouts(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetSlideLayouts();
    if (response.success) {
      return { success: true, result: JSON.stringify(response['layouts'], null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get slide layouts' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetSlideLayoutsTool: LLMSimpleTool = {
  definition: PPT_GET_SLIDE_LAYOUTS_DEFINITION, execute: executePPTGetSlideLayouts, categories: OFFICE_CATEGORIES, description: 'Get slide layouts in PowerPoint',
};

// =============================================================================
// Export Slide Tools
// =============================================================================

export const slidesTools: LLMSimpleTool[] = [
  pptAddSlideTool,
  pptDeleteSlideTool,
  pptMoveSlideTool,
  pptDuplicateSlideTool,
  pptHideSlideTool,
  pptShowSlideTool,
  pptSetSlideLayoutTool,
  pptGetSlideCountTool,
  pptGetSlideLayoutsTool,
];
