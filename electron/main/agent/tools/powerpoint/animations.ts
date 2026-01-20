/**
 * PowerPoint Animation Tools
 *
 * Animation operations: addAnimation, setTransition
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Animation
// =============================================================================

const PPT_ADD_ANIMATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_animation',
    description: `Add an animation effect to a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding animation' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        effect: {
          type: 'string',
          enum: ['fade', 'appear', 'fly_in', 'zoom', 'wipe'],
          description: 'Animation effect type (default: fade)',
        },
        trigger: {
          type: 'string',
          enum: ['on_click', 'with_previous', 'after_previous'],
          description: 'Animation trigger (default: on_click)',
        },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTAddAnimation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const effect = (args['effect'] as string) || 'fade';
    const trigger = (args['trigger'] as string) || 'on_click';
    const response = await powerpointClient.powerpointAddAnimation(
      args['slide_number'] as number,
      args['shape_index'] as number,
      effect,
      trigger
    );
    if (response.success) { return { success: true, result: `Animation '${effect}' added` }; }
    return { success: false, error: response.error || 'Failed to add animation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddAnimationTool: LLMSimpleTool = {
  definition: PPT_ADD_ANIMATION_DEFINITION, execute: executePPTAddAnimation, categories: OFFICE_CATEGORIES, description: 'Add animation in PowerPoint',
};

// =============================================================================
// PowerPoint Set Transition
// =============================================================================

const PPT_SET_TRANSITION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_transition',
    description: `Set transition effect for a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting transition' },
        slide_number: { type: 'number', description: 'Slide number' },
        transition_type: {
          type: 'string',
          enum: ['fade', 'push', 'wipe', 'split', 'reveal', 'random'],
          description: 'Transition effect type (default: fade)',
        },
        duration: { type: 'number', description: 'Duration in seconds (default: 1)' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTSetTransition(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const transitionType = (args['transition_type'] as 'fade' | 'push' | 'wipe' | 'split' | 'reveal' | 'random') || 'fade';
    const duration = (args['duration'] as number) || 1;
    const response = await powerpointClient.powerpointSetTransition(
      args['slide_number'] as number, transitionType, duration
    );
    if (response.success) { return { success: true, result: `Transition '${transitionType}' set` }; }
    return { success: false, error: response.error || 'Failed to set transition' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTransitionTool: LLMSimpleTool = {
  definition: PPT_SET_TRANSITION_DEFINITION, execute: executePPTSetTransition, categories: OFFICE_CATEGORIES, description: 'Set transition in PowerPoint',
};

// =============================================================================
// Export Animation Tools
// =============================================================================

export const animationsTools: LLMSimpleTool[] = [
  pptAddAnimationTool,
  pptSetTransitionTool,
];
