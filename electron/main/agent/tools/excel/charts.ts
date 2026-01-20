/**
 * Excel Chart Tools
 *
 * Chart operations: addChart, setChartTitle, deleteChart
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Add Chart
// =============================================================================

const EXCEL_ADD_CHART_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_chart',
    description: `Add a chart to the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a chart' },
        data_range: { type: 'string', description: 'Data range for the chart (e.g., "A1:B10")' },
        chart_type: {
          type: 'string',
          enum: ['column', 'bar', 'line', 'pie', 'area', 'scatter', 'doughnut'],
          description: 'Type of chart',
        },
        title: { type: 'string', description: 'Chart title (optional)' },
        left: { type: 'number', description: 'Left position in pixels (optional)' },
        top: { type: 'number', description: 'Top position in pixels (optional)' },
        width: { type: 'number', description: 'Chart width in pixels (optional)' },
        height: { type: 'number', description: 'Chart height in pixels (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'data_range', 'chart_type'],
    },
  },
};

async function executeExcelAddChart(args: Record<string, unknown>): Promise<ToolResult> {
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
      return { success: true, result: `Chart added: ${response['chart_name']}` };
    }
    return { success: false, error: response.error || 'Failed to add chart' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddChartTool: LLMSimpleTool = {
  definition: EXCEL_ADD_CHART_DEFINITION, execute: executeExcelAddChart, categories: OFFICE_CATEGORIES, description: 'Add chart in Excel',
};

// =============================================================================
// Excel Set Chart Title
// =============================================================================

const EXCEL_SET_CHART_TITLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_chart_title',
    description: `Set or update a chart's title.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting chart title' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        title: { type: 'string', description: 'New title for the chart' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'title'],
    },
  },
};

async function executeExcelSetChartTitle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetChartTitle(
      args['chart_index'] as number,
      args['title'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Chart title set' }; }
    return { success: false, error: response.error || 'Failed to set chart title' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetChartTitleTool: LLMSimpleTool = {
  definition: EXCEL_SET_CHART_TITLE_DEFINITION, execute: executeExcelSetChartTitle, categories: OFFICE_CATEGORIES, description: 'Set chart title in Excel',
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
    const response = await excelClient.excelDeleteChart(
      args['chart_index'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Chart deleted' }; }
    return { success: false, error: response.error || 'Failed to delete chart' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteChartTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_CHART_DEFINITION, execute: executeExcelDeleteChart, categories: OFFICE_CATEGORIES, description: 'Delete chart in Excel',
};

// =============================================================================
// Export Chart Tools
// =============================================================================

export const chartsTools: LLMSimpleTool[] = [
  excelAddChartTool,
  excelSetChartTitleTool,
  excelDeleteChartTool,
];
