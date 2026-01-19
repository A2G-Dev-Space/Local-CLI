/**
 * Word Tools - Barrel Export
 *
 * Re-exports all Word tool modules and provides unified WORD_TOOLS array
 */

// Domain exports
export * from './launch.js';
export * from './text.js';
export * from './formatting.js';
export * from './tables.js';
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

// Import tool arrays for unified export
import { launchTools } from './launch.js';
import { textTools } from './text.js';
import { formattingTools } from './formatting.js';
import { tablesTools } from './tables.js';
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

/**
 * All Word tools combined into a single array
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
