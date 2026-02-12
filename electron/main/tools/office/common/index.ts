/**
 * Office Common Module
 *
 * Barrel export for shared utilities, constants, and types
 * used by Office tools (Word, Excel, PowerPoint)
 */

// =============================================================================
// Utilities
// =============================================================================

export {
  saveScreenshot,
  hexToRgb,
  hexToBgrColor,
  hasKoreanText,
  getRecommendedFont,
  escapePowerShellString,
  columnLetterToNumber,
  columnNumberToLetter,
} from './utils';

// =============================================================================
// Constants
// =============================================================================

export {
  OFFICE_CATEGORIES,

  // Word alignment constants
  WORD_PARAGRAPH_ALIGNMENT,
  WORD_PAGE_NUMBER_ALIGNMENT,
  WORD_BREAK_TYPES,
  WORD_SHAPE_TYPES,

  // Excel alignment constants
  EXCEL_HORIZONTAL_ALIGNMENT,
  EXCEL_VERTICAL_ALIGNMENT,

  // Excel chart constants
  EXCEL_CHART_TYPES,

  // Excel border constants
  EXCEL_BORDER_STYLES,
  EXCEL_BORDER_WEIGHTS,
  EXCEL_BORDER_EDGES,

  // Excel conditional format constants
  EXCEL_CONDITION_TYPES,
  EXCEL_COMPARISON_OPERATORS,

  // Excel validation constants
  EXCEL_VALIDATION_TYPES,
  EXCEL_VALIDATION_OPERATORS,

  // PowerPoint alignment constants
  POWERPOINT_HORIZONTAL_ALIGNMENT,
  POWERPOINT_VERTICAL_ALIGNMENT,
  POWERPOINT_SHAPE_ALIGNMENT,
  POWERPOINT_DISTRIBUTE,

  // PowerPoint animation/transition constants
  POWERPOINT_ANIMATION_EFFECTS,
  POWERPOINT_TRANSITION_TYPES,

  // PowerPoint shape/chart constants
  POWERPOINT_SHAPE_TYPES,
  POWERPOINT_CHART_TYPES,
} from './constants';

// =============================================================================
// Types
// =============================================================================

export type {
  // Re-exported from tools/types.js
  ToolResult,
  ToolCategory,
  LLMSimpleTool,

  // Re-exported from office-client-base.js
  OfficeResponse,
  ScreenshotResponse,

  // Alignment types
  HorizontalAlignment,
  VerticalAlignment,
  ShapeAlignment,

  // Font types
  FontOptions,
  ExtendedFontOptions,

  // Color types
  RgbColor,

  // Excel types
  ExcelAlignmentOptions,
  ExcelBorderStyle,
  ExcelBorderEdge,
  ExcelBorderOptions,
  ExcelChartType,
  ExcelConditionalFormatType,
  ExcelComparisonOperator,
  ExcelValidationType,
  ExcelValidationOperator,
  ExcelClearType,

  // PowerPoint types
  PowerPointShapeType,
  PowerPointAnimationEffect,
  PowerPointTransitionType,
  PowerPointChartType,
  PowerPointDistribution,

  // Word types
  WordParagraphAlignment,
  WordBreakType,
  WordPageOrientation,
  WordGotoWhat,
  WordShapeType,

  // Common option interfaces
  PositionOptions,
  SizeOptions,
  BoundsOptions,
  PageMarginOptions,
  ShadowOptions,
  ReflectionOptions,
} from './types';
