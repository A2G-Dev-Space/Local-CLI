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
export * from './layout-builders.js';

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
import { powerpointCreateTool } from './launch.js';
import { powerpointSaveTool } from './export.js';

// All PowerPoint tools combined (for Modify Agent)
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

// High-level tools for Creation Agent — HTML pipeline only, no layout tools
export const POWERPOINT_CREATE_TOOLS: LLMSimpleTool[] = [
  powerpointCreateTool,
  powerpointSaveTool,
];
