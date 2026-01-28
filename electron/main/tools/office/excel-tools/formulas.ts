/**
 * Excel Formula Helper Tools
 *
 * Tools for inserting common Excel formulas.
 * Tools: vlookup, sumif, countif, indexMatch, averageif
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/index';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel VLOOKUP
// =============================================================================

const EXCEL_VLOOKUP_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_vlookup',
    description: `Insert a VLOOKUP formula to look up a value in the first column of a table and return a value in the same row from another column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting VLOOKUP' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        lookup_value: { type: 'string', description: 'Value to look for (cell reference or value, e.g., "A2" or "\\"Product1\\"")' },
        table_range: { type: 'string', description: 'Table range to search (e.g., "Sheet2!A:D")' },
        col_index: { type: 'number', description: 'Column index to return (1-based, e.g., 3 for third column)' },
        exact_match: { type: 'boolean', description: 'True for exact match (default), false for approximate match' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'lookup_value', 'table_range', 'col_index'],
    },
  },
};

async function executeExcelVlookup(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_vlookup', args);
  try {
    const response = await excelClient.excelInsertVlookup(
      args['cell'] as string,
      args['lookup_value'] as string,
      args['table_range'] as string,
      args['col_index'] as number,
      args['exact_match'] !== false, // default to true
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_vlookup', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `VLOOKUP formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_vlookup', args, new Error(response.error || 'Failed to insert VLOOKUP formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert VLOOKUP formula' };
  } catch (error) {
    logger.toolError('excel_vlookup', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert VLOOKUP: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelVlookupTool: LLMSimpleTool = {
  definition: EXCEL_VLOOKUP_DEFINITION,
  execute: executeExcelVlookup,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel VLOOKUP formula',
};

// =============================================================================
// Excel SUMIF
// =============================================================================

const EXCEL_SUMIF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_sumif',
    description: `Insert a SUMIF formula to sum values that meet a specific condition.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting SUMIF' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        range: { type: 'string', description: 'Range to evaluate against criteria (e.g., "A:A")' },
        criteria: { type: 'string', description: 'Condition to match. Simple: ">100", "Apple". Cell reference: ">="&A1 (uses value from A1). Already quoted criteria like "text" passed as-is.' },
        sum_range: { type: 'string', description: 'Range to sum (optional, if different from range)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'range', 'criteria'],
    },
  },
};

async function executeExcelSumif(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_sumif', args);
  try {
    const response = await excelClient.excelInsertSumif(
      args['cell'] as string,
      args['range'] as string,
      args['criteria'] as string,
      args['sum_range'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_sumif', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `SUMIF formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_sumif', args, new Error(response.error || 'Failed to insert SUMIF formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert SUMIF formula' };
  } catch (error) {
    logger.toolError('excel_sumif', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert SUMIF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSumifTool: LLMSimpleTool = {
  definition: EXCEL_SUMIF_DEFINITION,
  execute: executeExcelSumif,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel SUMIF formula',
};

// =============================================================================
// Excel COUNTIF
// =============================================================================

const EXCEL_COUNTIF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_countif',
    description: `Insert a COUNTIF formula to count cells that meet a specific condition.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting COUNTIF' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        range: { type: 'string', description: 'Range to count (e.g., "A:A")' },
        criteria: { type: 'string', description: 'Condition to match. Simple: ">100", "Apple". Cell reference: ">="&A1 (uses value from A1). Already quoted criteria like "text" passed as-is.' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'range', 'criteria'],
    },
  },
};

async function executeExcelCountif(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_countif', args);
  try {
    const response = await excelClient.excelInsertCountif(
      args['cell'] as string,
      args['range'] as string,
      args['criteria'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_countif', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `COUNTIF formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_countif', args, new Error(response.error || 'Failed to insert COUNTIF formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert COUNTIF formula' };
  } catch (error) {
    logger.toolError('excel_countif', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert COUNTIF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCountifTool: LLMSimpleTool = {
  definition: EXCEL_COUNTIF_DEFINITION,
  execute: executeExcelCountif,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel COUNTIF formula',
};

// =============================================================================
// Excel INDEX-MATCH
// =============================================================================

const EXCEL_INDEX_MATCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_index_match',
    description: `Insert an INDEX-MATCH formula combination (more flexible alternative to VLOOKUP).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting INDEX-MATCH' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        return_range: { type: 'string', description: 'Column/range to return values from (e.g., "C:C")' },
        lookup_range: { type: 'string', description: 'Column/range to search in (e.g., "A:A")' },
        lookup_value: { type: 'string', description: 'Value to look for (cell reference or value, e.g., "D2" or "\\"Product1\\"")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'return_range', 'lookup_range', 'lookup_value'],
    },
  },
};

async function executeExcelIndexMatch(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_index_match', args);
  try {
    const response = await excelClient.excelInsertIndexMatch(
      args['cell'] as string,
      args['return_range'] as string,
      args['lookup_range'] as string,
      args['lookup_value'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_index_match', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `INDEX-MATCH formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_index_match', args, new Error(response.error || 'Failed to insert INDEX-MATCH formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert INDEX-MATCH formula' };
  } catch (error) {
    logger.toolError('excel_index_match', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert INDEX-MATCH: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelIndexMatchTool: LLMSimpleTool = {
  definition: EXCEL_INDEX_MATCH_DEFINITION,
  execute: executeExcelIndexMatch,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel INDEX-MATCH formula',
};

// =============================================================================
// Excel AVERAGEIF
// =============================================================================

const EXCEL_AVERAGEIF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_averageif',
    description: `Insert an AVERAGEIF formula to average values that meet a specific condition.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting AVERAGEIF' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        range: { type: 'string', description: 'Range to evaluate against criteria (e.g., "A:A")' },
        criteria: { type: 'string', description: 'Condition to match. Simple: ">100", "Apple". Cell reference: ">="&A1 (uses value from A1). Already quoted criteria like "text" passed as-is.' },
        avg_range: { type: 'string', description: 'Range to average (optional, if different from range)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'range', 'criteria'],
    },
  },
};

async function executeExcelAverageif(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_averageif', args);
  try {
    const response = await excelClient.excelInsertAverageif(
      args['cell'] as string,
      args['range'] as string,
      args['criteria'] as string,
      args['avg_range'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_averageif', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `AVERAGEIF formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_averageif', args, new Error(response.error || 'Failed to insert AVERAGEIF formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert AVERAGEIF formula' };
  } catch (error) {
    logger.toolError('excel_averageif', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert AVERAGEIF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAverageifTool: LLMSimpleTool = {
  definition: EXCEL_AVERAGEIF_DEFINITION,
  execute: executeExcelAverageif,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel AVERAGEIF formula',
};

// =============================================================================
// Excel SUMIFS (Multi-criteria)
// =============================================================================

const EXCEL_SUMIFS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_sumifs',
    description: `Insert a SUMIFS formula to sum values with multiple conditions.
Unlike SUMIF, SUMIFS supports multiple criteria ranges and conditions.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting SUMIFS' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        sum_range: { type: 'string', description: 'Range to sum (e.g., "C:C")' },
        criteria_ranges: { type: 'array', items: { type: 'string' }, description: 'Array of ranges to evaluate (e.g., ["A:A", "B:B"])' },
        criteria: { type: 'array', items: { type: 'string' }, description: 'Array of conditions. Simple: "Product1", ">100". Cell reference: ">="&A1 (uses value from cell). Must match criteria_ranges order.' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'sum_range', 'criteria_ranges', 'criteria'],
    },
  },
};

async function executeExcelSumifs(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_sumifs', args);
  try {
    const response = await excelClient.excelInsertSumifs(
      args['cell'] as string,
      args['sum_range'] as string,
      args['criteria_ranges'] as string[],
      args['criteria'] as string[],
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_sumifs', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `SUMIFS formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_sumifs', args, new Error(response.error || 'Failed to insert SUMIFS formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert SUMIFS formula' };
  } catch (error) {
    logger.toolError('excel_sumifs', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert SUMIFS: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSumifsTool: LLMSimpleTool = {
  definition: EXCEL_SUMIFS_DEFINITION,
  execute: executeExcelSumifs,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel SUMIFS formula (multi-criteria)',
};

// =============================================================================
// Excel COUNTIFS (Multi-criteria)
// =============================================================================

const EXCEL_COUNTIFS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_countifs',
    description: `Insert a COUNTIFS formula to count cells with multiple conditions.
Unlike COUNTIF, COUNTIFS supports multiple criteria ranges and conditions.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting COUNTIFS' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        criteria_ranges: { type: 'array', items: { type: 'string' }, description: 'Array of ranges to evaluate (e.g., ["A:A", "B:B"])' },
        criteria: { type: 'array', items: { type: 'string' }, description: 'Array of conditions. Simple: "Product1", ">100". Cell reference: ">="&A1 (uses value from cell). Must match criteria_ranges order.' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'criteria_ranges', 'criteria'],
    },
  },
};

async function executeExcelCountifs(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_countifs', args);
  try {
    const response = await excelClient.excelInsertCountifs(
      args['cell'] as string,
      args['criteria_ranges'] as string[],
      args['criteria'] as string[],
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_countifs', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `COUNTIFS formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_countifs', args, new Error(response.error || 'Failed to insert COUNTIFS formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert COUNTIFS formula' };
  } catch (error) {
    logger.toolError('excel_countifs', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert COUNTIFS: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCountifsTool: LLMSimpleTool = {
  definition: EXCEL_COUNTIFS_DEFINITION,
  execute: executeExcelCountifs,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel COUNTIFS formula (multi-criteria)',
};

// =============================================================================
// Excel XLOOKUP
// =============================================================================

const EXCEL_XLOOKUP_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_xlookup',
    description: `Insert an XLOOKUP formula (modern replacement for VLOOKUP/HLOOKUP).
Requires Excel 365 or Excel 2021+. More flexible than VLOOKUP - can search in any direction.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting XLOOKUP' },
        cell: { type: 'string', description: 'Cell to insert the formula (e.g., "E2")' },
        lookup_value: { type: 'string', description: 'Value to look for (cell reference or value, e.g., "A2")' },
        lookup_range: { type: 'string', description: 'Range to search in (e.g., "B:B")' },
        return_range: { type: 'string', description: 'Range to return values from (e.g., "C:C")' },
        not_found_value: { type: 'string', description: 'Value to return if not found (optional)' },
        match_mode: { type: 'string', enum: ['exact', 'exactOrNext', 'exactOrPrev', 'wildcard'], description: 'Match mode: exact (default), exactOrNext, exactOrPrev, wildcard' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'lookup_value', 'lookup_range', 'return_range'],
    },
  },
};

async function executeExcelXlookup(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_xlookup', args);
  try {
    const response = await excelClient.excelInsertXlookup(
      args['cell'] as string,
      args['lookup_value'] as string,
      args['lookup_range'] as string,
      args['return_range'] as string,
      args['not_found_value'] as string | undefined,
      args['match_mode'] as 'exact' | 'exactOrNext' | 'exactOrPrev' | 'wildcard' | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_xlookup', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `XLOOKUP formula inserted in ${args['cell']}` };
    }
    logger.toolError('excel_xlookup', args, new Error(response.error || 'Failed to insert XLOOKUP formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert XLOOKUP formula' };
  } catch (error) {
    logger.toolError('excel_xlookup', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert XLOOKUP: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelXlookupTool: LLMSimpleTool = {
  definition: EXCEL_XLOOKUP_DEFINITION,
  execute: executeExcelXlookup,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel XLOOKUP formula',
};

// =============================================================================
// Export: Formula Tools Array
// =============================================================================

export const formulasTools: LLMSimpleTool[] = [
  excelVlookupTool,
  excelSumifTool,
  excelCountifTool,
  excelIndexMatchTool,
  excelAverageifTool,
  excelSumifsTool,
  excelCountifsTool,
  excelXlookupTool,
];
