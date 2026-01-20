/**
 * PowerPoint Z-Order & Alignment Tools
 *
 * Z-order and alignment: bringToFront, sendToBack, bringForward, sendBackward,
 * alignShapes, distributeShapes, groupShapes, ungroupShapes
 * Total: 8 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Bring To Front
// =============================================================================

const PPT_BRING_TO_FRONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_bring_to_front',
    description: `Bring a shape to the front (top of z-order).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are bringing to front' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTBringToFront(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointBringToFront(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) { return { success: true, result: 'Shape brought to front' }; }
    return { success: false, error: response.error || 'Failed to bring to front' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptBringToFrontTool: LLMSimpleTool = {
  definition: PPT_BRING_TO_FRONT_DEFINITION, execute: executePPTBringToFront, categories: OFFICE_CATEGORIES, description: 'Bring shape to front',
};

// =============================================================================
// PowerPoint Send To Back
// =============================================================================

const PPT_SEND_TO_BACK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_send_to_back',
    description: `Send a shape to the back (bottom of z-order).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sending to back' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSendToBack(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSendToBack(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) { return { success: true, result: 'Shape sent to back' }; }
    return { success: false, error: response.error || 'Failed to send to back' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSendToBackTool: LLMSimpleTool = {
  definition: PPT_SEND_TO_BACK_DEFINITION, execute: executePPTSendToBack, categories: OFFICE_CATEGORIES, description: 'Send shape to back',
};

// =============================================================================
// PowerPoint Bring Forward
// =============================================================================

const PPT_BRING_FORWARD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_bring_forward',
    description: `Bring a shape one level forward.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are bringing forward' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTBringForward(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointBringForward(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) { return { success: true, result: 'Shape brought forward' }; }
    return { success: false, error: response.error || 'Failed to bring forward' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptBringForwardTool: LLMSimpleTool = {
  definition: PPT_BRING_FORWARD_DEFINITION, execute: executePPTBringForward, categories: OFFICE_CATEGORIES, description: 'Bring shape forward',
};

// =============================================================================
// PowerPoint Send Backward
// =============================================================================

const PPT_SEND_BACKWARD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_send_backward',
    description: `Send a shape one level backward.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sending backward' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSendBackward(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSendBackward(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) { return { success: true, result: 'Shape sent backward' }; }
    return { success: false, error: response.error || 'Failed to send backward' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSendBackwardTool: LLMSimpleTool = {
  definition: PPT_SEND_BACKWARD_DEFINITION, execute: executePPTSendBackward, categories: OFFICE_CATEGORIES, description: 'Send shape backward',
};

// =============================================================================
// PowerPoint Align Shapes
// =============================================================================

const PPT_ALIGN_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_align_shapes',
    description: `Align multiple shapes.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are aligning shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of shape indices to align',
        },
        alignment: {
          type: 'string',
          enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'],
          description: 'Alignment type',
        },
      },
      required: ['reason', 'slide_number', 'shape_indices', 'alignment'],
    },
  },
};

async function executePPTAlignShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAlignShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[],
      args['alignment'] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
    );
    if (response.success) { return { success: true, result: `Shapes aligned to ${args['alignment']}` }; }
    return { success: false, error: response.error || 'Failed to align shapes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAlignShapesTool: LLMSimpleTool = {
  definition: PPT_ALIGN_SHAPES_DEFINITION, execute: executePPTAlignShapes, categories: OFFICE_CATEGORIES, description: 'Align shapes in PowerPoint',
};

// =============================================================================
// PowerPoint Distribute Shapes
// =============================================================================

const PPT_DISTRIBUTE_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_distribute_shapes',
    description: `Distribute shapes evenly.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are distributing shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of shape indices to distribute',
        },
        direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Distribution direction' },
      },
      required: ['reason', 'slide_number', 'shape_indices', 'direction'],
    },
  },
};

async function executePPTDistributeShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDistributeShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[],
      args['direction'] as 'horizontal' | 'vertical'
    );
    if (response.success) { return { success: true, result: `Shapes distributed ${args['direction']}ly` }; }
    return { success: false, error: response.error || 'Failed to distribute shapes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDistributeShapesTool: LLMSimpleTool = {
  definition: PPT_DISTRIBUTE_SHAPES_DEFINITION, execute: executePPTDistributeShapes, categories: OFFICE_CATEGORIES, description: 'Distribute shapes in PowerPoint',
};

// =============================================================================
// PowerPoint Group Shapes
// =============================================================================

const PPT_GROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_group_shapes',
    description: `Group multiple shapes together.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of shape indices to group',
        },
      },
      required: ['reason', 'slide_number', 'shape_indices'],
    },
  },
};

async function executePPTGroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGroupShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[]
    );
    if (response.success) {
      return { success: true, result: `Shapes grouped. Group index: ${response['group_index']}` };
    }
    return { success: false, error: response.error || 'Failed to group shapes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGroupShapesTool: LLMSimpleTool = {
  definition: PPT_GROUP_SHAPES_DEFINITION, execute: executePPTGroupShapes, categories: OFFICE_CATEGORIES, description: 'Group shapes in PowerPoint',
};

// =============================================================================
// PowerPoint Ungroup Shapes
// =============================================================================

const PPT_UNGROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_ungroup_shapes',
    description: `Ungroup a grouped shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are ungrouping' },
        slide_number: { type: 'number', description: 'Slide number' },
        group_index: { type: 'number', description: 'Group shape index' },
      },
      required: ['reason', 'slide_number', 'group_index'],
    },
  },
};

async function executePPTUngroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointUngroupShapes(
      args['slide_number'] as number, args['group_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Group ungrouped. Shape count: ${response['shape_count']}` };
    }
    return { success: false, error: response.error || 'Failed to ungroup shapes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptUngroupShapesTool: LLMSimpleTool = {
  definition: PPT_UNGROUP_SHAPES_DEFINITION, execute: executePPTUngroupShapes, categories: OFFICE_CATEGORIES, description: 'Ungroup shapes in PowerPoint',
};

// =============================================================================
// Export Z-Order Tools
// =============================================================================

export const zOrderTools: LLMSimpleTool[] = [
  pptBringToFrontTool,
  pptSendToBackTool,
  pptBringForwardTool,
  pptSendBackwardTool,
  pptAlignShapesTool,
  pptDistributeShapesTool,
  pptGroupShapesTool,
  pptUngroupShapesTool,
];
