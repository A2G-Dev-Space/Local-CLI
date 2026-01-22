/**
 * PowerPoint Tools - Index
 *
 * Re-exports all PowerPoint domain tools and combines them into a single array.
 */

import { LLMSimpleTool } from '../../types';

// Re-export all domain modules
export * from './launch';
export * from './slides';
export * from './shapes';
export * from './text';
export * from './tables';
export * from './media';
export * from './effects';
export * from './sections';
export * from './notes';
export * from './export';

// Import tool arrays for aggregation
import { launchTools } from './launch';
import { slidesTools } from './slides';
import { shapesTools } from './shapes';
import { textTools } from './text';
import { tablesTools } from './tables';
import { mediaTools } from './media';
import { effectsTools } from './effects';
import { sectionsTools } from './sections';
import { notesTools } from './notes';
import { exportTools } from './export';

// All PowerPoint tools combined into a single array
export const POWERPOINT_TOOLS: LLMSimpleTool[] = [
  ...launchTools,
  ...slidesTools,
  ...shapesTools,
  ...textTools,
  ...tablesTools,
  ...mediaTools,
  ...effectsTools,
  ...sectionsTools,
  ...notesTools,
  ...exportTools,
];
