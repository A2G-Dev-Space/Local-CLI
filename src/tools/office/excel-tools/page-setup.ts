/**
 * Excel Page Setup & Print Tools
 *
 * Tools for configuring page setup and print settings.
 * Tools: set_page_setup, set_print_area, set_print_titles
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

// =============================================================================
// Excel Set Page Setup
// =============================================================================

const EXCEL_SET_PAGE_SETUP_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_page_setup',
    description: `Configure page setup for printing: orientation, paper size, margins, and fit-to-page options.
Margins are specified in inches (e.g., 0.5 = half inch).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are configuring page setup' },
        orientation: { type: 'string', enum: ['portrait', 'landscape'], description: 'Page orientation' },
        paper_size: { type: 'string', enum: ['letter', 'legal', 'a4', 'a3'], description: 'Paper size' },
        margin_top: { type: 'number', description: 'Top margin in inches (e.g., 0.75)' },
        margin_bottom: { type: 'number', description: 'Bottom margin in inches' },
        margin_left: { type: 'number', description: 'Left margin in inches' },
        margin_right: { type: 'number', description: 'Right margin in inches' },
        fit_to_page: { type: 'boolean', description: 'Enable fit-to-page scaling' },
        fit_to_width: { type: 'number', description: 'Number of pages wide (when fit_to_page=true)' },
        fit_to_height: { type: 'number', description: 'Number of pages tall (when fit_to_page=true)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelSetPageSetup(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const options: {
      orientation?: 'portrait' | 'landscape';
      paperSize?: 'letter' | 'legal' | 'a4' | 'a3';
      margins?: { top?: number; bottom?: number; left?: number; right?: number };
      fitToPage?: boolean;
      fitToWidth?: number;
      fitToHeight?: number;
    } = {};

    if (args['orientation']) options.orientation = args['orientation'] as 'portrait' | 'landscape';
    if (args['paper_size']) options.paperSize = args['paper_size'] as 'letter' | 'legal' | 'a4' | 'a3';

    const margins: { top?: number; bottom?: number; left?: number; right?: number } = {};
    if (args['margin_top'] !== undefined) margins.top = args['margin_top'] as number;
    if (args['margin_bottom'] !== undefined) margins.bottom = args['margin_bottom'] as number;
    if (args['margin_left'] !== undefined) margins.left = args['margin_left'] as number;
    if (args['margin_right'] !== undefined) margins.right = args['margin_right'] as number;
    if (Object.keys(margins).length > 0) options.margins = margins;

    if (args['fit_to_page']) {
      options.fitToPage = true;
      if (args['fit_to_width'] !== undefined) options.fitToWidth = args['fit_to_width'] as number;
      if (args['fit_to_height'] !== undefined) options.fitToHeight = args['fit_to_height'] as number;
    }

    const response = await excelClient.excelSetPageSetup(options, args['sheet'] as string | undefined);
    if (response.success) {
      return { success: true, result: response.message || 'Page setup configured' };
    }
    return { success: false, error: response.error || 'Failed to set page setup' };
  } catch (error) {
    return { success: false, error: `Failed to set page setup: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetPageSetupTool: LLMSimpleTool = {
  definition: EXCEL_SET_PAGE_SETUP_DEFINITION,
  execute: executeExcelSetPageSetup,
  categories: OFFICE_CATEGORIES,
  description: 'Configure Excel page setup for printing',
};

// =============================================================================
// Excel Set Print Area
// =============================================================================

const EXCEL_SET_PRINT_AREA_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_print_area',
    description: `Set the print area to a specific range. Only this range will be printed.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting print area' },
        range: { type: 'string', description: 'Range to print (e.g., "A1:G50")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetPrintArea(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetPrintArea(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Print area set to '${args['range']}'` };
    }
    return { success: false, error: response.error || 'Failed to set print area' };
  } catch (error) {
    return { success: false, error: `Failed to set print area: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetPrintAreaTool: LLMSimpleTool = {
  definition: EXCEL_SET_PRINT_AREA_DEFINITION,
  execute: executeExcelSetPrintArea,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel print area',
};

// =============================================================================
// Excel Set Print Titles
// =============================================================================

const EXCEL_SET_PRINT_TITLES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_print_titles',
    description: `Set rows and/or columns to repeat on every printed page.
Use for headers that should appear on all pages.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting print titles' },
        rows_to_repeat: { type: 'string', description: 'Row range to repeat (e.g., "$1:$2" for rows 1-2)' },
        columns_to_repeat: { type: 'string', description: 'Column range to repeat (e.g., "$A:$B" for columns A-B)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelSetPrintTitles(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetPrintTitles(
      args['rows_to_repeat'] as string | undefined,
      args['columns_to_repeat'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Print titles configured' };
    }
    return { success: false, error: response.error || 'Failed to set print titles' };
  } catch (error) {
    return { success: false, error: `Failed to set print titles: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetPrintTitlesTool: LLMSimpleTool = {
  definition: EXCEL_SET_PRINT_TITLES_DEFINITION,
  execute: executeExcelSetPrintTitles,
  categories: OFFICE_CATEGORIES,
  description: 'Set rows/columns to repeat on printed pages',
};

// =============================================================================
// Export all page setup tools
// =============================================================================

export const pageSetupTools: LLMSimpleTool[] = [
  excelSetPageSetupTool,
  excelSetPrintAreaTool,
  excelSetPrintTitlesTool,
];
