/**
 * Desktop Control Agent Index
 *
 * Vision-based autonomous desktop control agent.
 * Electron exclusive — CLI has stub only.
 *
 * CLI parity: src/agents/desktop-control/index.ts (stub)
 */

export { DesktopControlSubAgent, runDesktopControl, abortDesktopControl } from './desktop-control-sub-agent';
export type { DesktopControlConfig } from './desktop-control-sub-agent';
export { createDesktopControlTool } from './desktop-control-tool';
