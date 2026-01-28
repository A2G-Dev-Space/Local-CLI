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
    description: `Add a chart based on data range.
Default position: left=100, top=100, width=400, height=300 points.
Data range should include headers for automatic series naming.`,
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
// Excel Add Chart Series
// =============================================================================

const EXCEL_ADD_CHART_SERIES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_chart_series',
    description: `Add a new data series to an existing chart.
The series uses the chart's existing X-axis (category) values.
Use name_range to set the series name from a cell value.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a series' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        values_range: { type: 'string', description: 'Range containing the series values (e.g., "C2:C10")' },
        name_range: { type: 'string', description: 'Cell containing the series name (optional, e.g., "C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'values_range'],
    },
  },
};

async function executeExcelAddChartSeries(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_add_chart_series', args);
  try {
    const response = await excelClient.excelAddChartSeries(
      args['chart_index'] as number,
      args['values_range'] as string,
      args['name_range'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_add_chart_series', args, { chartIndex: args['chart_index'], seriesIndex: response['series_index'] }, Date.now() - startTime);
      return { success: true, result: `Series added to chart (index: ${response['series_index']})` };
    }
    logger.toolError('excel_add_chart_series', args, new Error(response.error || 'Failed to add chart series'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add chart series' };
  } catch (error) {
    logger.toolError('excel_add_chart_series', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add chart series: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddChartSeriesTool: LLMSimpleTool = {
  definition: EXCEL_ADD_CHART_SERIES_DEFINITION,
  execute: executeExcelAddChartSeries,
  categories: OFFICE_CATEGORIES,
  description: 'Add series to Excel chart',
};

// =============================================================================
// Excel Edit Chart Series
// =============================================================================

const EXCEL_EDIT_CHART_SERIES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_edit_chart_series',
    description: `Edit an existing data series in a chart (change values, name).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are editing the series' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        series_index: { type: 'number', description: 'Series index (1-based)' },
        values_range: { type: 'string', description: 'New range for series values (optional)' },
        name_range: { type: 'string', description: 'Cell containing new series name (optional)' },
        name: { type: 'string', description: 'Direct series name (optional, alternative to name_range)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'series_index'],
    },
  },
};

