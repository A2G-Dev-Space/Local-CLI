/**
 * Excel Sheet Management Tools
 *
 * Tools for managing worksheets in Excel workbooks:
 * - Add, delete, rename sheets
 * - Get sheet list
 * - Select/activate sheets
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Excel Add Sheet
// =============================================================================

const EXCEL_ADD_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_sheet',
    description: `Add a new worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a sheet' },
        name: { type: 'string', description: 'Sheet name (optional)' },
        position: { type: 'string', description: 'Position: "start", "end", or after specific sheet name' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelAddSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAddSheet(
      args['name'] as string | undefined,
      args['position'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Sheet added: ${response['sheet_name'] || 'new sheet'}` };
    }
    return { success: false, error: response.error || 'Failed to add sheet' };
  } catch (error) {
    return { success: false, error: `Failed to add sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddSheetTool: LLMSimpleTool = {
  definition: EXCEL_ADD_SHEET_DEFINITION,
  execute: executeExcelAddSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel worksheet',
};

// =============================================================================
// Excel Delete Sheet
// =============================================================================

const EXCEL_DELETE_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_sheet',
    description: `Delete a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this sheet' },
        name: { type: 'string', description: 'Sheet name to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeleteSheet(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Sheet deleted: ${args['name']}` };
    }
    return { success: false, error: response.error || 'Failed to delete sheet' };
  } catch (error) {
    return { success: false, error: `Failed to delete sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteSheetTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_SHEET_DEFINITION,
  execute: executeExcelDeleteSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel worksheet',
};

// =============================================================================
// Excel Rename Sheet
// =============================================================================

const EXCEL_RENAME_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_rename_sheet',
    description: `Rename a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are renaming this sheet' },
        old_name: { type: 'string', description: 'Current sheet name' },
        new_name: { type: 'string', description: 'New sheet name' },
      },
      required: ['reason', 'old_name', 'new_name'],
    },
  },
};

async function executeExcelRenameSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelRenameSheet(
      args['old_name'] as string,
      args['new_name'] as string
    );
    if (response.success) {
      return { success: true, result: `Sheet renamed: ${args['old_name']} → ${args['new_name']}` };
    }
    return { success: false, error: response.error || 'Failed to rename sheet' };
  } catch (error) {
    return { success: false, error: `Failed to rename sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRenameSheetTool: LLMSimpleTool = {
  definition: EXCEL_RENAME_SHEET_DEFINITION,
  execute: executeExcelRenameSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Rename Excel worksheet',
};

// =============================================================================
// Excel Copy Sheet
// =============================================================================

const EXCEL_COPY_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_copy_sheet',
    description: `Copy (duplicate) a worksheet within the same workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are copying this sheet' },
        source_name: { type: 'string', description: 'Name of the sheet to copy' },
        new_name: { type: 'string', description: 'Name for the copied sheet (optional, auto-generated if not specified)' },
        position: { type: 'string', enum: ['before', 'after'], description: 'Position relative to target sheet (default: after source)' },
        target_sheet: { type: 'string', description: 'Target sheet for positioning (optional)' },
      },
      required: ['reason', 'source_name'],
    },
  },
};

async function executeExcelCopySheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCopySheet(
      args['source_name'] as string,
      args['new_name'] as string | undefined,
      args['position'] as 'before' | 'after' | undefined,
      args['target_sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Sheet copied: ${response['new_sheet_name']}` };
    }
    return { success: false, error: response.error || 'Failed to copy sheet' };
  } catch (error) {
    return { success: false, error: `Failed to copy sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCopySheetTool: LLMSimpleTool = {
  definition: EXCEL_COPY_SHEET_DEFINITION,
  execute: executeExcelCopySheet,
  categories: OFFICE_CATEGORIES,
  description: 'Copy Excel worksheet',
};

// =============================================================================
// Excel Get Sheets
// =============================================================================

const EXCEL_GET_SHEETS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_sheets',
    description: `Get list of all worksheets in the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the sheet list' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetSheets(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetSheets();
    if (response.success) {
      const sheets = response['sheets'] as string[] || [];
      return { success: true, result: `Sheets: ${sheets.join(', ')}` };
    }
    return { success: false, error: response.error || 'Failed to get sheets' };
  } catch (error) {
    return { success: false, error: `Failed to get sheets: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetSheetsTool: LLMSimpleTool = {
  definition: EXCEL_GET_SHEETS_DEFINITION,
  execute: executeExcelGetSheets,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel worksheet list',
};

// =============================================================================
// Excel Select Sheet
// =============================================================================

const EXCEL_SELECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_select_sheet',
    description: `Activate/select a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting sheet' },
        name: { type: 'string', description: 'Sheet name to select' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelSelectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSelectSheet(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Sheet "${args['name']}" activated` };
    }
    return { success: false, error: response.error || 'Failed to select sheet' };
  } catch (error) {
    return { success: false, error: `Failed to select sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSelectSheetTool: LLMSimpleTool = {
  definition: EXCEL_SELECT_SHEET_DEFINITION,
  execute: executeExcelSelectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Select Excel sheet',
};

// =============================================================================
// Excel Set Tab Color
// =============================================================================

const EXCEL_SET_TAB_COLOR_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_tab_color',
    description: `Set the color of a worksheet tab. Useful for organizing sheets visually.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting tab color' },
        sheet_name: { type: 'string', description: 'Name of the sheet' },
        color: { type: 'string', description: 'Hex color code (e.g., "#FF0000" for red, "#00FF00" for green)' },
      },
      required: ['reason', 'sheet_name', 'color'],
    },
  },
};

async function executeExcelSetTabColor(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetTabColor(
      args['sheet_name'] as string,
      args['color'] as string
    );
    if (response.success) {
      return { success: true, result: `Tab color set for "${args['sheet_name']}"` };
    }
    return { success: false, error: response.error || 'Failed to set tab color' };
  } catch (error) {
    return { success: false, error: `Failed to set tab color: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetTabColorTool: LLMSimpleTool = {
  definition: EXCEL_SET_TAB_COLOR_DEFINITION,
  execute: executeExcelSetTabColor,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel sheet tab color',
};

// =============================================================================
// Excel Set Zoom
// =============================================================================

const EXCEL_SET_ZOOM_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_zoom',
    description: `Set the zoom level of the active window. Range: 10-400%.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing zoom' },
        zoom_level: { type: 'number', description: 'Zoom percentage (10-400)' },
        sheet: { type: 'string', description: 'Sheet to zoom (optional, uses active sheet)' },
      },
      required: ['reason', 'zoom_level'],
    },
  },
};

async function executeExcelSetZoom(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetZoom(
      args['zoom_level'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Zoom set to ${args['zoom_level']}%` };
    }
    return { success: false, error: response.error || 'Failed to set zoom' };
  } catch (error) {
    return { success: false, error: `Failed to set zoom: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetZoomTool: LLMSimpleTool = {
  definition: EXCEL_SET_ZOOM_DEFINITION,
  execute: executeExcelSetZoom,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel zoom level',
};

// =============================================================================
// Excel Set Gridlines
// =============================================================================

const EXCEL_SET_GRIDLINES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_gridlines',
    description: `Show or hide gridlines in the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing gridlines' },
        show: { type: 'boolean', description: 'True to show gridlines, false to hide' },
        sheet: { type: 'string', description: 'Sheet name (optional, uses active sheet)' },
      },
      required: ['reason', 'show'],
    },
  },
};

async function executeExcelSetGridlines(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetGridlines(
      args['show'] as boolean,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Gridlines ${args['show'] ? 'shown' : 'hidden'}` };
    }
    return { success: false, error: response.error || 'Failed to set gridlines' };
  } catch (error) {
    return { success: false, error: `Failed to set gridlines: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetGridlinesTool: LLMSimpleTool = {
  definition: EXCEL_SET_GRIDLINES_DEFINITION,
  execute: executeExcelSetGridlines,
  categories: OFFICE_CATEGORIES,
  description: 'Show/hide Excel gridlines',
};

// =============================================================================
// Excel Set View Mode
// =============================================================================

const EXCEL_SET_VIEW_MODE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_view_mode',
    description: `Set the worksheet view mode.
- normal: Standard editing view
- pageBreak: Page Break Preview (shows where pages will break when printed)
- pageLayout: Page Layout view (WYSIWYG print preview)`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing view mode' },
        mode: { type: 'string', enum: ['normal', 'pageBreak', 'pageLayout'], description: 'View mode' },
        sheet: { type: 'string', description: 'Sheet name (optional, uses active sheet)' },
      },
      required: ['reason', 'mode'],
    },
  },
};

async function executeExcelSetViewMode(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetViewMode(
      args['mode'] as 'normal' | 'pageBreak' | 'pageLayout',
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `View mode set to "${args['mode']}"` };
    }
    return { success: false, error: response.error || 'Failed to set view mode' };
  } catch (error) {
    return { success: false, error: `Failed to set view mode: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetViewModeTool: LLMSimpleTool = {
  definition: EXCEL_SET_VIEW_MODE_DEFINITION,
  execute: executeExcelSetViewMode,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel view mode',
};

// =============================================================================
// Excel Insert Page Break
// =============================================================================

const EXCEL_INSERT_PAGE_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_page_break',
    description: `Insert a manual page break at the specified cell.
- Row page break: inserted above the cell
- Column page break: inserted to the left of the cell`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a page break' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A10" for row break at row 10)' },
        type: { type: 'string', enum: ['row', 'column'], description: 'Type of page break' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'type'],
    },
  },
};

async function executeExcelInsertPageBreak(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelInsertPageBreak(
      args['cell'] as string,
      args['type'] as 'row' | 'column',
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Inserted ${args['type']} page break at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to insert page break' };
  } catch (error) {
    return { success: false, error: `Failed to insert page break: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertPageBreakTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_PAGE_BREAK_DEFINITION,
  execute: executeExcelInsertPageBreak,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel page break',
};

// =============================================================================
// Excel Delete Page Break
// =============================================================================

const EXCEL_DELETE_PAGE_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_page_break',
    description: `Delete a manual page break at the specified cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting a page break' },
        cell: { type: 'string', description: 'Cell reference where the page break exists' },
        type: { type: 'string', enum: ['row', 'column'], description: 'Type of page break' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'type'],
    },
  },
};

async function executeExcelDeletePageBreak(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeletePageBreak(
      args['cell'] as string,
      args['type'] as 'row' | 'column',
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Deleted ${args['type']} page break at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to delete page break' };
  } catch (error) {
    return { success: false, error: `Failed to delete page break: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeletePageBreakTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_PAGE_BREAK_DEFINITION,
  execute: executeExcelDeletePageBreak,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel page break',
};

// =============================================================================
// Excel Reset All Page Breaks
// =============================================================================

const EXCEL_RESET_PAGE_BREAKS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_reset_page_breaks',
    description: `Remove all manual page breaks from the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are resetting page breaks' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelResetPageBreaks(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelResetAllPageBreaks(
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Reset all page breaks' };
    }
    return { success: false, error: response.error || 'Failed to reset page breaks' };
  } catch (error) {
    return { success: false, error: `Failed to reset page breaks: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelResetPageBreaksTool: LLMSimpleTool = {
  definition: EXCEL_RESET_PAGE_BREAKS_DEFINITION,
  execute: executeExcelResetPageBreaks,
  categories: OFFICE_CATEGORIES,
  description: 'Reset all Excel page breaks',
};

// =============================================================================
// Export All Sheet Tools
// =============================================================================

export const sheetsTools: LLMSimpleTool[] = [
  excelAddSheetTool,
  excelDeleteSheetTool,
  excelRenameSheetTool,
  excelCopySheetTool,
  excelGetSheetsTool,
  excelSelectSheetTool,
  excelSetTabColorTool,
  excelSetZoomTool,
  excelSetGridlinesTool,
  excelSetViewModeTool,
  excelInsertPageBreakTool,
  excelDeletePageBreakTool,
  excelResetPageBreaksTool,
];
