/**
 * Office Automation Tools (LLM Simple)
 *
 * LLM이 Microsoft Office를 제어할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 *
 * 이 도구들은 /tool 명령어로 활성화/비활성화 가능
 * 첫 사용 시 office-server.exe 자동 시작
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { officeClient } from './office-client.js';

/**
 * Save base64 image to file and return the path
 */
async function saveScreenshot(base64Image: string, appName: string): Promise<string> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');

  // Create screenshots directory if it doesn't exist
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${appName}_${timestamp}.png`;
  const filePath = path.join(screenshotsDir, filename);

  // Decode base64 and save
  const buffer = Buffer.from(base64Image, 'base64');
  await fs.writeFile(filePath, buffer);

  return filePath;
}

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
    description: `Write text to the active Word document with font settings.
The text will be inserted at the current cursor position.
IMPORTANT: Always specify font_name and font_size for proper formatting.
Recommended: font_name="맑은 고딕" or "Arial", font_size=11 for body text, 16-24 for titles.`,
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
    description: `Save the active Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Can use Linux/WSL paths (e.g., /home/user/doc.docx) or Windows paths (e.g., C:\\Users\\user\\doc.docx)',
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
      const filePath = await saveScreenshot(response.image, 'word');
      return {
        success: true,
        result: `Word screenshot saved to: ${filePath}\n\nYou can view this image using read_file tool if your LLM supports vision.`,
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

// -----------------------------------------------------------------------------
// Word Formatting & Advanced Tools
// -----------------------------------------------------------------------------

const WORD_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_font',
    description: `Set font properties for the current selection in Word.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "맑은 고딕")' },
        font_size: { type: 'number', description: 'Font size in points' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        underline: { type: 'boolean', description: 'Underline text' },
        color: { type: 'string', description: 'Font color as hex (e.g., "#FF0000")' },
        highlight_color: { type: 'string', description: 'Highlight color' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordSetFont({
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      bold: args['bold'] as boolean | undefined,
      italic: args['italic'] as boolean | undefined,
      underline: args['underline'] as boolean | undefined,
      color: args['color'] as string | undefined,
      highlightColor: args['highlight_color'] as string | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Font properties set' };
    }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetFontTool: LLMSimpleTool = {
  definition: WORD_SET_FONT_DEFINITION,
  execute: executeWordSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word font properties',
};

const WORD_SET_PARAGRAPH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_paragraph',
    description: `Set paragraph formatting for the current selection in Word.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting paragraph format' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Text alignment' },
        line_spacing: { type: 'number', description: 'Line spacing multiplier' },
        space_before: { type: 'number', description: 'Space before paragraph in points' },
        space_after: { type: 'number', description: 'Space after paragraph in points' },
        first_line_indent: { type: 'number', description: 'First line indent in points' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetParagraph(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordSetParagraph({
      alignment: args['alignment'] as 'left' | 'center' | 'right' | 'justify' | undefined,
      lineSpacing: args['line_spacing'] as number | undefined,
      spaceBefore: args['space_before'] as number | undefined,
      spaceAfter: args['space_after'] as number | undefined,
      firstLineIndent: args['first_line_indent'] as number | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Paragraph formatting set' };
    }
    return { success: false, error: response.error || 'Failed to set paragraph' };
  } catch (error) {
    return { success: false, error: `Failed to set paragraph: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetParagraphTool: LLMSimpleTool = {
  definition: WORD_SET_PARAGRAPH_DEFINITION,
  execute: executeWordSetParagraph,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word paragraph format',
};

const WORD_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_table',
    description: `Add a table to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a table' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        data: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '2D array of cell data' },
      },
      required: ['reason', 'rows', 'cols'],
    },
  },
};

