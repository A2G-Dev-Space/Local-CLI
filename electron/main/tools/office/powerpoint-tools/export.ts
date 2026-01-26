/**
 * PowerPoint Export Tools
 *
 * Tools for saving, exporting to PDF, and starting slideshow
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

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
  const startTime = Date.now();
  logger.toolStart('powerpoint_save', args);
  try {
    const response = await powerpointClient.powerpointSave(args['path'] as string | undefined);
    if (response.success) {
      logger.toolSuccess('powerpoint_save', args, { path: response['path'] || 'current location' }, Date.now() - startTime);
      return { success: true, result: `Presentation saved: ${response['path'] || 'current location'}` };
    }
    logger.toolError('powerpoint_save', args, new Error(response.error || 'Failed to save presentation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to save presentation' };
  } catch (error) {
    logger.toolError('powerpoint_save', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_export_pdf', args);
  try {
    const response = await powerpointClient.powerpointExportToPDF(args['path'] as string);
    if (response.success) {
      logger.toolSuccess('powerpoint_export_pdf', args, { path: response['path'] || args['path'] }, Date.now() - startTime);
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    logger.toolError('powerpoint_export_pdf', args, new Error(response.error || 'Failed to export to PDF'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    logger.toolError('powerpoint_export_pdf', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_start_slideshow', args);
  try {
    const fromSlide = args['from_slide'] as number ?? 1;
    const response = await powerpointClient.powerpointStartSlideshow(fromSlide);
    if (response.success) {
      logger.toolSuccess('powerpoint_start_slideshow', args, { fromSlide }, Date.now() - startTime);
      return { success: true, result: `Slideshow started from slide ${fromSlide}` };
    }
    logger.toolError('powerpoint_start_slideshow', args, new Error(response.error || 'Failed to start slideshow'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to start slideshow' };
  } catch (error) {
    logger.toolError('powerpoint_start_slideshow', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Export
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  powerpointSaveTool,
  powerpointExportPDFTool,
  powerpointStartSlideshowTool,
];
