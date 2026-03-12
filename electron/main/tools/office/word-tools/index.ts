/**
 * Word Tools - Barrel Export
 *
 * Re-exports all Word tool modules and provides unified WORD_TOOLS array
 * Total: 76 tools across 20 categories
 */

// Section builders (high-level, for Create Agent)
export * from './section-builders';

// Domain exports
export * from './launch';
export * from './text';
export * from './formatting';
export * from './tables';
export * from './tables-advanced';
export * from './content';
export * from './lists';
export * from './headers-footers';
export * from './page-setup';
export * from './bookmarks';
export * from './comments';
export * from './watermarks';
export * from './navigation';
export * from './undo-redo';
export * from './export';
export * from './selection';
export * from './track-changes';
export * from './toc';
export * from './footnotes';
export * from './find';

// Import tool arrays for unified export
import type { LLMSimpleTool } from '../../types';
import { sectionBuilderTools } from './section-builders';
import { wordCreateTool, wordSaveTool, wordScreenshotTool } from './launch';
import { wordSetPageMarginsTool } from './page-setup';
import { wordInsertHeaderTool, wordInsertFooterTool, wordInsertPageNumberTool } from './headers-footers';

import { launchTools } from './launch';
import { textTools } from './text';
import { formattingTools } from './formatting';
import { tablesTools } from './tables';
import { tablesAdvancedTools } from './tables-advanced';
import { contentTools } from './content';
import { listsTools } from './lists';
import { headersFootersTools } from './headers-footers';
import { pageSetupTools } from './page-setup';
import { bookmarksTools } from './bookmarks';
import { commentsTools } from './comments';
import { watermarksTools } from './watermarks';
import { navigationTools } from './navigation';
import { undoRedoTools } from './undo-redo';
import { exportTools } from './export';
import { selectionTools } from './selection';
import { trackChangesTools } from './track-changes';
import { tocTools } from './toc';
import { footnotesTools } from './footnotes';
import { findTools } from './find';

/**
 * All Word tools combined into a single array
 *
 * Categories:
 * - Launch (7): launch, create, open, save, screenshot, close, quit
 * - Text (6): write, read, find_replace, set_style, get_selected_text, select_all
 * - Formatting (3): set_font, set_paragraph, insert_break
 * - Tables (5): add_table, set_table_cell, merge_table_cells, set_table_style, set_table_border
 * - Tables Advanced (5): add_table_row, add_table_column, delete_table_row, delete_table_column, get_table_info
 * - Content (4): add_image, add_hyperlink, add_textbox, add_shape
 * - Lists (2): create_bullet_list, create_numbered_list
 * - Headers/Footers (3): insert_header, insert_footer, insert_page_number
 * - Page Setup (4): set_page_margins, set_page_orientation, set_page_size, set_columns
 * - Bookmarks (4): add_bookmark, get_bookmarks, delete_bookmark, goto_bookmark
 * - Comments (4): add_comment, get_comments, delete_comment, delete_all_comments
 * - Watermarks (2): add_watermark, remove_watermark
 * - Navigation (2): goto, get_document_info
 * - Undo/Redo (2): undo, redo
 * - Export (2): export_pdf, print
 * - Selection (5): delete_text, get_selection, select_range, move_cursor, move_cursor_to
 * - Track Changes (5): set_track_changes, get_track_changes, accept_all_revisions, reject_all_revisions, handle_revision
 * - TOC (3): insert_toc, update_toc, delete_toc
 * - Footnotes (6): add_footnote, add_endnote, get_footnotes, get_endnotes, delete_footnote, delete_endnote
 * - Find (2): find, find_all
 */
export const WORD_TOOLS = [
  ...launchTools,
  ...textTools,
  ...formattingTools,
  ...tablesTools,
  ...tablesAdvancedTools,
  ...contentTools,
  ...listsTools,
  ...headersFootersTools,
  ...pageSetupTools,
  ...bookmarksTools,
  ...commentsTools,
  ...watermarksTools,
  ...navigationTools,
  ...undoRedoTools,
  ...exportTools,
  ...selectionTools,
  ...trackChangesTools,
  ...tocTools,
  ...footnotesTools,
  ...findTools,
];

/**
 * Word CREATE tools — high-level section builders + lifecycle tools
 * Used by the Word Create Agent
 */
export const WORD_CREATE_TOOLS: LLMSimpleTool[] = [
  wordCreateTool,
  wordSaveTool,
  wordScreenshotTool,
  wordSetPageMarginsTool,
  wordInsertHeaderTool,
  wordInsertFooterTool,
  wordInsertPageNumberTool,
  ...sectionBuilderTools,
];