async function executeWordAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordAddTable(
      args['rows'] as number,
      args['cols'] as number,
      args['data'] as string[][] | undefined
    );
    if (response.success) {
      return { success: true, result: `Table added (${args['rows']}x${args['cols']})` };
    }
    return { success: false, error: response.error || 'Failed to add table' };
  } catch (error) {
    return { success: false, error: `Failed to add table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTableTool: LLMSimpleTool = {
  definition: WORD_ADD_TABLE_DEFINITION,
  execute: executeWordAddTable,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word table',
};

const WORD_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_image',
    description: `Add an image to the Word document. WSL paths (e.g., /home/user/image.png) are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        path: { type: 'string', description: 'Image file path. Can use Linux/WSL paths or Windows paths.' },
        width: { type: 'number', description: 'Image width in points (optional)' },
        height: { type: 'number', description: 'Image height in points (optional)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordAddImage(
      args['path'] as string,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: 'Image added' };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddImageTool: LLMSimpleTool = {
  definition: WORD_ADD_IMAGE_DEFINITION,
  execute: executeWordAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word image',
};

const WORD_ADD_HYPERLINK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_hyperlink',
    description: `Add a hyperlink to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a hyperlink' },
        text: { type: 'string', description: 'Display text' },
        url: { type: 'string', description: 'URL to link to' },
      },
      required: ['reason', 'text', 'url'],
    },
  },
};

async function executeWordAddHyperlink(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordAddHyperlink(
      args['text'] as string,
      args['url'] as string
    );
    if (response.success) {
      return { success: true, result: `Hyperlink added: ${args['text']}` };
    }
    return { success: false, error: response.error || 'Failed to add hyperlink' };
  } catch (error) {
    return { success: false, error: `Failed to add hyperlink: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddHyperlinkTool: LLMSimpleTool = {
  definition: WORD_ADD_HYPERLINK_DEFINITION,
  execute: executeWordAddHyperlink,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word hyperlink',
};

const WORD_FIND_REPLACE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_find_replace',
    description: `Find and replace text in the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are doing find/replace' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: true)' },
      },
      required: ['reason', 'find', 'replace'],
    },
  },
};

async function executeWordFindReplace(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordFindReplace(
      args['find'] as string,
      args['replace'] as string,
      args['replace_all'] as boolean ?? true
    );
    if (response.success) {
      return { success: true, result: `Replaced "${args['find']}" with "${args['replace']}"` };
    }
    return { success: false, error: response.error || 'Failed to find/replace' };
  } catch (error) {
    return { success: false, error: `Failed to find/replace: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordFindReplaceTool: LLMSimpleTool = {
  definition: WORD_FIND_REPLACE_DEFINITION,
  execute: executeWordFindReplace,
  categories: OFFICE_CATEGORIES,
  description: 'Find and replace in Word',
};

const WORD_SET_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_style',
    description: `Apply a style to the current selection. IMPORTANT: Style names depend on Office language. English: "Normal", "Heading 1", "Title". Korean (한국어): "표준", "제목 1", "제목". Use the style name matching the user's Office language.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying a style' },
        style: { type: 'string', description: 'Style name' },
      },
      required: ['reason', 'style'],
    },
  },
};

async function executeWordSetStyle(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordSetStyle(args['style'] as string);
    if (response.success) {
      return { success: true, result: `Style "${args['style']}" applied` };
    }
    return { success: false, error: response.error || 'Failed to set style' };
  } catch (error) {
    return { success: false, error: `Failed to set style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetStyleTool: LLMSimpleTool = {
  definition: WORD_SET_STYLE_DEFINITION,
  execute: executeWordSetStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Apply Word style',
};

const WORD_INSERT_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_break',
    description: `Insert a page break, line break, or section break.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a break' },
        break_type: { type: 'string', enum: ['page', 'line', 'section'], description: 'Type of break' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertBreak(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordInsertBreak(
      args['break_type'] as 'page' | 'line' | 'section' ?? 'page'
    );
    if (response.success) {
      return { success: true, result: `${args['break_type'] || 'page'} break inserted` };
    }
    return { success: false, error: response.error || 'Failed to insert break' };
  } catch (error) {
    return { success: false, error: `Failed to insert break: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertBreakTool: LLMSimpleTool = {
  definition: WORD_INSERT_BREAK_DEFINITION,
  execute: executeWordInsertBreak,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word break',
};

const WORD_SELECT_ALL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_select_all',
    description: `Select all content in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting all' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSelectAll(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.wordSelectAll();
    if (response.success) {
      return { success: true, result: 'All content selected' };
    }
    return { success: false, error: response.error || 'Failed to select all' };
  } catch (error) {
    return { success: false, error: `Failed to select all: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSelectAllTool: LLMSimpleTool = {
  definition: WORD_SELECT_ALL_DEFINITION,
  execute: executeWordSelectAll,
  categories: OFFICE_CATEGORIES,
  description: 'Select all in Word',
};

const WORD_GOTO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto',
    description: `Navigate to a specific page, line, or bookmark.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating' },
        what: { type: 'string', enum: ['page', 'line', 'bookmark'], description: 'Navigation target type' },
        target: { type: 'string', description: 'Page/line number or bookmark name' },
      },
      required: ['reason', 'what', 'target'],
    },
  },
};

async function executeWordGoto(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const target = args['what'] === 'bookmark' ? args['target'] as string : parseInt(args['target'] as string);
    const response = await officeClient.wordGoto(
      args['what'] as 'page' | 'line' | 'bookmark',
      target
    );
    if (response.success) {
      return { success: true, result: `Navigated to ${args['what']} ${args['target']}` };
    }
    return { success: false, error: response.error || 'Failed to navigate' };
  } catch (error) {
    return { success: false, error: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGotoTool: LLMSimpleTool = {
  definition: WORD_GOTO_DEFINITION,
  execute: executeWordGoto,
  categories: OFFICE_CATEGORIES,
  description: 'Navigate in Word',
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
    description: `Write a value to a specific cell in Excel with optional font settings.
Use cell references like "A1", "B2", "C10", etc.
Specify font_name and font_size for proper formatting.`,
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
        font_name: {
          type: 'string',
          description: 'Font name (e.g., "Arial", "맑은 고딕")',
        },
        font_size: {
          type: 'number',
          description: 'Font size in points (e.g., 11, 12, 14)',
        },
        bold: {
          type: 'boolean',
          description: 'Whether to make the text bold',
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
  const fontName = args['font_name'] as string | undefined;
  const fontSize = args['font_size'] as number | undefined;
  const bold = args['bold'] as boolean | undefined;

  try {
    const response = await officeClient.excelWriteCell(cell, value, sheet, { fontName, fontSize, bold });
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
    description: `Save the active Excel workbook. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Can use Linux/WSL paths or Windows paths.',
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
      const filePath = await saveScreenshot(response.image, 'excel');
      return {
        success: true,
        result: `Excel screenshot saved to: ${filePath}\n\nYou can view this image using read_file tool if your LLM supports vision.`,
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

// -----------------------------------------------------------------------------
// Excel Formatting Tools
// -----------------------------------------------------------------------------

const EXCEL_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_font',
    description: `Set font properties for Excel cells or range. Use this to change font name, size, style (bold/italic), color, and underline.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font properties' },
        range: { type: 'string', description: 'Cell range (e.g., "A1", "A1:B5", "A:A")' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "맑은 고딕")' },
        font_size: { type: 'number', description: 'Font size in points' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        underline: { type: 'boolean', description: 'Underline text' },
        color: { type: 'string', description: 'Font color as hex (e.g., "#FF0000" for red)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetFont(
      args['range'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        underline: args['underline'] as boolean | undefined,
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
  description: 'Set Excel cell font properties',
};

const EXCEL_SET_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_fill',
    description: `Set cell background/fill color for Excel cells or range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting fill color' },
        range: { type: 'string', description: 'Cell range (e.g., "A1", "A1:B5")' },
        color: { type: 'string', description: 'Background color as hex (e.g., "#FFFF00" for yellow, "#4472C4" for blue)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'color'],
    },
  },
};

async function executeExcelSetFill(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetFill(
      args['range'] as string,
      args['color'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Fill color ${args['color']} set for ${args['range']}` };
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
  description: 'Set Excel cell background color',
};

const EXCEL_SET_NUMBER_FORMAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_number_format',
    description: `Set number format for Excel cells. Common formats:
- "#,##0" - Number with thousands separator
- "#,##0.00" - Number with 2 decimals
- "0%" - Percentage
- "$#,##0.00" - Currency (USD)
- "₩#,##0" - Currency (KRW)
- "yyyy-mm-dd" - Date
- "@" - Text`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting number format' },
        range: { type: 'string', description: 'Cell range (e.g., "A1", "B2:B10")' },
        format: { type: 'string', description: 'Excel number format string' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'format'],
    },
  },
};

async function executeExcelSetNumberFormat(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetNumberFormat(
      args['range'] as string,
      args['format'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Number format "${args['format']}" set for ${args['range']}` };
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
  description: 'Set Excel cell number format',
};

const EXCEL_SET_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_border',
    description: `Set cell borders for Excel cells or range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting borders' },
        range: { type: 'string', description: 'Cell range (e.g., "A1:D10")' },
        style: { type: 'string', enum: ['thin', 'medium', 'thick', 'double', 'dotted', 'dashed'], description: 'Border line style' },
        color: { type: 'string', description: 'Border color as hex (e.g., "#000000")' },
        edges: { type: 'array', items: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'all'] }, description: 'Which edges to apply border' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetBorder(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetBorder(
      args['range'] as string,
      {
        style: args['style'] as 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed' | undefined,
        color: args['color'] as string | undefined,
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
  description: 'Set Excel cell borders',
};

const EXCEL_SET_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_alignment',
    description: `Set cell alignment for Excel cells or range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting alignment' },
        range: { type: 'string', description: 'Cell range' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'center', 'bottom'], description: 'Vertical alignment' },
        wrap_text: { type: 'boolean', description: 'Wrap text in cell' },
        orientation: { type: 'number', description: 'Text rotation angle (0-180)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetAlignment(
      args['range'] as string,
      {
        horizontal: args['horizontal'] as 'left' | 'center' | 'right' | undefined,
        vertical: args['vertical'] as 'top' | 'center' | 'bottom' | undefined,
        wrapText: args['wrap_text'] as boolean | undefined,
        orientation: args['orientation'] as number | undefined,
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
  description: 'Set Excel cell alignment',
};

const EXCEL_MERGE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_merge_cells',
    description: `Merge Excel cells in a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        range: { type: 'string', description: 'Cell range to merge (e.g., "A1:C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelMergeCells(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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

const EXCEL_SET_COLUMN_WIDTH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_column_width',
    description: `Set column width or auto-fit columns.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting column width' },
        column: { type: 'string', description: 'Column letter or range (e.g., "A", "A:C")' },
        width: { type: 'number', description: 'Width in characters' },
        auto_fit: { type: 'boolean', description: 'Auto-fit width to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelSetColumnWidth(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetColumnWidth(
      args['column'] as string,
      args['width'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column width set for ${args['column']}` };
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

const EXCEL_SET_ROW_HEIGHT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_row_height',
    description: `Set row height or auto-fit rows.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting row height' },
        row: { type: 'number', description: 'Row number' },
        height: { type: 'number', description: 'Height in points' },
        auto_fit: { type: 'boolean', description: 'Auto-fit height to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelSetRowHeight(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelSetRowHeight(
      args['row'] as number,
      args['height'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row height set for row ${args['row']}` };
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

const EXCEL_ADD_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_sheet',
    description: `Add a new worksheet to the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a sheet' },
        name: { type: 'string', description: 'Sheet name (optional)' },
        position: { type: 'string', description: 'Position: "start", "end", or sheet name to insert after' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelAddSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelAddSheet(
      args['name'] as string | undefined,
      args['position'] as 'start' | 'end' | string | undefined
    );
    if (response.success) {
      return { success: true, result: `Sheet added: ${response['sheet_name'] || args['name'] || 'new sheet'}` };
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

const EXCEL_DELETE_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_sheet',
    description: `Delete a worksheet from the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the sheet' },
        name: { type: 'string', description: 'Sheet name to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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

const EXCEL_RENAME_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_rename_sheet',
    description: `Rename a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are renaming the sheet' },
        old_name: { type: 'string', description: 'Current sheet name' },
        new_name: { type: 'string', description: 'New sheet name' },
      },
      required: ['reason', 'old_name', 'new_name'],
    },
  },
};

async function executeExcelRenameSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelInsertRow(
      args['row'] as number,
      args['count'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Inserted ${args['count'] ?? 1} row(s) at row ${args['row']}` };
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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelDeleteRow(
      args['row'] as number,
      args['count'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Deleted ${args['count'] ?? 1} row(s) at row ${args['row']}` };
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

const EXCEL_INSERT_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_column',
    description: `Insert columns at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting columns' },
        column: { type: 'string', description: 'Column letter to insert at (e.g., "B")' },
        count: { type: 'number', description: 'Number of columns to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelInsertColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelInsertColumn(
      args['column'] as string,
      args['count'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Inserted ${args['count'] ?? 1} column(s) at column ${args['column']}` };
    }
    return { success: false, error: response.error || 'Failed to insert column' };
  } catch (error) {
    return { success: false, error: `Failed to insert column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertColumnTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_COLUMN_DEFINITION,
  execute: executeExcelInsertColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel columns',
};

const EXCEL_DELETE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_column',
    description: `Delete columns at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting columns' },
        column: { type: 'string', description: 'Column letter to delete (e.g., "B")' },
        count: { type: 'number', description: 'Number of columns to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelDeleteColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.excelDeleteColumn(
      args['column'] as string,
      args['count'] as number ?? 1,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Deleted ${args['count'] ?? 1} column(s) at column ${args['column']}` };
    }
    return { success: false, error: response.error || 'Failed to delete column' };
  } catch (error) {
    return { success: false, error: `Failed to delete column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteColumnTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COLUMN_DEFINITION,
  execute: executeExcelDeleteColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel columns',
};

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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

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
    description: `Write text to a shape on a slide with optional font settings.
Shape 1 is typically the title, Shape 2 is the content area.
Specify font_name and font_size for proper formatting.`,
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
        font_name: {
          type: 'string',
          description: 'Font name (e.g., "Arial", "맑은 고딕")',
        },
        font_size: {
          type: 'number',
          description: 'Font size in points (e.g., 24 for title, 18 for content)',
        },
        bold: {
          type: 'boolean',
          description: 'Whether to make the text bold',
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
  const fontName = args['font_name'] as string | undefined;
  const fontSize = args['font_size'] as number | undefined;
  const bold = args['bold'] as boolean | undefined;

  try {
    const response = await officeClient.powerpointWriteText(slide, shape, text, { fontName, fontSize, bold });
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
    description: `Save the active PowerPoint presentation. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are saving',
        },
        path: {
          type: 'string',
          description: 'File path to save to (optional). Can use Linux/WSL paths or Windows paths.',
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
      const filePath = await saveScreenshot(response.image, 'powerpoint');
      return {
        success: true,
        result: `PowerPoint screenshot saved to: ${filePath}\n\nYou can view this image using read_file tool if your LLM supports vision.`,
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

// -----------------------------------------------------------------------------
// PowerPoint Advanced Tools
// -----------------------------------------------------------------------------

const POWERPOINT_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_textbox',
    description: `Add a text box to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a textbox' },
        slide: { type: 'number', description: 'Slide number' },
        text: { type: 'string', description: 'Text content' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 300)' },
        height: { type: 'number', description: 'Height in points (default: 50)' },
      },
      required: ['reason', 'slide', 'text'],
    },
  },
};

async function executePowerPointAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointAddTextbox(
      args['slide'] as number,
      args['text'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number ?? 300,
      args['height'] as number ?? 50
    );
    if (response.success) {
      return { success: true, result: `Textbox added to slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTextboxTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TEXTBOX_DEFINITION,
  execute: executePowerPointAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint textbox',
};

const POWERPOINT_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_font',
    description: `Set font properties for a shape on a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting font' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        color: { type: 'string', description: 'Font color as hex' },
      },
      required: ['reason', 'slide', 'shape'],
    },
  },
};

async function executePowerPointSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointSetFont(
      args['slide'] as number,
      args['shape'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        italic: args['italic'] as boolean | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Font properties set' };
    }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed to set font: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetFontTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_FONT_DEFINITION,
  execute: executePowerPointSetFont,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint font',
};

const POWERPOINT_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_image',
    description: `Add an image to a slide. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding an image' },
        slide: { type: 'number', description: 'Slide number' },
        path: { type: 'string', description: 'Image file path. Can use Linux/WSL paths or Windows paths.' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' },
      },
      required: ['reason', 'slide', 'path'],
    },
  },
};

async function executePowerPointAddImage(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointAddImage(
      args['slide'] as number,
      args['path'] as string,
      args['left'] as number ?? 100,
      args['top'] as number ?? 100,
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: `Image added to slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to add image' };
  } catch (error) {
    return { success: false, error: `Failed to add image: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddImageTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_IMAGE_DEFINITION,
  execute: executePowerPointAddImage,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint image',
};

const POWERPOINT_ADD_ANIMATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_animation',
    description: `Add animation effect to a shape. Effects: fade, fly_in, zoom, wipe, appear.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding animation' },
        slide: { type: 'number', description: 'Slide number' },
        shape: { type: 'number', description: 'Shape index' },
        effect: { type: 'string', description: 'Animation effect (fade, fly_in, zoom, wipe, appear)' },
        trigger: { type: 'string', enum: ['on_click', 'with_previous', 'after_previous'], description: 'Animation trigger' },
      },
      required: ['reason', 'slide', 'shape'],
    },
  },
};

