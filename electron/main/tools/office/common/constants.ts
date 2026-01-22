/**
 * Office Common Constants
 *
 * Shared constants for Office tools (Word, Excel, PowerPoint)
 */

import * as path from 'path';
import { LOCAL_HOME_DIR } from '../../../constants';
import { ToolCategory } from '../../types';

// =============================================================================
// Directory Constants
// =============================================================================

/**
 * Directory for storing Office screenshots
 */
export const OFFICE_SCREENSHOT_DIR = path.join(LOCAL_HOME_DIR, 'screenshots', 'office');

/**
 * User-friendly path description for screenshots
 */
export const OFFICE_SCREENSHOT_PATH_DESC = '~/.local-cli/screenshots/office/';

// =============================================================================
// Tool Category Constants
// =============================================================================

/**
 * Default categories for Office tools
 */
export const OFFICE_CATEGORIES: ToolCategory[] = ['llm-simple'];

// =============================================================================
// Word Alignment Constants
// =============================================================================

/**
 * Word paragraph alignment values (wdParagraphAlignment)
 */
export const WORD_PARAGRAPH_ALIGNMENT = {
  left: 0,      // wdAlignParagraphLeft
  center: 1,    // wdAlignParagraphCenter
  right: 2,     // wdAlignParagraphRight
  justify: 3,   // wdAlignParagraphJustify
} as const;

/**
 * Word page number alignment values (wdPageNumberAlignment)
 */
export const WORD_PAGE_NUMBER_ALIGNMENT = {
  left: 0,      // wdAlignPageNumberLeft
  center: 1,    // wdAlignPageNumberCenter
  right: 2,     // wdAlignPageNumberRight
} as const;

// =============================================================================
// Excel Alignment Constants
// =============================================================================

/**
 * Excel horizontal alignment values (xlHAlign)
 */
export const EXCEL_HORIZONTAL_ALIGNMENT = {
  left: -4131,    // xlLeft
  center: -4108,  // xlCenter
  right: -4152,   // xlRight
} as const;

/**
 * Excel vertical alignment values (xlVAlign)
 */
export const EXCEL_VERTICAL_ALIGNMENT = {
  top: -4160,     // xlTop
  center: -4108,  // xlCenter
  bottom: -4107,  // xlBottom
} as const;

// =============================================================================
// PowerPoint Alignment Constants
// =============================================================================

/**
 * PowerPoint text horizontal alignment values (ppParagraphAlignment)
 */
export const POWERPOINT_HORIZONTAL_ALIGNMENT = {
  left: 1,      // ppAlignLeft
  center: 2,    // ppAlignCenter
  right: 3,     // ppAlignRight
  justify: 4,   // ppAlignJustify
} as const;

/**
 * PowerPoint text vertical alignment values (msoVerticalAnchor)
 */
export const POWERPOINT_VERTICAL_ALIGNMENT = {
  top: 1,       // msoAnchorTop
  middle: 3,    // msoAnchorMiddle
  bottom: 4,    // msoAnchorBottom
} as const;

/**
 * PowerPoint shape alignment values (msoAlignCmd)
 */
export const POWERPOINT_SHAPE_ALIGNMENT = {
  left: 0,      // msoAlignLefts
  center: 1,    // msoAlignCenters
  right: 2,     // msoAlignRights
  top: 3,       // msoAlignTops
  middle: 4,    // msoAlignMiddles
  bottom: 5,    // msoAlignBottoms
} as const;

/**
 * PowerPoint shape distribution values (msoDistributeCmd)
 */
export const POWERPOINT_DISTRIBUTE = {
  horizontal: 0,  // msoDistributeHorizontally
  vertical: 1,    // msoDistributeVertically
} as const;

// =============================================================================
// Excel Chart Type Constants
// =============================================================================

/**
 * Excel chart types (xlChartType)
 */
export const EXCEL_CHART_TYPES = {
  column: 51,      // xlColumnClustered
  bar: 57,         // xlBarClustered
  line: 4,         // xlLine
  pie: 5,          // xlPie
  area: 1,         // xlArea
  scatter: -4169,  // xlXYScatter
  doughnut: -4120, // xlDoughnut
} as const;

// =============================================================================
// Excel Border Constants
// =============================================================================

/**
 * Excel border line styles (xlLineStyle)
 */
export const EXCEL_BORDER_STYLES = {
  thin: 1,        // xlContinuous
  medium: 1,      // xlContinuous (weight differs)
  thick: 1,       // xlContinuous (weight differs)
  double: -4119,  // xlDouble
  dotted: -4118,  // xlDot
  dashed: -4115,  // xlDash
} as const;

/**
 * Excel border weights (xlBorderWeight)
 */
export const EXCEL_BORDER_WEIGHTS = {
  thin: 2,        // xlThin
  medium: -4138,  // xlMedium
  thick: 4,       // xlThick
  double: 2,      // xlThin
  dotted: 2,      // xlThin
  dashed: 2,      // xlThin
} as const;

/**
 * Excel border edge indices (xlBordersIndex)
 */
export const EXCEL_BORDER_EDGES = {
  left: 7,        // xlEdgeLeft
  right: 10,      // xlEdgeRight
  top: 8,         // xlEdgeTop
  bottom: 9,      // xlEdgeBottom
  all: -1,        // Special value for all borders
} as const;

