/**
 * Office Client Module Index
 *
 * Exports all Office automation clients for Electron (Windows Native).
 * Total: 193 methods (Word: 52, Excel: 62, PowerPoint: 79)
 */

// Base class and types
export {
  OfficeClientBase,
  type OfficeResponse,
  type ScreenshotResponse,
} from './office-client-base';

// Word Client (52 methods)
export { WordClient, wordClient } from './word-client';

// Excel Client (62 methods)
export { ExcelClient, excelClient } from './excel-client';

// PowerPoint Client (79 methods)
export { PowerPointClient, powerpointClient } from './powerpoint-client';
