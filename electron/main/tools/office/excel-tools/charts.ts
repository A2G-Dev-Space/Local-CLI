/**
 * Excel Chart Tools
 *
 * Chart management tools for Excel.
 * Tools: addChart, setChartTitle, deleteChart
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/index';
import { logger } from '../../../utils/logger';

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
  const startTime = Date.now();
  logger.toolStart('excel_add_chart', args);
  try {
    const response = await excelClient.excelAddChart(
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
      logger.toolSuccess('excel_add_chart', args, { chartName: response['chart_name'], chartType: args['chart_type'] }, Date.now() - startTime);
      return { success: true, result: `Chart added: ${response['chart_name']}` };
    }
    logger.toolError('excel_add_chart', args, new Error(response.error || 'Failed to add chart'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
    logger.toolError('excel_add_chart', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_set_chart_title', args);
  try {
    const response = await excelClient.excelSetChartTitle(
      args['chart_index'] as number,
      args['title'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_chart_title', args, { chartIndex: args['chart_index'], title: args['title'] }, Date.now() - startTime);
      return { success: true, result: 'Chart title set' };
    }
    logger.toolError('excel_set_chart_title', args, new Error(response.error || 'Failed to set chart title'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set chart title' };
  } catch (error) {
    logger.toolError('excel_set_chart_title', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_delete_chart', args);
  try {
    const response = await excelClient.excelDeleteChart(
      args['chart_index'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_delete_chart', args, { chartIndex: args['chart_index'] }, Date.now() - startTime);
      return { success: true, result: 'Chart deleted' };
    }
    logger.toolError('excel_delete_chart', args, new Error(response.error || 'Failed to delete chart'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete chart' };
  } catch (error) {
    logger.toolError('excel_delete_chart', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Export: Chart Tools Array
// =============================================================================

export const chartsTools: LLMSimpleTool[] = [
  excelAddChartTool,
  excelSetChartTitleTool,
  excelDeleteChartTool,
];
