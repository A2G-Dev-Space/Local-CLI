/**
 * Agents Index
 *
 * Central export for all LLM-powered agents.
 *
 * CLI parity: src/agents/index.ts
 */

// Common sub-agent
export {
  SubAgent,
  type SubAgentConfig,
} from './common/index';

// Backward compatibility alias
export { SubAgent as OfficeSubAgent } from './common/index';

// Planning agent
export {
  PlanningLLM,
  type PlanningResult,
  type TodoItem,
} from './planner';

// Office sub-agents (Agent as a Tool)
export {
  createWordCreateRequestTool,
  createWordModifyRequestTool,
  createExcelCreateRequestTool,
  createExcelModifyRequestTool,
  createPowerPointCreateRequestTool,
  createPowerPointModifyRequestTool,
} from './office';

// Desktop control agent (Electron exclusive — Vision-based)
export {
  createDesktopControlTool,
  DesktopControlSubAgent,
  runDesktopControl,
  abortDesktopControl,
} from './desktop-control';
