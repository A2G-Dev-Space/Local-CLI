/**
 * PowerPoint Sections & Notes Tools
 *
 * Section operations: addSection, deleteSection, getSections, addNote, getNote
 * Total: 5 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Section
// =============================================================================

const PPT_ADD_SECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_section',
    description: `Add a section to organize slides.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a section' },
        section_name: { type: 'string', description: 'Name for the section' },
        before_slide: { type: 'number', description: 'Insert section before this slide' },
      },
      required: ['reason', 'section_name', 'before_slide'],
    },
  },
};

async function executePPTAddSection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddSection(
      args['section_name'] as string, args['before_slide'] as number
    );
    if (response.success) {
      return { success: true, result: `Section added. Index: ${response['section_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add section' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddSectionTool: LLMSimpleTool = {
  definition: PPT_ADD_SECTION_DEFINITION, execute: executePPTAddSection, categories: OFFICE_CATEGORIES, description: 'Add section in PowerPoint',
};

// =============================================================================
// PowerPoint Delete Section
// =============================================================================

const PPT_DELETE_SECTION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_section',
    description: `Delete a section (optionally with its slides).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this section' },
        section_index: { type: 'number', description: 'Section index to delete (1-based)' },
        delete_slides: { type: 'boolean', description: 'Also delete slides in section (default: false)' },
      },
      required: ['reason', 'section_index'],
    },
  },
};

async function executePPTDeleteSection(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteSection(
      args['section_index'] as number,
      args['delete_slides'] as boolean | undefined
    );
    if (response.success) { return { success: true, result: 'Section deleted' }; }
    return { success: false, error: response.error || 'Failed to delete section' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptDeleteSectionTool: LLMSimpleTool = {
  definition: PPT_DELETE_SECTION_DEFINITION, execute: executePPTDeleteSection, categories: OFFICE_CATEGORIES, description: 'Delete section in PowerPoint',
};

// =============================================================================
// PowerPoint Get Sections
// =============================================================================

const PPT_GET_SECTIONS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_sections',
    description: `Get list of all sections in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need section list' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTGetSections(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetSections();
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get sections' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetSectionsTool: LLMSimpleTool = {
  definition: PPT_GET_SECTIONS_DEFINITION, execute: executePPTGetSections, categories: OFFICE_CATEGORIES, description: 'Get sections in PowerPoint',
};

// =============================================================================
// PowerPoint Add Note
// =============================================================================

const PPT_ADD_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_note',
    description: `Add speaker notes to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding notes' },
        slide_number: { type: 'number', description: 'Slide number' },
        note_text: { type: 'string', description: 'Note text' },
      },
      required: ['reason', 'slide_number', 'note_text'],
    },
  },
};

async function executePPTAddNote(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddNote(
      args['slide_number'] as number, args['note_text'] as string
    );
    if (response.success) { return { success: true, result: 'Note added' }; }
    return { success: false, error: response.error || 'Failed to add note' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddNoteTool: LLMSimpleTool = {
  definition: PPT_ADD_NOTE_DEFINITION, execute: executePPTAddNote, categories: OFFICE_CATEGORIES, description: 'Add note in PowerPoint',
};

// =============================================================================
// PowerPoint Get Note
// =============================================================================

const PPT_GET_NOTE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_note',
    description: `Get speaker notes from a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the notes' },
        slide_number: { type: 'number', description: 'Slide number' },
      },
      required: ['reason', 'slide_number'],
    },
  },
};

async function executePPTGetNote(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetNote(args['slide_number'] as number);
    if (response.success) {
      return { success: true, result: `Note: ${response['note']}` };
    }
    return { success: false, error: response.error || 'Failed to get note' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptGetNoteTool: LLMSimpleTool = {
  definition: PPT_GET_NOTE_DEFINITION, execute: executePPTGetNote, categories: OFFICE_CATEGORIES, description: 'Get note in PowerPoint',
};

// =============================================================================
// Export Sections Tools
// =============================================================================

export const sectionsTools: LLMSimpleTool[] = [
  pptAddSectionTool,
  pptDeleteSectionTool,
  pptGetSectionsTool,
  pptAddNoteTool,
  pptGetNoteTool,
];
