/**
 * PowerPoint Effects Tools
 *
 * Tools for managing visual effects: transitions, backgrounds, animations,
 * shadows, reflections, and themes.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// PowerPoint Add Animation
// =============================================================================

const POWERPOINT_ADD_ANIMATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_animation',
    description: `Add animation effect to a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding animation' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        effect: { type: 'string', enum: ['fade', 'fly_in', 'zoom', 'wipe', 'appear'], description: 'Animation effect (default: fade)' },
        trigger: { type: 'string', enum: ['on_click', 'with_previous', 'after_previous'], description: 'Animation trigger (default: on_click)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointAddAnimation(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_animation', args);
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const response = await powerpointClient.powerpointAddAnimation(
      slideNum,
      shapeIndex,
      (args['effect'] as string) ?? 'fade',
      (args['trigger'] as string) ?? 'on_click'
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_animation', args, { slideNumber: slideNum, shapeIndex, effect: args['effect'] }, Date.now() - startTime);
      return { success: true, result: 'Animation added' };
    }
    logger.toolError('powerpoint_add_animation', args, new Error(response.error || 'Failed to add animation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add animation' };
  } catch (error) {
    logger.toolError('powerpoint_add_animation', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        slide_number: { type: 'number', description: 'Slide number' },
        transition: { type: 'string', enum: ['fade', 'push', 'wipe', 'split', 'reveal', 'random'], description: 'Transition type' },
        duration: { type: 'number', description: 'Transition duration in seconds (default: 1)' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointSetTransition(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_transition', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointSetTransition(
      slideNum,
      (args['transition'] as 'fade' | 'push' | 'wipe' | 'split' | 'reveal' | 'random') ?? 'fade',
      args['duration'] != null ? Number(args['duration']) : 1
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_transition', args, { slideNumber: slideNum, transition: args['transition'] }, Date.now() - startTime);
      return { success: true, result: `Transition set for slide ${slideNum}` };
    }
    logger.toolError('powerpoint_set_transition', args, new Error(response.error || 'Failed to set transition'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set transition' };
  } catch (error) {
    logger.toolError('powerpoint_set_transition', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Set slide background. Use either color OR image, not both. If both provided, color takes priority.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting background' },
        slide_number: { type: 'number', description: 'Slide number' },
        color: { type: 'string', description: 'Solid background color as hex (e.g., "#FFFFFF"). Takes priority over image.' },
        image: { type: 'string', description: 'Background image file path. WSL paths are auto-converted.' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointSetBackground(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_background', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointSetBackground(
      slideNum,
      {
        color: args['color'] as string | undefined,
        imagePath: args['image'] as string | undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_background', args, { slideNumber: slideNum }, Date.now() - startTime);
      return { success: true, result: `Background set for slide ${slideNum}` };
    }
    logger.toolError('powerpoint_set_background', args, new Error(response.error || 'Failed to set background'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set background' };
  } catch (error) {
    logger.toolError('powerpoint_set_background', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        reason: { type: 'string', description: 'Why you are setting shadow effect' },
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
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetShadow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shadow', args);
  try {
    const response = await powerpointClient.powerpointSetShadow(
      Number(args['slide_number']),
      Number(args['shape_index']),
      {
        visible: args['visible'] != null ? Boolean(args['visible']) : undefined,
        type: args['type'] as 'outer' | 'inner' | undefined,
        color: args['color'] as string | undefined,
        blur: args['blur'] != null ? Number(args['blur']) : undefined,
        offsetX: args['offset_x'] != null ? Number(args['offset_x']) : undefined,
        offsetY: args['offset_y'] != null ? Number(args['offset_y']) : undefined,
        transparency: args['transparency'] != null ? Number(args['transparency']) : undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shadow', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shadow effect updated' };
    }
    logger.toolError('powerpoint_set_shadow', args, new Error(response.error || 'Failed to set shadow'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shadow' };
  } catch (error) {
    logger.toolError('powerpoint_set_shadow', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Set reflection effect on a shape. Reflection creates a mirror image below the shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting reflection effect' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        visible: { type: 'boolean', description: 'Reflection visibility (true to show, false to hide)' },
        type: { type: 'number', description: 'Reflection preset (1=Tight, 2=Half, 3=Full, 4-6=Tight/Half/Full Touching, 7-9=Tight/Half/Full Offset)' },
        blur: { type: 'number', description: 'Blur amount in points' },
        offset: { type: 'number', description: 'Offset distance from shape in points' },
        size: { type: 'number', description: 'Reflection size as percentage (0-100)' },
        transparency: { type: 'number', description: 'Transparency percentage (0=opaque, 100=invisible)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetReflection(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_reflection', args);
  try {
    const response = await powerpointClient.powerpointSetReflection(
      Number(args['slide_number']),
      Number(args['shape_index']),
      {
        visible: args['visible'] != null ? Boolean(args['visible']) : undefined,
        type: args['type'] != null ? Number(args['type']) : undefined,
        blur: args['blur'] != null ? Number(args['blur']) : undefined,
        offset: args['offset'] != null ? Number(args['offset']) : undefined,
        size: args['size'] != null ? Number(args['size']) : undefined,
        transparency: args['transparency'] != null ? Number(args['transparency']) : undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_reflection', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Reflection effect updated' };
    }
    logger.toolError('powerpoint_set_reflection', args, new Error(response.error || 'Failed to set reflection'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set reflection' };
  } catch (error) {
    logger.toolError('powerpoint_set_reflection', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Apply a theme file (.thmx) to the presentation. Note: Built-in themes are not supported; you must provide a .thmx file path. WSL paths are auto-converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying a theme' },
        theme_path: { type: 'string', description: 'Path to theme file (.thmx)' },
      },
      required: ['reason', 'theme_path'],
    },
  },
};

async function executePowerPointApplyTheme(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_apply_theme', args);
  try {
    const response = await powerpointClient.powerpointApplyTheme(args['theme_path'] as string);
    if (response.success) {
      logger.toolSuccess('powerpoint_apply_theme', args, { themePath: args['theme_path'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Theme applied' };
    }
    logger.toolError('powerpoint_apply_theme', args, new Error(response.error || 'Failed to apply theme'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to apply theme' };
  } catch (error) {
    logger.toolError('powerpoint_apply_theme', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
