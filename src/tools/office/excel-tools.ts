/**
 * Microsoft Excel Tools
 *
 * LLM이 Excel을 제어할 수 있는 도구들
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
// Excel Launch
// =============================================================================

const EXCEL_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_launch',
    description: `Launch Microsoft Excel for spreadsheet editing.
Use this tool to start Excel before working with spreadsheets.
The Excel window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching Excel' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'Excel launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch Excel' };
  } catch (error) {
    return { success: false, error: `Failed to launch Excel: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelLaunchTool: LLMSimpleTool = {
  definition: EXCEL_LAUNCH_DEFINITION,
  execute: executeExcelLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft Excel',
};

// =============================================================================
// Excel Create
// =============================================================================

const EXCEL_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create',
    description: `Create a new Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a workbook' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New workbook created' };
    }
    return { success: false, error: response.error || 'Failed to create workbook' };
  } catch (error) {
    return { success: false, error: `Failed to create workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreateTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_DEFINITION,
  execute: executeExcelCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new Excel workbook',
};

// =============================================================================
// Excel Open
// =============================================================================

const EXCEL_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_open',
    description: `Open an existing Excel workbook. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this workbook' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeExcelOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Workbook opened: ${response['workbook_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open workbook' };
  } catch (error) {
    return { success: false, error: `Failed to open workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelOpenTool: LLMSimpleTool = {
  definition: EXCEL_OPEN_DEFINITION,
  execute: executeExcelOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing Excel workbook',
};

// =============================================================================
// Excel Write Cell
// =============================================================================

const EXCEL_WRITE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_cell',
    description: `Write a value to a specific cell in Excel with optional font settings.
Use cell references like "A1", "B2", "C10", etc.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are writing to this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "B2")' },
        value: { type: 'string', description: 'Value to write to the cell' },
        sheet: { type: 'string', description: 'Sheet name (optional, uses active sheet if not specified)' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "맑은 고딕")' },
        font_size: { type: 'number', description: 'Font size in points' },
        bold: { type: 'boolean', description: 'Whether to make the text bold' },
      },
      required: ['reason', 'cell', 'value'],
    },
  },
};

async function executeExcelWriteCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelWriteCell(
      args['cell'] as string,
      args['value'],
      args['sheet'] as string | undefined,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Value written to cell ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to write cell' };
  } catch (error) {
    return { success: false, error: `Failed to write cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelWriteCellTool: LLMSimpleTool = {
  definition: EXCEL_WRITE_CELL_DEFINITION,
  execute: executeExcelWriteCell,
  categories: OFFICE_CATEGORIES,
  description: 'Write value to Excel cell',
};

// =============================================================================
// Excel Read Cell
// =============================================================================

const EXCEL_READ_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_cell',
    description: `Read a value from a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "B2")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelReadCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelReadCell(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const value = response['value'];
      return { success: true, result: `Cell ${args['cell']}: ${value ?? '(empty)'}` };
    }
    return { success: false, error: response.error || 'Failed to read cell' };
  } catch (error) {
    return { success: false, error: `Failed to read cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelReadCellTool: LLMSimpleTool = {
  definition: EXCEL_READ_CELL_DEFINITION,
  execute: executeExcelReadCell,
  categories: OFFICE_CATEGORIES,
  description: 'Read value from Excel cell',
};

// =============================================================================
// Excel Write Range
// =============================================================================

const EXCEL_WRITE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_range',
    description: `Write multiple values to a range of cells in Excel.
Provide a 2D array of values starting from the specified cell.
Example: start_cell="A1", values=[["Name", "Age"], ["John", 25]]`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are writing this range' },
        start_cell: { type: 'string', description: 'Starting cell reference (e.g., "A1")' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values to write' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_cell', 'values'],
    },
  },
};

async function executeExcelWriteRange(args: Record<string, unknown>): Promise<ToolResult> {
  const values = args['values'] as unknown[][];
  try {
    const response = await officeClient.excelWriteRange(
      args['start_cell'] as string,
      values,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const rows = values.length;
      const cols = values[0]?.length || 0;
      return { success: true, result: `Written ${rows}x${cols} values starting at ${args['start_cell']}` };
    }
    return { success: false, error: response.error || 'Failed to write range' };
  } catch (error) {
    return { success: false, error: `Failed to write range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelWriteRangeTool: LLMSimpleTool = {
  definition: EXCEL_WRITE_RANGE_DEFINITION,
  execute: executeExcelWriteRange,
  categories: OFFICE_CATEGORIES,
  description: 'Write values to Excel range',
};

// =============================================================================
// Excel Read Range
// =============================================================================

const EXCEL_READ_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_range',
    description: `Read values from a range of cells in Excel.
Returns a 2D array of values.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading this range' },
        range: { type: 'string', description: 'Range reference (e.g., "A1:C10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelReadRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelReadRange(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const values = response['values'];
      const rows = response['rows'] as number || 0;
      const cols = response['columns'] as number || 0;
      return {
        success: true,
        result: `Range ${args['range']} (${rows}x${cols}):\n${JSON.stringify(values, null, 2)}`,
      };
    }
    return { success: false, error: response.error || 'Failed to read range' };
  } catch (error) {
    return { success: false, error: `Failed to read range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelReadRangeTool: LLMSimpleTool = {
  definition: EXCEL_READ_RANGE_DEFINITION,
  execute: executeExcelReadRange,
  categories: OFFICE_CATEGORIES,
  description: 'Read values from Excel range',
};

// =============================================================================
// Excel Save
// =============================================================================

const EXCEL_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_save',
    description: `Save the active Excel workbook. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelSave(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSave(args['path'] as string | undefined);
    if (response.success) {
      return { success: true, result: `Workbook saved: ${response['path'] || 'current location'}` };
    }
    return { success: false, error: response.error || 'Failed to save workbook' };
  } catch (error) {
    return { success: false, error: `Failed to save workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSaveTool: LLMSimpleTool = {
  definition: EXCEL_SAVE_DEFINITION,
  execute: executeExcelSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save Excel workbook',
};

// =============================================================================
// Excel Screenshot
// =============================================================================

const EXCEL_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_screenshot',
    description: `Take a screenshot of the current Excel worksheet.
Captures the used range and saves to ${OFFICE_SCREENSHOT_PATH_DESC}.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'excel');
      return {
        success: true,
        result: `Excel screenshot saved to: ${filePath}`,
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelScreenshotTool: LLMSimpleTool = {
  definition: EXCEL_SCREENSHOT_DEFINITION,
  execute: executeExcelScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take Excel window screenshot',
};

// =============================================================================
// Excel Close
// =============================================================================

const EXCEL_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_close',
    description: `Close the active Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are closing' },
        save: { type: 'boolean', description: 'Whether to save before closing (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelClose(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelClose(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Workbook closed${args['save'] ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close workbook' };
  } catch (error) {
    return { success: false, error: `Failed to close workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCloseTool: LLMSimpleTool = {
  definition: EXCEL_CLOSE_DEFINITION,
  execute: executeExcelClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Excel workbook',
};

// =============================================================================
// Excel Quit
// =============================================================================

const EXCEL_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_quit',
    description: `Quit Microsoft Excel application entirely.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are quitting Excel' },
        save: { type: 'boolean', description: 'Whether to save all workbooks before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelQuit(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelQuit(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Excel closed${args['save'] ? ' (all workbooks saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit Excel' };
  } catch (error) {
    return { success: false, error: `Failed to quit Excel: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelQuitTool: LLMSimpleTool = {
  definition: EXCEL_QUIT_DEFINITION,
  execute: executeExcelQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft Excel',
};

// =============================================================================
// Excel Set Formula
// =============================================================================

const EXCEL_SET_FORMULA_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_formula',
    description: `Set a formula in a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting a formula' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1")' },
        formula: { type: 'string', description: 'Formula (e.g., "=SUM(A1:A10)")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'formula'],
    },
  },
};

async function executeExcelSetFormula(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetFormula(
      args['cell'] as string,
      args['formula'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Formula set in ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to set formula' };
  } catch (error) {
    return { success: false, error: `Failed to set formula: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFormulaTool: LLMSimpleTool = {
  definition: EXCEL_SET_FORMULA_DEFINITION,
  execute: executeExcelSetFormula,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel formula',
};

// =============================================================================
// Excel Set Font
// =============================================================================

const EXCEL_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_font',
    description: `Set font properties for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
        range: { type: 'string', description: 'Range reference (e.g., "A1:B5")' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        color: { type: 'string', description: 'Font color as hex' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetFont(
      args['range'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        color: args['color'] as string | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Font properties set for ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFontTool: LLMSimpleTool = {
  definition: EXCEL_SET_FONT_DEFINITION,
  execute: executeExcelSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel font properties',
};

// =============================================================================
// Excel Set Fill
// =============================================================================

const EXCEL_SET_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_fill',
    description: `Set background fill color for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting fill color' },
        range: { type: 'string', description: 'Range reference (e.g., "A1:B5")' },
        color: { type: 'string', description: 'Fill color as hex (e.g., "#FFFF00")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'color'],
    },
  },
};

async function executeExcelSetFill(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetFill(
      args['range'] as string,
      args['color'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Fill color set for ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set fill' };
  } catch (error) {
    return { success: false, error: `Failed to set fill: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFillTool: LLMSimpleTool = {
  definition: EXCEL_SET_FILL_DEFINITION,
  execute: executeExcelSetFill,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel fill color',
};

// =============================================================================
// Excel Set Number Format
// =============================================================================

const EXCEL_SET_NUMBER_FORMAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_number_format',
    description: `Set number format for a range.
Common formats: "#,##0" (thousands), "0.00" (2 decimals), "0%" (percent), "yyyy-mm-dd" (date)`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting number format' },
        range: { type: 'string', description: 'Range reference' },
        format: { type: 'string', description: 'Number format string' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'format'],
    },
  },
};

async function executeExcelSetNumberFormat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetNumberFormat(
      args['range'] as string,
      args['format'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Number format set for ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set number format' };
  } catch (error) {
    return { success: false, error: `Failed to set number format: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetNumberFormatTool: LLMSimpleTool = {
  definition: EXCEL_SET_NUMBER_FORMAT_DEFINITION,
  execute: executeExcelSetNumberFormat,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel number format',
};

// =============================================================================
// Excel Set Border
// =============================================================================

const EXCEL_SET_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_border',
    description: `Set border for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting border' },
        range: { type: 'string', description: 'Range reference' },
        style: { type: 'string', enum: ['thin', 'medium', 'thick', 'double', 'dotted', 'dashed'], description: 'Border style' },
        edges: { type: 'array', items: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'all'] }, description: 'Which edges to apply border (default: all)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetBorder(
      args['range'] as string,
      {
        style: args['style'] as 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed' | undefined,
        edges: args['edges'] as ('left' | 'right' | 'top' | 'bottom' | 'all')[] | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Border set for ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set border' };
  } catch (error) {
    return { success: false, error: `Failed to set border: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetBorderTool: LLMSimpleTool = {
  definition: EXCEL_SET_BORDER_DEFINITION,
  execute: executeExcelSetBorder,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel border',
};

// =============================================================================
// Excel Set Alignment
// =============================================================================

const EXCEL_SET_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_alignment',
    description: `Set cell alignment for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting alignment' },
        range: { type: 'string', description: 'Range reference' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'center', 'bottom'], description: 'Vertical alignment' },
        wrap_text: { type: 'boolean', description: 'Wrap text' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetAlignment(
      args['range'] as string,
      {
        horizontal: args['horizontal'] as 'left' | 'center' | 'right' | undefined,
        vertical: args['vertical'] as 'top' | 'center' | 'bottom' | undefined,
        wrapText: args['wrap_text'] as boolean | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Alignment set for ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set alignment' };
  } catch (error) {
    return { success: false, error: `Failed to set alignment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetAlignmentTool: LLMSimpleTool = {
  definition: EXCEL_SET_ALIGNMENT_DEFINITION,
  execute: executeExcelSetAlignment,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel alignment',
};

// =============================================================================
// Excel Merge Cells
// =============================================================================

const EXCEL_MERGE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_merge_cells',
    description: `Merge a range of cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        range: { type: 'string', description: 'Range to merge (e.g., "A1:C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelMergeCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelMergeCells(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Cells merged: ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to merge cells' };
  } catch (error) {
    return { success: false, error: `Failed to merge cells: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelMergeCellsTool: LLMSimpleTool = {
  definition: EXCEL_MERGE_CELLS_DEFINITION,
  execute: executeExcelMergeCells,
  categories: OFFICE_CATEGORIES,
  description: 'Merge Excel cells',
};

// =============================================================================
// Excel Set Column Width
// =============================================================================

const EXCEL_SET_COLUMN_WIDTH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_column_width',
    description: `Set column width or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting column width' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        width: { type: 'number', description: 'Width in characters (ignored if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit column width to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelSetColumnWidth(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetColumnWidth(
      args['column'] as string,
      args['width'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} width set` };
    }
    return { success: false, error: response.error || 'Failed to set column width' };
  } catch (error) {
    return { success: false, error: `Failed to set column width: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetColumnWidthTool: LLMSimpleTool = {
  definition: EXCEL_SET_COLUMN_WIDTH_DEFINITION,
  execute: executeExcelSetColumnWidth,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel column width',
};

// =============================================================================
// Excel Set Row Height
// =============================================================================

const EXCEL_SET_ROW_HEIGHT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_row_height',
    description: `Set row height or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting row height' },
        row: { type: 'number', description: 'Row number' },
        height: { type: 'number', description: 'Height in points (ignored if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit row height to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelSetRowHeight(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetRowHeight(
      args['row'] as number,
      args['height'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} height set` };
    }
    return { success: false, error: response.error || 'Failed to set row height' };
  } catch (error) {
    return { success: false, error: `Failed to set row height: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetRowHeightTool: LLMSimpleTool = {
  definition: EXCEL_SET_ROW_HEIGHT_DEFINITION,
  execute: executeExcelSetRowHeight,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel row height',
};

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
    const response = await officeClient.excelAddSheet(
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
    const response = await officeClient.excelDeleteSheet(args['name'] as string);
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
    const response = await officeClient.excelRenameSheet(
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
    const response = await officeClient.excelGetSheets();
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
// Excel Sort Range
// =============================================================================

const EXCEL_SORT_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_sort_range',
    description: `Sort a range of cells by a column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sorting' },
        range: { type: 'string', description: 'Range to sort (e.g., "A1:D10")' },
        sort_column: { type: 'string', description: 'Column to sort by (e.g., "B")' },
        ascending: { type: 'boolean', description: 'Sort ascending (default: true)' },
        has_header: { type: 'boolean', description: 'First row is header (default: true)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'sort_column'],
    },
  },
};

async function executeExcelSortRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSortRange(
      args['range'] as string,
      args['sort_column'] as string,
      args['ascending'] as boolean ?? true,
      args['has_header'] as boolean ?? true,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Range sorted by column ${args['sort_column']}` };
    }
    return { success: false, error: response.error || 'Failed to sort range' };
  } catch (error) {
    return { success: false, error: `Failed to sort range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSortRangeTool: LLMSimpleTool = {
  definition: EXCEL_SORT_RANGE_DEFINITION,
  execute: executeExcelSortRange,
  categories: OFFICE_CATEGORIES,
  description: 'Sort Excel range',
};

// =============================================================================
// Excel Insert Row
// =============================================================================

const EXCEL_INSERT_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_row',
    description: `Insert rows at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting rows' },
        row: { type: 'number', description: 'Row number to insert at' },
        count: { type: 'number', description: 'Number of rows to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelInsertRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = args['count'] as number ?? 1;
    const response = await officeClient.excelInsertRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} row(s) inserted at row ${args['row']}` };
    }
    return { success: false, error: response.error || 'Failed to insert row' };
  } catch (error) {
    return { success: false, error: `Failed to insert row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertRowTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_ROW_DEFINITION,
  execute: executeExcelInsertRow,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel rows',
};

// =============================================================================
// Excel Delete Row
// =============================================================================

const EXCEL_DELETE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_row',
    description: `Delete rows at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting rows' },
        row: { type: 'number', description: 'Row number to delete' },
        count: { type: 'number', description: 'Number of rows to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelDeleteRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = args['count'] as number ?? 1;
    const response = await officeClient.excelDeleteRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} row(s) deleted at row ${args['row']}` };
    }
    return { success: false, error: response.error || 'Failed to delete row' };
  } catch (error) {
    return { success: false, error: `Failed to delete row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteRowTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_ROW_DEFINITION,
  execute: executeExcelDeleteRow,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel rows',
};

// =============================================================================
// Excel Freeze Panes
// =============================================================================

const EXCEL_FREEZE_PANES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_freeze_panes',
    description: `Freeze panes to keep rows/columns visible while scrolling.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are freezing panes' },
        row: { type: 'number', description: 'Freeze rows above this row number' },
        column: { type: 'string', description: 'Freeze columns to the left of this column' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelFreezePanes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelFreezePanes(
      args['row'] as number | undefined,
      args['column'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Panes frozen' };
    }
    return { success: false, error: response.error || 'Failed to freeze panes' };
  } catch (error) {
    return { success: false, error: `Failed to freeze panes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFreezePanesTool: LLMSimpleTool = {
  definition: EXCEL_FREEZE_PANES_DEFINITION,
  execute: executeExcelFreezePanes,
  categories: OFFICE_CATEGORIES,
  description: 'Freeze Excel panes',
};

// =============================================================================
// Excel Auto Filter
// =============================================================================

const EXCEL_AUTO_FILTER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_auto_filter',
    description: `Apply auto filter to a range for data filtering.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying auto filter' },
        range: { type: 'string', description: 'Range to apply filter (e.g., "A1:D10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelAutoFilter(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAutoFilter(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Auto filter applied to ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to apply auto filter' };
  } catch (error) {
    return { success: false, error: `Failed to apply auto filter: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAutoFilterTool: LLMSimpleTool = {
  definition: EXCEL_AUTO_FILTER_DEFINITION,
  execute: executeExcelAutoFilter,
  categories: OFFICE_CATEGORIES,
  description: 'Apply Excel auto filter',
};

// =============================================================================
// Excel Add Chart
// =============================================================================

const EXCEL_ADD_CHART_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_chart',
    description: `Add a chart based on data range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a chart' },
        data_range: { type: 'string', description: 'Data range (e.g., "A1:B10")' },
        chart_type: { type: 'string', enum: ['column', 'bar', 'line', 'pie', 'area', 'scatter', 'doughnut'], description: 'Chart type' },
        title: { type: 'string', description: 'Chart title (optional)' },
        left: { type: 'number', description: 'Left position in points (optional)' },
        top: { type: 'number', description: 'Top position in points (optional)' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'data_range', 'chart_type'],
    },
  },
};

async function executeExcelAddChart(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAddChart(
      args['data_range'] as string,
      args['chart_type'] as 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut',
      {
        title: args['title'] as string | undefined,
        left: args['left'] as number | undefined,
        top: args['top'] as number | undefined,
        width: args['width'] as number | undefined,
        height: args['height'] as number | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Chart added: ${response['chart_name']}` };
    }
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
    return { success: false, error: `Failed to add chart: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddChartTool: LLMSimpleTool = {
  definition: EXCEL_ADD_CHART_DEFINITION,
  execute: executeExcelAddChart,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel chart',
};

// =============================================================================
// Excel Set Chart Title
// =============================================================================

const EXCEL_SET_CHART_TITLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_chart_title',
    description: `Set or change the title of a chart.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting chart title' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        title: { type: 'string', description: 'New chart title' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'title'],
    },
  },
};

async function executeExcelSetChartTitle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetChartTitle(
      args['chart_index'] as number,
      args['title'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Chart title set' };
    }
    return { success: false, error: response.error || 'Failed to set chart title' };
  } catch (error) {
    return { success: false, error: `Failed to set chart title: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetChartTitleTool: LLMSimpleTool = {
  definition: EXCEL_SET_CHART_TITLE_DEFINITION,
  execute: executeExcelSetChartTitle,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel chart title',
};

// =============================================================================
// Excel Delete Chart
// =============================================================================

const EXCEL_DELETE_CHART_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_chart',
    description: `Delete a chart from the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the chart' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index'],
    },
  },
};

async function executeExcelDeleteChart(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelDeleteChart(
      args['chart_index'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Chart deleted' };
    }
    return { success: false, error: response.error || 'Failed to delete chart' };
  } catch (error) {
    return { success: false, error: `Failed to delete chart: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteChartTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_CHART_DEFINITION,
  execute: executeExcelDeleteChart,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel chart',
};

// =============================================================================
// Excel Add Conditional Format
// =============================================================================

const EXCEL_ADD_CONDITIONAL_FORMAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_conditional_format',
    description: `Add conditional formatting to a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding conditional format' },
        range: { type: 'string', description: 'Range to format (e.g., "A1:A10")' },
        format_type: { type: 'string', enum: ['cellValue', 'colorScale', 'dataBar', 'iconSet', 'duplicates', 'top10'], description: 'Format type' },
        operator: { type: 'string', enum: ['greater', 'less', 'equal', 'between', 'notBetween'], description: 'Comparison operator (for cellValue)' },
        value1: { type: 'string', description: 'First value for comparison' },
        value2: { type: 'string', description: 'Second value (for between/notBetween)' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
        font_color: { type: 'string', description: 'Font color as hex' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'format_type'],
    },
  },
};

async function executeExcelAddConditionalFormat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAddConditionalFormat(
      args['range'] as string,
      args['format_type'] as 'cellValue' | 'colorScale' | 'dataBar' | 'iconSet' | 'duplicates' | 'top10',
      {
        operator: args['operator'] as 'greater' | 'less' | 'equal' | 'between' | 'notBetween' | undefined,
        value1: args['value1'] as string | number | undefined,
        value2: args['value2'] as string | number | undefined,
        fillColor: args['fill_color'] as string | undefined,
        fontColor: args['font_color'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Conditional format added to ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to add conditional format' };
  } catch (error) {
    return { success: false, error: `Failed to add conditional format: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddConditionalFormatTool: LLMSimpleTool = {
  definition: EXCEL_ADD_CONDITIONAL_FORMAT_DEFINITION,
  execute: executeExcelAddConditionalFormat,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel conditional format',
};

// =============================================================================
// Excel Clear Conditional Format
// =============================================================================

const EXCEL_CLEAR_CONDITIONAL_FORMAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_conditional_format',
    description: `Clear conditional formatting from a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing conditional format' },
        range: { type: 'string', description: 'Range to clear (e.g., "A1:A10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearConditionalFormat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelClearConditionalFormat(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Conditional formatting cleared from ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to clear conditional format' };
  } catch (error) {
    return { success: false, error: `Failed to clear conditional format: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearConditionalFormatTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_CONDITIONAL_FORMAT_DEFINITION,
  execute: executeExcelClearConditionalFormat,
  categories: OFFICE_CATEGORIES,
  description: 'Clear Excel conditional format',
};

// =============================================================================
// Excel Set Data Validation
// =============================================================================

const EXCEL_SET_DATA_VALIDATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_data_validation',
    description: `Set data validation (dropdown list, number range, etc.) for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting data validation' },
        range: { type: 'string', description: 'Range (e.g., "A1:A10")' },
        validation_type: { type: 'string', enum: ['list', 'whole', 'decimal', 'date', 'textLength', 'custom'], description: 'Validation type' },
        formula1: { type: 'string', description: 'Formula/values (for list: "Option1,Option2,Option3")' },
        formula2: { type: 'string', description: 'Second formula (for between/notBetween)' },
        operator: { type: 'string', enum: ['between', 'notBetween', 'equal', 'notEqual', 'greater', 'less', 'greaterEqual', 'lessEqual'], description: 'Comparison operator' },
        input_title: { type: 'string', description: 'Input message title' },
        input_message: { type: 'string', description: 'Input message' },
        error_title: { type: 'string', description: 'Error message title' },
        error_message: { type: 'string', description: 'Error message' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'validation_type'],
    },
  },
};

async function executeExcelSetDataValidation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelSetDataValidation(
      args['range'] as string,
      args['validation_type'] as 'list' | 'whole' | 'decimal' | 'date' | 'textLength' | 'custom',
      {
        formula1: args['formula1'] as string | undefined,
        formula2: args['formula2'] as string | undefined,
        operator: args['operator'] as 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greater' | 'less' | 'greaterEqual' | 'lessEqual' | undefined,
        inputTitle: args['input_title'] as string | undefined,
        inputMessage: args['input_message'] as string | undefined,
        errorTitle: args['error_title'] as string | undefined,
        errorMessage: args['error_message'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Data validation set on ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to set data validation' };
  } catch (error) {
    return { success: false, error: `Failed to set data validation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetDataValidationTool: LLMSimpleTool = {
  definition: EXCEL_SET_DATA_VALIDATION_DEFINITION,
  execute: executeExcelSetDataValidation,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel data validation',
};

// =============================================================================
// Excel Clear Data Validation
// =============================================================================

const EXCEL_CLEAR_DATA_VALIDATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_data_validation',
    description: `Clear data validation from a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing data validation' },
        range: { type: 'string', description: 'Range to clear' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearDataValidation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelClearDataValidation(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Data validation cleared from ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to clear data validation' };
  } catch (error) {
    return { success: false, error: `Failed to clear data validation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearDataValidationTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_DATA_VALIDATION_DEFINITION,
  execute: executeExcelClearDataValidation,
  categories: OFFICE_CATEGORIES,
  description: 'Clear Excel data validation',
};

// =============================================================================
// Excel Create Named Range
// =============================================================================

const EXCEL_CREATE_NAMED_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create_named_range',
    description: `Create a named range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating named range' },
        name: { type: 'string', description: 'Name for the range' },
        range: { type: 'string', description: 'Range address (e.g., "A1:B10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'name', 'range'],
    },
  },
};

async function executeExcelCreateNamedRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelCreateNamedRange(
      args['name'] as string,
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Named range "${args['name']}" created` };
    }
    return { success: false, error: response.error || 'Failed to create named range' };
  } catch (error) {
    return { success: false, error: `Failed to create named range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreateNamedRangeTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_NAMED_RANGE_DEFINITION,
  execute: executeExcelCreateNamedRange,
  categories: OFFICE_CATEGORIES,
  description: 'Create Excel named range',
};

// =============================================================================
// Excel Get Named Ranges
// =============================================================================

const EXCEL_GET_NAMED_RANGES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_named_ranges',
    description: `Get all named ranges in the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need named ranges' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetNamedRanges(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelGetNamedRanges();
    if (response.success) {
      const ranges = response['named_ranges'] as Array<{ name: string; refersTo: string }> || [];
      if (ranges.length === 0) {
        return { success: true, result: 'No named ranges found' };
      }
      const list = ranges.map(r => `- ${r.name}: ${r.refersTo}`).join('\n');
      return { success: true, result: `Named ranges:\n${list}` };
    }
    return { success: false, error: response.error || 'Failed to get named ranges' };
  } catch (error) {
    return { success: false, error: `Failed to get named ranges: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetNamedRangesTool: LLMSimpleTool = {
  definition: EXCEL_GET_NAMED_RANGES_DEFINITION,
  execute: executeExcelGetNamedRanges,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel named ranges',
};

// =============================================================================
// Excel Delete Named Range
// =============================================================================

const EXCEL_DELETE_NAMED_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_named_range',
    description: `Delete a named range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting named range' },
        name: { type: 'string', description: 'Name of the range to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteNamedRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelDeleteNamedRange(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Named range "${args['name']}" deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete named range' };
  } catch (error) {
    return { success: false, error: `Failed to delete named range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteNamedRangeTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_NAMED_RANGE_DEFINITION,
  execute: executeExcelDeleteNamedRange,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel named range',
};

// =============================================================================
// Excel Copy Range
// =============================================================================

const EXCEL_COPY_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_copy_range',
    description: `Copy a range to clipboard.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are copying' },
        range: { type: 'string', description: 'Range to copy (e.g., "A1:B10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelCopyRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelCopyRange(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Range ${args['range']} copied to clipboard` };
    }
    return { success: false, error: response.error || 'Failed to copy range' };
  } catch (error) {
    return { success: false, error: `Failed to copy range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCopyRangeTool: LLMSimpleTool = {
  definition: EXCEL_COPY_RANGE_DEFINITION,
  execute: executeExcelCopyRange,
  categories: OFFICE_CATEGORIES,
  description: 'Copy Excel range',
};

// =============================================================================
// Excel Paste Range
// =============================================================================

const EXCEL_PASTE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_paste_range',
    description: `Paste clipboard content to a destination cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are pasting' },
        destination: { type: 'string', description: 'Destination cell (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'destination'],
    },
  },
};

async function executeExcelPasteRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelPasteRange(
      args['destination'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Pasted to ${args['destination']}` };
    }
    return { success: false, error: response.error || 'Failed to paste' };
  } catch (error) {
    return { success: false, error: `Failed to paste: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPasteRangeTool: LLMSimpleTool = {
  definition: EXCEL_PASTE_RANGE_DEFINITION,
  execute: executeExcelPasteRange,
  categories: OFFICE_CATEGORIES,
  description: 'Paste to Excel range',
};

// =============================================================================
// Excel Clear Range
// =============================================================================

const EXCEL_CLEAR_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_range',
    description: `Clear a range (all content, values only, formats only, or comments only).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing' },
        range: { type: 'string', description: 'Range to clear (e.g., "A1:B10")' },
        clear_type: { type: 'string', enum: ['all', 'contents', 'formats', 'comments'], description: 'What to clear (default: all)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelClearRange(
      args['range'] as string,
      args['clear_type'] as 'all' | 'contents' | 'formats' | 'comments' ?? 'all',
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Range ${args['range']} cleared` };
    }
    return { success: false, error: response.error || 'Failed to clear range' };
  } catch (error) {
    return { success: false, error: `Failed to clear range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearRangeTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_RANGE_DEFINITION,
  execute: executeExcelClearRange,
  categories: OFFICE_CATEGORIES,
  description: 'Clear Excel range',
};

// =============================================================================
// Excel Hide Column
// =============================================================================

const EXCEL_HIDE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_hide_column',
    description: `Hide a column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding column' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelHideColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelHideColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} hidden` };
    }
    return { success: false, error: response.error || 'Failed to hide column' };
  } catch (error) {
    return { success: false, error: `Failed to hide column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideColumnTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_COLUMN_DEFINITION,
  execute: executeExcelHideColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Hide Excel column',
};

// =============================================================================
// Excel Show Column
// =============================================================================

const EXCEL_SHOW_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_show_column',
    description: `Show a hidden column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing column' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelShowColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelShowColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} shown` };
    }
    return { success: false, error: response.error || 'Failed to show column' };
  } catch (error) {
    return { success: false, error: `Failed to show column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowColumnTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_COLUMN_DEFINITION,
  execute: executeExcelShowColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Show Excel column',
};

// =============================================================================
// Excel Hide Row
// =============================================================================

const EXCEL_HIDE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_hide_row',
    description: `Hide a row.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding row' },
        row: { type: 'number', description: 'Row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelHideRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelHideRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} hidden` };
    }
    return { success: false, error: response.error || 'Failed to hide row' };
  } catch (error) {
    return { success: false, error: `Failed to hide row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideRowTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_ROW_DEFINITION,
  execute: executeExcelHideRow,
  categories: OFFICE_CATEGORIES,
  description: 'Hide Excel row',
};

// =============================================================================
// Excel Show Row
// =============================================================================

const EXCEL_SHOW_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_show_row',
    description: `Show a hidden row.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing row' },
        row: { type: 'number', description: 'Row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelShowRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelShowRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} shown` };
    }
    return { success: false, error: response.error || 'Failed to show row' };
  } catch (error) {
    return { success: false, error: `Failed to show row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowRowTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_ROW_DEFINITION,
  execute: executeExcelShowRow,
  categories: OFFICE_CATEGORIES,
  description: 'Show Excel row',
};

// =============================================================================
// Excel Add Image
// =============================================================================

const EXCEL_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_image',
    description: `Add an image to the worksheet. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding image' },
        image_path: { type: 'string', description: 'Image file path' },
        cell: { type: 'string', description: 'Cell to position image (e.g., "A1")' },
        width: { type: 'number', description: 'Image width (optional)' },
        height: { type: 'number', description: 'Image height (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'image_path', 'cell'],
    },
  },
};

async function executeExcelAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAddImage(
      args['image_path'] as string,
      args['cell'] as string,
      {
        width: args['width'] as number | undefined,
        height: args['height'] as number | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Image added at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddImageTool: LLMSimpleTool = {
  definition: EXCEL_ADD_IMAGE_DEFINITION,
  execute: executeExcelAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel image',
};

// =============================================================================
// Excel Add Hyperlink
// =============================================================================

const EXCEL_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_hyperlink',
    description: `Add a hyperlink to a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding hyperlink' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        url: { type: 'string', description: 'URL to link to' },
        display_text: { type: 'string', description: 'Display text (optional, defaults to URL)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'url'],
    },
  },
};

async function executeExcelAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAddHyperlink(
      args['cell'] as string,
      args['url'] as string,
      args['display_text'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Hyperlink added to ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddHyperlinkTool: LLMSimpleTool = {
  definition: EXCEL_ADD_HYPERLINK_DEFINITION,
  execute: executeExcelAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel hyperlink',
};

// =============================================================================
// Excel Export to PDF
// =============================================================================

const EXCEL_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_export_pdf',
    description: `Export workbook or sheet to PDF. WSL paths are automatically converted.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        path: { type: 'string', description: 'Output PDF file path' },
        sheet: { type: 'string', description: 'Sheet name (optional, exports entire workbook if not specified)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeExcelExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelExportPDF(
      args['path'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelExportPDFTool: LLMSimpleTool = {
  definition: EXCEL_EXPORT_PDF_DEFINITION,
  execute: executeExcelExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export Excel to PDF',
};

// =============================================================================
// Excel Print
// =============================================================================

const EXCEL_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_print',
    description: `Print workbook or sheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are printing' },
        copies: { type: 'number', description: 'Number of copies (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional, prints entire workbook if not specified)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelPrint(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelPrint(
      args['copies'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    return { success: false, error: `Failed to print: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPrintTool: LLMSimpleTool = {
  definition: EXCEL_PRINT_DEFINITION,
  execute: executeExcelPrint,
  categories: OFFICE_CATEGORIES,
  description: 'Print Excel',
};

// =============================================================================
// Excel Add Comment
// =============================================================================

const EXCEL_ADD_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_comment',
    description: `Add a comment to a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        text: { type: 'string', description: 'Comment text' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'text'],
    },
  },
};

async function executeExcelAddComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelAddComment(
      args['cell'] as string,
      args['text'] as string,
      undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Comment added to ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    return { success: false, error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddCommentTool: LLMSimpleTool = {
  definition: EXCEL_ADD_COMMENT_DEFINITION,
  execute: executeExcelAddComment,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel comment',
};

// =============================================================================
// Excel Get Comment
// =============================================================================

const EXCEL_GET_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_comment',
    description: `Get comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelGetComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelGetComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      if (response['has_comment']) {
        return { success: true, result: `Comment at ${args['cell']}: "${response['text']}"` };
      }
      return { success: true, result: `No comment at ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to get comment' };
  } catch (error) {
    return { success: false, error: `Failed to get comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetCommentTool: LLMSimpleTool = {
  definition: EXCEL_GET_COMMENT_DEFINITION,
  execute: executeExcelGetComment,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel comment',
};

// =============================================================================
// Excel Delete Comment
// =============================================================================

const EXCEL_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_comment',
    description: `Delete comment from a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting comment' },
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelDeleteComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelDeleteComment(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Comment deleted from ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    return { success: false, error: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteCommentTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COMMENT_DEFINITION,
  execute: executeExcelDeleteComment,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel comment',
};

// =============================================================================
// Excel Protect Sheet
// =============================================================================

const EXCEL_PROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_protect_sheet',
    description: `Protect a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are protecting sheet' },
        password: { type: 'string', description: 'Protection password (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional, protects active sheet)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelProtectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelProtectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Sheet protected' };
    }
    return { success: false, error: response.error || 'Failed to protect sheet' };
  } catch (error) {
    return { success: false, error: `Failed to protect sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelProtectSheetTool: LLMSimpleTool = {
  definition: EXCEL_PROTECT_SHEET_DEFINITION,
  execute: executeExcelProtectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Protect Excel sheet',
};

// =============================================================================
// Excel Unprotect Sheet
// =============================================================================

const EXCEL_UNPROTECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_unprotect_sheet',
    description: `Unprotect a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are unprotecting sheet' },
        password: { type: 'string', description: 'Protection password (if protected)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelUnprotectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelUnprotectSheet(
      args['password'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Sheet unprotected' };
    }
    return { success: false, error: response.error || 'Failed to unprotect sheet' };
  } catch (error) {
    return { success: false, error: `Failed to unprotect sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUnprotectSheetTool: LLMSimpleTool = {
  definition: EXCEL_UNPROTECT_SHEET_DEFINITION,
  execute: executeExcelUnprotectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Unprotect Excel sheet',
};

// =============================================================================
// Excel Unmerge Cells
// =============================================================================

const EXCEL_UNMERGE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_unmerge_cells',
    description: `Unmerge merged cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are unmerging cells' },
        range: { type: 'string', description: 'Range to unmerge (e.g., "A1:C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelUnmergeCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelUnmergeCells(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Cells unmerged: ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to unmerge cells' };
  } catch (error) {
    return { success: false, error: `Failed to unmerge cells: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUnmergeCellsTool: LLMSimpleTool = {
  definition: EXCEL_UNMERGE_CELLS_DEFINITION,
  execute: executeExcelUnmergeCells,
  categories: OFFICE_CATEGORIES,
  description: 'Unmerge Excel cells',
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
    const response = await officeClient.excelSelectSheet(args['name'] as string);
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
// Excel Find Replace
// =============================================================================

const EXCEL_FIND_REPLACE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_find_replace',
    description: `Find and replace text in the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are doing find/replace' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        match_case: { type: 'boolean', description: 'Case sensitive (default: false)' },
        match_entire_cell: { type: 'boolean', description: 'Match entire cell only (default: false)' },
        range: { type: 'string', description: 'Range to search (optional, searches entire sheet)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'find', 'replace'],
    },
  },
};

async function executeExcelFindReplace(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelFindReplace(
      args['find'] as string,
      args['replace'] as string,
      {
        matchCase: args['match_case'] as boolean | undefined,
        matchEntireCell: args['match_entire_cell'] as boolean | undefined,
        range: args['range'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Replaced "${args['find']}" with "${args['replace']}"` };
    }
    return { success: false, error: response.error || 'Failed to find/replace' };
  } catch (error) {
    return { success: false, error: `Failed to find/replace: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFindReplaceTool: LLMSimpleTool = {
  definition: EXCEL_FIND_REPLACE_DEFINITION,
  execute: executeExcelFindReplace,
  categories: OFFICE_CATEGORIES,
  description: 'Find and replace in Excel',
};

// =============================================================================
// Excel Group Rows
// =============================================================================

const EXCEL_GROUP_ROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_group_rows',
    description: `Group rows for outlining.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping rows' },
        start_row: { type: 'number', description: 'Start row number' },
        end_row: { type: 'number', description: 'End row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_row', 'end_row'],
    },
  },
};

async function executeExcelGroupRows(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelGroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} grouped` };
    }
    return { success: false, error: response.error || 'Failed to group rows' };
  } catch (error) {
    return { success: false, error: `Failed to group rows: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_GROUP_ROWS_DEFINITION,
  execute: executeExcelGroupRows,
  categories: OFFICE_CATEGORIES,
  description: 'Group Excel rows',
};

// =============================================================================
// Excel Ungroup Rows
// =============================================================================

const EXCEL_UNGROUP_ROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_ungroup_rows',
    description: `Ungroup rows.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are ungrouping rows' },
        start_row: { type: 'number', description: 'Start row number' },
        end_row: { type: 'number', description: 'End row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_row', 'end_row'],
    },
  },
};

async function executeExcelUngroupRows(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.excelUngroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} ungrouped` };
    }
    return { success: false, error: response.error || 'Failed to ungroup rows' };
  } catch (error) {
    return { success: false, error: `Failed to ungroup rows: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUngroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_UNGROUP_ROWS_DEFINITION,
  execute: executeExcelUngroupRows,
  categories: OFFICE_CATEGORIES,
  description: 'Ungroup Excel rows',
};

// =============================================================================
// Export All Excel Tools
// =============================================================================

export const EXCEL_TOOLS: LLMSimpleTool[] = [
  // Basic operations
  excelLaunchTool,
  excelCreateTool,
  excelOpenTool,
  excelWriteCellTool,
  excelReadCellTool,
  excelWriteRangeTool,
  excelReadRangeTool,
  excelSaveTool,
  excelScreenshotTool,
  excelCloseTool,
  excelQuitTool,
  // Formulas
  excelSetFormulaTool,
  // Formatting
  excelSetFontTool,
  excelSetFillTool,
  excelSetNumberFormatTool,
  excelSetBorderTool,
  excelSetAlignmentTool,
  excelMergeCellsTool,
  excelUnmergeCellsTool,
  excelSetColumnWidthTool,
  excelSetRowHeightTool,
  // Sheet management
  excelAddSheetTool,
  excelDeleteSheetTool,
  excelRenameSheetTool,
  excelGetSheetsTool,
  excelSelectSheetTool,
  // Data tools
  excelSortRangeTool,
  excelInsertRowTool,
  excelDeleteRowTool,
  excelFreezePanesTool,
  excelAutoFilterTool,
  // Charts
  excelAddChartTool,
  excelSetChartTitleTool,
  excelDeleteChartTool,
  // Conditional Formatting
  excelAddConditionalFormatTool,
  excelClearConditionalFormatTool,
  // Data Validation
  excelSetDataValidationTool,
  excelClearDataValidationTool,
  // Named Ranges
  excelCreateNamedRangeTool,
  excelGetNamedRangesTool,
  excelDeleteNamedRangeTool,
  // Copy/Paste/Clear
  excelCopyRangeTool,
  excelPasteRangeTool,
  excelClearRangeTool,
  // Hide/Show
  excelHideColumnTool,
  excelShowColumnTool,
  excelHideRowTool,
  excelShowRowTool,
  // Images & Hyperlinks
  excelAddImageTool,
  excelAddHyperlinkTool,
  // Export & Print
  excelExportPDFTool,
  excelPrintTool,
  // Comments
  excelAddCommentTool,
  excelGetCommentTool,
  excelDeleteCommentTool,
  // Protection
  excelProtectSheetTool,
  excelUnprotectSheetTool,
  // Find/Replace
  excelFindReplaceTool,
  // Grouping
  excelGroupRowsTool,
  excelUngroupRowsTool,
];
