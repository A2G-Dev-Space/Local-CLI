/**
 * Office Automation Client (Composite)
 *
 * Provides a unified interface for all Office automation clients.
 * This is a facade that delegates to specialized clients for each application.
 *
 * Architecture:
 * - OfficeClientBase: Common PowerShell execution and utilities
 * - WordClient: Microsoft Word operations
 * - ExcelClient: Microsoft Excel operations
 * - PowerPointClient: Microsoft PowerPoint operations
 * - OfficeClient: Composite that combines all of the above
 */

import { OfficeResponse, ScreenshotResponse } from './office-client-base';
import { WordClient } from './word-client';
import { ExcelClient } from './excel-client';
import { PowerPointClient } from './powerpoint-client';

/**
 * Composite Office Client
 *
 * Provides access to all Office applications through a single interface.
 * Maintains backward compatibility with existing code that uses officeClient.
 */
class OfficeClient {
  private wordClient: WordClient;
  private excelClient: ExcelClient;
  private powerpointClient: PowerPointClient;

  constructor() {
    this.wordClient = new WordClient();
    this.excelClient = new ExcelClient();
    this.powerpointClient = new PowerPointClient();
  }

  // ===========================================================================
  // Common
  // ===========================================================================

  async isAvailable(): Promise<boolean> {
    return this.wordClient.isAvailable();
  }

  // ===========================================================================
  // Word (delegate to WordClient)
  // ===========================================================================

