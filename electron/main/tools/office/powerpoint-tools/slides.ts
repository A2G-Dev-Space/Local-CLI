/**
 * PowerPoint Slide Tools
 *
 * Tools for managing slides in PowerPoint presentations:
 * add, delete, move, duplicate, hide, show, set layout, get count
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

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
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_slide', args);
  try {
    const layout = args['layout'] != null ? Number(args['layout']) : 2;
    const response = await powerpointClient.powerpointAddSlide(layout);
    if (response.success) {
      logger.toolSuccess('powerpoint_add_slide', args, { layout, slideNumber: response['slide_number'] }, Date.now() - startTime);
      return { success: true, result: `Slide added (layout ${layout}), slide number: ${response['slide_number']}` };
    }
    logger.toolError('powerpoint_add_slide', args, new Error(response.error || 'Failed to add slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add slide' };
  } catch (error) {
    logger.toolError('powerpoint_add_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        slide_number: { type: 'number', description: 'Slide number to delete' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointDeleteSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_delete_slide', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointDeleteSlide(slideNum);
    if (response.success) {
      logger.toolSuccess('powerpoint_delete_slide', args, { slideNumber: slideNum }, Date.now() - startTime);
      return { success: true, result: `Slide ${slideNum} deleted` };
    }
    logger.toolError('powerpoint_delete_slide', args, new Error(response.error || 'Failed to delete slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete slide' };
  } catch (error) {
    logger.toolError('powerpoint_delete_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_move_slide', args);
  try {
    const response = await powerpointClient.powerpointMoveSlide(
      Number(args['from_index']),
      Number(args['to_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_move_slide', args, { fromIndex: args['from_index'], toIndex: args['to_index'] }, Date.now() - startTime);
      return { success: true, result: `Slide moved from ${args['from_index']} to ${args['to_index']}` };
    }
    logger.toolError('powerpoint_move_slide', args, new Error(response.error || 'Failed to move slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to move slide' };
  } catch (error) {
    logger.toolError('powerpoint_move_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are duplicating this slide' },
        slide_number: { type: 'number', description: 'Slide number to duplicate' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointDuplicateSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_duplicate_slide', args);
  try {
    const response = await powerpointClient.powerpointDuplicateSlide(Number(args['slide_number']));
    if (response.success) {
      logger.toolSuccess('powerpoint_duplicate_slide', args, { slideNumber: args['slide_number'], newSlideIndex: response['new_slide_index'] }, Date.now() - startTime);
      return { success: true, result: `Slide duplicated. New slide index: ${response['new_slide_index']}` };
    }
    logger.toolError('powerpoint_duplicate_slide', args, new Error(response.error || 'Failed to duplicate slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to duplicate slide' };
  } catch (error) {
    logger.toolError('powerpoint_duplicate_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are hiding this slide' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointHideSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_hide_slide', args);
  try {
    const response = await powerpointClient.powerpointHideSlide(Number(args['slide_number']));
    if (response.success) {
      logger.toolSuccess('powerpoint_hide_slide', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Slide hidden' };
    }
    logger.toolError('powerpoint_hide_slide', args, new Error(response.error || 'Failed to hide slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to hide slide' };
  } catch (error) {
    logger.toolError('powerpoint_hide_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are showing this slide' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointShowSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_show_slide', args);
  try {
    const response = await powerpointClient.powerpointShowSlide(Number(args['slide_number']));
    if (response.success) {
      logger.toolSuccess('powerpoint_show_slide', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Slide shown' };
    }
    logger.toolError('powerpoint_show_slide', args, new Error(response.error || 'Failed to show slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to show slide' };
  } catch (error) {
    logger.toolError('powerpoint_show_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are changing the slide layout' },
        slide_number: { type: 'number', description: 'Slide number' },
        layout_index: { type: 'number', description: 'Layout index (1-12)' },
      },
      required: ['reason', 'slide_number', 'layout_index'],
    },
  },
};

async function executePowerPointSetSlideLayout(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_slide_layout', args);
  try {
    const response = await powerpointClient.powerpointSetSlideLayout(
      Number(args['slide_number']),
      Number(args['layout_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_slide_layout', args, { slideNumber: args['slide_number'], layoutIndex: args['layout_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Slide layout set' };
    }
    logger.toolError('powerpoint_set_slide_layout', args, new Error(response.error || 'Failed to set slide layout'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set slide layout' };
  } catch (error) {
    logger.toolError('powerpoint_set_slide_layout', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_slide_count', _args);
  try {
    const response = await powerpointClient.powerpointGetSlideCount();
    if (response.success) {
      logger.toolSuccess('powerpoint_get_slide_count', _args, { slideCount: response['slide_count'] }, Date.now() - startTime);
      return { success: true, result: `Slide count: ${response['slide_count']}` };
    }
    logger.toolError('powerpoint_get_slide_count', _args, new Error(response.error || 'Failed to get slide count'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get slide count' };
  } catch (error) {
    logger.toolError('powerpoint_get_slide_count', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// PowerPoint Stop Slideshow
// =============================================================================

const POWERPOINT_STOP_SLIDESHOW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_stop_slideshow',
    description: `Stop the currently running slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are stopping the slideshow' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointStopSlideshow(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_stop_slideshow', _args);
  try {
    const response = await powerpointClient.powerpointStopSlideshow();
    if (response.success) {
      logger.toolSuccess('powerpoint_stop_slideshow', _args, {}, Date.now() - startTime);
      return { success: true, result: response.message || 'Slideshow stopped' };
    }
    logger.toolError('powerpoint_stop_slideshow', _args, new Error(response.error || 'Failed to stop slideshow'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to stop slideshow' };
  } catch (error) {
    logger.toolError('powerpoint_stop_slideshow', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to stop slideshow: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointStopSlideshowTool: LLMSimpleTool = {
  definition: POWERPOINT_STOP_SLIDESHOW_DEFINITION,
  execute: executePowerPointStopSlideshow,
  categories: OFFICE_CATEGORIES,
  description: 'Stop running slideshow',
};

// =============================================================================
// PowerPoint Goto Slide
// =============================================================================

const POWERPOINT_GOTO_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_goto_slide',
    description: `Navigate to a specific slide during slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating to this slide' },
        slide_number: { type: 'number', description: 'Target slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointGotoSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_goto_slide', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointGotoSlide(slideNum);
    if (response.success) {
      logger.toolSuccess('powerpoint_goto_slide', args, { slideNumber: slideNum }, Date.now() - startTime);
      return { success: true, result: response.message || `Navigated to slide ${slideNum}` };
    }
    logger.toolError('powerpoint_goto_slide', args, new Error(response.error || 'Failed to navigate to slide'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to navigate to slide' };
  } catch (error) {
    logger.toolError('powerpoint_goto_slide', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to navigate to slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGotoSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_GOTO_SLIDE_DEFINITION,
  execute: executePowerPointGotoSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Navigate to slide during slideshow',
};

// =============================================================================
// PowerPoint Get Presentation Info
// =============================================================================

const POWERPOINT_GET_PRESENTATION_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_presentation_info',
    description: `Get detailed information about the current presentation including file name, slide count, dimensions, and author.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need presentation information' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointGetPresentationInfo(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_presentation_info', _args);
  try {
    const response = await powerpointClient.powerpointGetPresentationInfo();
    if (response.success) {
      const info = response;
      const details = [
        `Name: ${info['name'] || 'N/A'}`,
        `Path: ${info['path'] || 'N/A'}`,
        `Slide Count: ${info['slide_count'] || 'N/A'}`,
        `Width: ${info['slide_width'] || 'N/A'}`,
        `Height: ${info['slide_height'] || 'N/A'}`,
        `Saved: ${info['saved'] || 'N/A'}`,
        `ReadOnly: ${info['readonly'] || 'N/A'}`,
      ].join('\n');
      logger.toolSuccess('powerpoint_get_presentation_info', _args, info, Date.now() - startTime);
      return { success: true, result: `Presentation Info:\n${details}` };
    }
    logger.toolError('powerpoint_get_presentation_info', _args, new Error(response.error || 'Failed to get presentation info'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get presentation info' };
  } catch (error) {
    logger.toolError('powerpoint_get_presentation_info', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get presentation info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetPresentationInfoTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_PRESENTATION_INFO_DEFINITION,
  execute: executePowerPointGetPresentationInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get presentation information',
};

// =============================================================================
// PowerPoint Import Slides
// =============================================================================

const POWERPOINT_IMPORT_SLIDES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_import_slides',
    description: `Import slides from another PowerPoint presentation. Useful for reusing content from templates or merging presentations. WSL paths are auto-converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are importing slides' },
        source_path: { type: 'string', description: 'Path to source PowerPoint file (.pptx)' },
        start_slide: { type: 'number', description: 'First slide to import from source (default: 1)' },
        end_slide: { type: 'number', description: 'Last slide to import from source (default: all slides)' },
        insert_at: { type: 'number', description: 'Position to insert in current presentation (default: end)' },
      },
      required: ['reason', 'source_path'],
    },
  },
};

async function executePowerPointImportSlides(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_import_slides', args);
  try {
    const sourcePath = args['source_path'] as string;
    const startSlide = args['start_slide'] != null ? Number(args['start_slide']) : undefined;
    const endSlide = args['end_slide'] != null ? Number(args['end_slide']) : undefined;
    const insertAt = args['insert_at'] != null ? Number(args['insert_at']) : undefined;

    const slideRange = startSlide || endSlide ? { start: startSlide, end: endSlide } : undefined;
    const response = await powerpointClient.powerpointImportSlides(sourcePath, slideRange, insertAt);

    if (response.success) {
      logger.toolSuccess('powerpoint_import_slides', args, { sourcePath, imported: response['imported_count'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Slides imported from ${sourcePath}` };
    }
    logger.toolError('powerpoint_import_slides', args, new Error(response.error || 'Failed to import slides'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to import slides' };
  } catch (error) {
    logger.toolError('powerpoint_import_slides', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to import slides: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointImportSlidesTool: LLMSimpleTool = {
  definition: POWERPOINT_IMPORT_SLIDES_DEFINITION,
  execute: executePowerPointImportSlides,
  categories: OFFICE_CATEGORIES,
  description: 'Import slides from another presentation',
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
  powerpointStopSlideshowTool,
  powerpointGotoSlideTool,
  powerpointGetPresentationInfoTool,
  powerpointImportSlidesTool,
];
