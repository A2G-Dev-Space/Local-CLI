/**
 * Excel Validation Tools
 *
 * Conditional formatting and data validation tools for Excel.
 * Tools: addConditionalFormat, clearConditionalFormat, setDataValidation, clearDataValidation
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

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
    const response = await excelClient.excelAddConditionalFormat(
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
    const response = await excelClient.excelClearConditionalFormat(
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
    const response = await excelClient.excelSetDataValidation(
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
    const response = await excelClient.excelClearDataValidation(
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
// Export: Validation Tools Array
// =============================================================================

export const validationTools: LLMSimpleTool[] = [
  excelAddConditionalFormatTool,
  excelClearConditionalFormatTool,
  excelSetDataValidationTool,
  excelClearDataValidationTool,
];
