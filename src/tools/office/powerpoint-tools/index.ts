/**
 * PowerPoint Tools - Index
 *
 * Re-exports all PowerPoint domain tools and combines them into a single array.
 */

import { LLMSimpleTool } from '../../types.js';

// Re-export all domain modules
export * from './launch.js';
export * from './slides.js';
export * from './shapes.js';
export * from './text.js';
export * from './tables.js';
export * from './media.js';
export * from './effects.js';
export * from './sections.js';
export * from './notes.js';
export * from './export.js';

// Import tool arrays for aggregation
import { launchTools } from './launch.js';
import { slidesTools } from './slides.js';
import { shapesTools } from './shapes.js';
import { textTools } from './text.js';
import { tablesTools } from './tables.js';
import { mediaTools } from './media.js';
import { effectsTools } from './effects.js';
import { sectionsTools } from './sections.js';
import { notesTools } from './notes.js';
import { exportTools } from './export.js';

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