  wordLaunch = () => this.wordClient.wordLaunch();
  wordCreate = () => this.wordClient.wordCreate();
  wordWrite = (text: string, options?: Parameters<WordClient['wordWrite']>[1]) =>
    this.wordClient.wordWrite(text, options);
  wordRead = () => this.wordClient.wordRead();
  wordSave = (filePath?: string) => this.wordClient.wordSave(filePath);
  wordOpen = (filePath: string) => this.wordClient.wordOpen(filePath);
  wordClose = (save?: boolean) => this.wordClient.wordClose(save);
  wordQuit = (save?: boolean) => this.wordClient.wordQuit(save);
  wordSetFont = (options: Parameters<WordClient['wordSetFont']>[0]) =>
    this.wordClient.wordSetFont(options);
  wordSetParagraph = (options: Parameters<WordClient['wordSetParagraph']>[0]) =>
    this.wordClient.wordSetParagraph(options);
  wordAddHyperlink = (text: string, url: string) =>
    this.wordClient.wordAddHyperlink(text, url);
  wordAddTable = (rows: number, cols: number, data?: string[][]) =>
    this.wordClient.wordAddTable(rows, cols, data);
  wordAddImage = (imagePath: string, width?: number, height?: number) =>
    this.wordClient.wordAddImage(imagePath, width, height);
  wordDeleteText = (start: number, end: number) =>
    this.wordClient.wordDeleteText(start, end);
  wordFindReplace = (find: string, replace: string, replaceAll?: boolean) =>
    this.wordClient.wordFindReplace(find, replace, replaceAll);
  wordSetStyle = (styleName: string) => this.wordClient.wordSetStyle(styleName);
  wordInsertBreak = (breakType?: 'page' | 'line' | 'section') =>
    this.wordClient.wordInsertBreak(breakType);
  wordGetSelection = () => this.wordClient.wordGetSelection();
  wordSelectAll = () => this.wordClient.wordSelectAll();
  wordGoto = (what: 'page' | 'line' | 'bookmark', target: number | string) =>
    this.wordClient.wordGoto(what, target);
  wordInsertHeader = (text: string, options?: Parameters<WordClient['wordInsertHeader']>[1]) =>
    this.wordClient.wordInsertHeader(text, options);
  wordInsertFooter = (text: string, options?: Parameters<WordClient['wordInsertFooter']>[1]) =>
    this.wordClient.wordInsertFooter(text, options);
  wordInsertPageNumber = (alignment?: 'left' | 'center' | 'right') =>
    this.wordClient.wordInsertPageNumber(alignment);
  wordExportToPDF = (outputPath: string) => this.wordClient.wordExportToPDF(outputPath);
  wordPrint = (copies?: number) => this.wordClient.wordPrint(copies);
  wordScreenshot = () => this.wordClient.wordScreenshot();
  wordSetTableCell = (...args: Parameters<WordClient['wordSetTableCell']>) =>
    this.wordClient.wordSetTableCell(...args);
  wordMergeTableCells = (...args: Parameters<WordClient['wordMergeTableCells']>) =>
    this.wordClient.wordMergeTableCells(...args);
  wordSetTableStyle = (tableIndex: number, styleName: string) =>
    this.wordClient.wordSetTableStyle(tableIndex, styleName);
  wordSetTableBorder = (...args: Parameters<WordClient['wordSetTableBorder']>) =>
    this.wordClient.wordSetTableBorder(...args);
  wordAddBookmark = (name: string, text?: string) =>
    this.wordClient.wordAddBookmark(name, text);
  wordGetBookmarks = () => this.wordClient.wordGetBookmarks();
  wordDeleteBookmark = (name: string) => this.wordClient.wordDeleteBookmark(name);
  wordGotoBookmark = (name: string) => this.wordClient.wordGotoBookmark(name);
  wordAddComment = (commentText: string, author?: string) =>
    this.wordClient.wordAddComment(commentText, author);
  wordGetComments = () => this.wordClient.wordGetComments();
  wordDeleteComment = (index: number) => this.wordClient.wordDeleteComment(index);
  wordDeleteAllComments = () => this.wordClient.wordDeleteAllComments();
  wordCreateBulletList = (items: string[]) => this.wordClient.wordCreateBulletList(items);
  wordCreateNumberedList = (items: string[]) => this.wordClient.wordCreateNumberedList(items);
  wordSetPageMargins = (options: Parameters<WordClient['wordSetPageMargins']>[0]) =>
    this.wordClient.wordSetPageMargins(options);
  wordSetPageOrientation = (orientation: 'portrait' | 'landscape') =>
    this.wordClient.wordSetPageOrientation(orientation);
  wordSetPageSize = (...args: Parameters<WordClient['wordSetPageSize']>) =>
    this.wordClient.wordSetPageSize(...args);
  wordAddWatermark = (text: string, options?: Parameters<WordClient['wordAddWatermark']>[1]) =>
    this.wordClient.wordAddWatermark(text, options);
  wordRemoveWatermark = () => this.wordClient.wordRemoveWatermark();
  wordAddTextbox = (...args: Parameters<WordClient['wordAddTextbox']>) =>
    this.wordClient.wordAddTextbox(...args);
  wordAddShape = (...args: Parameters<WordClient['wordAddShape']>) =>
    this.wordClient.wordAddShape(...args);
  wordGetDocumentInfo = () => this.wordClient.wordGetDocumentInfo();
  wordSetColumns = (count: number, spacing?: number) =>
    this.wordClient.wordSetColumns(count, spacing);
  wordUndo = (times?: number) => this.wordClient.wordUndo(times);
  wordRedo = (times?: number) => this.wordClient.wordRedo(times);
  wordGetSelectedText = () => this.wordClient.wordGetSelectedText();

  // ===========================================================================
  // Excel (delegate to ExcelClient)
  // ===========================================================================

