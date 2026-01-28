/**
 * PowerPoint Section Tools
 *
 * Tools for managing sections in PowerPoint presentations.
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Add Section Tool
// =============================================================================

const POWERPOINT_ADD_SECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_section',
    description: `Add a section to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding this section' },
        section_name: { type: 'string', description: 'Section name' },
        before_slide: { type: 'number', description: 'Insert section before this slide number' },
      },
      required: ['reason', 'section_name', 'before_slide'],
    },
  },
};

async function executePowerPointAddSection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const beforeSlide = Number(args['before_slide']);
    const response = await powerpointClient.powerpointAddSection(
      args['section_name'] as string,
      beforeSlide
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

// =============================================================================
// Delete Section Tool
// =============================================================================

const POWERPOINT_DELETE_SECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_section',
    description: `Delete a section from the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this section' },
        section_index: { type: 'number', description: 'Section index to delete (1-based)' },
        delete_slides: { type: 'boolean', description: 'Whether to also delete slides in the section (default: false)' },
      },
      required: ['reason', 'section_index'],
    },
  },
};

async function executePowerPointDeleteSection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const sectionIndex = Number(args['section_index']);
    const deleteSlides = args['delete_slides'] != null ? Boolean(args['delete_slides']) : false;
    const response = await powerpointClient.powerpointDeleteSection(sectionIndex, deleteSlides);
    if (response.success) {
      return { success: true, result: `Section deleted.` };
    }
    return { success: false, error: response.error || 'Failed to delete section' };
  } catch (error) {
    return { success: false, error: `Failed to delete section: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteSectionTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_SECTION_DEFINITION,
  execute: executePowerPointDeleteSection,
  categories: OFFICE_CATEGORIES,
  description: 'Delete section',
};

// =============================================================================
// Get Sections Tool
// =============================================================================

const POWERPOINT_GET_SECTIONS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_sections',
    description: `Get list of all sections in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are getting the sections list' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointGetSections(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetSections();
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
// Export all section tools
// =============================================================================

export const sectionsTools: LLMSimpleTool[] = [
  powerpointAddSectionTool,
  powerpointDeleteSectionTool,
  powerpointGetSectionsTool,
];
