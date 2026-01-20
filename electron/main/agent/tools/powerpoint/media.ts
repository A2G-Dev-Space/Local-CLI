/**
 * PowerPoint Media Tools
 *
 * Media operations: addHyperlink, addVideo, addAudio, addChart
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Hyperlink
// =============================================================================

const PPT_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
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
        url: { type: 'string', description: 'URL or address to link to' },
        screen_tip: { type: 'string', description: 'Tooltip text (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'url'],
    },
  },
};

async function executePPTAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddHyperlink(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['url'] as string,
      args['screen_tip'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Hyperlink added' }; }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddHyperlinkTool: LLMSimpleTool = {
  definition: PPT_ADD_HYPERLINK_DEFINITION, execute: executePPTAddHyperlink, categories: OFFICE_CATEGORIES, description: 'Add hyperlink in PowerPoint',
};

// =============================================================================
// PowerPoint Add Video
// =============================================================================

const PPT_ADD_VIDEO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_video',
    description: `Add a video to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a video' },
        slide_number: { type: 'number', description: 'Slide number' },
        video_path: { type: 'string', description: 'Path to the video file' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 400)' },
        height: { type: 'number', description: 'Height in points (default: 300)' },
      },
      required: ['reason', 'slide_number', 'video_path'],
    },
  },
};

async function executePPTAddVideo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddVideo(
      args['slide_number'] as number,
      args['video_path'] as string,
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      (args['width'] as number) || 400,
      (args['height'] as number) || 300
    );
    if (response.success) {
      return { success: true, result: `Video added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add video' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddVideoTool: LLMSimpleTool = {
  definition: PPT_ADD_VIDEO_DEFINITION, execute: executePPTAddVideo, categories: OFFICE_CATEGORIES, description: 'Add video in PowerPoint',
};

// =============================================================================
// PowerPoint Add Audio
// =============================================================================

const PPT_ADD_AUDIO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_audio',
    description: `Add an audio file to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding audio' },
        slide_number: { type: 'number', description: 'Slide number' },
        audio_path: { type: 'string', description: 'Path to the audio file' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        play_in_background: { type: 'boolean', description: 'Play in background (default: false)' },
      },
      required: ['reason', 'slide_number', 'audio_path'],
    },
  },
};

async function executePPTAddAudio(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddAudio(
      args['slide_number'] as number,
      args['audio_path'] as string,
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      args['play_in_background'] as boolean | undefined
    );
    if (response.success) {
      return { success: true, result: `Audio added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add audio' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddAudioTool: LLMSimpleTool = {
  definition: PPT_ADD_AUDIO_DEFINITION, execute: executePPTAddAudio, categories: OFFICE_CATEGORIES, description: 'Add audio in PowerPoint',
};

// =============================================================================
// PowerPoint Add Chart
// =============================================================================

const PPT_ADD_CHART_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_chart',
    description: `Add a chart to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a chart' },
        slide_number: { type: 'number', description: 'Slide number' },
        chart_type: {
          type: 'string',
          enum: ['column', 'bar', 'line', 'pie', 'area', 'scatter'],
          description: 'Type of chart',
        },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 400)' },
        height: { type: 'number', description: 'Height in points (default: 300)' },
        data: {
          type: 'object',
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
          description: 'Chart data (optional)',
        },
      },
      required: ['reason', 'slide_number', 'chart_type'],
    },
  },
};

async function executePPTAddChart(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddChart(
      args['slide_number'] as number,
      args['chart_type'] as 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      (args['width'] as number) || 400,
      (args['height'] as number) || 300,
      args['data'] as { categories: string[]; series: { name: string; values: number[] }[] } | undefined
    );
    if (response.success) {
      return { success: true, result: `Chart added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddChartTool: LLMSimpleTool = {
  definition: PPT_ADD_CHART_DEFINITION, execute: executePPTAddChart, categories: OFFICE_CATEGORIES, description: 'Add chart in PowerPoint',
};

// =============================================================================
// Export Media Tools
// =============================================================================

export const mediaTools: LLMSimpleTool[] = [
  pptAddHyperlinkTool,
  pptAddVideoTool,
  pptAddAudioTool,
  pptAddChartTool,
];
