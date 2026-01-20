/**
 * Excel Tools - Barrel Export
 *
 * Re-exports all Excel tool modules and provides unified EXCEL_TOOLS array
 * Total: 62 tools
 */

// Domain exports
export * from './launch';
export * from './cells';
export * from './formatting';
export * from './sheets';
export * from './rows-columns';
export * from './charts';
export * from './validation';
export * from './named-ranges';
export * from './data-ops';
export * from './media';
export * from './comments';
export * from './protection';
export * from './export';

// Import tool arrays for unified export
import { launchTools } from './launch';
import { cellsTools } from './cells';
import { formattingTools } from './formatting';
import { sheetsTools } from './sheets';
import { rowsColumnsTools } from './rows-columns';
import { chartsTools } from './charts';
import { validationTools } from './validation';
import { namedRangesTools } from './named-ranges';
import { dataOpsTools } from './data-ops';
import { mediaTools } from './media';
import { commentsTools } from './comments';
import { protectionTools } from './protection';
import { exportTools } from './export';

/**
 * All Excel tools combined into a single array
 * Total: 62 tools
 *
 * - launchTools: 7 (launch, create, open, save, close, quit, screenshot)
 * - cellsTools: 5 (writeCell, readCell, writeRange, readRange, setFormula)
 * - formattingTools: 9 (setFont, setAlignment, setColumnWidth, setRowHeight, mergeCells, unmergeCells, setBorder, setFill, setNumberFormat)
 * - sheetsTools: 5 (addSheet, deleteSheet, renameSheet, getSheets, selectSheet)
 * - rowsColumnsTools: 13 (sortRange, insertRow, deleteRow, insertColumn, deleteColumn, hideColumn, showColumn, hideRow, showRow, groupRows, ungroupRows, freezePanes, autoFilter)
 * - chartsTools: 3 (addChart, setChartTitle, deleteChart)
 * - validationTools: 4 (addConditionalFormat, clearConditionalFormat, setDataValidation, clearDataValidation)
 * - namedRangesTools: 3 (createNamedRange, getNamedRanges, deleteNamedRange)
 * - dataOpsTools: 4 (copyRange, pasteRange, clearRange, findReplace)
 * - mediaTools: 2 (addImage, addHyperlink)
 * - commentsTools: 3 (addComment, getComment, deleteComment)
 * - protectionTools: 2 (protectSheet, unprotectSheet)
 * - exportTools: 2 (exportPDF, print)
 */
export const EXCEL_TOOLS = [
  ...launchTools,
  ...cellsTools,
  ...formattingTools,
  ...sheetsTools,
  ...rowsColumnsTools,
  ...chartsTools,
  ...validationTools,
  ...namedRangesTools,
  ...dataOpsTools,
  ...mediaTools,
  ...commentsTools,
  ...protectionTools,
  ...exportTools,
];
