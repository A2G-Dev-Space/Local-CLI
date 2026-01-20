/**
 * Excel Validation Tools
 *
 * Validation operations: addConditionalFormat, clearConditionalFormat, setDataValidation, clearDataValidation
 * Total: 4 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

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
        range: { type: 'string', description: 'Cell or range (e.g., "A1:B10")' },
        format_type: {
          type: 'string',
          enum: ['cellValue', 'colorScale', 'dataBar', 'iconSet', 'duplicates', 'top10'],
          description: 'Type of conditional formatting',
        },
        operator: {
          type: 'string',
          enum: ['greater', 'less', 'equal', 'between', 'notBetween'],
          description: 'Comparison operator (for cellValue type)',
        },
        value1: { type: ['string', 'number'], description: 'First comparison value' },
        value2: { type: ['string', 'number'], description: 'Second value (for between/notBetween)' },
        fill_color: { type: 'string', description: 'Fill color as hex (e.g., "#FFFF00")' },
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
        operator: args['operator'] as string | undefined,
        value1: args['value1'] as string | number | undefined,
        value2: args['value2'] as string | number | undefined,
        fillColor: args['fill_color'] as string | undefined,
        fontColor: args['font_color'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: `Conditional format added to ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to add conditional format' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddConditionalFormatTool: LLMSimpleTool = {
  definition: EXCEL_ADD_CONDITIONAL_FORMAT_DEFINITION, execute: executeExcelAddConditionalFormat, categories: OFFICE_CATEGORIES, description: 'Add conditional formatting in Excel',
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
        range: { type: 'string', description: 'Cell or range' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearConditionalFormat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelClearConditionalFormat(
      args['range'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Conditional formatting cleared' }; }
    return { success: false, error: response.error || 'Failed to clear conditional format' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearConditionalFormatTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_CONDITIONAL_FORMAT_DEFINITION, execute: executeExcelClearConditionalFormat, categories: OFFICE_CATEGORIES, description: 'Clear conditional formatting in Excel',
};

// =============================================================================
// Excel Set Data Validation
// =============================================================================

const EXCEL_SET_DATA_VALIDATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_data_validation',
    description: `Set data validation rules for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting data validation' },
        range: { type: 'string', description: 'Cell or range' },
        validation_type: {
          type: 'string',
          enum: ['list', 'whole', 'decimal', 'date', 'textLength', 'custom'],
          description: 'Type of validation',
        },
        formula1: { type: 'string', description: 'Validation formula/list (e.g., "Yes,No,Maybe" for list)' },
        formula2: { type: 'string', description: 'Second formula (for between operators)' },
        operator: {
          type: 'string',
          enum: ['between', 'notBetween', 'equal', 'notEqual', 'greater', 'less', 'greaterEqual', 'lessEqual'],
          description: 'Comparison operator',
        },
        input_title: { type: 'string', description: 'Input message title' },
        input_message: { type: 'string', description: 'Input message text' },
        error_title: { type: 'string', description: 'Error alert title' },
        error_message: { type: 'string', description: 'Error alert message' },
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
        operator: args['operator'] as string | undefined,
        inputTitle: args['input_title'] as string | undefined,
        inputMessage: args['input_message'] as string | undefined,
        errorTitle: args['error_title'] as string | undefined,
        errorMessage: args['error_message'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: `Data validation set on ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to set data validation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetDataValidationTool: LLMSimpleTool = {
  definition: EXCEL_SET_DATA_VALIDATION_DEFINITION, execute: executeExcelSetDataValidation, categories: OFFICE_CATEGORIES, description: 'Set data validation in Excel',
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
        range: { type: 'string', description: 'Cell or range' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearDataValidation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelClearDataValidation(
      args['range'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Data validation cleared' }; }
    return { success: false, error: response.error || 'Failed to clear data validation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearDataValidationTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_DATA_VALIDATION_DEFINITION, execute: executeExcelClearDataValidation, categories: OFFICE_CATEGORIES, description: 'Clear data validation in Excel',
};

// =============================================================================
// Export Validation Tools
// =============================================================================

export const validationTools: LLMSimpleTool[] = [
  excelAddConditionalFormatTool,
  excelClearConditionalFormatTool,
  excelSetDataValidationTool,
  excelClearDataValidationTool,
];