  excelLaunch = () => this.excelClient.excelLaunch();
  excelCreate = () => this.excelClient.excelCreate();
  excelOpen = (filePath: string) => this.excelClient.excelOpen(filePath);
  excelWriteCell = (...args: Parameters<ExcelClient['excelWriteCell']>) =>
    this.excelClient.excelWriteCell(...args);
  excelReadCell = (cell: string, sheet?: string) =>
    this.excelClient.excelReadCell(cell, sheet);
  excelWriteRange = (startCell: string, values: unknown[][], sheet?: string) =>
    this.excelClient.excelWriteRange(startCell, values, sheet);
  excelReadRange = (range: string, sheet?: string) =>
    this.excelClient.excelReadRange(range, sheet);
  excelSave = (filePath?: string) => this.excelClient.excelSave(filePath);
  excelClose = (save?: boolean) => this.excelClient.excelClose(save);
  excelQuit = (save?: boolean) => this.excelClient.excelQuit(save);
  excelSetFormula = (cell: string, formula: string, sheet?: string) =>
    this.excelClient.excelSetFormula(cell, formula, sheet);
  excelSetFont = (...args: Parameters<ExcelClient['excelSetFont']>) =>
    this.excelClient.excelSetFont(...args);
  excelSetAlignment = (...args: Parameters<ExcelClient['excelSetAlignment']>) =>
    this.excelClient.excelSetAlignment(...args);
  excelSetColumnWidth = (...args: Parameters<ExcelClient['excelSetColumnWidth']>) =>
    this.excelClient.excelSetColumnWidth(...args);
  excelSetRowHeight = (...args: Parameters<ExcelClient['excelSetRowHeight']>) =>
    this.excelClient.excelSetRowHeight(...args);
  excelMergeCells = (range: string, sheet?: string) =>
    this.excelClient.excelMergeCells(range, sheet);
  excelSetBorder = (...args: Parameters<ExcelClient['excelSetBorder']>) =>
    this.excelClient.excelSetBorder(...args);
  excelSetFill = (range: string, color: string, sheet?: string) =>
    this.excelClient.excelSetFill(range, color, sheet);
  excelSetNumberFormat = (range: string, format: string, sheet?: string) =>
    this.excelClient.excelSetNumberFormat(range, format, sheet);
  excelAddSheet = (name?: string, position?: 'start' | 'end' | string) =>
    this.excelClient.excelAddSheet(name, position);
  excelDeleteSheet = (name: string) => this.excelClient.excelDeleteSheet(name);
  excelRenameSheet = (oldName: string, newName: string) =>
    this.excelClient.excelRenameSheet(oldName, newName);
  excelGetSheets = () => this.excelClient.excelGetSheets();
  excelSortRange = (...args: Parameters<ExcelClient['excelSortRange']>) =>
    this.excelClient.excelSortRange(...args);
  excelInsertRow = (row: number, count?: number, sheet?: string) =>
    this.excelClient.excelInsertRow(row, count, sheet);
  excelDeleteRow = (row: number, count?: number, sheet?: string) =>
    this.excelClient.excelDeleteRow(row, count, sheet);
  excelInsertColumn = (column: string, count?: number, sheet?: string) =>
    this.excelClient.excelInsertColumn(column, count, sheet);
  excelDeleteColumn = (column: string, count?: number, sheet?: string) =>
    this.excelClient.excelDeleteColumn(column, count, sheet);
  excelFreezePanes = (row?: number, column?: string, sheet?: string) =>
    this.excelClient.excelFreezePanes(row, column, sheet);
  excelAutoFilter = (range: string, sheet?: string) =>
    this.excelClient.excelAutoFilter(range, sheet);
  excelScreenshot = () => this.excelClient.excelScreenshot();
  excelAddChart = (...args: Parameters<ExcelClient['excelAddChart']>) =>
    this.excelClient.excelAddChart(...args);
  excelSetChartTitle = (chartIndex: number, title: string, sheet?: string) =>
    this.excelClient.excelSetChartTitle(chartIndex, title, sheet);
  excelDeleteChart = (chartIndex: number, sheet?: string) =>
    this.excelClient.excelDeleteChart(chartIndex, sheet);
  excelAddConditionalFormat = (...args: Parameters<ExcelClient['excelAddConditionalFormat']>) =>
    this.excelClient.excelAddConditionalFormat(...args);
  excelClearConditionalFormat = (range: string, sheet?: string) =>
    this.excelClient.excelClearConditionalFormat(range, sheet);
  excelSetDataValidation = (...args: Parameters<ExcelClient['excelSetDataValidation']>) =>
    this.excelClient.excelSetDataValidation(...args);
  excelClearDataValidation = (range: string, sheet?: string) =>
    this.excelClient.excelClearDataValidation(range, sheet);
  excelCreateNamedRange = (name: string, range: string, sheet?: string) =>
    this.excelClient.excelCreateNamedRange(name, range, sheet);
  excelGetNamedRanges = () => this.excelClient.excelGetNamedRanges();
  excelDeleteNamedRange = (name: string) => this.excelClient.excelDeleteNamedRange(name);
  excelCopyRange = (range: string, sheet?: string) =>
    this.excelClient.excelCopyRange(range, sheet);
  excelPasteRange = (destination: string, sheet?: string) =>
    this.excelClient.excelPasteRange(destination, sheet);
  excelClearRange = (...args: Parameters<ExcelClient['excelClearRange']>) =>
    this.excelClient.excelClearRange(...args);
  excelHideColumn = (column: string, sheet?: string) =>
    this.excelClient.excelHideColumn(column, sheet);
  excelShowColumn = (column: string, sheet?: string) =>
    this.excelClient.excelShowColumn(column, sheet);
  excelHideRow = (row: number, sheet?: string) =>
    this.excelClient.excelHideRow(row, sheet);
  excelShowRow = (row: number, sheet?: string) =>
    this.excelClient.excelShowRow(row, sheet);
  excelAddImage = (...args: Parameters<ExcelClient['excelAddImage']>) =>
    this.excelClient.excelAddImage(...args);
  excelAddHyperlink = (...args: Parameters<ExcelClient['excelAddHyperlink']>) =>
    this.excelClient.excelAddHyperlink(...args);
  excelExportPDF = (outputPath: string, sheet?: string) =>
    this.excelClient.excelExportPDF(outputPath, sheet);
  excelPrint = (copies?: number, sheet?: string) =>
    this.excelClient.excelPrint(copies, sheet);
  excelAddComment = (cell: string, text: string, author?: string, sheet?: string) =>
    this.excelClient.excelAddComment(cell, text, author, sheet);
  excelGetComment = (cell: string, sheet?: string) =>
    this.excelClient.excelGetComment(cell, sheet);
  excelDeleteComment = (cell: string, sheet?: string) =>
    this.excelClient.excelDeleteComment(cell, sheet);
  excelProtectSheet = (password?: string, sheet?: string) =>
    this.excelClient.excelProtectSheet(password, sheet);
  excelUnprotectSheet = (password?: string, sheet?: string) =>
    this.excelClient.excelUnprotectSheet(password, sheet);
  excelUnmergeCells = (range: string, sheet?: string) =>
    this.excelClient.excelUnmergeCells(range, sheet);
  excelSelectSheet = (name: string) => this.excelClient.excelSelectSheet(name);
  excelFindReplace = (...args: Parameters<ExcelClient['excelFindReplace']>) =>
    this.excelClient.excelFindReplace(...args);
  excelGroupRows = (startRow: number, endRow: number, sheet?: string) =>
    this.excelClient.excelGroupRows(startRow, endRow, sheet);
  excelUngroupRows = (startRow: number, endRow: number, sheet?: string) =>
    this.excelClient.excelUngroupRows(startRow, endRow, sheet);

