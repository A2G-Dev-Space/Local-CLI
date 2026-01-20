/**
 * PowerPoint Export Tools
 *
 * Export operations: exportToPDF, startSlideshow
 * Total: 2 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Export to PDF
// =============================================================================

const PPT_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_export_pdf',
    description: `Export the presentation to PDF format.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        output_path: { type: 'string', description: 'Path for the PDF output file' },
      },
      required: ['reason', 'output_path'],
    },
  },
};

async function executePPTExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointExportToPDF(args['output_path'] as string);
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${args['output_path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptExportPDFTool: LLMSimpleTool = {
  definition: PPT_EXPORT_PDF_DEFINITION, execute: executePPTExportPDF, categories: OFFICE_CATEGORIES, description: 'Export PowerPoint to PDF',
};

// =============================================================================
// PowerPoint Start Slideshow
// =============================================================================

const PPT_START_SLIDESHOW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_start_slideshow',
    description: `Start the slideshow from a specific slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are starting the slideshow' },
        from_slide: { type: 'number', description: 'Starting slide number (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTStartSlideshow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const fromSlide = (args['from_slide'] as number) || 1;
    const response = await powerpointClient.powerpointStartSlideshow(fromSlide);
    if (response.success) {
      return { success: true, result: `Slideshow started from slide ${fromSlide}` };
    }
    return { success: false, error: response.error || 'Failed to start slideshow' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptStartSlideshowTool: LLMSimpleTool = {
  definition: PPT_START_SLIDESHOW_DEFINITION, execute: executePPTStartSlideshow, categories: OFFICE_CATEGORIES, description: 'Start slideshow in PowerPoint',
};

// =============================================================================
// Export Tools
// =============================================================================

export const exportTools: LLMSimpleTool[] = [
  pptExportPDFTool,
  pptStartSlideshowTool,
];
