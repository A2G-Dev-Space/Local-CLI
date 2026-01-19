/**
 * Office Common Types
 *
 * Shared type definitions for Office tools (Word, Excel, PowerPoint)
 */

// Re-export from tools/types.js for convenience
export type { ToolResult, ToolCategory, LLMSimpleTool } from '../../types.js';

// Re-export from office-client-base.js
export type { OfficeResponse, ScreenshotResponse } from '../office-client-base.js';

// =============================================================================
// Alignment Types
// =============================================================================

/**
 * Horizontal alignment options (common across Word, Excel, PowerPoint)
 */
export type HorizontalAlignment = 'left' | 'center' | 'right' | 'justify';

/**
 * Vertical alignment options (common across Excel, PowerPoint)
 */
export type VerticalAlignment = 'top' | 'center' | 'middle' | 'bottom';

/**
 * Shape alignment options (PowerPoint)
 */
export type ShapeAlignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

// =============================================================================
// Font Options Types
// =============================================================================

/**
 * Common font options used across Office applications
 */
export interface FontOptions {
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
}

/**
 * Extended font options with strikethrough
 */
export interface ExtendedFontOptions extends FontOptions {
  strikethrough?: boolean;
}

// =============================================================================
// Color Types
// =============================================================================

/**
 * RGB color representation
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

// =============================================================================
// Excel-specific Types
// =============================================================================

/**
 * Excel cell alignment options
 */
export interface ExcelAlignmentOptions {
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'center' | 'bottom';
  wrapText?: boolean;
  orientation?: number;
}

/**
 * Excel border style options
 */
export type ExcelBorderStyle = 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed';

/**
 * Excel border edge options
 */
export type ExcelBorderEdge = 'left' | 'right' | 'top' | 'bottom' | 'all';

/**
 * Excel border options
 */
export interface ExcelBorderOptions {
  style?: ExcelBorderStyle;
  color?: string;
  edges?: ExcelBorderEdge[];
}

/**
 * Excel chart types
 */
export type ExcelChartType = 'column' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut';

/**
 * Excel conditional format types
 */
export type ExcelConditionalFormatType = 'cellValue' | 'colorScale' | 'dataBar' | 'iconSet' | 'duplicates' | 'top10';

/**
 * Excel comparison operators
 */
export type ExcelComparisonOperator = 'greater' | 'less' | 'equal' | 'between' | 'notBetween';

/**
 * Excel validation types
 */
export type ExcelValidationType = 'list' | 'whole' | 'decimal' | 'date' | 'textLength' | 'custom';

/**
 * Excel validation operators
 */
export type ExcelValidationOperator = 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greater' | 'less' | 'greaterEqual' | 'lessEqual';

/**
 * Excel clear range types
 */
export type ExcelClearType = 'all' | 'contents' | 'formats' | 'comments';

// =============================================================================
// PowerPoint-specific Types
// =============================================================================

/**
 * PowerPoint shape types
 */
export type PowerPointShapeType =
  | 'rectangle'
  | 'rounded_rectangle'
  | 'oval'
  | 'diamond'
  | 'triangle'
  | 'right_triangle'
  | 'pentagon'
  | 'hexagon'
  | 'arrow_right'
  | 'arrow_left'
  | 'arrow_up'
  | 'arrow_down'
  | 'star_5'
  | 'star_6'
  | 'heart'
  | 'lightning'
  | 'callout';

/**
 * PowerPoint animation effect types
 */
export type PowerPointAnimationEffect =
  | 'appear'
  | 'fade'
  | 'fly_in'
  | 'float_in'
  | 'split'
  | 'wipe'
  | 'shape'
  | 'wheel'
  | 'random_bars'
  | 'grow_and_turn'
  | 'zoom'
  | 'swivel'
  | 'bounce';

/**
 * PowerPoint transition types
 */
export type PowerPointTransitionType =
  | 'none'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'split'
  | 'reveal'
  | 'random_bars'
  | 'shape'
  | 'uncover'
  | 'cover'
  | 'flash';

/**
 * PowerPoint chart types (same as Excel)
 */
export type PowerPointChartType = ExcelChartType;

/**
 * PowerPoint distribution options
 */
export type PowerPointDistribution = 'horizontal' | 'vertical';

// =============================================================================
// Word-specific Types
// =============================================================================

/**
 * Word paragraph alignment options
 */
export type WordParagraphAlignment = 'left' | 'center' | 'right' | 'justify';

/**
 * Word break types
 */
export type WordBreakType = 'page' | 'line' | 'section';

/**
 * Word page orientation
 */
export type WordPageOrientation = 'portrait' | 'landscape';

/**
 * Word navigation target types
 */
export type WordGotoWhat = 'page' | 'line' | 'bookmark';

/**
 * Word shape types (same as PowerPoint)
 */
export type WordShapeType = PowerPointShapeType;

// =============================================================================
// Common Option Interfaces
// =============================================================================

/**
 * Position options (x, y coordinates)
 */
export interface PositionOptions {
  left?: number;
  top?: number;
}

/**
 * Size options (width, height)
 */
export interface SizeOptions {
  width?: number;
  height?: number;
}

/**
 * Combined position and size options
 */
export interface BoundsOptions extends PositionOptions, SizeOptions {}

/**
 * Page margin options
 */
export interface PageMarginOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Shadow effect options
 */
export interface ShadowOptions {
  visible?: boolean;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  color?: string;
  transparency?: number;
}

/**
 * Reflection effect options
 */
export interface ReflectionOptions {
  visible?: boolean;
  size?: number;
  transparency?: number;
  offset?: number;
  blur?: number;
}
