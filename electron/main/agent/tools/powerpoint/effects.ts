/**
 * PowerPoint Effects Tools
 *
 * Effect operations: setShadow, setReflection
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Set Shadow
// =============================================================================

const PPT_SET_SHADOW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shadow',
    description: `Set shadow effect for a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting shadow' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        visible: { type: 'boolean', description: 'Show/hide shadow' },
        type: { type: 'string', enum: ['outer', 'inner'], description: 'Shadow type' },
        color: { type: 'string', description: 'Shadow color as hex' },
        blur: { type: 'number', description: 'Blur amount' },
        offset_x: { type: 'number', description: 'Horizontal offset' },
        offset_y: { type: 'number', description: 'Vertical offset' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetShadow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShadow(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        visible: args['visible'] as boolean | undefined,
        type: args['type'] as 'outer' | 'inner' | undefined,
        color: args['color'] as string | undefined,
        blur: args['blur'] as number | undefined,
        offsetX: args['offset_x'] as number | undefined,
        offsetY: args['offset_y'] as number | undefined,
        transparency: args['transparency'] as number | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Shadow effect updated' }; }
    return { success: false, error: response.error || 'Failed to set shadow' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShadowTool: LLMSimpleTool = {
  definition: PPT_SET_SHADOW_DEFINITION, execute: executePPTSetShadow, categories: OFFICE_CATEGORIES, description: 'Set shadow in PowerPoint',
};

// =============================================================================
// PowerPoint Set Reflection
// =============================================================================

const PPT_SET_REFLECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_reflection',
    description: `Set reflection effect for a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting reflection' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        visible: { type: 'boolean', description: 'Show/hide reflection' },
        type: { type: 'number', description: 'Reflection type (1-9)' },
        blur: { type: 'number', description: 'Blur amount' },
        offset: { type: 'number', description: 'Offset distance' },
        size: { type: 'number', description: 'Reflection size' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetReflection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetReflection(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        visible: args['visible'] as boolean | undefined,
        type: args['type'] as number | undefined,
        blur: args['blur'] as number | undefined,
        offset: args['offset'] as number | undefined,
        size: args['size'] as number | undefined,
        transparency: args['transparency'] as number | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Reflection effect updated' }; }
    return { success: false, error: response.error || 'Failed to set reflection' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetReflectionTool: LLMSimpleTool = {
  definition: PPT_SET_REFLECTION_DEFINITION, execute: executePPTSetReflection, categories: OFFICE_CATEGORIES, description: 'Set reflection in PowerPoint',
};

// =============================================================================
// Export Effects Tools
// =============================================================================

export const effectsTools: LLMSimpleTool[] = [
  pptSetShadowTool,
  pptSetReflectionTool,
];
