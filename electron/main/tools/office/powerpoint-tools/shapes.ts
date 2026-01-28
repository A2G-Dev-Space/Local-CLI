/**
 * PowerPoint Shape Tools
 *
 * Tools for managing shapes in PowerPoint presentations:
 * - Basic: add, delete, duplicate, rotate
 * - Info: get info, set name, list
 * - Transform: position, size, style, opacity
 * - Z-Order: bring to front, send to back, bring forward, send backward
 * - Multi-shape: align, distribute, group, ungroup
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// PowerPoint Add Shape
// =============================================================================

const POWERPOINT_ADD_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_shape',
    description: `Add a shape to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_type: { type: 'string', enum: ['rectangle', 'oval', 'triangle', 'arrow', 'star'], description: 'Type of shape' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        fill_color: { type: 'string', description: 'Fill color as hex (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_type', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executePowerPointAddShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_shape', args);
  try {
    const slideNum = Number(args['slide_number']);
    const response = await powerpointClient.powerpointAddShape(
      slideNum,
      args['shape_type'] as 'rectangle' | 'oval' | 'triangle' | 'arrow' | 'star',
      Number(args['left']),
      Number(args['top']),
      Number(args['width']),
      Number(args['height']),
      args['fill_color'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_shape', args, { slideNumber: slideNum, shapeType: args['shape_type'] }, Date.now() - startTime);
      return { success: true, result: `${args['shape_type']} shape added to slide ${slideNum}` };
    }
    logger.toolError('powerpoint_add_shape', args, new Error(response.error || 'Failed to add shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
    logger.toolError('powerpoint_add_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_SHAPE_DEFINITION,
  execute: executePowerPointAddShape,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint shape',
};

// =============================================================================
// PowerPoint Delete Shape
// =============================================================================

const POWERPOINT_DELETE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_shape',
    description: `Delete a shape from a slide. IMPORTANT: Shape indices shift after deletion. When deleting multiple shapes, delete from highest index to lowest to avoid index shift issues.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index to delete' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointDeleteShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_delete_shape', args);
  try {
    const response = await powerpointClient.powerpointDeleteShape(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_delete_shape', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape deleted' };
    }
    logger.toolError('powerpoint_delete_shape', args, new Error(response.error || 'Failed to delete shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete shape' };
  } catch (error) {
    logger.toolError('powerpoint_delete_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_SHAPE_DEFINITION,
  execute: executePowerPointDeleteShape,
  categories: OFFICE_CATEGORIES,
  description: 'Delete shape from slide',
};

// =============================================================================
// PowerPoint Duplicate Shape
// =============================================================================

const POWERPOINT_DUPLICATE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_duplicate_shape',
    description: `Duplicate a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are duplicating this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index to duplicate' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointDuplicateShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_duplicate_shape', args);
  try {
    const response = await powerpointClient.powerpointDuplicateShape(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_duplicate_shape', args, { slideNumber: args['slide_number'], newShapeIndex: response['new_shape_index'] }, Date.now() - startTime);
      return { success: true, result: `Shape duplicated. New shape index: ${response['new_shape_index']}` };
    }
    logger.toolError('powerpoint_duplicate_shape', args, new Error(response.error || 'Failed to duplicate shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to duplicate shape' };
  } catch (error) {
    logger.toolError('powerpoint_duplicate_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to duplicate shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDuplicateShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_DUPLICATE_SHAPE_DEFINITION,
  execute: executePowerPointDuplicateShape,
  categories: OFFICE_CATEGORIES,
  description: 'Duplicate shape',
};

// =============================================================================
// PowerPoint Rotate Shape
// =============================================================================

const POWERPOINT_ROTATE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_rotate_shape',
    description: `Rotate a shape to a specific angle.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are rotating this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        angle: { type: 'number', description: 'Rotation angle in degrees (0-360)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'angle'],
    },
  },
};

async function executePowerPointRotateShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_rotate_shape', args);
  try {
    const response = await powerpointClient.powerpointRotateShape(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['angle'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_rotate_shape', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'], angle: args['angle'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape rotated' };
    }
    logger.toolError('powerpoint_rotate_shape', args, new Error(response.error || 'Failed to rotate shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to rotate shape' };
  } catch (error) {
    logger.toolError('powerpoint_rotate_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to rotate shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointRotateShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_ROTATE_SHAPE_DEFINITION,
  execute: executePowerPointRotateShape,
  categories: OFFICE_CATEGORIES,
  description: 'Rotate shape',
};

// =============================================================================
// PowerPoint Get Shape Info
// =============================================================================

const POWERPOINT_GET_SHAPE_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_shape_info',
    description: `Get detailed information about a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need shape information' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointGetShapeInfo(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_shape_info', args);
  try {
    const response = await powerpointClient.powerpointGetShapeInfo(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_get_shape_info', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    logger.toolError('powerpoint_get_shape_info', args, new Error(response.error || 'Failed to get shape info'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get shape info' };
  } catch (error) {
    logger.toolError('powerpoint_get_shape_info', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get shape info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetShapeInfoTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SHAPE_INFO_DEFINITION,
  execute: executePowerPointGetShapeInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get shape information',
};

// =============================================================================
// PowerPoint Set Shape Name
// =============================================================================

const POWERPOINT_SET_SHAPE_NAME_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_name',
    description: `Set a name for a shape (for easier identification).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting the shape name' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        name: { type: 'string', description: 'Shape name' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'name'],
    },
  },
};

async function executePowerPointSetShapeName(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shape_name', args);
  try {
    const response = await powerpointClient.powerpointSetShapeName(
      Number(args['slide_number']),
      Number(args['shape_index']),
      args['name'] as string
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shape_name', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'], name: args['name'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape name set' };
    }
    logger.toolError('powerpoint_set_shape_name', args, new Error(response.error || 'Failed to set shape name'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shape name' };
  } catch (error) {
    logger.toolError('powerpoint_set_shape_name', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set shape name: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShapeNameTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHAPE_NAME_DEFINITION,
  execute: executePowerPointSetShapeName,
  categories: OFFICE_CATEGORIES,
  description: 'Set shape name',
};

// =============================================================================
// PowerPoint Get Shape List
// =============================================================================

const POWERPOINT_GET_SHAPE_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_shape_list',
    description: `Get list of all shapes on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are getting the shape list' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePowerPointGetShapeList(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_shape_list', args);
  try {
    const response = await powerpointClient.powerpointGetShapeList(Number(args['slide_number']));
    if (response.success) {
      logger.toolSuccess('powerpoint_get_shape_list', args, { slideNumber: args['slide_number'] }, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    logger.toolError('powerpoint_get_shape_list', args, new Error(response.error || 'Failed to get shape list'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get shape list' };
  } catch (error) {
    logger.toolError('powerpoint_get_shape_list', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get shape list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetShapeListTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SHAPE_LIST_DEFINITION,
  execute: executePowerPointGetShapeList,
  categories: OFFICE_CATEGORIES,
  description: 'Get list of shapes on slide',
};

// =============================================================================
// PowerPoint Set Shape Position
// =============================================================================

const POWERPOINT_SET_SHAPE_POSITION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_position',
    description: `Set the position of a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting the shape position' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'left', 'top'],
    },
  },
};

async function executePowerPointSetShapePosition(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shape_position', args);
  try {
    const response = await powerpointClient.powerpointSetShapePosition(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['left']),
      Number(args['top'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shape_position', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape position set' };
    }
    logger.toolError('powerpoint_set_shape_position', args, new Error(response.error || 'Failed to set shape position'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shape position' };
  } catch (error) {
    logger.toolError('powerpoint_set_shape_position', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set shape position: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShapePositionTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHAPE_POSITION_DEFINITION,
  execute: executePowerPointSetShapePosition,
  categories: OFFICE_CATEGORIES,
  description: 'Set shape position',
};

// =============================================================================
// PowerPoint Set Shape Size
// =============================================================================

const POWERPOINT_SET_SHAPE_SIZE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_size',
    description: `Set the size of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting the shape size' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        lock_aspect_ratio: { type: 'boolean', description: 'Lock aspect ratio (default: false)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'width', 'height'],
    },
  },
};

async function executePowerPointSetShapeSize(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shape_size', args);
  try {
    const response = await powerpointClient.powerpointSetShapeSize(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['width']),
      Number(args['height']),
      args['lock_aspect_ratio'] != null ? Boolean(args['lock_aspect_ratio']) : undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shape_size', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape size set' };
    }
    logger.toolError('powerpoint_set_shape_size', args, new Error(response.error || 'Failed to set shape size'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shape size' };
  } catch (error) {
    logger.toolError('powerpoint_set_shape_size', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set shape size: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShapeSizeTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHAPE_SIZE_DEFINITION,
  execute: executePowerPointSetShapeSize,
  categories: OFFICE_CATEGORIES,
  description: 'Set shape size',
};

// =============================================================================
// PowerPoint Set Shape Style
// =============================================================================

const POWERPOINT_SET_SHAPE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_style',
    description: `Set the fill and line style of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting the shape style' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        fill_color: { type: 'string', description: 'Fill color (hex: #RRGGBB)' },
        fill_transparency: { type: 'number', description: 'Fill transparency (0-100)' },
        line_color: { type: 'string', description: 'Line/border color (hex)' },
        line_weight: { type: 'number', description: 'Line weight in points' },
        line_style: { type: 'string', enum: ['solid', 'dash', 'dot', 'dashDot'], description: 'Line style' },
        no_fill: { type: 'boolean', description: 'Remove fill' },
        no_line: { type: 'boolean', description: 'Remove line/border' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetShapeStyle(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shape_style', args);
  try {
    const response = await powerpointClient.powerpointSetShapeStyle(
      Number(args['slide_number']),
      Number(args['shape_index']),
      {
        fillColor: args['fill_color'] as string | undefined,
        fillTransparency: args['fill_transparency'] != null ? Number(args['fill_transparency']) : undefined,
        lineColor: args['line_color'] as string | undefined,
        lineWeight: args['line_weight'] != null ? Number(args['line_weight']) : undefined,
        lineStyle: args['line_style'] as 'solid' | 'dash' | 'dot' | 'dashDot' | undefined,
        noFill: args['no_fill'] != null ? Boolean(args['no_fill']) : undefined,
        noLine: args['no_line'] != null ? Boolean(args['no_line']) : undefined,
      }
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shape_style', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape style updated' };
    }
    logger.toolError('powerpoint_set_shape_style', args, new Error(response.error || 'Failed to set shape style'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shape style' };
  } catch (error) {
    logger.toolError('powerpoint_set_shape_style', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set shape style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShapeStyleTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHAPE_STYLE_DEFINITION,
  execute: executePowerPointSetShapeStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Set shape fill and line style',
};

// =============================================================================
// PowerPoint Set Shape Opacity
// =============================================================================

const POWERPOINT_SET_SHAPE_OPACITY_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_opacity',
    description: `Set the opacity/transparency of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting the shape opacity' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        opacity: { type: 'number', description: 'Opacity percentage (0-100, where 0 is fully transparent)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'opacity'],
    },
  },
};

async function executePowerPointSetShapeOpacity(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_set_shape_opacity', args);
  try {
    const response = await powerpointClient.powerpointSetShapeOpacity(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['opacity'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_set_shape_opacity', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'], opacity: args['opacity'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape opacity set' };
    }
    logger.toolError('powerpoint_set_shape_opacity', args, new Error(response.error || 'Failed to set shape opacity'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set shape opacity' };
  } catch (error) {
    logger.toolError('powerpoint_set_shape_opacity', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set shape opacity: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetShapeOpacityTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SHAPE_OPACITY_DEFINITION,
  execute: executePowerPointSetShapeOpacity,
  categories: OFFICE_CATEGORIES,
  description: 'Set shape opacity',
};

// =============================================================================
// PowerPoint Z-Order Functions
// =============================================================================

const POWERPOINT_BRING_TO_FRONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_bring_to_front',
    description: `Bring a shape to the front (topmost layer).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are bringing the shape to front' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointBringToFront(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_bring_to_front', args);
  try {
    const response = await powerpointClient.powerpointBringToFront(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_bring_to_front', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape brought to front' };
    }
    logger.toolError('powerpoint_bring_to_front', args, new Error(response.error || 'Failed to bring shape to front'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to bring shape to front' };
  } catch (error) {
    logger.toolError('powerpoint_bring_to_front', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to bring shape to front: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointBringToFrontTool: LLMSimpleTool = {
  definition: POWERPOINT_BRING_TO_FRONT_DEFINITION,
  execute: executePowerPointBringToFront,
  categories: OFFICE_CATEGORIES,
  description: 'Bring shape to front',
};

const POWERPOINT_SEND_TO_BACK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_send_to_back',
    description: `Send a shape to the back (bottommost layer).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sending the shape to back' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSendToBack(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_send_to_back', args);
  try {
    const response = await powerpointClient.powerpointSendToBack(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_send_to_back', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape sent to back' };
    }
    logger.toolError('powerpoint_send_to_back', args, new Error(response.error || 'Failed to send shape to back'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to send shape to back' };
  } catch (error) {
    logger.toolError('powerpoint_send_to_back', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to send shape to back: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSendToBackTool: LLMSimpleTool = {
  definition: POWERPOINT_SEND_TO_BACK_DEFINITION,
  execute: executePowerPointSendToBack,
  categories: OFFICE_CATEGORIES,
  description: 'Send shape to back',
};

const POWERPOINT_BRING_FORWARD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_bring_forward',
    description: `Bring a shape forward one layer.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are bringing the shape forward' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointBringForward(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_bring_forward', args);
  try {
    const response = await powerpointClient.powerpointBringForward(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_bring_forward', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape brought forward' };
    }
    logger.toolError('powerpoint_bring_forward', args, new Error(response.error || 'Failed to bring shape forward'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to bring shape forward' };
  } catch (error) {
    logger.toolError('powerpoint_bring_forward', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to bring shape forward: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointBringForwardTool: LLMSimpleTool = {
  definition: POWERPOINT_BRING_FORWARD_DEFINITION,
  execute: executePowerPointBringForward,
  categories: OFFICE_CATEGORIES,
  description: 'Bring shape forward one layer',
};

const POWERPOINT_SEND_BACKWARD_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_send_backward',
    description: `Send a shape backward one layer.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sending the shape backward' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSendBackward(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_send_backward', args);
  try {
    const response = await powerpointClient.powerpointSendBackward(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_send_backward', args, { slideNumber: args['slide_number'], shapeIndex: args['shape_index'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape sent backward' };
    }
    logger.toolError('powerpoint_send_backward', args, new Error(response.error || 'Failed to send shape backward'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to send shape backward' };
  } catch (error) {
    logger.toolError('powerpoint_send_backward', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to send shape backward: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSendBackwardTool: LLMSimpleTool = {
  definition: POWERPOINT_SEND_BACKWARD_DEFINITION,
  execute: executePowerPointSendBackward,
  categories: OFFICE_CATEGORIES,
  description: 'Send shape backward one layer',
};

// =============================================================================
// PowerPoint Align Shapes
// =============================================================================

const POWERPOINT_ALIGN_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_align_shapes',
    description: `Align multiple shapes.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are aligning the shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices to align' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'], description: 'Alignment type' },
      },
      required: ['reason', 'slide_number', 'shape_indices', 'alignment'],
    },
  },
};

async function executePowerPointAlignShapes(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_align_shapes', args);
  try {
    const response = await powerpointClient.powerpointAlignShapes(
      Number(args['slide_number']),
      (args['shape_indices'] as unknown[]).map(Number),
      args['alignment'] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_align_shapes', args, { slideNumber: args['slide_number'], alignment: args['alignment'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shapes aligned' };
    }
    logger.toolError('powerpoint_align_shapes', args, new Error(response.error || 'Failed to align shapes'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to align shapes' };
  } catch (error) {
    logger.toolError('powerpoint_align_shapes', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to align shapes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAlignShapesTool: LLMSimpleTool = {
  definition: POWERPOINT_ALIGN_SHAPES_DEFINITION,
  execute: executePowerPointAlignShapes,
  categories: OFFICE_CATEGORIES,
  description: 'Align multiple shapes',
};

// =============================================================================
// PowerPoint Distribute Shapes
// =============================================================================

const POWERPOINT_DISTRIBUTE_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_distribute_shapes',
    description: `Distribute shapes evenly.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are distributing the shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices' },
        direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Distribution direction' },
      },
      required: ['reason', 'slide_number', 'shape_indices', 'direction'],
    },
  },
};

async function executePowerPointDistributeShapes(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_distribute_shapes', args);
  try {
    const response = await powerpointClient.powerpointDistributeShapes(
      Number(args['slide_number']),
      (args['shape_indices'] as unknown[]).map(Number),
      args['direction'] as 'horizontal' | 'vertical'
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_distribute_shapes', args, { slideNumber: args['slide_number'], direction: args['direction'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shapes distributed' };
    }
    logger.toolError('powerpoint_distribute_shapes', args, new Error(response.error || 'Failed to distribute shapes'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to distribute shapes' };
  } catch (error) {
    logger.toolError('powerpoint_distribute_shapes', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to distribute shapes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDistributeShapesTool: LLMSimpleTool = {
  definition: POWERPOINT_DISTRIBUTE_SHAPES_DEFINITION,
  execute: executePowerPointDistributeShapes,
  categories: OFFICE_CATEGORIES,
  description: 'Distribute shapes evenly',
};

// =============================================================================
// PowerPoint Group Shapes
// =============================================================================

const POWERPOINT_GROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_group_shapes',
    description: `Group multiple shapes together.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping the shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices to group' },
      },
      required: ['reason', 'slide_number', 'shape_indices'],
    },
  },
};

async function executePowerPointGroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_group_shapes', args);
  try {
    const response = await powerpointClient.powerpointGroupShapes(
      Number(args['slide_number']),
      (args['shape_indices'] as unknown[]).map(Number)
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_group_shapes', args, { slideNumber: args['slide_number'], groupIndex: response['group_index'] }, Date.now() - startTime);
      return { success: true, result: `Shapes grouped. Group index: ${response['group_index']}` };
    }
    logger.toolError('powerpoint_group_shapes', args, new Error(response.error || 'Failed to group shapes'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to group shapes' };
  } catch (error) {
    logger.toolError('powerpoint_group_shapes', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to group shapes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGroupShapesTool: LLMSimpleTool = {
  definition: POWERPOINT_GROUP_SHAPES_DEFINITION,
  execute: executePowerPointGroupShapes,
  categories: OFFICE_CATEGORIES,
  description: 'Group shapes together',
};

// =============================================================================
// PowerPoint Ungroup Shapes
// =============================================================================

const POWERPOINT_UNGROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_ungroup_shapes',
    description: `Ungroup a grouped shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are ungrouping the shapes' },
        slide_number: { type: 'number', description: 'Slide number' },
        group_index: { type: 'number', description: 'Group shape index' },
      },
      required: ['reason', 'slide_number', 'group_index'],
    },
  },
};

async function executePowerPointUngroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_ungroup_shapes', args);
  try {
    const response = await powerpointClient.powerpointUngroupShapes(
      Number(args['slide_number']),
      Number(args['group_index'])
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_ungroup_shapes', args, { slideNumber: args['slide_number'], shapeCount: response['shape_count'] }, Date.now() - startTime);
      return { success: true, result: `Group ungrouped. ${response['shape_count']} shapes` };
    }
    logger.toolError('powerpoint_ungroup_shapes', args, new Error(response.error || 'Failed to ungroup shapes'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to ungroup shapes' };
  } catch (error) {
    logger.toolError('powerpoint_ungroup_shapes', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to ungroup shapes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointUngroupShapesTool: LLMSimpleTool = {
  definition: POWERPOINT_UNGROUP_SHAPES_DEFINITION,
  execute: executePowerPointUngroupShapes,
  categories: OFFICE_CATEGORIES,
  description: 'Ungroup shapes',
};

// =============================================================================
// PowerPoint Flip Shape
// =============================================================================

const POWERPOINT_FLIP_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_flip_shape',
    description: `Flip a shape horizontally or vertically.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are flipping this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Flip direction' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'direction'],
    },
  },
};

async function executePowerPointFlipShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_flip_shape', args);
  try {
    const response = await powerpointClient.powerpointFlipShape(
      Number(args['slide_number']),
      Number(args['shape_index']),
      args['direction'] as 'horizontal' | 'vertical'
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_flip_shape', args, { direction: args['direction'] }, Date.now() - startTime);
      return { success: true, result: response.message || 'Shape flipped' };
    }
    logger.toolError('powerpoint_flip_shape', args, new Error(response.error || 'Failed to flip shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to flip shape' };
  } catch (error) {
    logger.toolError('powerpoint_flip_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to flip shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointFlipShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_FLIP_SHAPE_DEFINITION,
  execute: executePowerPointFlipShape,
  categories: OFFICE_CATEGORIES,
  description: 'Flip shape horizontally or vertically',
};

// =============================================================================
// PowerPoint Copy Shape
// =============================================================================

const POWERPOINT_COPY_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_copy_shape',
    description: `Copy a shape to the same slide or a different slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are copying this shape' },
        source_slide: { type: 'number', description: 'Source slide number' },
        shape_index: { type: 'number', description: 'Shape index to copy' },
        target_slide: { type: 'number', description: 'Target slide number (default: same slide)' },
      },
      required: ['reason', 'source_slide', 'shape_index'],
    },
  },
};

async function executePowerPointCopyShape(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_copy_shape', args);
  try {
    const response = await powerpointClient.powerpointCopyShape(
      Number(args['source_slide']),
      Number(args['shape_index']),
      args['target_slide'] != null ? Number(args['target_slide']) : undefined
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_copy_shape', args, { newShapeIndex: response['new_shape_index'] }, Date.now() - startTime);
      return { success: true, result: `${response.message}. New shape index: ${response['new_shape_index']}` };
    }
    logger.toolError('powerpoint_copy_shape', args, new Error(response.error || 'Failed to copy shape'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to copy shape' };
  } catch (error) {
    logger.toolError('powerpoint_copy_shape', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to copy shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCopyShapeTool: LLMSimpleTool = {
  definition: POWERPOINT_COPY_SHAPE_DEFINITION,
  execute: executePowerPointCopyShape,
  categories: OFFICE_CATEGORIES,
  description: 'Copy shape to same or different slide',
};

// =============================================================================
// Export
// =============================================================================

export const shapesTools: LLMSimpleTool[] = [
  powerpointAddShapeTool,
  powerpointDeleteShapeTool,
  powerpointDuplicateShapeTool,
  powerpointRotateShapeTool,
  powerpointGetShapeInfoTool,
  powerpointSetShapeNameTool,
  powerpointGetShapeListTool,
  powerpointSetShapePositionTool,
  powerpointSetShapeSizeTool,
  powerpointSetShapeStyleTool,
  powerpointSetShapeOpacityTool,
  powerpointBringToFrontTool,
  powerpointSendToBackTool,
  powerpointBringForwardTool,
  powerpointSendBackwardTool,
  powerpointAlignShapesTool,
  powerpointDistributeShapesTool,
  powerpointGroupShapesTool,
  powerpointUngroupShapesTool,
  powerpointFlipShapeTool,
  powerpointCopyShapeTool,
];
