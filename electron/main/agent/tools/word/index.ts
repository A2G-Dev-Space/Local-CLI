/**
 * Word Tools - Barrel Export
 *
 * Re-exports all Word tool modules and provides unified WORD_TOOLS array
 * Total: 52 tools
 */

// Domain exports
export * from './launch';
export * from './text';
export * from './formatting';
export * from './tables';
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

// Import tool arrays for unified export
import { launchTools } from './launch';
import { textTools } from './text';
import { formattingTools } from './formatting';
import { tablesTools } from './tables';
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

/**
 * All Word tools combined into a single array
 * Total: 52 tools
 *
 * - launchTools: 7 (launch, create, open, save, close, quit, screenshot)
 * - textTools: 3 (write, read, deleteText)
 * - formattingTools: 3 (setFont, setParagraph, setStyle)
 * - tablesTools: 5 (addTable, setTableCell, mergeTableCells, setTableStyle, setTableBorder)
 * - contentTools: 6 (addImage, addHyperlink, findReplace, insertBreak, addTextbox, addShape)
 * - listsTools: 2 (createBulletList, createNumberedList)
 * - headersFootersTools: 3 (insertHeader, insertFooter, insertPageNumber)
 * - pageSetupTools: 4 (setPageMargins, setPageOrientation, setPageSize, setColumns)
 * - bookmarksTools: 4 (addBookmark, getBookmarks, deleteBookmark, gotoBookmark)
 * - commentsTools: 4 (addComment, getComments, deleteComment, deleteAllComments)
 * - watermarksTools: 2 (addWatermark, removeWatermark)
 * - navigationTools: 4 (getSelection, selectAll, goto, getSelectedText)
 * - undoRedoTools: 2 (undo, redo)
 * - exportTools: 3 (exportToPDF, print, getDocumentInfo)
 */
export const WORD_TOOLS = [
  ...launchTools,
  ...textTools,
  ...formattingTools,
  ...tablesTools,
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
];
