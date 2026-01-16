/**
 * Microsoft Word Tools
 *
 * LLM이 Word를 제어할 수 있는 도구들
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
// Word Launch
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
        reason: { type: 'string', description: 'Explanation of why you are launching Word' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
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

// =============================================================================
// Word Create
// =============================================================================

const WORD_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create',
    description: `Create a new Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a document' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New document created' };
    }
    return { success: false, error: response.error || 'Failed to create document' };
  } catch (error) {
    return { success: false, error: `Failed to create document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateTool: LLMSimpleTool = {
  definition: WORD_CREATE_DEFINITION,
  execute: executeWordCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new Word document',
};

// =============================================================================
// Word Open
// =============================================================================

const WORD_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_open',
    description: `Open an existing Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this document' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Document opened: ${response['document_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open document' };
  } catch (error) {
    return { success: false, error: `Failed to open document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordOpenTool: LLMSimpleTool = {
  definition: WORD_OPEN_DEFINITION,
  execute: executeWordOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing Word document',
};

// =============================================================================
// Word Write
// =============================================================================

const WORD_WRITE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_write',
    description: `Write text to the active Word document with font settings.
The text will be inserted at the current cursor position.
By default, a new paragraph is created after the text (new_paragraph=true).
This prevents formatting from bleeding between sections.
Set new_paragraph=false only when continuing on the same line.
IMPORTANT: Always specify font_name and font_size for proper formatting.
Recommended: font_name="맑은 고딕" or "Arial", font_size=11 for body text, 16-24 for titles.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are writing this text' },
        text: { type: 'string', description: 'The text to write to the document' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "Times New Roman", "맑은 고딕")' },
        font_size: { type: 'number', description: 'Font size in points (e.g., 12, 14, 16)' },
        bold: { type: 'boolean', description: 'Whether to make the text bold' },
        italic: { type: 'boolean', description: 'Whether to make the text italic' },
        new_paragraph: { type: 'boolean', description: 'Add paragraph break after text (default: true). Set false to continue on same line.' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordWrite(args: Record<string, unknown>): Promise<ToolResult> {
  const text = args['text'] as string;
  const fontName = args['font_name'] as string | undefined;
  const fontSize = args['font_size'] as number | undefined;
  const bold = args['bold'] as boolean | undefined;
  const italic = args['italic'] as boolean | undefined;
  const newParagraph = args['new_paragraph'] as boolean | undefined;

  try {
    const response = await officeClient.wordWrite(text, { fontName, fontSize, bold, italic, newParagraph });
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

// =============================================================================
// Word Read
// =============================================================================

const WORD_READ_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_read',
    description: `Read the content of the active Word document.
Returns the full text content of the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading the document' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRead(_args: Record<string, unknown>): Promise<ToolResult> {
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

// =============================================================================
// Word Save
// =============================================================================

const WORD_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_save',
    description: `Save the active Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional). Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSave(args: Record<string, unknown>): Promise<ToolResult> {
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

// =============================================================================
// Word Screenshot
// =============================================================================

const WORD_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_screenshot',
    description: `Take a screenshot of the current Word document.
Captures the document content and saves to ${OFFICE_SCREENSHOT_PATH_DESC}.
Use this to verify document formatting or show the user what the document looks like.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
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

// =============================================================================
// Word Close
// =============================================================================

const WORD_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_close',
    description: `Close the active Word document.
Optionally save before closing.`,
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

async function executeWordClose(args: Record<string, unknown>): Promise<ToolResult> {
  const save = args['save'] === true;

  try {
    const response = await officeClient.wordClose(save);
    if (response.success) {
      return { success: true, result: `Document closed${save ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close document' };
  } catch (error) {
    return { success: false, error: `Failed to close document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCloseTool: LLMSimpleTool = {
  definition: WORD_CLOSE_DEFINITION,
  execute: executeWordClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Word document',
};

// =============================================================================
// Word Quit
// =============================================================================

const WORD_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_quit',
    description: `Quit Microsoft Word application entirely.
Optionally save all documents before quitting.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are quitting Word' },
        save: { type: 'boolean', description: 'Whether to save all documents before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordQuit(args: Record<string, unknown>): Promise<ToolResult> {
  const save = args['save'] === true;

  try {
    const response = await officeClient.wordQuit(save);
    if (response.success) {
      return { success: true, result: `Word closed${save ? ' (all documents saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit Word' };
  } catch (error) {
    return { success: false, error: `Failed to quit Word: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordQuitTool: LLMSimpleTool = {
  definition: WORD_QUIT_DEFINITION,
  execute: executeWordQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft Word',
};

// =============================================================================
// Word Set Font
// =============================================================================

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
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetFont({
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      bold: args['bold'] as boolean | undefined,
      italic: args['italic'] as boolean | undefined,
      underline: args['underline'] as boolean | undefined,
      color: args['color'] as string | undefined,
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

// =============================================================================
// Word Set Paragraph
// =============================================================================

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

// =============================================================================
// Word Add Table
// =============================================================================

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

// =============================================================================
// Word Add Image
// =============================================================================

const WORD_ADD_IMAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_image',
    description: `Add an image to the Word document. WSL paths are automatically converted to Windows paths.`,
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

// =============================================================================
// Word Add Hyperlink
// =============================================================================

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

// =============================================================================
// Word Find Replace
// =============================================================================

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

// =============================================================================
// Word Set Style
// =============================================================================

const WORD_SET_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_style',
    description: `Apply a style to the current selection. IMPORTANT: Style names depend on Office language. English: "Normal", "Heading 1", "Title". Korean: "표준", "제목 1", "제목".`,
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

// =============================================================================
// Word Insert Break
// =============================================================================

const WORD_INSERT_BREAK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_break',
    description: `Insert a page break, line break, or section break.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting a break' },
        break_type: { type: 'string', enum: ['page', 'line', 'section'], description: 'Type of break (default: page)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertBreak(args: Record<string, unknown>): Promise<ToolResult> {
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

// =============================================================================
// Word Select All
// =============================================================================

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

// =============================================================================
// Word Goto
// =============================================================================

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
// Word Insert Header
// =============================================================================

const WORD_INSERT_HEADER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_header',
    description: `Insert header text to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting header' },
        text: { type: 'string', description: 'Header text' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordInsertHeader(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordInsertHeader(
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Header inserted' };
    }
    return { success: false, error: response.error || 'Failed to insert header' };
  } catch (error) {
    return { success: false, error: `Failed to insert header: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertHeaderTool: LLMSimpleTool = {
  definition: WORD_INSERT_HEADER_DEFINITION,
  execute: executeWordInsertHeader,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word header',
};

// =============================================================================
// Word Insert Footer
// =============================================================================

const WORD_INSERT_FOOTER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_footer',
    description: `Insert footer text to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting footer' },
        text: { type: 'string', description: 'Footer text' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordInsertFooter(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordInsertFooter(
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Footer inserted' };
    }
    return { success: false, error: response.error || 'Failed to insert footer' };
  } catch (error) {
    return { success: false, error: `Failed to insert footer: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertFooterTool: LLMSimpleTool = {
  definition: WORD_INSERT_FOOTER_DEFINITION,
  execute: executeWordInsertFooter,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word footer',
};

// =============================================================================
// Word Insert Page Number
// =============================================================================

const WORD_INSERT_PAGE_NUMBER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_insert_page_number',
    description: `Insert page numbers to the document footer.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting page numbers' },
        alignment: { type: 'string', enum: ['left', 'center', 'right'], description: 'Page number alignment (default: center)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordInsertPageNumber(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordInsertPageNumber(
      args['alignment'] as 'left' | 'center' | 'right' ?? 'center'
    );
    if (response.success) {
      return { success: true, result: 'Page numbers inserted' };
    }
    return { success: false, error: response.error || 'Failed to insert page numbers' };
  } catch (error) {
    return { success: false, error: `Failed to insert page numbers: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordInsertPageNumberTool: LLMSimpleTool = {
  definition: WORD_INSERT_PAGE_NUMBER_DEFINITION,
  execute: executeWordInsertPageNumber,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Word page numbers',
};

// =============================================================================
// Word Export to PDF
// =============================================================================

const WORD_EXPORT_PDF_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_export_pdf',
    description: `Export the document to PDF. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are exporting to PDF' },
        path: { type: 'string', description: 'Output PDF file path. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordExportPDF(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordExportToPDF(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Exported to PDF: ${response['path'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to export to PDF' };
  } catch (error) {
    return { success: false, error: `Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordExportPDFTool: LLMSimpleTool = {
  definition: WORD_EXPORT_PDF_DEFINITION,
  execute: executeWordExportPDF,
  categories: OFFICE_CATEGORIES,
  description: 'Export Word to PDF',
};

// =============================================================================
// Word Print
// =============================================================================

const WORD_PRINT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_print',
    description: `Print the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are printing' },
        copies: { type: 'number', description: 'Number of copies (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordPrint(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordPrint(args['copies'] as number ?? 1);
    if (response.success) {
      return { success: true, result: `Print job sent (${args['copies'] ?? 1} copies)` };
    }
    return { success: false, error: response.error || 'Failed to print' };
  } catch (error) {
    return { success: false, error: `Failed to print: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordPrintTool: LLMSimpleTool = {
  definition: WORD_PRINT_DEFINITION,
  execute: executeWordPrint,
  categories: OFFICE_CATEGORIES,
  description: 'Print Word document',
};

// =============================================================================
// Word Set Table Cell
// =============================================================================

const WORD_SET_TABLE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_cell',
    description: `Set the content of a specific cell in a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table cell' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        row: { type: 'number', description: 'Row number (1-based)' },
        col: { type: 'number', description: 'Column number (1-based)' },
        text: { type: 'string', description: 'Text to set in the cell' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'table_index', 'row', 'col', 'text'],
    },
  },
};

async function executeWordSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetTableCell(
      args['table_index'] as number,
      args['row'] as number,
      args['col'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table cell updated' };
    }
    return { success: false, error: response.error || 'Failed to set table cell' };
  } catch (error) {
    return { success: false, error: `Failed to set table cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableCellTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_CELL_DEFINITION,
  execute: executeWordSetTableCell,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table cell',
};

// =============================================================================
// Word Merge Table Cells
// =============================================================================

const WORD_MERGE_TABLE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_merge_table_cells',
    description: `Merge cells in a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        start_row: { type: 'number', description: 'Start row (1-based)' },
        start_col: { type: 'number', description: 'Start column (1-based)' },
        end_row: { type: 'number', description: 'End row (1-based)' },
        end_col: { type: 'number', description: 'End column (1-based)' },
      },
      required: ['reason', 'table_index', 'start_row', 'start_col', 'end_row', 'end_col'],
    },
  },
};

async function executeWordMergeTableCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordMergeTableCells(
      args['table_index'] as number,
      args['start_row'] as number,
      args['start_col'] as number,
      args['end_row'] as number,
      args['end_col'] as number
    );
    if (response.success) {
      return { success: true, result: 'Table cells merged' };
    }
    return { success: false, error: response.error || 'Failed to merge cells' };
  } catch (error) {
    return { success: false, error: `Failed to merge cells: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordMergeTableCellsTool: LLMSimpleTool = {
  definition: WORD_MERGE_TABLE_CELLS_DEFINITION,
  execute: executeWordMergeTableCells,
  categories: OFFICE_CATEGORIES,
  description: 'Merge Word table cells',
};

// =============================================================================
// Word Set Table Style
// =============================================================================

const WORD_SET_TABLE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_style',
    description: `Apply a style to a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table style' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        style: { type: 'string', description: 'Style name (e.g., "Table Grid", "Light Shading")' },
      },
      required: ['reason', 'table_index', 'style'],
    },
  },
};

async function executeWordSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetTableStyle(
      args['table_index'] as number,
      args['style'] as string
    );
    if (response.success) {
      return { success: true, result: `Table style set to "${args['style']}"` };
    }
    return { success: false, error: response.error || 'Failed to set table style' };
  } catch (error) {
    return { success: false, error: `Failed to set table style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableStyleTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_STYLE_DEFINITION,
  execute: executeWordSetTableStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table style',
};

// =============================================================================
// Word Set Table Border
// =============================================================================

const WORD_SET_TABLE_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_border',
    description: `Set border style for a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table border' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        style: { type: 'string', enum: ['single', 'double', 'thick', 'none'], description: 'Border style' },
        color: { type: 'string', description: 'Border color as hex (e.g., "#000000")' },
      },
      required: ['reason', 'table_index'],
    },
  },
};

async function executeWordSetTableBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetTableBorder(
      args['table_index'] as number,
      {
        style: args['style'] as 'single' | 'double' | 'thick' | 'none' | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Table border set' };
    }
    return { success: false, error: response.error || 'Failed to set table border' };
  } catch (error) {
    return { success: false, error: `Failed to set table border: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableBorderTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_BORDER_DEFINITION,
  execute: executeWordSetTableBorder,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table border',
};

// =============================================================================
// Word Add Bookmark
// =============================================================================

const WORD_ADD_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_bookmark',
    description: `Add a bookmark at the current selection or with specified text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a bookmark' },
        name: { type: 'string', description: 'Bookmark name (no spaces)' },
        text: { type: 'string', description: 'Optional text to mark (will be selected)' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordAddBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordAddBookmark(
      args['name'] as string,
      args['text'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Bookmark "${args['name']}" added` };
    }
    return { success: false, error: response.error || 'Failed to add bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to add bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddBookmarkTool: LLMSimpleTool = {
  definition: WORD_ADD_BOOKMARK_DEFINITION,
  execute: executeWordAddBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word bookmark',
};

// =============================================================================
// Word Get Bookmarks
// =============================================================================

const WORD_GET_BOOKMARKS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_bookmarks',
    description: `Get all bookmarks in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need bookmark list' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetBookmarks(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordGetBookmarks();
    if (response.success) {
      const bookmarks = response['bookmarks'] as Array<{ name: string; text: string }> || [];
      if (bookmarks.length === 0) {
        return { success: true, result: 'No bookmarks found' };
      }
      const list = bookmarks.map(b => `- ${b.name}: "${b.text}"`).join('\n');
      return { success: true, result: `Bookmarks:\n${list}` };
    }
    return { success: false, error: response.error || 'Failed to get bookmarks' };
  } catch (error) {
    return { success: false, error: `Failed to get bookmarks: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetBookmarksTool: LLMSimpleTool = {
  definition: WORD_GET_BOOKMARKS_DEFINITION,
  execute: executeWordGetBookmarks,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word bookmarks',
};

// =============================================================================
// Word Delete Bookmark
// =============================================================================

const WORD_DELETE_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_bookmark',
    description: `Delete a bookmark from the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting the bookmark' },
        name: { type: 'string', description: 'Bookmark name to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordDeleteBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordDeleteBookmark(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Bookmark "${args['name']}" deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to delete bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteBookmarkTool: LLMSimpleTool = {
  definition: WORD_DELETE_BOOKMARK_DEFINITION,
  execute: executeWordDeleteBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word bookmark',
};

// =============================================================================
// Word Goto Bookmark
// =============================================================================

const WORD_GOTO_BOOKMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_goto_bookmark',
    description: `Navigate to a bookmark in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are navigating to bookmark' },
        name: { type: 'string', description: 'Bookmark name' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeWordGotoBookmark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordGotoBookmark(args['name'] as string);
    if (response.success) {
      return { success: true, result: `Moved to bookmark "${args['name']}"` };
    }
    return { success: false, error: response.error || 'Failed to goto bookmark' };
  } catch (error) {
    return { success: false, error: `Failed to goto bookmark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGotoBookmarkTool: LLMSimpleTool = {
  definition: WORD_GOTO_BOOKMARK_DEFINITION,
  execute: executeWordGotoBookmark,
  categories: OFFICE_CATEGORIES,
  description: 'Goto Word bookmark',
};

// =============================================================================
// Word Add Comment
// =============================================================================

const WORD_ADD_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_comment',
    description: `Add a comment to the current selection.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a comment' },
        text: { type: 'string', description: 'Comment text' },
        author: { type: 'string', description: 'Author name (optional)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordAddComment(
      args['text'] as string,
      args['author'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: 'Comment added' };
    }
    return { success: false, error: response.error || 'Failed to add comment' };
  } catch (error) {
    return { success: false, error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddCommentTool: LLMSimpleTool = {
  definition: WORD_ADD_COMMENT_DEFINITION,
  execute: executeWordAddComment,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word comment',
};

// =============================================================================
// Word Get Comments
// =============================================================================

const WORD_GET_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_comments',
    description: `Get all comments in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need comments' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetComments(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordGetComments();
    if (response.success) {
      const comments = response['comments'] as Array<{ index: number; author: string; text: string; scope: string }> || [];
      const count = response['count'] as number || 0;
      if (count === 0) {
        return { success: true, result: 'No comments found' };
      }
      const list = comments.map(c => `[${c.index}] ${c.author}: "${c.text}" (on: "${c.scope?.slice(0, 30)}...")`).join('\n');
      return { success: true, result: `${count} comments:\n${list}` };
    }
    return { success: false, error: response.error || 'Failed to get comments' };
  } catch (error) {
    return { success: false, error: `Failed to get comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetCommentsTool: LLMSimpleTool = {
  definition: WORD_GET_COMMENTS_DEFINITION,
  execute: executeWordGetComments,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word comments',
};

// =============================================================================
// Word Delete Comment
// =============================================================================

const WORD_DELETE_COMMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_comment',
    description: `Delete a comment by index.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting comment' },
        index: { type: 'number', description: 'Comment index (1-based)' },
      },
      required: ['reason', 'index'],
    },
  },
};

async function executeWordDeleteComment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordDeleteComment(args['index'] as number);
    if (response.success) {
      return { success: true, result: `Comment ${args['index']} deleted` };
    }
    return { success: false, error: response.error || 'Failed to delete comment' };
  } catch (error) {
    return { success: false, error: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteCommentTool: LLMSimpleTool = {
  definition: WORD_DELETE_COMMENT_DEFINITION,
  execute: executeWordDeleteComment,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Word comment',
};

// =============================================================================
// Word Delete All Comments
// =============================================================================

const WORD_DELETE_ALL_COMMENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_delete_all_comments',
    description: `Delete all comments in the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting all comments' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordDeleteAllComments(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordDeleteAllComments();
    if (response.success) {
      return { success: true, result: response.message || 'All comments deleted' };
    }
    return { success: false, error: response.error || 'Failed to delete comments' };
  } catch (error) {
    return { success: false, error: `Failed to delete comments: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordDeleteAllCommentsTool: LLMSimpleTool = {
  definition: WORD_DELETE_ALL_COMMENTS_DEFINITION,
  execute: executeWordDeleteAllComments,
  categories: OFFICE_CATEGORIES,
  description: 'Delete all Word comments',
};

// =============================================================================
// Word Create Bullet List
// =============================================================================

const WORD_CREATE_BULLET_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_bullet_list',
    description: `Create a bullet list with the specified items.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating bullet list' },
        items: { type: 'array', items: { type: 'string' }, description: 'List items' },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateBulletList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordCreateBulletList(args['items'] as string[]);
    if (response.success) {
      return { success: true, result: response.message || 'Bullet list created' };
    }
    return { success: false, error: response.error || 'Failed to create bullet list' };
  } catch (error) {
    return { success: false, error: `Failed to create bullet list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateBulletListTool: LLMSimpleTool = {
  definition: WORD_CREATE_BULLET_LIST_DEFINITION,
  execute: executeWordCreateBulletList,
  categories: OFFICE_CATEGORIES,
  description: 'Create Word bullet list',
};

// =============================================================================
// Word Create Numbered List
// =============================================================================

const WORD_CREATE_NUMBERED_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create_numbered_list',
    description: `Create a numbered list with the specified items.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating numbered list' },
        items: { type: 'array', items: { type: 'string' }, description: 'List items' },
      },
      required: ['reason', 'items'],
    },
  },
};

async function executeWordCreateNumberedList(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordCreateNumberedList(args['items'] as string[]);
    if (response.success) {
      return { success: true, result: response.message || 'Numbered list created' };
    }
    return { success: false, error: response.error || 'Failed to create numbered list' };
  } catch (error) {
    return { success: false, error: `Failed to create numbered list: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateNumberedListTool: LLMSimpleTool = {
  definition: WORD_CREATE_NUMBERED_LIST_DEFINITION,
  execute: executeWordCreateNumberedList,
  categories: OFFICE_CATEGORIES,
  description: 'Create Word numbered list',
};

// =============================================================================
// Word Set Page Margins
// =============================================================================

const WORD_SET_PAGE_MARGINS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_margins',
    description: `Set page margins (in points, 72 points = 1 inch).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting margins' },
        top: { type: 'number', description: 'Top margin in points' },
        bottom: { type: 'number', description: 'Bottom margin in points' },
        left: { type: 'number', description: 'Left margin in points' },
        right: { type: 'number', description: 'Right margin in points' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSetPageMargins(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetPageMargins({
      top: args['top'] as number | undefined,
      bottom: args['bottom'] as number | undefined,
      left: args['left'] as number | undefined,
      right: args['right'] as number | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Page margins updated' };
    }
    return { success: false, error: response.error || 'Failed to set margins' };
  } catch (error) {
    return { success: false, error: `Failed to set margins: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageMarginsTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_MARGINS_DEFINITION,
  execute: executeWordSetPageMargins,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page margins',
};

// =============================================================================
// Word Set Page Orientation
// =============================================================================

const WORD_SET_PAGE_ORIENTATION_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_orientation',
    description: `Set page orientation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing orientation' },
        orientation: { type: 'string', enum: ['portrait', 'landscape'], description: 'Page orientation' },
      },
      required: ['reason', 'orientation'],
    },
  },
};

async function executeWordSetPageOrientation(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetPageOrientation(args['orientation'] as 'portrait' | 'landscape');
    if (response.success) {
      return { success: true, result: `Page orientation set to ${args['orientation']}` };
    }
    return { success: false, error: response.error || 'Failed to set orientation' };
  } catch (error) {
    return { success: false, error: `Failed to set orientation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageOrientationTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_ORIENTATION_DEFINITION,
  execute: executeWordSetPageOrientation,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page orientation',
};

// =============================================================================
// Word Set Page Size
// =============================================================================

const WORD_SET_PAGE_SIZE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_page_size',
    description: `Set page size.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing page size' },
        size: { type: 'string', enum: ['A4', 'Letter', 'Legal', 'A3', 'B5', 'custom'], description: 'Page size' },
        width: { type: 'number', description: 'Custom width in points (for custom size)' },
        height: { type: 'number', description: 'Custom height in points (for custom size)' },
      },
      required: ['reason', 'size'],
    },
  },
};

async function executeWordSetPageSize(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetPageSize(
      args['size'] as 'A4' | 'Letter' | 'Legal' | 'A3' | 'B5' | 'custom',
      args['width'] as number | undefined,
      args['height'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Page size updated' };
    }
    return { success: false, error: response.error || 'Failed to set page size' };
  } catch (error) {
    return { success: false, error: `Failed to set page size: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetPageSizeTool: LLMSimpleTool = {
  definition: WORD_SET_PAGE_SIZE_DEFINITION,
  execute: executeWordSetPageSize,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word page size',
};

// =============================================================================
// Word Add Watermark
// =============================================================================

const WORD_ADD_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_watermark',
    description: `Add a text watermark to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding watermark' },
        text: { type: 'string', description: 'Watermark text' },
        font_name: { type: 'string', description: 'Font name (default: Arial)' },
        font_size: { type: 'number', description: 'Font size (default: 72)' },
        color: { type: 'string', description: 'Color as hex (default: light gray)' },
        semitransparent: { type: 'boolean', description: 'Make semitransparent (default: true)' },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeWordAddWatermark(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordAddWatermark(args['text'] as string, {
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      color: args['color'] as string | undefined,
      semitransparent: args['semitransparent'] as boolean | undefined,
    });
    if (response.success) {
      return { success: true, result: 'Watermark added' };
    }
    return { success: false, error: response.error || 'Failed to add watermark' };
  } catch (error) {
    return { success: false, error: `Failed to add watermark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddWatermarkTool: LLMSimpleTool = {
  definition: WORD_ADD_WATERMARK_DEFINITION,
  execute: executeWordAddWatermark,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word watermark',
};

// =============================================================================
// Word Remove Watermark
// =============================================================================

const WORD_REMOVE_WATERMARK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_remove_watermark',
    description: `Remove watermark from the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing watermark' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRemoveWatermark(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordRemoveWatermark();
    if (response.success) {
      return { success: true, result: 'Watermark removed' };
    }
    return { success: false, error: response.error || 'Failed to remove watermark' };
  } catch (error) {
    return { success: false, error: `Failed to remove watermark: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRemoveWatermarkTool: LLMSimpleTool = {
  definition: WORD_REMOVE_WATERMARK_DEFINITION,
  execute: executeWordRemoveWatermark,
  categories: OFFICE_CATEGORIES,
  description: 'Remove Word watermark',
};

// =============================================================================
// Word Add Textbox
// =============================================================================

const WORD_ADD_TEXTBOX_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_textbox',
    description: `Add a textbox to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding textbox' },
        text: { type: 'string', description: 'Textbox content' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        border_color: { type: 'string', description: 'Border color as hex' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
      },
      required: ['reason', 'text', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddTextbox(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordAddTextbox(
      args['text'] as string,
      args['left'] as number,
      args['top'] as number,
      args['width'] as number,
      args['height'] as number,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        borderColor: args['border_color'] as string | undefined,
        fillColor: args['fill_color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Textbox added: ${response['shape_name']}` };
    }
    return { success: false, error: response.error || 'Failed to add textbox' };
  } catch (error) {
    return { success: false, error: `Failed to add textbox: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTextboxTool: LLMSimpleTool = {
  definition: WORD_ADD_TEXTBOX_DEFINITION,
  execute: executeWordAddTextbox,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word textbox',
};

// =============================================================================
// Word Add Shape
// =============================================================================

const WORD_ADD_SHAPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_shape',
    description: `Add a shape to the document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding shape' },
        shape_type: { type: 'string', enum: ['rectangle', 'oval', 'roundedRectangle', 'triangle', 'diamond', 'arrow', 'line'], description: 'Shape type' },
        left: { type: 'number', description: 'Left position in points' },
        top: { type: 'number', description: 'Top position in points' },
        width: { type: 'number', description: 'Width in points' },
        height: { type: 'number', description: 'Height in points' },
        fill_color: { type: 'string', description: 'Fill color as hex' },
        line_color: { type: 'string', description: 'Line color as hex' },
        line_weight: { type: 'number', description: 'Line weight in points' },
      },
      required: ['reason', 'shape_type', 'left', 'top', 'width', 'height'],
    },
  },
};

async function executeWordAddShape(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordAddShape(
      args['shape_type'] as 'rectangle' | 'oval' | 'roundedRectangle' | 'triangle' | 'diamond' | 'arrow' | 'line',
      args['left'] as number,
      args['top'] as number,
      args['width'] as number,
      args['height'] as number,
      {
        fillColor: args['fill_color'] as string | undefined,
        lineColor: args['line_color'] as string | undefined,
        lineWeight: args['line_weight'] as number | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Shape added: ${response['shape_name']}` };
    }
    return { success: false, error: response.error || 'Failed to add shape' };
  } catch (error) {
    return { success: false, error: `Failed to add shape: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddShapeTool: LLMSimpleTool = {
  definition: WORD_ADD_SHAPE_DEFINITION,
  execute: executeWordAddShape,
  categories: OFFICE_CATEGORIES,
  description: 'Add Word shape',
};

// =============================================================================
// Word Get Document Info
// =============================================================================

const WORD_GET_DOCUMENT_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_document_info',
    description: `Get document statistics (pages, words, characters, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need document info' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetDocumentInfo(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordGetDocumentInfo();
    if (response.success) {
      return {
        success: true,
        result: `Document: ${response['name']}
Pages: ${response['pages']}
Words: ${response['words']}
Characters: ${response['characters']}
Characters (with spaces): ${response['characters_with_spaces']}
Paragraphs: ${response['paragraphs']}
Lines: ${response['lines']}
Saved: ${response['saved'] ? 'Yes' : 'No'}
Read-only: ${response['read_only'] ? 'Yes' : 'No'}`,
      };
    }
    return { success: false, error: response.error || 'Failed to get document info' };
  } catch (error) {
    return { success: false, error: `Failed to get document info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetDocumentInfoTool: LLMSimpleTool = {
  definition: WORD_GET_DOCUMENT_INFO_DEFINITION,
  execute: executeWordGetDocumentInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word document info',
};

// =============================================================================
// Word Set Columns
// =============================================================================

const WORD_SET_COLUMNS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_columns',
    description: `Set the number of columns for the document layout.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting columns' },
        count: { type: 'number', description: 'Number of columns (1-4)' },
        spacing: { type: 'number', description: 'Spacing between columns in points (optional)' },
      },
      required: ['reason', 'count'],
    },
  },
};

async function executeWordSetColumns(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordSetColumns(
      args['count'] as number,
      args['spacing'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: `Columns set to ${args['count']}` };
    }
    return { success: false, error: response.error || 'Failed to set columns' };
  } catch (error) {
    return { success: false, error: `Failed to set columns: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetColumnsTool: LLMSimpleTool = {
  definition: WORD_SET_COLUMNS_DEFINITION,
  execute: executeWordSetColumns,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word columns',
};

// =============================================================================
// Word Undo
// =============================================================================

const WORD_UNDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_undo',
    description: `Undo the last action(s).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are undoing' },
        times: { type: 'number', description: 'Number of times to undo (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordUndo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordUndo(args['times'] as number ?? 1);
    if (response.success) {
      return { success: true, result: response.message || 'Undo performed' };
    }
    return { success: false, error: response.error || 'Failed to undo' };
  } catch (error) {
    return { success: false, error: `Failed to undo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordUndoTool: LLMSimpleTool = {
  definition: WORD_UNDO_DEFINITION,
  execute: executeWordUndo,
  categories: OFFICE_CATEGORIES,
  description: 'Undo Word action',
};

// =============================================================================
// Word Redo
// =============================================================================

const WORD_REDO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_redo',
    description: `Redo the last undone action(s).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are redoing' },
        times: { type: 'number', description: 'Number of times to redo (default: 1)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordRedo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordRedo(args['times'] as number ?? 1);
    if (response.success) {
      return { success: true, result: response.message || 'Redo performed' };
    }
    return { success: false, error: response.error || 'Failed to redo' };
  } catch (error) {
    return { success: false, error: `Failed to redo: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordRedoTool: LLMSimpleTool = {
  definition: WORD_REDO_DEFINITION,
  execute: executeWordRedo,
  categories: OFFICE_CATEGORIES,
  description: 'Redo Word action',
};

// =============================================================================
// Word Get Selected Text
// =============================================================================

const WORD_GET_SELECTED_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_get_selected_text',
    description: `Get the currently selected text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need selected text' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordGetSelectedText(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await officeClient.wordGetSelectedText();
    if (response.success) {
      const text = response['text'] as string || '';
      if (!text || text.length === 0) {
        return { success: true, result: 'No text selected' };
      }
      return { success: true, result: `Selected text: "${text}"` };
    }
    return { success: false, error: response.error || 'Failed to get selected text' };
  } catch (error) {
    return { success: false, error: `Failed to get selected text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordGetSelectedTextTool: LLMSimpleTool = {
  definition: WORD_GET_SELECTED_TEXT_DEFINITION,
  execute: executeWordGetSelectedText,
  categories: OFFICE_CATEGORIES,
  description: 'Get Word selected text',
};

// =============================================================================
// Export All Word Tools
// =============================================================================

export const WORD_TOOLS: LLMSimpleTool[] = [
  // Basic operations
  wordLaunchTool,
  wordCreateTool,
  wordOpenTool,
  wordWriteTool,
  wordReadTool,
  wordSaveTool,
  wordScreenshotTool,
  wordCloseTool,
  wordQuitTool,
  // Formatting
  wordSetFontTool,
  wordSetParagraphTool,
  wordSetStyleTool,
  // Content
  wordAddTableTool,
  wordAddImageTool,
  wordAddHyperlinkTool,
  wordFindReplaceTool,
  wordInsertBreakTool,
  // Navigation
  wordSelectAllTool,
  wordGotoTool,
  // Header/Footer
  wordInsertHeaderTool,
  wordInsertFooterTool,
  wordInsertPageNumberTool,
  // Export
  wordExportPDFTool,
  wordPrintTool,
  // Table manipulation
  wordSetTableCellTool,
  wordMergeTableCellsTool,
  wordSetTableStyleTool,
  wordSetTableBorderTool,
  // Bookmarks
  wordAddBookmarkTool,
  wordGetBookmarksTool,
  wordDeleteBookmarkTool,
  wordGotoBookmarkTool,
  // Comments
  wordAddCommentTool,
  wordGetCommentsTool,
  wordDeleteCommentTool,
  wordDeleteAllCommentsTool,
  // Lists
  wordCreateBulletListTool,
  wordCreateNumberedListTool,
  // Page Setup
  wordSetPageMarginsTool,
  wordSetPageOrientationTool,
  wordSetPageSizeTool,
  // Watermark
  wordAddWatermarkTool,
  wordRemoveWatermarkTool,
  // Textbox & Shapes
  wordAddTextboxTool,
  wordAddShapeTool,
  // Document Info
  wordGetDocumentInfoTool,
  // Columns
  wordSetColumnsTool,
  // Undo/Redo
  wordUndoTool,
  wordRedoTool,
  // Selection
  wordGetSelectedTextTool,
];
