/**
 * PowerPoint Tools - Barrel Export
 *
 * Re-exports all PowerPoint tool modules and provides unified POWERPOINT_TOOLS array
 * Total: 68 tools
 */

// Domain exports
export * from './launch';
export * from './slides';
export * from './text';
export * from './shapes';
export * from './z-order';
export * from './tables';
export * from './animations';
export * from './background';
export * from './effects';
export * from './sections';
export * from './media';
export * from './export';

// Import tool arrays for unified export
import { launchTools } from './launch';
import { slidesTools } from './slides';
import { textTools } from './text';
import { shapesTools } from './shapes';
import { zOrderTools } from './z-order';
import { tablesTools } from './tables';
import { animationsTools } from './animations';
import { backgroundTools } from './background';
import { effectsTools } from './effects';
import { sectionsTools } from './sections';
import { mediaTools } from './media';
import { exportTools } from './export';

/**
 * All PowerPoint tools combined into a single array
 * Total: 68 tools
 *
 * - launchTools: 7 (launch, create, open, save, close, quit, screenshot)
 * - slidesTools: 9 (addSlide, deleteSlide, moveSlide, duplicateSlide, hideSlide, showSlide, setSlideLayout, getSlideCount, getSlideLayouts)
 * - textTools: 9 (writeText, readSlide, addTextbox, setFont, setTextAlignment, setBulletList, setLineSpacing, setPlaceholderText, getPlaceholders)
 * - shapesTools: 14 (addImage, addShape, deleteShape, duplicateShape, rotateShape, getShapeInfo, setShapeName, setShapeOpacity, getShapeList, setShapePosition, setShapeSize, setShapeStyle, setTextboxBorder, setTextboxFill)
 * - zOrderTools: 8 (bringToFront, sendToBack, bringForward, sendBackward, alignShapes, distributeShapes, groupShapes, ungroupShapes)
 * - tablesTools: 3 (addTable, setTableCell, setTableStyle)
 * - animationsTools: 2 (addAnimation, setTransition)
 * - backgroundTools: 3 (setBackground, applyTheme, getThemes)
 * - effectsTools: 2 (setShadow, setReflection)
 * - sectionsTools: 5 (addSection, deleteSection, getSections, addNote, getNote)
 * - mediaTools: 4 (addHyperlink, addVideo, addAudio, addChart)
 * - exportTools: 2 (exportToPDF, startSlideshow)
 */
export const POWERPOINT_TOOLS = [
  ...launchTools,
  ...slidesTools,
  ...textTools,
  ...shapesTools,
  ...zOrderTools,
  ...tablesTools,
  ...animationsTools,
  ...backgroundTools,
  ...effectsTools,
  ...sectionsTools,
  ...mediaTools,
  ...exportTools,
];