  // ===========================================================================
  // PowerPoint (delegate to PowerPointClient)
  // ===========================================================================

  powerpointLaunch = () => this.powerpointClient.powerpointLaunch();
  powerpointCreate = () => this.powerpointClient.powerpointCreate();
  powerpointOpen = (filePath: string) => this.powerpointClient.powerpointOpen(filePath);
  powerpointAddSlide = (layout?: number) => this.powerpointClient.powerpointAddSlide(layout);
  powerpointDeleteSlide = (slideNumber: number) =>
    this.powerpointClient.powerpointDeleteSlide(slideNumber);
  powerpointMoveSlide = (fromIndex: number, toIndex: number) =>
    this.powerpointClient.powerpointMoveSlide(fromIndex, toIndex);
  powerpointWriteText = (...args: Parameters<PowerPointClient['powerpointWriteText']>) =>
    this.powerpointClient.powerpointWriteText(...args);
  powerpointReadSlide = (slideNumber: number) =>
    this.powerpointClient.powerpointReadSlide(slideNumber);
  powerpointAddTextbox = (...args: Parameters<PowerPointClient['powerpointAddTextbox']>) =>
    this.powerpointClient.powerpointAddTextbox(...args);
  powerpointSetFont = (...args: Parameters<PowerPointClient['powerpointSetFont']>) =>
    this.powerpointClient.powerpointSetFont(...args);
  powerpointAddImage = (...args: Parameters<PowerPointClient['powerpointAddImage']>) =>
    this.powerpointClient.powerpointAddImage(...args);
  powerpointAddShape = (...args: Parameters<PowerPointClient['powerpointAddShape']>) =>
    this.powerpointClient.powerpointAddShape(...args);
  powerpointAddAnimation = (...args: Parameters<PowerPointClient['powerpointAddAnimation']>) =>
    this.powerpointClient.powerpointAddAnimation(...args);
  powerpointSetTransition = (...args: Parameters<PowerPointClient['powerpointSetTransition']>) =>
    this.powerpointClient.powerpointSetTransition(...args);
  powerpointSetBackground = (...args: Parameters<PowerPointClient['powerpointSetBackground']>) =>
    this.powerpointClient.powerpointSetBackground(...args);
  powerpointGetSlideCount = () => this.powerpointClient.powerpointGetSlideCount();
  powerpointSave = (filePath?: string) => this.powerpointClient.powerpointSave(filePath);
  powerpointExportToPDF = (outputPath: string) =>
    this.powerpointClient.powerpointExportToPDF(outputPath);
  powerpointStartSlideshow = (fromSlide?: number) =>
    this.powerpointClient.powerpointStartSlideshow(fromSlide);
  powerpointClose = (save?: boolean) => this.powerpointClient.powerpointClose(save);
  powerpointQuit = (save?: boolean) => this.powerpointClient.powerpointQuit(save);
  powerpointScreenshot = () => this.powerpointClient.powerpointScreenshot();
  powerpointAddTable = (...args: Parameters<PowerPointClient['powerpointAddTable']>) =>
    this.powerpointClient.powerpointAddTable(...args);
  powerpointSetTableCell = (...args: Parameters<PowerPointClient['powerpointSetTableCell']>) =>
    this.powerpointClient.powerpointSetTableCell(...args);
  powerpointSetTableStyle = (...args: Parameters<PowerPointClient['powerpointSetTableStyle']>) =>
    this.powerpointClient.powerpointSetTableStyle(...args);
  powerpointDeleteShape = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointDeleteShape(slideNumber, shapeIndex);
  powerpointDuplicateShape = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointDuplicateShape(slideNumber, shapeIndex);
  powerpointRotateShape = (slideNumber: number, shapeIndex: number, angle: number) =>
    this.powerpointClient.powerpointRotateShape(slideNumber, shapeIndex, angle);
  powerpointGetShapeInfo = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointGetShapeInfo(slideNumber, shapeIndex);
  powerpointSetShapeName = (slideNumber: number, shapeIndex: number, name: string) =>
    this.powerpointClient.powerpointSetShapeName(slideNumber, shapeIndex, name);
  powerpointSetShapeOpacity = (slideNumber: number, shapeIndex: number, opacity: number) =>
    this.powerpointClient.powerpointSetShapeOpacity(slideNumber, shapeIndex, opacity);
  powerpointGetShapeList = (slideNumber: number) =>
    this.powerpointClient.powerpointGetShapeList(slideNumber);
  powerpointSetShapePosition = (...args: Parameters<PowerPointClient['powerpointSetShapePosition']>) =>
    this.powerpointClient.powerpointSetShapePosition(...args);
  powerpointSetShapeSize = (...args: Parameters<PowerPointClient['powerpointSetShapeSize']>) =>
    this.powerpointClient.powerpointSetShapeSize(...args);
  powerpointSetShapeStyle = (...args: Parameters<PowerPointClient['powerpointSetShapeStyle']>) =>
    this.powerpointClient.powerpointSetShapeStyle(...args);
  powerpointBringToFront = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointBringToFront(slideNumber, shapeIndex);
  powerpointSendToBack = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointSendToBack(slideNumber, shapeIndex);
  powerpointBringForward = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointBringForward(slideNumber, shapeIndex);
  powerpointSendBackward = (slideNumber: number, shapeIndex: number) =>
    this.powerpointClient.powerpointSendBackward(slideNumber, shapeIndex);
  powerpointAlignShapes = (...args: Parameters<PowerPointClient['powerpointAlignShapes']>) =>
    this.powerpointClient.powerpointAlignShapes(...args);
  powerpointDistributeShapes = (...args: Parameters<PowerPointClient['powerpointDistributeShapes']>) =>
    this.powerpointClient.powerpointDistributeShapes(...args);
  powerpointSetSlideLayout = (slideNumber: number, layoutIndex: number) =>
    this.powerpointClient.powerpointSetSlideLayout(slideNumber, layoutIndex);
  powerpointDuplicateSlide = (slideNumber: number) =>
    this.powerpointClient.powerpointDuplicateSlide(slideNumber);
  powerpointHideSlide = (slideNumber: number) =>
    this.powerpointClient.powerpointHideSlide(slideNumber);
  powerpointShowSlide = (slideNumber: number) =>
    this.powerpointClient.powerpointShowSlide(slideNumber);
  powerpointAddSection = (sectionName: string, beforeSlide: number) =>
    this.powerpointClient.powerpointAddSection(sectionName, beforeSlide);
  powerpointDeleteSection = (sectionIndex: number, deleteSlides?: boolean) =>
    this.powerpointClient.powerpointDeleteSection(sectionIndex, deleteSlides);
  powerpointGetSections = () => this.powerpointClient.powerpointGetSections();
  powerpointAddNote = (slideNumber: number, noteText: string) =>
    this.powerpointClient.powerpointAddNote(slideNumber, noteText);
  powerpointGetNote = (slideNumber: number) =>
    this.powerpointClient.powerpointGetNote(slideNumber);
  powerpointGroupShapes = (slideNumber: number, shapeIndices: number[]) =>
    this.powerpointClient.powerpointGroupShapes(slideNumber, shapeIndices);
  powerpointUngroupShapes = (slideNumber: number, groupIndex: number) =>
    this.powerpointClient.powerpointUngroupShapes(slideNumber, groupIndex);
  powerpointSetTextAlignment = (...args: Parameters<PowerPointClient['powerpointSetTextAlignment']>) =>
    this.powerpointClient.powerpointSetTextAlignment(...args);
  powerpointSetBulletList = (...args: Parameters<PowerPointClient['powerpointSetBulletList']>) =>
    this.powerpointClient.powerpointSetBulletList(...args);
  powerpointSetLineSpacing = (...args: Parameters<PowerPointClient['powerpointSetLineSpacing']>) =>
    this.powerpointClient.powerpointSetLineSpacing(...args);
  powerpointSetTextboxBorder = (...args: Parameters<PowerPointClient['powerpointSetTextboxBorder']>) =>
    this.powerpointClient.powerpointSetTextboxBorder(...args);
  powerpointSetTextboxFill = (...args: Parameters<PowerPointClient['powerpointSetTextboxFill']>) =>
    this.powerpointClient.powerpointSetTextboxFill(...args);
  powerpointAddHyperlink = (...args: Parameters<PowerPointClient['powerpointAddHyperlink']>) =>
    this.powerpointClient.powerpointAddHyperlink(...args);
  powerpointAddVideo = (...args: Parameters<PowerPointClient['powerpointAddVideo']>) =>
    this.powerpointClient.powerpointAddVideo(...args);
  powerpointAddAudio = (...args: Parameters<PowerPointClient['powerpointAddAudio']>) =>
    this.powerpointClient.powerpointAddAudio(...args);
  powerpointAddChart = (...args: Parameters<PowerPointClient['powerpointAddChart']>) =>
    this.powerpointClient.powerpointAddChart(...args);
  powerpointSetShadow = (...args: Parameters<PowerPointClient['powerpointSetShadow']>) =>
    this.powerpointClient.powerpointSetShadow(...args);
  powerpointSetReflection = (...args: Parameters<PowerPointClient['powerpointSetReflection']>) =>
    this.powerpointClient.powerpointSetReflection(...args);
  powerpointApplyTheme = (themePath: string) =>
    this.powerpointClient.powerpointApplyTheme(themePath);
  powerpointGetThemes = () => this.powerpointClient.powerpointGetThemes();
  powerpointSetPlaceholderText = (...args: Parameters<PowerPointClient['powerpointSetPlaceholderText']>) =>
    this.powerpointClient.powerpointSetPlaceholderText(...args);
  powerpointGetPlaceholders = (slideNumber: number) =>
    this.powerpointClient.powerpointGetPlaceholders(slideNumber);
  powerpointGetSlideLayouts = () => this.powerpointClient.powerpointGetSlideLayouts();
}

// Export singleton instance
export const officeClient = new OfficeClient();
export type { OfficeResponse, ScreenshotResponse };