async function executePowerPointAddAnimation(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointAddAnimation(
      args['slide'] as number,
      args['shape'] as number,
      args['effect'] as string ?? 'fade',
      args['trigger'] as string ?? 'on_click'
    );
    if (response.success) {
      return { success: true, result: 'Animation added' };
    }
    return { success: false, error: response.error || 'Failed to add animation' };
  } catch (error) {
    return { success: false, error: `Failed to add animation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddAnimationTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_ANIMATION_DEFINITION,
  execute: executePowerPointAddAnimation,
  categories: OFFICE_CATEGORIES,
  description: 'Add PowerPoint animation',
};

const POWERPOINT_SET_BACKGROUND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_background',
    description: `Set slide background color or image. WSL paths for images are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting background' },
        slide: { type: 'number', description: 'Slide number' },
        color: { type: 'string', description: 'Background color as hex (e.g., "#FFFFFF")' },
        image: { type: 'string', description: 'Background image file path. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'slide'],
    },
  },
};

async function executePowerPointSetBackground(args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointSetBackground(
      args['slide'] as number,
      {
        color: args['color'] as string | undefined,
        imagePath: args['image'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Background set for slide ${args['slide']}` };
    }
    return { success: false, error: response.error || 'Failed to set background' };
  } catch (error) {
    return { success: false, error: `Failed to set background: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetBackgroundTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_BACKGROUND_DEFINITION,
  execute: executePowerPointSetBackground,
  categories: OFFICE_CATEGORIES,
  description: 'Set PowerPoint background',
};

const POWERPOINT_GET_SLIDE_COUNT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_slide_count',
    description: `Get the number of slides in the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need slide count' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointGetSlideCount(_args: Record<string, unknown>): Promise<ToolResult> {
  const serverCheck = await ensureServerRunning();
  if (!serverCheck.success) return { success: false, error: serverCheck.error };

  try {
    const response = await officeClient.powerpointGetSlideCount();
    if (response.success) {
      return { success: true, result: `Slide count: ${response['count']}` };
    }
    return { success: false, error: response.error || 'Failed to get slide count' };
  } catch (error) {
    return { success: false, error: `Failed to get slide count: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetSlideCountTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_SLIDE_COUNT_DEFINITION,
  execute: executePowerPointGetSlideCount,
  categories: OFFICE_CATEGORIES,
  description: 'Get PowerPoint slide count',
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
  // Advanced tools
  wordSetFontTool,
  wordSetParagraphTool,
  wordAddTableTool,
  wordAddImageTool,
  wordAddHyperlinkTool,
  wordFindReplaceTool,
  wordSetStyleTool,
  wordInsertBreakTool,
  wordSelectAllTool,
  wordGotoTool,
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
  // Formatting tools
  excelSetFontTool,
  excelSetFillTool,
  excelSetNumberFormatTool,
  excelSetBorderTool,
  excelSetAlignmentTool,
  excelMergeCellsTool,
  excelSetColumnWidthTool,
  excelSetRowHeightTool,
  // Sheet management
  excelAddSheetTool,
  excelDeleteSheetTool,
  excelRenameSheetTool,
  excelGetSheetsTool,
  // Data tools
  excelSortRangeTool,
  excelInsertRowTool,
  excelDeleteRowTool,
  excelInsertColumnTool,
  excelDeleteColumnTool,
  excelFreezePanesTool,
  excelAutoFilterTool,
];

export const POWERPOINT_TOOLS: LLMSimpleTool[] = [
  powerpointLaunchTool,
  powerpointAddSlideTool,
  powerpointWriteTextTool,
  powerpointReadSlideTool,
  powerpointSaveTool,
  powerpointScreenshotTool,
  powerpointCloseTool,
  // Advanced tools
  powerpointAddTextboxTool,
  powerpointSetFontTool,
  powerpointAddImageTool,
  powerpointAddAnimationTool,
  powerpointSetBackgroundTool,
  powerpointGetSlideCountTool,
];

export const OFFICE_TOOLS: LLMSimpleTool[] = [
  ...WORD_TOOLS,
  ...EXCEL_TOOLS,
  ...POWERPOINT_TOOLS,
];
