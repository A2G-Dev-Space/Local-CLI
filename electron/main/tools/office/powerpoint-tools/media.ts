/**
 * PowerPoint Media Tools
 *
 * Tools for adding media content to PowerPoint slides:
 * - Images
 * - Videos
 * - Audio
 * - Hyperlinks
 * - Charts
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// PowerPoint Add Image
// =============================================================================

const POWERPOINT_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_image',
    description: `Add an image to a slide. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        slide: { type: 'number', description: 'Slide number' },
        path: { type: 'string', description: 'Image file path' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
      },
      required: ['reason', 'slide', 'path'],
    },
  },
};

async function executePowerPointAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_image', args);
  try {
    const response = await powerpointClient.powerpointAddImage(
      args['slide'] as number,
      args['path'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_image', args, { slide: args['slide'] }, Date.now() - startTime);
      return { success: true, result: `Image added to slide ${args['slide']}` };
    }
    logger.toolError('powerpoint_add_image', args, new Error(response.error || 'Failed to add image'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    logger.toolError('powerpoint_add_image', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddImageTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_IMAGE_DEFINITION,
  execute: executePowerPointAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint image',
};

// =============================================================================
// PowerPoint Add Video
// =============================================================================

const POWERPOINT_ADD_VIDEO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_video',
    description: `Add a video to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        video_path: { type: 'string', description: 'Path to video file' },
        left: { type: 'number', description: 'Left position (default: 100)' },
        top: { type: 'number', description: 'Top position (default: 100)' },
        width: { type: 'number', description: 'Width (default: 400)' },
        height: { type: 'number', description: 'Height (default: 300)' },
      },
      required: ['slide_number', 'video_path'],
    },
  },
};

async function executePowerPointAddVideo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_video', args);
  try {
    const response = await powerpointClient.powerpointAddVideo(
      args['slide_number'] as number,
      args['video_path'] as string,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_video', args, { slideNumber: args['slide_number'], shapeIndex: response['shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Video added. Shape index: ${response['shape_index']}` };
    }
    logger.toolError('powerpoint_add_video', args, new Error(response.error || 'Failed to add video'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add video' };
  } catch (error) {
    logger.toolError('powerpoint_add_video', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add video: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddVideoTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_VIDEO_DEFINITION,
  execute: executePowerPointAddVideo,
  categories: OFFICE_CATEGORIES,
  description: 'Add video to slide',
};

// =============================================================================
// PowerPoint Add Audio
// =============================================================================

const POWERPOINT_ADD_AUDIO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_audio',
    description: `Add an audio file to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        audio_path: { type: 'string', description: 'Path to audio file' },
        left: { type: 'number', description: 'Left position (default: 100)' },
        top: { type: 'number', description: 'Top position (default: 100)' },
        play_in_background: { type: 'boolean', description: 'Play audio in background (default: false)' },
      },
      required: ['slide_number', 'audio_path'],
    },
  },
};

async function executePowerPointAddAudio(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_audio', args);
  try {
    const response = await powerpointClient.powerpointAddAudio(
      args['slide_number'] as number,
      args['audio_path'] as string,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['play_in_background'] as boolean | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_audio', args, { slideNumber: args['slide_number'], shapeIndex: response['shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Audio added. Shape index: ${response['shape_index']}` };
    }
    logger.toolError('powerpoint_add_audio', args, new Error(response.error || 'Failed to add audio'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add audio' };
  } catch (error) {
    logger.toolError('powerpoint_add_audio', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add audio: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddAudioTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_AUDIO_DEFINITION,
  execute: executePowerPointAddAudio,
  categories: OFFICE_CATEGORIES,
  description: 'Add audio to slide',
};

// =============================================================================
// PowerPoint Add Hyperlink
// =============================================================================

const POWERPOINT_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_hyperlink',
    description: `Add a hyperlink to a shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        url: { type: 'string', description: 'Hyperlink URL' },
        screen_tip: { type: 'string', description: 'Tooltip text when hovering' },
      },
      required: ['slide_number', 'shape_index', 'url'],
    },
  },
};

async function executePowerPointAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_hyperlink', args);
  try {
    const response = await powerpointClient.powerpointAddHyperlink(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['url'] as string,
      args['screen_tip'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_hyperlink', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Hyperlink added' };
    }
    logger.toolError('powerpoint_add_hyperlink', args, new Error(response.error || 'Failed to add hyperlink'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    logger.toolError('powerpoint_add_hyperlink', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddHyperlinkTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_HYPERLINK_DEFINITION,
  execute: executePowerPointAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add hyperlink to shape',
};

// =============================================================================
// PowerPoint Add Chart
// =============================================================================

const POWERPOINT_ADD_CHART_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_chart',
    description: `Add a chart to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        chart_type: { type: 'string', enum: ['column', 'bar', 'line', 'pie', 'area', 'scatter'], description: 'Chart type' },
        left: { type: 'number', description: 'Left position (default: 100)' },
        top: { type: 'number', description: 'Top position (default: 100)' },
        width: { type: 'number', description: 'Width (default: 400)' },
        height: { type: 'number', description: 'Height (default: 300)' },
        data: {
          type: 'object',
          description: 'Chart data',
          properties: {
            categories: { type: 'array', items: { type: 'string' }, description: 'Category labels' },
            series: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  values: { type: 'array', items: { type: 'number' } },
                },
              },
              description: 'Data series',
            },
          },
        },
      },
      required: ['slide_number', 'chart_type'],
    },
  },
};

async function executePowerPointAddChart(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_chart', args);
  try {
    const response = await powerpointClient.powerpointAddChart(
      args['slide_number'] as number,
      args['chart_type'] as 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined,
      args['data'] as { categories: string[]; series: { name: string; values: number[] }[] } | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_chart', args, { slideNumber: args['slide_number'], chartType: args['chart_type'], shapeIndex: response['shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Chart added. Shape index: ${response['shape_index']}` };
    }
    logger.toolError('powerpoint_add_chart', args, new Error(response.error || 'Failed to add chart'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
    logger.toolError('powerpoint_add_chart', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add chart: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddChartTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_CHART_DEFINITION,
  execute: executePowerPointAddChart,
  categories: OFFICE_CATEGORIES,
  description: 'Add chart to slide',
};

// =============================================================================
// Export
// =============================================================================

export const mediaTools: LLMSimpleTool[] = [
  powerpointAddImageTool,
  powerpointAddVideoTool,
  powerpointAddAudioTool,
  powerpointAddHyperlinkTool,
  powerpointAddChartTool,
];