async function executeExcelEditChartSeries(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_edit_chart_series', args);
  try {
    const response = await excelClient.excelEditChartSeries(
      args['chart_index'] as number,
      args['series_index'] as number,
      {
        valuesRange: args['values_range'] as string | undefined,
        nameRange: args['name_range'] as string | undefined,
        name: args['name'] as string | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_edit_chart_series', args, { chartIndex: args['chart_index'], seriesIndex: args['series_index'] }, Date.now() - startTime);
      return { success: true, result: `Series ${args['series_index']} updated` };
    }
    logger.toolError('excel_edit_chart_series', args, new Error(response.error || 'Failed to edit chart series'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to edit chart series' };
  } catch (error) {
    logger.toolError('excel_edit_chart_series', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to edit chart series: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelEditChartSeriesTool: LLMSimpleTool = {
  definition: EXCEL_EDIT_CHART_SERIES_DEFINITION,
  execute: executeExcelEditChartSeries,
  categories: OFFICE_CATEGORIES,
  description: 'Edit Excel chart series',
};

// =============================================================================
// Excel Delete Chart Series
// =============================================================================

const EXCEL_DELETE_CHART_SERIES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_chart_series',
    description: `Delete a data series from a chart.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the series' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        series_index: { type: 'number', description: 'Series index to delete (1-based)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'series_index'],
    },
  },
};

async function executeExcelDeleteChartSeries(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_delete_chart_series', args);
  try {
    const response = await excelClient.excelDeleteChartSeries(
      args['chart_index'] as number,
      args['series_index'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_delete_chart_series', args, { chartIndex: args['chart_index'], seriesIndex: args['series_index'] }, Date.now() - startTime);
      return { success: true, result: `Series ${args['series_index']} deleted from chart` };
    }
    logger.toolError('excel_delete_chart_series', args, new Error(response.error || 'Failed to delete chart series'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete chart series' };
  } catch (error) {
    logger.toolError('excel_delete_chart_series', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete chart series: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteChartSeriesTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_CHART_SERIES_DEFINITION,
  execute: executeExcelDeleteChartSeries,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel chart series',
};

// =============================================================================
// Excel Set Chart Legend
// =============================================================================

const EXCEL_SET_CHART_LEGEND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_chart_legend',
    description: `Show, hide, or position the chart legend.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are modifying the legend' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        show: { type: 'boolean', description: 'True to show legend, false to hide' },
        position: { type: 'string', enum: ['bottom', 'top', 'left', 'right', 'corner'], description: 'Legend position (optional)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index'],
    },
  },
};

async function executeExcelSetChartLegend(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_chart_legend', args);
  try {
    const response = await excelClient.excelSetChartLegend(
      args['chart_index'] as number,
      {
        show: args['show'] as boolean | undefined,
        position: args['position'] as 'bottom' | 'top' | 'left' | 'right' | 'corner' | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_chart_legend', args, { chartIndex: args['chart_index'] }, Date.now() - startTime);
      return { success: true, result: 'Chart legend updated' };
    }
    logger.toolError('excel_set_chart_legend', args, new Error(response.error || 'Failed to set chart legend'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set chart legend' };
  } catch (error) {
    logger.toolError('excel_set_chart_legend', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set chart legend: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetChartLegendTool: LLMSimpleTool = {
  definition: EXCEL_SET_CHART_LEGEND_DEFINITION,
  execute: executeExcelSetChartLegend,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel chart legend',
};

// =============================================================================
// Excel Set Chart Data Labels
// =============================================================================

const EXCEL_SET_CHART_DATA_LABELS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_chart_data_labels',
    description: `Show or hide data labels on chart data points.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are modifying data labels' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        show: { type: 'boolean', description: 'True to show labels, false to hide' },
        show_value: { type: 'boolean', description: 'Show data values (default: true)' },
        show_category: { type: 'boolean', description: 'Show category names' },
        show_percent: { type: 'boolean', description: 'Show percentage (for pie charts)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index'],
    },
  },
};

async function executeExcelSetChartDataLabels(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_chart_data_labels', args);
  try {
    const response = await excelClient.excelSetChartDataLabels(
      args['chart_index'] as number,
      {
        show: args['show'] as boolean | undefined,
        showValue: args['show_value'] as boolean | undefined,
        showCategory: args['show_category'] as boolean | undefined,
        showPercent: args['show_percent'] as boolean | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_chart_data_labels', args, { chartIndex: args['chart_index'] }, Date.now() - startTime);
      return { success: true, result: 'Chart data labels updated' };
    }
    logger.toolError('excel_set_chart_data_labels', args, new Error(response.error || 'Failed to set chart data labels'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set chart data labels' };
  } catch (error) {
    logger.toolError('excel_set_chart_data_labels', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set chart data labels: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetChartDataLabelsTool: LLMSimpleTool = {
  definition: EXCEL_SET_CHART_DATA_LABELS_DEFINITION,
  execute: executeExcelSetChartDataLabels,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel chart data labels',
};

// =============================================================================
// Excel Set Chart Axis
// =============================================================================

const EXCEL_SET_CHART_AXIS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_chart_axis',
    description: `Configure chart axis: title, scale, and units.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are modifying the axis' },
        chart_index: { type: 'number', description: 'Chart index (1-based)' },
        axis: { type: 'string', enum: ['x', 'y'], description: 'Axis to configure (x=category, y=value)' },
        title: { type: 'string', description: 'Axis title text (optional)' },
        min: { type: 'number', description: 'Minimum scale value (optional, y-axis only)' },
        max: { type: 'number', description: 'Maximum scale value (optional, y-axis only)' },
        major_unit: { type: 'number', description: 'Major gridline unit (optional, y-axis only)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'chart_index', 'axis'],
    },
  },
};

async function executeExcelSetChartAxis(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_chart_axis', args);
  try {
    const response = await excelClient.excelSetChartAxis(
      args['chart_index'] as number,
      args['axis'] as 'x' | 'y',
      {
        title: args['title'] as string | undefined,
        min: args['min'] as number | undefined,
        max: args['max'] as number | undefined,
        majorUnit: args['major_unit'] as number | undefined,
      },
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_chart_axis', args, { chartIndex: args['chart_index'], axis: args['axis'] }, Date.now() - startTime);
      return { success: true, result: `Chart ${args['axis']}-axis updated` };
    }
    logger.toolError('excel_set_chart_axis', args, new Error(response.error || 'Failed to set chart axis'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set chart axis' };
  } catch (error) {
    logger.toolError('excel_set_chart_axis', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set chart axis: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetChartAxisTool: LLMSimpleTool = {
  definition: EXCEL_SET_CHART_AXIS_DEFINITION,
  execute: executeExcelSetChartAxis,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel chart axis',
};

// =============================================================================
// Export: Chart Tools Array
// =============================================================================

export const chartsTools: LLMSimpleTool[] = [
  excelAddChartTool,
  excelSetChartTitleTool,
  excelDeleteChartTool,
  excelAddChartSeriesTool,
  excelEditChartSeriesTool,
  excelDeleteChartSeriesTool,
  excelSetChartLegendTool,
  excelSetChartDataLabelsTool,
  excelSetChartAxisTool,
];
