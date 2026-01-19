/**
 * Excel Formatting Tools
 *
 * Cell formatting tools for Excel.
 * Tools: setFont, setFill, setNumberFormat, setBorder, setAlignment, mergeCells, unmergeCells
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

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
    const response = await excelClient.excelSetFont(
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
    const response = await excelClient.excelSetFill(
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
    const response = await excelClient.excelSetNumberFormat(
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
    const response = await excelClient.excelSetBorder(
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
    const response = await excelClient.excelSetAlignment(
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
    const response = await excelClient.excelMergeCells(
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
    const response = await excelClient.excelUnmergeCells(
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
// Export: Formatting Tools Array
// =============================================================================

export const formattingTools: LLMSimpleTool[] = [
  excelSetFontTool,
  excelSetFillTool,
  excelSetNumberFormatTool,
  excelSetBorderTool,
  excelSetAlignmentTool,
  excelMergeCellsTool,
  excelUnmergeCellsTool,
];
