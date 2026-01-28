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

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
        slide_number: { type: 'number', description: 'Slide number' },
        path: { type: 'string', description: 'Image file path' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
      },
      required: ['reason', 'slide_number', 'path'],
    },
  },
};

async function executePowerPointAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddImage(
      slideNum,
      args['path'] as string,
      args['left'] != null ? Number(args['left']) : 100,
      args['top'] != null ? Number(args['top']) : 100,
      args['width'] != null ? Number(args['width']) : undefined,
      args['height'] != null ? Number(args['height']) : undefined
    );
    if (response.success) {
      return { success: true, result: `Image added to slide ${slideNum}` };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
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
    description: `Add a video to a slide. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a video' },
        slide_number: { type: 'number', description: 'Slide number' },
        video_path: { type: 'string', description: 'Path to video file' },
        left: { type: 'number', description: 'Left position (default: 100)' },
        top: { type: 'number', description: 'Top position (default: 100)' },
        width: { type: 'number', description: 'Width (default: 400)' },
        height: { type: 'number', description: 'Height (default: 300)' },
      },
      required: ['reason', 'slide_number', 'video_path'],
    },
  },
};

async function executePowerPointAddVideo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddVideo(
      slideNum,
      args['video_path'] as string,
      args['left'] != null ? Number(args['left']) : undefined,
      args['top'] != null ? Number(args['top']) : undefined,
      args['width'] != null ? Number(args['width']) : undefined,
      args['height'] != null ? Number(args['height']) : undefined
    );
    if (response.success) {
      return { success: true, result: `Video added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add video' };
  } catch (error) {
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
    description: `Add an audio file to a slide. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding audio' },
        slide_number: { type: 'number', description: 'Slide number' },
        audio_path: { type: 'string', description: 'Path to audio file' },
        left: { type: 'number', description: 'Left position (default: 100)' },
        top: { type: 'number', description: 'Top position (default: 100)' },
        play_in_background: { type: 'boolean', description: 'Play audio in background (default: false)' },
      },
      required: ['reason', 'slide_number', 'audio_path'],
    },
  },
};

async function executePowerPointAddAudio(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddAudio(
      slideNum,
      args['audio_path'] as string,
      args['left'] != null ? Number(args['left']) : undefined,
      args['top'] != null ? Number(args['top']) : undefined,
      args['play_in_background'] != null ? Boolean(args['play_in_background']) : undefined
    );
    if (response.success) {
      return { success: true, result: `Audio added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add audio' };
  } catch (error) {
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
        reason: { type: 'string', description: 'Why you are adding a hyperlink' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        url: { type: 'string', description: 'Hyperlink URL' },
        screen_tip: { type: 'string', description: 'Tooltip text when hovering' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'url'],
    },
  },
};

async function executePowerPointAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const response = await powerpointClient.powerpointAddHyperlink(
      slideNum,
      shapeIndex,
      args['url'] as string,
      args['screen_tip'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Hyperlink added' };
    }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
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
    description: `Add a chart to a slide. Example data: {categories: ["Q1","Q2","Q3"], series: [{name: "Sales", values: [100,200,150]}]}`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a chart' },
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
      required: ['reason', 'slide_number', 'chart_type'],
    },
  },
};

async function executePowerPointAddChart(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddChart(
      slideNum,
      args['chart_type'] as 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      args['left'] != null ? Number(args['left']) : undefined,
      args['top'] != null ? Number(args['top']) : undefined,
      args['width'] != null ? Number(args['width']) : undefined,
      args['height'] != null ? Number(args['height']) : undefined,
      args['data'] as { categories: string[]; series: { name: string; values: number[] }[] } | undefined
    );
    if (response.success) {
      return { success: true, result: `Chart added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
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
