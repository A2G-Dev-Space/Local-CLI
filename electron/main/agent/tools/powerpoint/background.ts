/**
 * PowerPoint Background & Theme Tools
 *
 * Background operations: setBackground, applyTheme, getThemes
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Set Background
// =============================================================================

const PPT_SET_BACKGROUND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_background',
    description: `Set slide background color or image.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting background' },
        slide_number: { type: 'number', description: 'Slide number' },
        color: { type: 'string', description: 'Background color as hex' },
        image_path: { type: 'string', description: 'Path to background image' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTSetBackground(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetBackground(
      args['slide_number'] as number,
      {
        color: args['color'] as string | undefined,
        imagePath: args['image_path'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Background set' }; }
    return { success: false, error: response.error || 'Failed to set background' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetBackgroundTool: LLMSimpleTool = {
  definition: PPT_SET_BACKGROUND_DEFINITION, execute: executePPTSetBackground, categories: OFFICE_CATEGORIES, description: 'Set background in PowerPoint',
};

// =============================================================================
// PowerPoint Apply Theme
// =============================================================================

const PPT_APPLY_THEME_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_apply_theme',
    description: `Apply a theme to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying a theme' },
        theme_path: { type: 'string', description: 'Path to the theme file (.thmx)' },
      },
      required: ['reason', 'theme_path'],
    },
  },
};

async function executePPTApplyTheme(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointApplyTheme(args['theme_path'] as string);
    if (response.success) { return { success: true, result: 'Theme applied' }; }
    return { success: false, error: response.error || 'Failed to apply theme' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptApplyThemeTool: LLMSimpleTool = {
  definition: PPT_APPLY_THEME_DEFINITION, execute: executePPTApplyTheme, categories: OFFICE_CATEGORIES, description: 'Apply theme in PowerPoint',
};

// =============================================================================
// PowerPoint Get Themes
// =============================================================================

const PPT_GET_THEMES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_themes',
    description: `Get available themes.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need theme list' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTGetThemes(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetThemes();
    if (response.success) {
      return { success: true, result: JSON.stringify(response['themes'], null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get themes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetThemesTool: LLMSimpleTool = {
  definition: PPT_GET_THEMES_DEFINITION, execute: executePPTGetThemes, categories: OFFICE_CATEGORIES, description: 'Get themes in PowerPoint',
};

// =============================================================================
// Export Background Tools
// =============================================================================

export const backgroundTools: LLMSimpleTool[] = [
  pptSetBackgroundTool,
  pptApplyThemeTool,
  pptGetThemesTool,
];
