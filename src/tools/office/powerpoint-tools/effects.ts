/**
 * PowerPoint Effects Tools
 *
 * Tools for managing visual effects: transitions, backgrounds, animations,
 * shadows, reflections, and themes.
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// PowerPoint Add Animation
// =============================================================================

const POWERPOINT_ADD_ANIMATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_animation',
    description: `Add animation effect to a shape. Effects: fade, fly_in, zoom, wipe, appear.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding animation' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index' },
        effect: { type: 'string', description: 'Animation effect (fade, fly_in, zoom, wipe, appear)' },
        trigger: { type: 'string', enum: ['on_click', 'with_previous', 'after_previous'], description: 'Animation trigger' },
      },
      required: ['reason', 'slide', 'shape'],
    },
  },
};

async function executePowerPointAddAnimation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddAnimation(
      args['slide'] as number,
      args['shape'] as number,
      args['effect'] as string ?? 'fade',
      args['trigger'] as string ?? 'on_click'
    );
    if (response.success) {
      return { success: true, result: 'Animation added' };
    }
    return { success: false, error: response.error || 'Failed to add animation' };
  } catch (error) {
    return { success: false, error: `Failed to add animation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddAnimationTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_ANIMATION_DEFINITION,
  execute: executePowerPointAddAnimation,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint animation',
};

// =============================================================================
// PowerPoint Set Transition
// =============================================================================

const POWERPOINT_SET_TRANSITION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_transition',
    description: `Set slide transition effect.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting transition' },
        slide: { type: 'number', description: 'Slide number' },
        transition: { type: 'string', enum: ['fade', 'push', 'wipe', 'split', 'reveal', 'random'], description: 'Transition type' },
        duration: { type: 'number', description: 'Transition duration in seconds (default: 1)' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointSetTransition(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTransition(
      args['slide'] as number,
      args['transition'] as 'fade' | 'push' | 'wipe' | 'split' | 'reveal' | 'random' ?? 'fade',
      args['duration'] as number ?? 1
    );
    if (response.success) {
      return { success: true, result: `Transition set for slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to set transition' };
  } catch (error) {
    return { success: false, error: `Failed to set transition: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTransitionTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TRANSITION_DEFINITION,
  execute: executePowerPointSetTransition,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint transition',
};

// =============================================================================
// PowerPoint Set Background
// =============================================================================

const POWERPOINT_SET_BACKGROUND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_background',
    description: `Set slide background color or image.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting background' },
        slide: { type: 'number', description: 'Slide number' },
        color: { type: 'string', description: 'Background color as hex (e.g., "#FFFFFF")' },
        image: { type: 'string', description: 'Background image file path' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointSetBackground(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetBackground(
      args['slide'] as number,
      {
        color: args['color'] as string | undefined,
        imagePath: args['image'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Background set for slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to set background' };
  } catch (error) {
    return { success: false, error: `Failed to set background: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetBackgroundTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_BACKGROUND_DEFINITION,
  execute: executePowerPointSetBackground,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint background',
};

// =============================================================================
// PowerPoint Set Shadow
// =============================================================================

const POWERPOINT_SET_SHADOW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shadow',
    description: `Set shadow effect on a shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        visible: { type: 'boolean', description: 'Shadow visibility' },
        type: { type: 'string', enum: ['outer', 'inner'], description: 'Shadow type' },
        color: { type: 'string', description: 'Shadow color (hex)' },
        blur: { type: 'number', description: 'Blur amount' },
        offset_x: { type: 'number', description: 'Horizontal offset' },
        offset_y: { type: 'number', description: 'Vertical offset' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetShadow(args: Record<string, unknown>): Promise<ToolResult> {
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
    if (response.success) {
      return { success: true, result: response.message || 'Shadow effect updated' };
    }
    return { success: false, error: response.error || 'Failed to set shadow' };
  } catch (error) {
    return { success: false, error: `Failed to set shadow: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShadowTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHADOW_DEFINITION,
  execute: executePowerPointSetShadow,
  categories: OFFICE_CATEGORIES,
  description: 'Set shadow effect',
};

// =============================================================================
// PowerPoint Set Reflection
// =============================================================================

const POWERPOINT_SET_REFLECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_reflection',
    description: `Set reflection effect on a shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        visible: { type: 'boolean', description: 'Reflection visibility' },
        type: { type: 'number', description: 'Reflection type (1-9)' },
        blur: { type: 'number', description: 'Blur amount' },
        offset: { type: 'number', description: 'Offset from shape' },
        size: { type: 'number', description: 'Reflection size percentage' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetReflection(args: Record<string, unknown>): Promise<ToolResult> {
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
    if (response.success) {
      return { success: true, result: response.message || 'Reflection effect updated' };
    }
    return { success: false, error: response.error || 'Failed to set reflection' };
  } catch (error) {
    return { success: false, error: `Failed to set reflection: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetReflectionTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_REFLECTION_DEFINITION,
  execute: executePowerPointSetReflection,
  categories: OFFICE_CATEGORIES,
  description: 'Set reflection effect',
};

// =============================================================================
// PowerPoint Apply Theme
// =============================================================================

const POWERPOINT_APPLY_THEME_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_apply_theme',
    description: `Apply a theme to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        theme_path: { type: 'string', description: 'Path to theme file (.thmx)' },
      },
      required: ['theme_path'],
    },
  },
};

async function executePowerPointApplyTheme(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointApplyTheme(args['theme_path'] as string);
    if (response.success) {
      return { success: true, result: response.message || 'Theme applied' };
    }
    return { success: false, error: response.error || 'Failed to apply theme' };
  } catch (error) {
    return { success: false, error: `Failed to apply theme: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointApplyThemeTool: LLMSimpleTool = {
  definition: POWERPOINT_APPLY_THEME_DEFINITION,
  execute: executePowerPointApplyTheme,
  categories: OFFICE_CATEGORIES,
  description: 'Apply theme to presentation',
};

// =============================================================================
// Export
// =============================================================================

export const effectsTools: LLMSimpleTool[] = [
  powerpointAddAnimationTool,
  powerpointSetTransitionTool,
  powerpointSetBackgroundTool,
  powerpointSetShadowTool,
  powerpointSetReflectionTool,
  powerpointApplyThemeTool,
];
