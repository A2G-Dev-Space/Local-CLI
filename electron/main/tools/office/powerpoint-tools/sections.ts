/**
 * PowerPoint Section Tools
 *
 * Tools for managing sections in PowerPoint presentations.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

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
        section_name: { type: 'string', description: 'Section name' },
        before_slide: { type: 'number', description: 'Insert section before this slide number' },
      },
      required: ['section_name', 'before_slide'],
    },
  },
};

async function executePowerPointAddSection(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_add_section', args);
  try {
    const response = await powerpointClient.powerpointAddSection(
      args['section_name'] as string,
      args['before_slide'] as number
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_add_section', args, { sectionName: args['section_name'], sectionIndex: response['section_index'] }, Date.now() - startTime);
      return { success: true, result: `Section added. Section index: ${response['section_index']}` };
    }
    logger.toolError('powerpoint_add_section', args, new Error(response.error || 'Failed to add section'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add section' };
  } catch (error) {
    logger.toolError('powerpoint_add_section', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
        section_index: { type: 'number', description: 'Section index to delete (1-based)' },
        delete_slides: { type: 'boolean', description: 'Whether to also delete slides in the section (default: false)' },
      },
      required: ['section_index'],
    },
  },
};

async function executePowerPointDeleteSection(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_delete_section', args);
  try {
    const response = await powerpointClient.powerpointDeleteSection(
      args['section_index'] as number,
      (args['delete_slides'] as boolean) ?? false
    );
    if (response.success) {
      logger.toolSuccess('powerpoint_delete_section', args, { sectionIndex: args['section_index'] }, Date.now() - startTime);
      return { success: true, result: `Section deleted.` };
    }
    logger.toolError('powerpoint_delete_section', args, new Error(response.error || 'Failed to delete section'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete section' };
  } catch (error) {
    logger.toolError('powerpoint_delete_section', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
      properties: {},
      required: [],
    },
  },
};

async function executePowerPointGetSections(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('powerpoint_get_sections', _args);
  try {
    const response = await powerpointClient.powerpointGetSections();
    if (response.success) {
      logger.toolSuccess('powerpoint_get_sections', _args, {}, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    logger.toolError('powerpoint_get_sections', _args, new Error(response.error || 'Failed to get sections'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get sections' };
  } catch (error) {
    logger.toolError('powerpoint_get_sections', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
