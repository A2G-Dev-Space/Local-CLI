/**
 * Word Tools - Barrel Export
 *
 * Re-exports all Word tool modules and provides unified WORD_TOOLS array
 * Total: 76 tools across 20 categories
 */

// Domain exports
export * from './launch.js';
export * from './text.js';
export * from './formatting.js';
export * from './tables.js';
export * from './tables-advanced.js';
export * from './content.js';
export * from './lists.js';
export * from './headers-footers.js';
export * from './page-setup.js';
export * from './bookmarks.js';
export * from './comments.js';
export * from './watermarks.js';
export * from './navigation.js';
export * from './undo-redo.js';
export * from './export.js';
export * from './selection.js';
export * from './track-changes.js';
export * from './toc.js';
export * from './footnotes.js';
export * from './find.js';

// Import tool arrays for unified export
import { launchTools } from './launch.js';
import { textTools } from './text.js';
import { formattingTools } from './formatting.js';
import { tablesTools } from './tables.js';
import { tablesAdvancedTools } from './tables-advanced.js';
import { contentTools } from './content.js';
import { listsTools } from './lists.js';
import { headersFootersTools } from './headers-footers.js';
import { pageSetupTools } from './page-setup.js';
import { bookmarksTools } from './bookmarks.js';
import { commentsTools } from './comments.js';
import { watermarksTools } from './watermarks.js';
import { navigationTools } from './navigation.js';
import { undoRedoTools } from './undo-redo.js';
import { exportTools } from './export.js';
import { selectionTools } from './selection.js';
import { trackChangesTools } from './track-changes.js';
import { tocTools } from './toc.js';
import { footnotesTools } from './footnotes.js';
import { findTools } from './find.js';

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
