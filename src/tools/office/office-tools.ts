/**
 * Office Automation Tools (LLM Simple)
 *
 * LLM이 Microsoft Office를 제어할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 *
 * 이 도구들은 /tool 명령어로 활성화/비활성화 가능
 * 첫 사용 시 office-server.exe 자동 시작
 */

import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { officeClient } from './office-client.js';

const OFFICE_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * Ensure Office server is running (auto-start if needed)
 */
async function ensureServerRunning(): Promise<{ success: boolean; error?: string }> {
  try {
    if (await officeClient.isRunning()) {
      return { success: true };
    }

    await officeClient.startServer();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Office server not available: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// =============================================================================
// Microsoft Word Tools
// =============================================================================

const WORD_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_launch',
    description: `Launch Microsoft Word for document editing.
Use this tool to start Word before creating or editing documents.
The Word window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are launching Word',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.wordLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'Word launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch Word' };
  } catch (error) {
    return { success: false, error: `Failed to launch Word: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordLaunchTool: LLMSimpleTool = {
  definition: WORD_LAUNCH_DEFINITION,
  execute: executeWordLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft Word',
};

const WORD_WRITE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_write',
    description: `Write text to the active Word document with optional font settings.
The text will be inserted at the current cursor position.
Font settings are applied to the new text as it's written.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are writing this text',
        },
        text: {
          type: 'string',
          description: 'The text to write to the document',
        },
        font_name: {
          type: 'string',
          description: 'Font name (e.g., "Arial", "Times New Roman", "맑은 고딕")',
        },
        font_size: {
          type: 'number',
          description: 'Font size in points (e.g., 12, 14, 16)',
        },
        bold: {
          type: 'boolean',
          description: 'Whether to make the text bold',
        },
        italic: {
          type: 'boolean',
          description: 'Whether to make the text italic',
        },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordWrite(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const text = args['text'] as string;
  const fontName = args['font_name'] as string | undefined;
  const fontSize = args['font_size'] as number | undefined;
  const bold = args['bold'] as boolean | undefined;
  const italic = args['italic'] as boolean | undefined;

  try {
    const response = await officeClient.wordWrite(text, { fontName, fontSize, bold, italic });
    if (response.success) {
      return { success: true, result: `Text written to document (${text.length} characters)` };
    }
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    return { success: false, error: `Failed to write text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordWriteTool: LLMSimpleTool = {
  definition: WORD_WRITE_DEFINITION,
  execute: executeWordWrite,
  categories: OFFICE_CATEGORIES,
  description: 'Write text to Word document',
};

const WORD_READ_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_read',
    description: `Read the content of the active Word document.
Returns the full text content of the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are reading the document',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRead(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.wordRead();
    if (response.success) {
      const content = response['content'] as string || '';
      const docName = response['document_name'] as string || 'Unknown';
      return {
        success: true,
        result: `Document: ${docName}\n\nContent:\n${content || '(empty document)'}`,
      };
    }
    return { success: false, error: response.error || 'Failed to read document' };
  } catch (error) {
    return { success: false, error: `Failed to read document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordReadTool: LLMSimpleTool = {
  definition: WORD_READ_DEFINITION,
  execute: executeWordRead,
  categories: OFFICE_CATEGORIES,
  description: 'Read Word document content',
};

const WORD_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_save',
    description: `Save the active Word document.
Optionally specify a file path to save as a new file.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Example: C:\\Users\\user\\Documents\\report.docx',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSave(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const filePath = args['path'] as string | undefined;

  try {
    const response = await officeClient.wordSave(filePath);
    if (response.success) {
      const savedPath = response['path'] as string || filePath || 'current location';
      return { success: true, result: `Document saved to: ${savedPath}` };
    }
    return { success: false, error: response.error || 'Failed to save document' };
  } catch (error) {
    return { success: false, error: `Failed to save document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSaveTool: LLMSimpleTool = {
  definition: WORD_SAVE_DEFINITION,
  execute: executeWordSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save Word document',
};

const WORD_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_screenshot',
    description: `Take a screenshot of the Word window.
Returns a base64-encoded PNG image of the current Word window.
Use this to verify document formatting or show the user what the document looks like.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are taking a screenshot',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.wordScreenshot();
    if (response.success && response.image) {
      return {
        success: true,
        result: 'Word screenshot captured',
        metadata: {
          image: response.image,
          imageType: 'image/png',
          encoding: 'base64',
        },
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordScreenshotTool: LLMSimpleTool = {
  definition: WORD_SCREENSHOT_DEFINITION,
  execute: executeWordScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take Word window screenshot',
};

const WORD_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_close',
    description: `Close Microsoft Word.
Optionally save all documents before closing.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are closing Word',
        },
        save: {
          type: 'boolean',
          description: 'Whether to save documents before closing (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeWordClose(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const save = args['save'] === true;

  try {
    const response = await officeClient.wordClose(save);
    if (response.success) {
      return { success: true, result: `Word closed${save ? ' (documents saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close Word' };
  } catch (error) {
    return { success: false, error: `Failed to close Word: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCloseTool: LLMSimpleTool = {
  definition: WORD_CLOSE_DEFINITION,
  execute: executeWordClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Microsoft Word',
};

// =============================================================================
// Microsoft Excel Tools
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
        reason: {
          type: 'string',
          description: 'Explanation of why you are launching Excel',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

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

const EXCEL_WRITE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_cell',
    description: `Write a value to a specific cell in Excel.
Use cell references like "A1", "B2", "C10", etc.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are writing to this cell',
        },
        cell: {
          type: 'string',
          description: 'Cell reference (e.g., "A1", "B2")',
        },
        value: {
          type: 'string',
          description: 'Value to write to the cell',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional, uses active sheet if not specified)',
        },
      },
      required: ['reason', 'cell', 'value'],
    },
  },
};

async function executeExcelWriteCell(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const cell = args['cell'] as string;
  const value = args['value'];
  const sheet = args['sheet'] as string | undefined;

  try {
    const response = await officeClient.excelWriteCell(cell, value, sheet);
    if (response.success) {
      return { success: true, result: `Value written to cell ${cell}` };
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

const EXCEL_READ_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_cell',
    description: `Read a value from a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are reading this cell',
        },
        cell: {
          type: 'string',
          description: 'Cell reference (e.g., "A1", "B2")',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelReadCell(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const cell = args['cell'] as string;
  const sheet = args['sheet'] as string | undefined;

  try {
    const response = await officeClient.excelReadCell(cell, sheet);
    if (response.success) {
      const value = response['value'];
      return { success: true, result: `Cell ${cell}: ${value ?? '(empty)'}` };
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

const EXCEL_WRITE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_range',
    description: `Write multiple values to a range of cells in Excel.
Provide a 2D array of values starting from the specified cell.
Example: start_cell="A1", values=[["Name", "Age"], ["John", 25], ["Jane", 30]]`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are writing this range',
        },
        start_cell: {
          type: 'string',
          description: 'Starting cell reference (e.g., "A1")',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: {},
          },
          description: '2D array of values to write',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'start_cell', 'values'],
    },
  },
};

async function executeExcelWriteRange(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const startCell = args['start_cell'] as string;
  const values = args['values'] as unknown[][];
  const sheet = args['sheet'] as string | undefined;

  try {
    const response = await officeClient.excelWriteRange(startCell, values, sheet);
    if (response.success) {
      const rows = values.length;
      const cols = values[0]?.length || 0;
      return { success: true, result: `Written ${rows}x${cols} values starting at ${startCell}` };
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

const EXCEL_READ_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_range',
    description: `Read values from a range of cells in Excel.
Returns a 2D array of values.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are reading this range',
        },
        range: {
          type: 'string',
          description: 'Range reference (e.g., "A1:C10")',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelReadRange(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const range = args['range'] as string;
  const sheet = args['sheet'] as string | undefined;

  try {
    const response = await officeClient.excelReadRange(range, sheet);
    if (response.success) {
      const values = response['values'] as unknown[][] || [];
      const formatted = values.map(row => row.join('\t')).join('\n');
      return { success: true, result: `Range ${range}:\n${formatted || '(empty)'}` };
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

const EXCEL_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_save',
    description: `Save the active Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Example: C:\\Users\\user\\Documents\\data.xlsx',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelSave(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const filePath = args['path'] as string | undefined;

  try {
    const response = await officeClient.excelSave(filePath);
    if (response.success) {
      const savedPath = response['path'] as string || filePath || 'current location';
      return { success: true, result: `Workbook saved to: ${savedPath}` };
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

const EXCEL_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_screenshot',
    description: `Take a screenshot of the Excel window.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are taking a screenshot',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.excelScreenshot();
    if (response.success && response.image) {
      return {
        success: true,
        result: 'Excel screenshot captured',
        metadata: {
          image: response.image,
          imageType: 'image/png',
          encoding: 'base64',
        },
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

const EXCEL_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_close',
    description: `Close Microsoft Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are closing Excel',
        },
        save: {
          type: 'boolean',
          description: 'Whether to save workbooks before closing (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelClose(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const save = args['save'] === true;

  try {
    const response = await officeClient.excelClose(save);
    if (response.success) {
      return { success: true, result: `Excel closed${save ? ' (workbooks saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close Excel' };
  } catch (error) {
    return { success: false, error: `Failed to close Excel: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCloseTool: LLMSimpleTool = {
  definition: EXCEL_CLOSE_DEFINITION,
  execute: executeExcelClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Microsoft Excel',
};

// =============================================================================
// Microsoft PowerPoint Tools
// =============================================================================

const POWERPOINT_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_launch',
    description: `Launch Microsoft PowerPoint for presentation editing.
Use this tool to start PowerPoint before working with presentations.
The PowerPoint window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are launching PowerPoint',
        },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.powerpointLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'PowerPoint launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed to launch PowerPoint: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointLaunchTool: LLMSimpleTool = {
  definition: POWERPOINT_LAUNCH_DEFINITION,
  execute: executePowerPointLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft PowerPoint',
};

const POWERPOINT_ADD_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_slide',
    description: `Add a new slide to the presentation.
Layout options:
1 = Title Slide
2 = Title and Content
3 = Section Header
4 = Two Content
5 = Comparison
6 = Title Only
7 = Blank`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are adding a slide',
        },
        layout: {
          type: 'number',
          description: 'Slide layout (1-7, default: 2 for Title and Content)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointAddSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const layout = (args['layout'] as number) || 2;

  try {
    const response = await officeClient.powerpointAddSlide(layout);
    if (response.success) {
      const slideNumber = response['slide_number'];
      return { success: true, result: `Slide ${slideNumber} added (layout: ${layout})` };
    }
    return { success: false, error: response.error || 'Failed to add slide' };
  } catch (error) {
    return { success: false, error: `Failed to add slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_SLIDE_DEFINITION,
  execute: executePowerPointAddSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Add slide to PowerPoint',
};

const POWERPOINT_WRITE_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_write_text',
    description: `Write text to a shape on a slide.
Shape 1 is typically the title, Shape 2 is the content area.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are writing this text',
        },
        slide: {
          type: 'number',
          description: 'Slide number (1-based)',
        },
        shape: {
          type: 'number',
          description: 'Shape index (1 = title, 2 = content)',
        },
        text: {
          type: 'string',
          description: 'Text to write',
        },
      },
      required: ['reason', 'slide', 'shape', 'text'],
    },
  },
};

async function executePowerPointWriteText(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const slide = args['slide'] as number;
  const shape = args['shape'] as number;
  const text = args['text'] as string;

  try {
    const response = await officeClient.powerpointWriteText(slide, shape, text);
    if (response.success) {
      return { success: true, result: `Text written to slide ${slide}, shape ${shape}` };
    }
    return { success: false, error: response.error || 'Failed to write text' };
  } catch (error) {
    return { success: false, error: `Failed to write text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointWriteTextTool: LLMSimpleTool = {
  definition: POWERPOINT_WRITE_TEXT_DEFINITION,
  execute: executePowerPointWriteText,
  categories: OFFICE_CATEGORIES,
  description: 'Write text to PowerPoint slide',
};

const POWERPOINT_READ_SLIDE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_read_slide',
    description: `Read content from a slide.
Returns all text content from all shapes on the slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are reading this slide',
        },
        slide: {
          type: 'number',
          description: 'Slide number (1-based)',
        },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointReadSlide(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const slide = args['slide'] as number;

  try {
    const response = await officeClient.powerpointReadSlide(slide);
    if (response.success) {
      const shapes = response['shapes'] as Array<{ shape_index: number; text: string }> || [];
      const formatted = shapes.map(s => `  Shape ${s.shape_index}: ${s.text}`).join('\n');
      return { success: true, result: `Slide ${slide} content:\n${formatted || '(empty slide)'}` };
    }
    return { success: false, error: response.error || 'Failed to read slide' };
  } catch (error) {
    return { success: false, error: `Failed to read slide: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointReadSlideTool: LLMSimpleTool = {
  definition: POWERPOINT_READ_SLIDE_DEFINITION,
  execute: executePowerPointReadSlide,
  categories: OFFICE_CATEGORIES,
  description: 'Read PowerPoint slide content',
};

const POWERPOINT_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_save',
    description: `Save the active PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Example: C:\\Users\\user\\Documents\\presentation.pptx',
        },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointSave(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const filePath = args['path'] as string | undefined;

  try {
    const response = await officeClient.powerpointSave(filePath);
    if (response.success) {
      const savedPath = response['path'] as string || filePath || 'current location';
      return { success: true, result: `Presentation saved to: ${savedPath}` };
    }
    return { success: false, error: response.error || 'Failed to save presentation' };
  } catch (error) {
    return { success: false, error: `Failed to save presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSaveTool: LLMSimpleTool = {
  definition: POWERPOINT_SAVE_DEFINITION,
  execute: executePowerPointSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save PowerPoint presentation',
};

const POWERPOINT_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_screenshot',
    description: `Take a screenshot of the PowerPoint window.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are taking a screenshot',
        },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  try {
    const response = await officeClient.powerpointScreenshot();
    if (response.success && response.image) {
      return {
        success: true,
        result: 'PowerPoint screenshot captured',
        metadata: {
          image: response.image,
          imageType: 'image/png',
          encoding: 'base64',
        },
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointScreenshotTool: LLMSimpleTool = {
  definition: POWERPOINT_SCREENSHOT_DEFINITION,
  execute: executePowerPointScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take PowerPoint window screenshot',
};

const POWERPOINT_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_close',
    description: `Close Microsoft PowerPoint.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are closing PowerPoint',
        },
        save: {
          type: 'boolean',
          description: 'Whether to save presentations before closing (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointClose(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) {
    return { success: false, error: serverCheck.error };
  }

  const save = args['save'] === true;

  try {
    const response = await officeClient.powerpointClose(save);
    if (response.success) {
      return { success: true, result: `PowerPoint closed${save ? ' (presentations saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed to close PowerPoint: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCloseTool: LLMSimpleTool = {
  definition: POWERPOINT_CLOSE_DEFINITION,
  execute: executePowerPointClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Microsoft PowerPoint',
};

// =============================================================================
// Export All Tools
// =============================================================================

export const WORD_TOOLS: LLMSimpleTool[] = [
  wordLaunchTool,
  wordWriteTool,
  wordReadTool,
  wordSaveTool,
  wordScreenshotTool,
  wordCloseTool,
];

export const EXCEL_TOOLS: LLMSimpleTool[] = [
  excelLaunchTool,
  excelWriteCellTool,
  excelReadCellTool,
  excelWriteRangeTool,
  excelReadRangeTool,
  excelSaveTool,
  excelScreenshotTool,
  excelCloseTool,
];

export const POWERPOINT_TOOLS: LLMSimpleTool[] = [
  powerpointLaunchTool,
  powerpointAddSlideTool,
  powerpointWriteTextTool,
  powerpointReadSlideTool,
  powerpointSaveTool,
  powerpointScreenshotTool,
  powerpointCloseTool,
];

export const OFFICE_TOOLS: LLMSimpleTool[] = [
  ...WORD_TOOLS,
  ...EXCEL_TOOLS,
  ...POWERPOINT_TOOLS,
];
