/**
 * Word Tools - Barrel Export
 *
 * Re-exports all Word tool modules and provides unified WORD_TOOLS array
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