// =============================================================================
// Excel Conditional Format Constants
// =============================================================================

/**
 * Excel conditional format types (xlFormatConditionType)
 */
export const EXCEL_CONDITION_TYPES = {
  cellValue: 1,   // xlCellValue
  colorScale: 3,  // xlColorScale
  dataBar: 4,     // xlDataBar
  iconSet: 6,     // xlIconSet
  duplicates: 8,  // xlUniqueValues
  top10: 5,       // xlTop10
} as const;

/**
 * Excel comparison operators (xlFormatConditionOperator)
 */
export const EXCEL_COMPARISON_OPERATORS = {
  greater: 5,     // xlGreater
  less: 6,        // xlLess
  equal: 3,       // xlEqual
  between: 1,     // xlBetween
  notBetween: 2,  // xlNotBetween
} as const;

// =============================================================================
// Excel Data Validation Constants
// =============================================================================

/**
 * Excel data validation types (xlDVType)
 */
export const EXCEL_VALIDATION_TYPES = {
  list: 3,        // xlValidateList
  whole: 1,       // xlValidateWholeNumber
  decimal: 2,     // xlValidateDecimal
  date: 4,        // xlValidateDate
  textLength: 6,  // xlValidateTextLength
  custom: 7,      // xlValidateCustom
} as const;

/**
 * Excel data validation operators (xlFormatConditionOperator)
 */
export const EXCEL_VALIDATION_OPERATORS = {
  between: 1,
  notBetween: 2,
  equal: 3,
  notEqual: 4,
  greater: 5,
  less: 6,
  greaterEqual: 7,
  lessEqual: 8,
} as const;

// =============================================================================
// PowerPoint Animation Constants
// =============================================================================

/**
 * PowerPoint animation effect types (msoAnimEffect)
 */
export const POWERPOINT_ANIMATION_EFFECTS = {
  appear: 1,            // msoAnimEffectAppear
  fade: 10,             // msoAnimEffectFade
  fly_in: 2,            // msoAnimEffectFly
  float_in: 42,         // msoAnimEffectFloat
  split: 21,            // msoAnimEffectSplit
  wipe: 22,             // msoAnimEffectWipe
  shape: 31,            // msoAnimEffectShape (Circle)
  wheel: 36,            // msoAnimEffectWheel
  random_bars: 15,      // msoAnimEffectRandomBars
  grow_and_turn: 26,    // msoAnimEffectGrowAndTurn
  zoom: 39,             // msoAnimEffectZoom
  swivel: 20,           // msoAnimEffectSwivel
  bounce: 25,           // msoAnimEffectBounce
} as const;

// =============================================================================
// PowerPoint Transition Constants
// =============================================================================

/**
 * PowerPoint slide transition types (ppEntryEffect)
 */
export const POWERPOINT_TRANSITION_TYPES = {
  none: 0,
  fade: 1197,           // ppEffectFade
  push: 1228,           // ppEffectPush
  wipe: 1212,           // ppEffectWipe
  split: 1217,          // ppEffectSplit
  reveal: 1204,         // ppEffectReveal
  random_bars: 1243,    // ppEffectRandomBars
  shape: 1221,          // ppEffectShape (circle)
  uncover: 1227,        // ppEffectUncover
  cover: 1218,          // ppEffectCover
  flash: 1248,          // ppEffectFlash
} as const;

// =============================================================================
// PowerPoint Shape Types
// =============================================================================

/**
 * PowerPoint AutoShape types (msoAutoShapeType)
 */
export const POWERPOINT_SHAPE_TYPES = {
  rectangle: 1,         // msoShapeRectangle
  rounded_rectangle: 5, // msoShapeRoundedRectangle
  oval: 9,              // msoShapeOval
  diamond: 4,           // msoShapeDiamond
  triangle: 7,          // msoShapeIsoscelesTriangle
  right_triangle: 6,    // msoShapeRightTriangle
  pentagon: 51,         // msoShapePentagon
  hexagon: 52,          // msoShapeHexagon
  arrow_right: 33,      // msoShapeRightArrow
  arrow_left: 34,       // msoShapeLeftArrow
  arrow_up: 35,         // msoShapeUpArrow
  arrow_down: 36,       // msoShapeDownArrow
  star_5: 12,           // msoShape5pointStar
  star_6: 58,           // msoShape6pointStar
  heart: 21,            // msoShapeHeart
  lightning: 22,        // msoShapeLightningBolt
  callout: 41,          // msoShapeRectangularCallout
} as const;

// =============================================================================
// PowerPoint Chart Type Constants
// =============================================================================

/**
 * PowerPoint chart types (xlChartType - same as Excel)
 */
export const POWERPOINT_CHART_TYPES = EXCEL_CHART_TYPES;

// =============================================================================
// Word Break Types
// =============================================================================

/**
 * Word break types (wdBreakType)
 */
export const WORD_BREAK_TYPES = {
  page: 7,        // wdPageBreak
  line: 6,        // wdLineBreak
  section: 2,     // wdSectionBreakNextPage
} as const;

// =============================================================================
// Word Shape Types
// =============================================================================

/**
 * Word AutoShape types (msoAutoShapeType) - same as PowerPoint
 */
export const WORD_SHAPE_TYPES = POWERPOINT_SHAPE_TYPES;
