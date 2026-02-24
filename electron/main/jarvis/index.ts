/**
 * Jarvis Module - barrel export
 *
 * NOTE: JarvisTray는 Electron main process 전용 (Tray, Menu, nativeImage 사용).
 * worker 번들에 포함되면 electron-shim 에러 발생하므로 barrel에서 제외.
 * index.ts에서 직접 import: import { JarvisTray } from './jarvis/jarvis-tray';
 */

export * from './jarvis-types';
export { JarvisService, jarvisService } from './jarvis-service';
export { JARVIS_SYSTEM_PROMPT, JARVIS_MANAGER_TOOLS, buildManagerUserPrompt } from './jarvis-prompts';
