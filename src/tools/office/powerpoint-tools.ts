/**
 * Microsoft PowerPoint Tools
 *
 * LLM이 PowerPoint를 제어할 수 있는 도구들
 * PowerShell COM을 통해 직접 제어 (office-server.exe 불필요)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { officeClient } from './office-client.js';
import { LOCAL_HOME_DIR } from '../../constants.js';

const OFFICE_SCREENSHOT_DIR = path.join(LOCAL_HOME_DIR, 'screenshots', 'office');
const OFFICE_SCREENSHOT_PATH_DESC = '~/.local-cli/screenshots/office/';
const OFFICE_CATEGORIES: ToolCategory[] = ['llm-simple'];

async function saveScreenshot(base64Image: string, appName: string): Promise<string> {
  await fs.mkdir(OFFICE_SCREENSHOT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${appName}_${timestamp}.png`;
  const filePath = path.join(OFFICE_SCREENSHOT_DIR, filename);
  const buffer = Buffer.from(base64Image, 'base64');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

// =============================================================================
// PowerPoint Launch
// =============================================================================

const POWERPOINT_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_launch',
    description: `Launch Microsoft PowerPoint for presentation editing.
Use this tool to start PowerPoint before working with presentations.
The PowerPoint window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching PowerPoint' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'PowerPoint launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed to launch PowerPoint: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointLaunchTool: LLMSimpleTool = {
  definition: POWERPOINT_LAUNCH_DEFINITION,
  execute: executePowerPointLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft PowerPoint',
};

// =============================================================================
// PowerPoint Create
// =============================================================================

const POWERPOINT_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_create',
    description: `Create a new PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a presentation' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New presentation created' };
    }
    return { success: false, error: response.error || 'Failed to create presentation' };
  } catch (error) {
    return { success: false, error: `Failed to create presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCreateTool: LLMSimpleTool = {
  definition: POWERPOINT_CREATE_DEFINITION,
  execute: executePowerPointCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new PowerPoint presentation',
};

// =============================================================================
// PowerPoint Open
// =============================================================================

const POWERPOINT_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_open',
    description: `Open an existing PowerPoint presentation. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this presentation' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executePowerPointOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Presentation opened: ${response['presentation_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open presentation' };
  } catch (error) {
    return { success: false, error: `Failed to open presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointOpenTool: LLMSimpleTool = {
  definition: POWERPOINT_OPEN_DEFINITION,
  execute: executePowerPointOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing PowerPoint presentation',
};

// =============================================================================
// PowerPoint Add Slide
// =============================================================================

const POWERPOINT_ADD_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_slide',
    description: `Add a new slide to the presentation.
Layout options:
1 = Title Slide
2 = Title and Content
3 = Section Header
4 = Two Content
5 = Comparison
6 = Title Only
7 = Blank`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a slide' },
        layout: { type: 'number', description: 'Slide layout (1-7, default: 2)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointAddSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const layout = args['layout'] as number ?? 2;
    const response = await officeClient.powerpointAddSlide(layout);
    if (response.success) {
      return { success: true, result: `Slide added (layout ${layout}), slide number: ${response['slide_number']}` };
    }
    return { success: false, error: response.error || 'Failed to add slide' };
  } catch (error) {
    return { success: false, error: `Failed to add slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_SLIDE_DEFINITION,
  execute: executePowerPointAddSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint slide',
};

// =============================================================================
// PowerPoint Delete Slide
// =============================================================================

const POWERPOINT_DELETE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_slide',
    description: `Delete a slide from the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this slide' },
        slide: { type: 'number', description: 'Slide number to delete' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointDeleteSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointDeleteSlide(args['slide'] as number);
    if (response.success) {
      return { success: true, result: `Slide ${args['slide']} deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete slide' };
  } catch (error) {
    return { success: false, error: `Failed to delete slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_SLIDE_DEFINITION,
  execute: executePowerPointDeleteSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Delete PowerPoint slide',
};

// =============================================================================
// PowerPoint Move Slide
// =============================================================================

const POWERPOINT_MOVE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_move_slide',
    description: `Move a slide to a different position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are moving this slide' },
        from_index: { type: 'number', description: 'Current slide number' },
        to_index: { type: 'number', description: 'Target position' },
      },
      required: ['reason', 'from_index', 'to_index'],
    },
  },
};

async function executePowerPointMoveSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointMoveSlide(
      args['from_index'] as number,
      args['to_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Slide moved from ${args['from_index']} to ${args['to_index']}` };
    }
    return { success: false, error: response.error || 'Failed to move slide' };
  } catch (error) {
    return { success: false, error: `Failed to move slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointMoveSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_MOVE_SLIDE_DEFINITION,
  execute: executePowerPointMoveSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Move PowerPoint slide',
};

// =============================================================================
// PowerPoint Write Text
// =============================================================================

const POWERPOINT_WRITE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_write_text',
    description: `Write text to a shape on a slide.
Shape index 1 is usually the title placeholder, index 2 is the content placeholder.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are writing text' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index (1=title, 2=content)' },
        text: { type: 'string', description: 'Text to write' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'slide', 'shape', 'text'],
    },
  },
};

async function executePowerPointWriteText(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointWriteText(
      args['slide'] as number,
      args['shape'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Text written to slide ${args['slide']}, shape ${args['shape']}` };
    }
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    return { success: false, error: `Failed to write text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointWriteTextTool: LLMSimpleTool = {
  definition: POWERPOINT_WRITE_TEXT_DEFINITION,
  execute: executePowerPointWriteText,
  categories: OFFICE_CATEGORIES,
  description: 'Write text to PowerPoint shape',
};

// =============================================================================
// PowerPoint Read Slide
// =============================================================================

const POWERPOINT_READ_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_read_slide',
    description: `Read all text content from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are reading this slide' },
        slide: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointReadSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointReadSlide(args['slide'] as number);
    if (response.success) {
      const texts = response['texts'] as Array<{ shape_index: number; shape_name: string; text: string }> || [];
      const textContent = texts.map(t => `[Shape ${t.shape_index}] ${t.text}`).join('\n');
      return {
        success: true,
        result: `Slide ${args['slide']} (${response['shape_count']} shapes):\n${textContent || '(no text content)'}`,
      };
    }
    return { success: false, error: response.error || 'Failed to read slide' };
  } catch (error) {
    return { success: false, error: `Failed to read slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointReadSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_READ_SLIDE_DEFINITION,
  execute: executePowerPointReadSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Read PowerPoint slide content',
};

// =============================================================================
// PowerPoint Add Textbox
// =============================================================================

const POWERPOINT_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_textbox',
    description: `Add a textbox to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a textbox' },
        slide: { type: 'number', description: 'Slide number' },
        text: { type: 'string', description: 'Text content' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 300)' },
        height: { type: 'number', description: 'Height in points (default: 50)' },
      },
      required: ['reason', 'slide', 'text'],
    },
  },
};

async function executePowerPointAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAddTextbox(
      args['slide'] as number,
      args['text'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number ?? 300,
      args['height'] as number ?? 50
    );
    if (response.success) {
      return { success: true, result: `Textbox added to slide ${args['slide']} (shape index: ${response['shape_index']})` };
    }
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTextboxTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TEXTBOX_DEFINITION,
  execute: executePowerPointAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint textbox',
};

// =============================================================================
// PowerPoint Set Font
// =============================================================================

const POWERPOINT_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_font',
    description: `Set font properties for a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        color: { type: 'string', description: 'Font color as hex' },
      },
      required: ['reason', 'slide', 'shape'],
    },
  },
};

async function executePowerPointSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetFont(
      args['slide'] as number,
      args['shape'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Font properties set' };
    }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetFontTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_FONT_DEFINITION,
  execute: executePowerPointSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint font',
};

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
  try {
    const response = await officeClient.powerpointAddImage(
      args['slide'] as number,
      args['path'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: `Image added to slide ${args['slide']}` };
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
        slide: { type: 'number', description: 'Slide number' },
        shape_type: { type: 'string', enum: ['rectangle', 'oval', 'triangle', 'arrow', 'star'], description: 'Type of shape' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        fill_color: { type: 'string', description: 'Fill color as hex (optional)' },
      },
      required: ['reason', 'slide', 'shape_type', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executePowerPointAddShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAddShape(
      args['slide'] as number,
      args['shape_type'] as 'rectangle' | 'oval' | 'triangle' | 'arrow' | 'star',
      args['left'] as number,
      args['top'] as number,
      args['width'] as number,
      args['height'] as number,
      args['fill_color'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${args['shape_type']} shape added to slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
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
    const response = await officeClient.powerpointAddAnimation(
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
    const response = await officeClient.powerpointSetTransition(
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
    const response = await officeClient.powerpointSetBackground(
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
// PowerPoint Get Slide Count
// =============================================================================

const POWERPOINT_GET_SLIDE_COUNT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_count',
    description: `Get the number of slides in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need slide count' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointGetSlideCount(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetSlideCount();
    if (response.success) {
      return { success: true, result: `Slide count: ${response['slide_count']}` };
    }
    return { success: false, error: response.error || 'Failed to get slide count' };
  } catch (error) {
    return { success: false, error: `Failed to get slide count: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSlideCountTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SLIDE_COUNT_DEFINITION,
  execute: executePowerPointGetSlideCount,
  categories: OFFICE_CATEGORIES,
  description: 'Get PowerPoint slide count',
};

// =============================================================================
// PowerPoint Save
// =============================================================================

const POWERPOINT_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_save',
    description: `Save the active presentation. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointSave(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSave(args['path'] as string | undefined);
    if (response.success) {
      return { success: true, result: `Presentation saved: ${response['path'] || 'current location'}` };
    }
    return { success: false, error: response.error || 'Failed to save presentation' };
  } catch (error) {
    return { success: false, error: `Failed to save presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSaveTool: LLMSimpleTool = {
  definition: POWERPOINT_SAVE_DEFINITION,
  execute: executePowerPointSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save PowerPoint presentation',
};

// =============================================================================
// PowerPoint Export to PDF
// =============================================================================

const POWERPOINT_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_export_pdf',
    description: `Export the presentation to PDF. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        path: { type: 'string', description: 'Output PDF file path' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executePowerPointExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointExportToPDF(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointExportPDFTool: LLMSimpleTool = {
  definition: POWERPOINT_EXPORT_PDF_DEFINITION,
  execute: executePowerPointExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export PowerPoint to PDF',
};

// =============================================================================
// PowerPoint Start Slideshow
// =============================================================================

const POWERPOINT_START_SLIDESHOW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_start_slideshow',
    description: `Start the slideshow presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are starting slideshow' },
        from_slide: { type: 'number', description: 'Starting slide number (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointStartSlideshow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const fromSlide = args['from_slide'] as number ?? 1;
    const response = await officeClient.powerpointStartSlideshow(fromSlide);
    if (response.success) {
      return { success: true, result: `Slideshow started from slide ${fromSlide}` };
    }
    return { success: false, error: response.error || 'Failed to start slideshow' };
  } catch (error) {
    return { success: false, error: `Failed to start slideshow: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointStartSlideshowTool: LLMSimpleTool = {
  definition: POWERPOINT_START_SLIDESHOW_DEFINITION,
  execute: executePowerPointStartSlideshow,
  categories: OFFICE_CATEGORIES,
  description: 'Start PowerPoint slideshow',
};

// =============================================================================
// PowerPoint Screenshot
// =============================================================================

const POWERPOINT_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_screenshot',
    description: `Take a screenshot of the current slide.
Saves to ${OFFICE_SCREENSHOT_PATH_DESC}.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'powerpoint');
      return {
        success: true,
        result: `PowerPoint screenshot saved to: ${filePath}`,
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointScreenshotTool: LLMSimpleTool = {
  definition: POWERPOINT_SCREENSHOT_DEFINITION,
  execute: executePowerPointScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take PowerPoint slide screenshot',
};

// =============================================================================
// PowerPoint Close
// =============================================================================

const POWERPOINT_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_close',
    description: `Close the active presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are closing' },
        save: { type: 'boolean', description: 'Whether to save before closing (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointClose(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointClose(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Presentation closed${args['save'] ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close presentation' };
  } catch (error) {
    return { success: false, error: `Failed to close presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCloseTool: LLMSimpleTool = {
  definition: POWERPOINT_CLOSE_DEFINITION,
  execute: executePowerPointClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close PowerPoint presentation',
};

// =============================================================================
// PowerPoint Quit
// =============================================================================

const POWERPOINT_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_quit',
    description: `Quit Microsoft PowerPoint application entirely.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are quitting PowerPoint' },
        save: { type: 'boolean', description: 'Whether to save all presentations before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointQuit(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointQuit(args['save'] === true);
    if (response.success) {
      return { success: true, result: `PowerPoint closed${args['save'] ? ' (all presentations saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed to quit PowerPoint: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointQuitTool: LLMSimpleTool = {
  definition: POWERPOINT_QUIT_DEFINITION,
  execute: executePowerPointQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft PowerPoint',
};

// =============================================================================
// PowerPoint Add Table
// =============================================================================

const POWERPOINT_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table',
    description: `Add a table to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number (1-indexed)' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Table width in points (default: 400)' },
        height: { type: 'number', description: 'Table height in points (default: 200)' },
        data: { type: 'array', description: '2D array of cell values', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['slide_number', 'rows', 'cols'],
    },
  },
};

async function executePowerPointAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAddTable(
      args['slide_number'] as number,
      args['rows'] as number,
      args['cols'] as number,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined,
      args['data'] as string[][] | undefined
    );
    if (response.success) {
      return { success: true, result: `Table added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add table' };
  } catch (error) {
    return { success: false, error: `Failed to add table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTableTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TABLE_DEFINITION,
  execute: executePowerPointAddTable,
  categories: OFFICE_CATEGORIES,
  description: 'Add table to slide',
};

// =============================================================================
// PowerPoint Set Table Cell
// =============================================================================

const POWERPOINT_SET_TABLE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_cell',
    description: `Set text and formatting for a table cell.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number (1-indexed)' },
        shape_index: { type: 'number', description: 'Table shape index' },
        row: { type: 'number', description: 'Row number (1-indexed)' },
        col: { type: 'number', description: 'Column number (1-indexed)' },
        text: { type: 'string', description: 'Cell text' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        fill_color: { type: 'string', description: 'Cell background color (hex: #RRGGBB)' },
      },
      required: ['slide_number', 'shape_index', 'row', 'col', 'text'],
    },
  },
};

async function executePowerPointSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetTableCell(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['row'] as number,
      args['col'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        fillColor: args['fill_color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table cell updated' };
    }
    return { success: false, error: response.error || 'Failed to update table cell' };
  } catch (error) {
    return { success: false, error: `Failed to update table cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTableCellTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TABLE_CELL_DEFINITION,
  execute: executePowerPointSetTableCell,
  categories: OFFICE_CATEGORIES,
  description: 'Set table cell text and formatting',
};

// =============================================================================
// PowerPoint Set Table Style
// =============================================================================

const POWERPOINT_SET_TABLE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_style',
    description: `Set table style (borders, header row, alternating rows).`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        border_color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        header_row_fill: { type: 'string', description: 'Header row background color (hex)' },
        alternate_row_fill: { type: 'string', description: 'Alternating row background color (hex)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetTableStyle(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        borderColor: args['border_color'] as string | undefined,
        headerRowFill: args['header_row_fill'] as string | undefined,
        alternateRowFill: args['alternate_row_fill'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table style updated' };
    }
    return { success: false, error: response.error || 'Failed to update table style' };
  } catch (error) {
    return { success: false, error: `Failed to update table style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTableStyleTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TABLE_STYLE_DEFINITION,
  execute: executePowerPointSetTableStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Set table style',
};

// =============================================================================
// PowerPoint Delete Shape
// =============================================================================

const POWERPOINT_DELETE_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_shape',
    description: `Delete a shape from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index to delete' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointDeleteShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointDeleteShape(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape deleted' };
    }
    return { success: false, error: response.error || 'Failed to delete shape' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index to duplicate' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointDuplicateShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointDuplicateShape(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Shape duplicated. New shape index: ${response['new_shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to duplicate shape' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        angle: { type: 'number', description: 'Rotation angle in degrees (0-360)' },
      },
      required: ['slide_number', 'shape_index', 'angle'],
    },
  },
};

async function executePowerPointRotateShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointRotateShape(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['angle'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape rotated' };
    }
    return { success: false, error: response.error || 'Failed to rotate shape' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointGetShapeInfo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetShapeInfo(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get shape info' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointGetShapeList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetShapeList(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get shape list' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        name: { type: 'string', description: 'Shape name' },
      },
      required: ['slide_number', 'shape_index', 'name'],
    },
  },
};

async function executePowerPointSetShapeName(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetShapeName(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['name'] as string
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape name set' };
    }
    return { success: false, error: response.error || 'Failed to set shape name' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        opacity: { type: 'number', description: 'Opacity percentage (0-100, where 0 is fully transparent)' },
      },
      required: ['slide_number', 'shape_index', 'opacity'],
    },
  },
};

async function executePowerPointSetShapeOpacity(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetShapeOpacity(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['opacity'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape opacity set' };
    }
    return { success: false, error: response.error || 'Failed to set shape opacity' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
      },
      required: ['slide_number', 'shape_index', 'left', 'top'],
    },
  },
};

async function executePowerPointSetShapePosition(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetShapePosition(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['left'] as number,
      args['top'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape position set' };
    }
    return { success: false, error: response.error || 'Failed to set shape position' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        lock_aspect_ratio: { type: 'boolean', description: 'Lock aspect ratio (default: false)' },
      },
      required: ['slide_number', 'shape_index', 'width', 'height'],
    },
  },
};

async function executePowerPointSetShapeSize(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetShapeSize(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['width'] as number,
      args['height'] as number,
      args['lock_aspect_ratio'] as boolean | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape size set' };
    }
    return { success: false, error: response.error || 'Failed to set shape size' };
  } catch (error) {
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
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetShapeStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetShapeStyle(
      args['slide_number'] as number,
      args['shape_index'] as number,
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
    if (response.success) {
      return { success: true, result: response.message || 'Shape style updated' };
    }
    return { success: false, error: response.error || 'Failed to set shape style' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointBringToFront(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointBringToFront(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape brought to front' };
    }
    return { success: false, error: response.error || 'Failed to bring shape to front' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSendToBack(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSendToBack(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape sent to back' };
    }
    return { success: false, error: response.error || 'Failed to send shape to back' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointBringForward(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointBringForward(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape brought forward' };
    }
    return { success: false, error: response.error || 'Failed to bring shape forward' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSendBackward(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSendBackward(
      args['slide_number'] as number,
      args['shape_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shape sent backward' };
    }
    return { success: false, error: response.error || 'Failed to send shape backward' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices to align' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'], description: 'Alignment type' },
      },
      required: ['slide_number', 'shape_indices', 'alignment'],
    },
  },
};

async function executePowerPointAlignShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAlignShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[],
      args['alignment'] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shapes aligned' };
    }
    return { success: false, error: response.error || 'Failed to align shapes' };
  } catch (error) {
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
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices' },
        direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Distribution direction' },
      },
      required: ['slide_number', 'shape_indices', 'direction'],
    },
  },
};

async function executePowerPointDistributeShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointDistributeShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[],
      args['direction'] as 'horizontal' | 'vertical'
    );
    if (response.success) {
      return { success: true, result: response.message || 'Shapes distributed' };
    }
    return { success: false, error: response.error || 'Failed to distribute shapes' };
  } catch (error) {
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
// PowerPoint Set Slide Layout
// =============================================================================

const POWERPOINT_SET_SLIDE_LAYOUT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_slide_layout',
    description: `Set the layout of a slide. Common layouts: 1=Title, 2=Title+Content, 3=Section Header, 4=Two Content, 5=Comparison, 6=Title Only, 7=Blank`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        layout_index: { type: 'number', description: 'Layout index (1-12)' },
      },
      required: ['slide_number', 'layout_index'],
    },
  },
};

async function executePowerPointSetSlideLayout(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetSlideLayout(
      args['slide_number'] as number,
      args['layout_index'] as number
    );
    if (response.success) {
      return { success: true, result: response.message || 'Slide layout set' };
    }
    return { success: false, error: response.error || 'Failed to set slide layout' };
  } catch (error) {
    return { success: false, error: `Failed to set slide layout: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetSlideLayoutTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_SLIDE_LAYOUT_DEFINITION,
  execute: executePowerPointSetSlideLayout,
  categories: OFFICE_CATEGORIES,
  description: 'Set slide layout',
};

// =============================================================================
// PowerPoint Duplicate Slide
// =============================================================================

const POWERPOINT_DUPLICATE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_duplicate_slide',
    description: `Duplicate a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number to duplicate' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointDuplicateSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointDuplicateSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: `Slide duplicated. New slide index: ${response['new_slide_index']}` };
    }
    return { success: false, error: response.error || 'Failed to duplicate slide' };
  } catch (error) {
    return { success: false, error: `Failed to duplicate slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDuplicateSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_DUPLICATE_SLIDE_DEFINITION,
  execute: executePowerPointDuplicateSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Duplicate slide',
};

// =============================================================================
// PowerPoint Hide/Show Slide
// =============================================================================

const POWERPOINT_HIDE_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_hide_slide',
    description: `Hide a slide from slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointHideSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointHideSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: response.message || 'Slide hidden' };
    }
    return { success: false, error: response.error || 'Failed to hide slide' };
  } catch (error) {
    return { success: false, error: `Failed to hide slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointHideSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_HIDE_SLIDE_DEFINITION,
  execute: executePowerPointHideSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Hide slide from slideshow',
};

const POWERPOINT_SHOW_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_show_slide',
    description: `Show a hidden slide in slideshow.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointShowSlide(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointShowSlide(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: response.message || 'Slide shown' };
    }
    return { success: false, error: response.error || 'Failed to show slide' };
  } catch (error) {
    return { success: false, error: `Failed to show slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointShowSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_SHOW_SLIDE_DEFINITION,
  execute: executePowerPointShowSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Show hidden slide',
};

// =============================================================================
// PowerPoint Section Functions
// =============================================================================

const POWERPOINT_ADD_SECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_section',
    description: `Add a section to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        section_name: { type: 'string', description: 'Section name' },
        before_slide: { type: 'number', description: 'Insert section before this slide number' },
      },
      required: ['section_name', 'before_slide'],
    },
  },
};

async function executePowerPointAddSection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAddSection(
      args['section_name'] as string,
      args['before_slide'] as number
    );
    if (response.success) {
      return { success: true, result: `Section added. Section index: ${response['section_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add section' };
  } catch (error) {
    return { success: false, error: `Failed to add section: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddSectionTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_SECTION_DEFINITION,
  execute: executePowerPointAddSection,
  categories: OFFICE_CATEGORIES,
  description: 'Add section',
};

const POWERPOINT_GET_SECTIONS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_sections',
    description: `Get list of all sections in the presentation.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

async function executePowerPointGetSections(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetSections();
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get sections' };
  } catch (error) {
    return { success: false, error: `Failed to get sections: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSectionsTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SECTIONS_DEFINITION,
  execute: executePowerPointGetSections,
  categories: OFFICE_CATEGORIES,
  description: 'Get sections list',
};

// =============================================================================
// PowerPoint Notes Functions
// =============================================================================

const POWERPOINT_ADD_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_note',
    description: `Add speaker notes to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        note_text: { type: 'string', description: 'Note text' },
      },
      required: ['slide_number', 'note_text'],
    },
  },
};

async function executePowerPointAddNote(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointAddNote(
      args['slide_number'] as number,
      args['note_text'] as string
    );
    if (response.success) {
      return { success: true, result: response.message || 'Note added' };
    }
    return { success: false, error: response.error || 'Failed to add note' };
  } catch (error) {
    return { success: false, error: `Failed to add note: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddNoteTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_NOTE_DEFINITION,
  execute: executePowerPointAddNote,
  categories: OFFICE_CATEGORIES,
  description: 'Add speaker notes',
};

const POWERPOINT_GET_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_note',
    description: `Get speaker notes from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointGetNote(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetNote(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: `Note: ${response['note']}` };
    }
    return { success: false, error: response.error || 'Failed to get note' };
  } catch (error) {
    return { success: false, error: `Failed to get note: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetNoteTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_NOTE_DEFINITION,
  execute: executePowerPointGetNote,
  categories: OFFICE_CATEGORIES,
  description: 'Get speaker notes',
};

// =============================================================================
// PowerPoint Grouping Functions
// =============================================================================

const POWERPOINT_GROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_group_shapes',
    description: `Group multiple shapes together.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_indices: { type: 'array', items: { type: 'number' }, description: 'Array of shape indices to group' },
      },
      required: ['slide_number', 'shape_indices'],
    },
  },
};

async function executePowerPointGroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGroupShapes(
      args['slide_number'] as number,
      args['shape_indices'] as number[]
    );
    if (response.success) {
      return { success: true, result: `Shapes grouped. Group index: ${response['group_index']}` };
    }
    return { success: false, error: response.error || 'Failed to group shapes' };
  } catch (error) {
    return { success: false, error: `Failed to group shapes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGroupShapesTool: LLMSimpleTool = {
  definition: POWERPOINT_GROUP_SHAPES_DEFINITION,
  execute: executePowerPointGroupShapes,
  categories: OFFICE_CATEGORIES,
  description: 'Group shapes together',
};

const POWERPOINT_UNGROUP_SHAPES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_ungroup_shapes',
    description: `Ungroup a grouped shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        group_index: { type: 'number', description: 'Group shape index' },
      },
      required: ['slide_number', 'group_index'],
    },
  },
};

async function executePowerPointUngroupShapes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointUngroupShapes(
      args['slide_number'] as number,
      args['group_index'] as number
    );
    if (response.success) {
      return { success: true, result: `Group ungrouped. ${response['shape_count']} shapes` };
    }
    return { success: false, error: response.error || 'Failed to ungroup shapes' };
  } catch (error) {
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
// PowerPoint Text Formatting Functions
// =============================================================================

const POWERPOINT_SET_TEXT_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_text_alignment',
    description: `Set text alignment in a shape.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Vertical alignment' },
      },
      required: ['slide_number', 'shape_index', 'horizontal'],
    },
  },
};

async function executePowerPointSetTextAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetTextAlignment(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['horizontal'] as 'left' | 'center' | 'right' | 'justify',
      args['vertical'] as 'top' | 'middle' | 'bottom' | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Text alignment set' };
    }
    return { success: false, error: response.error || 'Failed to set text alignment' };
  } catch (error) {
    return { success: false, error: `Failed to set text alignment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextAlignmentTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXT_ALIGNMENT_DEFINITION,
  execute: executePowerPointSetTextAlignment,
  categories: OFFICE_CATEGORIES,
  description: 'Set text alignment',
};

const POWERPOINT_SET_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_bullet_list',
    description: `Set bullet or numbered list style for text.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        bullet_type: { type: 'string', enum: ['none', 'bullet', 'numbered'], description: 'Bullet type' },
        bullet_char: { type: 'string', description: 'Custom bullet character (e.g., "•", "→")' },
      },
      required: ['slide_number', 'shape_index', 'bullet_type'],
    },
  },
};

async function executePowerPointSetBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetBulletList(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['bullet_type'] as 'none' | 'bullet' | 'numbered',
      args['bullet_char'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Bullet style set' };
    }
    return { success: false, error: response.error || 'Failed to set bullet style' };
  } catch (error) {
    return { success: false, error: `Failed to set bullet style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetBulletListTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_BULLET_LIST_DEFINITION,
  execute: executePowerPointSetBulletList,
  categories: OFFICE_CATEGORIES,
  description: 'Set bullet/numbered list',
};

const POWERPOINT_SET_LINE_SPACING_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_line_spacing',
    description: `Set line spacing for text.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        line_spacing: { type: 'number', description: 'Line spacing multiplier (e.g., 1.5 for 1.5x)' },
        space_after: { type: 'number', description: 'Space after paragraph in points' },
        space_before: { type: 'number', description: 'Space before paragraph in points' },
      },
      required: ['slide_number', 'shape_index', 'line_spacing'],
    },
  },
};

async function executePowerPointSetLineSpacing(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetLineSpacing(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['line_spacing'] as number,
      args['space_after'] as number | undefined,
      args['space_before'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Line spacing set' };
    }
    return { success: false, error: response.error || 'Failed to set line spacing' };
  } catch (error) {
    return { success: false, error: `Failed to set line spacing: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetLineSpacingTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_LINE_SPACING_DEFINITION,
  execute: executePowerPointSetLineSpacing,
  categories: OFFICE_CATEGORIES,
  description: 'Set line spacing',
};

const POWERPOINT_SET_TEXTBOX_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_border',
    description: `Set textbox border style.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        weight: { type: 'number', description: 'Border weight in points' },
        style: { type: 'string', enum: ['solid', 'dash', 'dot'], description: 'Border style' },
        visible: { type: 'boolean', description: 'Border visibility (false to remove)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetTextboxBorder(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        weight: args['weight'] as number | undefined,
        style: args['style'] as 'solid' | 'dash' | 'dot' | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Textbox border updated' };
    }
    return { success: false, error: response.error || 'Failed to set textbox border' };
  } catch (error) {
    return { success: false, error: `Failed to set textbox border: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextboxBorderTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXTBOX_BORDER_DEFINITION,
  execute: executePowerPointSetTextboxBorder,
  categories: OFFICE_CATEGORIES,
  description: 'Set textbox border',
};

const POWERPOINT_SET_TEXTBOX_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_textbox_fill',
    description: `Set textbox background fill.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Shape index' },
        color: { type: 'string', description: 'Fill color (hex: #RRGGBB)' },
        transparency: { type: 'number', description: 'Transparency (0-100)' },
        visible: { type: 'boolean', description: 'Fill visibility (false to remove)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTextboxFill(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetTextboxFill(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        color: args['color'] as string | undefined,
        transparency: args['transparency'] as number | undefined,
        visible: args['visible'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Textbox fill updated' };
    }
    return { success: false, error: response.error || 'Failed to set textbox fill' };
  } catch (error) {
    return { success: false, error: `Failed to set textbox fill: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTextboxFillTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TEXTBOX_FILL_DEFINITION,
  execute: executePowerPointSetTextboxFill,
  categories: OFFICE_CATEGORIES,
  description: 'Set textbox background fill',
};

// =============================================================================
// PowerPoint Media Functions
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
  try {
    const response = await officeClient.powerpointAddHyperlink(
      args['slide_number'] as number,
      args['shape_index'] as number,
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
  try {
    const response = await officeClient.powerpointAddVideo(
      args['slide_number'] as number,
      args['video_path'] as string,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined
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
  try {
    const response = await officeClient.powerpointAddAudio(
      args['slide_number'] as number,
      args['audio_path'] as string,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['play_in_background'] as boolean | undefined
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
  try {
    const response = await officeClient.powerpointAddChart(
      args['slide_number'] as number,
      args['chart_type'] as 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined,
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
// PowerPoint Effects Functions
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
    const response = await officeClient.powerpointSetShadow(
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
    const response = await officeClient.powerpointSetReflection(
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
    const response = await officeClient.powerpointApplyTheme(args['theme_path'] as string);
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
// PowerPoint Placeholder Functions
// =============================================================================

const POWERPOINT_SET_PLACEHOLDER_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_placeholder_text',
    description: `Set text in a slide placeholder (title, subtitle, body, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        placeholder_type: { type: 'string', enum: ['title', 'subtitle', 'body', 'footer', 'slideNumber', 'date'], description: 'Placeholder type' },
        text: { type: 'string', description: 'Text to set' },
      },
      required: ['slide_number', 'placeholder_type', 'text'],
    },
  },
};

async function executePowerPointSetPlaceholderText(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointSetPlaceholderText(
      args['slide_number'] as number,
      args['placeholder_type'] as 'title' | 'subtitle' | 'body' | 'footer' | 'slideNumber' | 'date',
      args['text'] as string
    );
    if (response.success) {
      return { success: true, result: response.message || 'Placeholder text set' };
    }
    return { success: false, error: response.error || 'Failed to set placeholder text' };
  } catch (error) {
    return { success: false, error: `Failed to set placeholder text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetPlaceholderTextTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_PLACEHOLDER_TEXT_DEFINITION,
  execute: executePowerPointSetPlaceholderText,
  categories: OFFICE_CATEGORIES,
  description: 'Set placeholder text',
};

const POWERPOINT_GET_PLACEHOLDERS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_placeholders',
    description: `Get list of placeholders on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['slide_number'],
    },
  },
};

async function executePowerPointGetPlaceholders(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetPlaceholders(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get placeholders' };
  } catch (error) {
    return { success: false, error: `Failed to get placeholders: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetPlaceholdersTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_PLACEHOLDERS_DEFINITION,
  execute: executePowerPointGetPlaceholders,
  categories: OFFICE_CATEGORIES,
  description: 'Get placeholders on slide',
};

const POWERPOINT_GET_SLIDE_LAYOUTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_layouts',
    description: `Get available slide layouts.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

async function executePowerPointGetSlideLayouts(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.powerpointGetSlideLayouts();
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get slide layouts' };
  } catch (error) {
    return { success: false, error: `Failed to get slide layouts: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSlideLayoutsTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SLIDE_LAYOUTS_DEFINITION,
  execute: executePowerPointGetSlideLayouts,
  categories: OFFICE_CATEGORIES,
  description: 'Get available slide layouts',
};

// =============================================================================
// Export All PowerPoint Tools
// =============================================================================

export const POWERPOINT_TOOLS: LLMSimpleTool[] = [
  // Basic operations
  powerpointLaunchTool,
  powerpointCreateTool,
  powerpointOpenTool,
  powerpointAddSlideTool,
  powerpointDeleteSlideTool,
  powerpointMoveSlideTool,
  powerpointWriteTextTool,
  powerpointReadSlideTool,
  powerpointSaveTool,
  powerpointScreenshotTool,
  powerpointCloseTool,
  powerpointQuitTool,
  // Content
  powerpointAddTextboxTool,
  powerpointAddImageTool,
  powerpointAddShapeTool,
  // Table
  powerpointAddTableTool,
  powerpointSetTableCellTool,
  powerpointSetTableStyleTool,
  // Shape Management
  powerpointDeleteShapeTool,
  powerpointDuplicateShapeTool,
  powerpointRotateShapeTool,
  powerpointGetShapeInfoTool,
  powerpointGetShapeListTool,
  powerpointSetShapeNameTool,
  powerpointSetShapeOpacityTool,
  // Shape Position/Size/Style
  powerpointSetShapePositionTool,
  powerpointSetShapeSizeTool,
  powerpointSetShapeStyleTool,
  // Z-Order
  powerpointBringToFrontTool,
  powerpointSendToBackTool,
  powerpointBringForwardTool,
  powerpointSendBackwardTool,
  // Alignment
  powerpointAlignShapesTool,
  powerpointDistributeShapesTool,
  // Slide Management
  powerpointSetSlideLayoutTool,
  powerpointDuplicateSlideTool,
  powerpointHideSlideTool,
  powerpointShowSlideTool,
  powerpointAddSectionTool,
  powerpointGetSectionsTool,
  // Notes
  powerpointAddNoteTool,
  powerpointGetNoteTool,
  // Grouping
  powerpointGroupShapesTool,
  powerpointUngroupShapesTool,
  // Text Formatting
  powerpointSetTextAlignmentTool,
  powerpointSetBulletListTool,
  powerpointSetLineSpacingTool,
  powerpointSetTextboxBorderTool,
  powerpointSetTextboxFillTool,
  // Media
  powerpointAddHyperlinkTool,
  powerpointAddVideoTool,
  powerpointAddAudioTool,
  powerpointAddChartTool,
  // Effects
  powerpointSetShadowTool,
  powerpointSetReflectionTool,
  powerpointApplyThemeTool,
  // Placeholder
  powerpointSetPlaceholderTextTool,
  powerpointGetPlaceholdersTool,
  powerpointGetSlideLayoutsTool,
  // Formatting (existing)
  powerpointSetFontTool,
  powerpointSetBackgroundTool,
  // Animation & Transition
  powerpointAddAnimationTool,
  powerpointSetTransitionTool,
  // Info
  powerpointGetSlideCountTool,
  // Export & Presentation
  powerpointExportPDFTool,
  powerpointStartSlideshowTool,
];
