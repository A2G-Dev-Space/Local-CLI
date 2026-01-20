/**
 * PowerPoint Shape Tools
 *
 * Shape operations: addImage, addShape, deleteShape, duplicateShape, rotateShape,
 * getShapeInfo, setShapeName, setShapeOpacity, getShapeList, setShapePosition,
 * setShapeSize, setShapeStyle, setTextboxBorder, setTextboxFill
 * Total: 14 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Image
// =============================================================================

const PPT_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_image',
    description: `Add an image to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        slide_number: { type: 'number', description: 'Slide number' },
        image_path: { type: 'string', description: 'Path to the image file' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
      },
      required: ['reason', 'slide_number', 'image_path'],
    },
  },
};

async function executePPTAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddImage(
      args['slide_number'] as number,
      args['image_path'] as string,
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: `Image added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddImageTool: LLMSimpleTool = {
  definition: PPT_ADD_IMAGE_DEFINITION, execute: executePPTAddImage, categories: OFFICE_CATEGORIES, description: 'Add image in PowerPoint',
};

// =============================================================================
// PowerPoint Add Shape
// =============================================================================

const PPT_ADD_SHAPE_DEFINITION: ToolDefinition = {
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

async function executePPTAddShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddShape(
      args['slide_number'] as number,
      args['shape_type'] as 'rectangle' | 'oval' | 'triangle' | 'arrow' | 'star',
      args['left'] as number, args['top'] as number,
      args['width'] as number, args['height'] as number,
      args['fill_color'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Shape added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddShapeTool: LLMSimpleTool = {
  definition: PPT_ADD_SHAPE_DEFINITION, execute: executePPTAddShape, categories: OFFICE_CATEGORIES, description: 'Add shape in PowerPoint',
};

// =============================================================================
// PowerPoint Delete Shape
// =============================================================================

const PPT_DELETE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_shape',
    description: `Delete a shape from a slide.`,
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

async function executePPTDeleteShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteShape(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) { return { success: true, result: 'Shape deleted' }; }
    return { success: false, error: response.error || 'Failed to delete shape' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDeleteShapeTool: LLMSimpleTool = {
  definition: PPT_DELETE_SHAPE_DEFINITION, execute: executePPTDeleteShape, categories: OFFICE_CATEGORIES, description: 'Delete shape in PowerPoint',
};

// =============================================================================
// PowerPoint Duplicate Shape
// =============================================================================

const PPT_DUPLICATE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_duplicate_shape',
    description: `Duplicate a shape.`,
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

async function executePPTDuplicateShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDuplicateShape(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Shape duplicated. New index: ${response['new_shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to duplicate shape' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDuplicateShapeTool: LLMSimpleTool = {
  definition: PPT_DUPLICATE_SHAPE_DEFINITION, execute: executePPTDuplicateShape, categories: OFFICE_CATEGORIES, description: 'Duplicate shape in PowerPoint',
};

// =============================================================================
// PowerPoint Rotate Shape
// =============================================================================

const PPT_ROTATE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_rotate_shape',
    description: `Rotate a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are rotating this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        angle: { type: 'number', description: 'Rotation angle in degrees' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'angle'],
    },
  },
};

async function executePPTRotateShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointRotateShape(
      args['slide_number'] as number, args['shape_index'] as number, args['angle'] as number
    );
    if (response.success) { return { success: true, result: `Shape rotated to ${args['angle']} degrees` }; }
    return { success: false, error: response.error || 'Failed to rotate shape' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptRotateShapeTool: LLMSimpleTool = {
  definition: PPT_ROTATE_SHAPE_DEFINITION, execute: executePPTRotateShape, categories: OFFICE_CATEGORIES, description: 'Rotate shape in PowerPoint',
};

// =============================================================================
// PowerPoint Get Shape Info
// =============================================================================

const PPT_GET_SHAPE_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_shape_info',
    description: `Get information about a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need shape info' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTGetShapeInfo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetShapeInfo(
      args['slide_number'] as number, args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get shape info' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetShapeInfoTool: LLMSimpleTool = {
  definition: PPT_GET_SHAPE_INFO_DEFINITION, execute: executePPTGetShapeInfo, categories: OFFICE_CATEGORIES, description: 'Get shape info in PowerPoint',
};

// =============================================================================
// PowerPoint Set Shape Name
// =============================================================================

const PPT_SET_SHAPE_NAME_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_name',
    description: `Set the name of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are naming this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        name: { type: 'string', description: 'New name for the shape' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'name'],
    },
  },
};

async function executePPTSetShapeName(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShapeName(
      args['slide_number'] as number, args['shape_index'] as number, args['name'] as string
    );
    if (response.success) { return { success: true, result: 'Shape name set' }; }
    return { success: false, error: response.error || 'Failed to set shape name' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShapeNameTool: LLMSimpleTool = {
  definition: PPT_SET_SHAPE_NAME_DEFINITION, execute: executePPTSetShapeName, categories: OFFICE_CATEGORIES, description: 'Set shape name in PowerPoint',
};

// =============================================================================
// PowerPoint Set Shape Opacity
// =============================================================================

const PPT_SET_SHAPE_OPACITY_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_opacity',
    description: `Set the opacity of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing opacity' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        opacity: { type: 'number', description: 'Opacity percentage (0-100)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'opacity'],
    },
  },
};

async function executePPTSetShapeOpacity(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShapeOpacity(
      args['slide_number'] as number, args['shape_index'] as number, args['opacity'] as number
    );
    if (response.success) { return { success: true, result: `Shape opacity set to ${args['opacity']}%` }; }
    return { success: false, error: response.error || 'Failed to set shape opacity' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShapeOpacityTool: LLMSimpleTool = {
  definition: PPT_SET_SHAPE_OPACITY_DEFINITION, execute: executePPTSetShapeOpacity, categories: OFFICE_CATEGORIES, description: 'Set shape opacity in PowerPoint',
};

// =============================================================================
// PowerPoint Get Shape List
// =============================================================================

const PPT_GET_SHAPE_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_shape_list',
    description: `Get list of all shapes on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need shape list' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTGetShapeList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetShapeList(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get shape list' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetShapeListTool: LLMSimpleTool = {
  definition: PPT_GET_SHAPE_LIST_DEFINITION, execute: executePPTGetShapeList, categories: OFFICE_CATEGORIES, description: 'Get shape list in PowerPoint',
};

// =============================================================================
// PowerPoint Set Shape Position
// =============================================================================

const PPT_SET_SHAPE_POSITION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_position',
    description: `Set the position of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'left', 'top'],
    },
  },
};

async function executePPTSetShapePosition(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShapePosition(
      args['slide_number'] as number, args['shape_index'] as number,
      args['left'] as number, args['top'] as number
    );
    if (response.success) { return { success: true, result: 'Shape position set' }; }
    return { success: false, error: response.error || 'Failed to set shape position' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShapePositionTool: LLMSimpleTool = {
  definition: PPT_SET_SHAPE_POSITION_DEFINITION, execute: executePPTSetShapePosition, categories: OFFICE_CATEGORIES, description: 'Set shape position in PowerPoint',
};

// =============================================================================
// PowerPoint Set Shape Size
// =============================================================================

const PPT_SET_SHAPE_SIZE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_size',
    description: `Set the size of a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are resizing this shape' },
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

async function executePPTSetShapeSize(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShapeSize(
      args['slide_number'] as number, args['shape_index'] as number,
      args['width'] as number, args['height'] as number,
      args['lock_aspect_ratio'] as boolean | undefined
    );
    if (response.success) { return { success: true, result: 'Shape size set' }; }
    return { success: false, error: response.error || 'Failed to set shape size' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShapeSizeTool: LLMSimpleTool = {
  definition: PPT_SET_SHAPE_SIZE_DEFINITION, execute: executePPTSetShapeSize, categories: OFFICE_CATEGORIES, description: 'Set shape size in PowerPoint',
};

// =============================================================================
// PowerPoint Set Shape Style
// =============================================================================

const PPT_SET_SHAPE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_shape_style',
    description: `Set fill and line style for a shape.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are styling this shape' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
        fill_transparency: { type: 'number', description: 'Fill transparency (0-100)' },
        line_color: { type: 'string', description: 'Line color as hex' },
        line_weight: { type: 'number', description: 'Line weight in points' },
        line_style: { type: 'string', enum: ['solid', 'dash', 'dot', 'dashDot'], description: 'Line style' },
        no_fill: { type: 'boolean', description: 'Remove fill' },
        no_line: { type: 'boolean', description: 'Remove line' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetShapeStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetShapeStyle(
      args['slide_number'] as number, args['shape_index'] as number,
      {
        fillColor: args['fill_color'] as string | undefined,
        fillTransparency: args['fill_transparency'] as number | undefined,
        lineColor: args['line_color'] as string | undefined,
        lineWeight: args['line_weight'] as number | undefined,
        lineStyle: args['line_style'] as 'solid' | 'dash' | 'dot' | 'dashDot' | undefined,
        noFill: args['no_fill'] as boolean | undefined,
        noLine: args['no_line'] as boolean | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Shape style updated' }; }
    return { success: false, error: response.error || 'Failed to set shape style' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetShapeStyleTool: LLMSimpleTool = {
  definition: PPT_SET_SHAPE_STYLE_DEFINITION, execute: executePPTSetShapeStyle, categories: OFFICE_CATEGORIES, description: 'Set shape style in PowerPoint',
};

// =============================================================================
// PowerPoint Set Textbox Border
// =============================================================================

const PPT_SET_TEXTBOX_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_border',
    description: `Set border for a textbox.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting border' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Border color as hex' },
        weight: { type: 'number', description: 'Border weight in points' },
        style: { type: 'string', enum: ['solid', 'dash', 'dot'], description: 'Border style' },
        visible: { type: 'boolean', description: 'Show/hide border' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetTextboxBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTextboxBorder(
      args['slide_number'] as number, args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        weight: args['weight'] as number | undefined,
        style: args['style'] as 'solid' | 'dash' | 'dot' | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Textbox border updated' }; }
    return { success: false, error: response.error || 'Failed to set textbox border' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTextboxBorderTool: LLMSimpleTool = {
  definition: PPT_SET_TEXTBOX_BORDER_DEFINITION, execute: executePPTSetTextboxBorder, categories: OFFICE_CATEGORIES, description: 'Set textbox border in PowerPoint',
};

// =============================================================================
// PowerPoint Set Textbox Fill
// =============================================================================

const PPT_SET_TEXTBOX_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_fill',
    description: `Set fill for a textbox.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting fill' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Fill color as hex' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
        visible: { type: 'boolean', description: 'Show/hide fill' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetTextboxFill(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTextboxFill(
      args['slide_number'] as number, args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        transparency: args['transparency'] as number | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Textbox fill updated' }; }
    return { success: false, error: response.error || 'Failed to set textbox fill' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTextboxFillTool: LLMSimpleTool = {
  definition: PPT_SET_TEXTBOX_FILL_DEFINITION, execute: executePPTSetTextboxFill, categories: OFFICE_CATEGORIES, description: 'Set textbox fill in PowerPoint',
};

// =============================================================================
// Export Shape Tools
// =============================================================================

export const shapesTools: LLMSimpleTool[] = [
  pptAddImageTool,
  pptAddShapeTool,
  pptDeleteShapeTool,
  pptDuplicateShapeTool,
  pptRotateShapeTool,
  pptGetShapeInfoTool,
  pptSetShapeNameTool,
  pptSetShapeOpacityTool,
  pptGetShapeListTool,
  pptSetShapePositionTool,
  pptSetShapeSizeTool,
  pptSetShapeStyleTool,
  pptSetTextboxBorderTool,
  pptSetTextboxFillTool,
];
