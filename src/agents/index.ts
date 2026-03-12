/**
 * Agents Index
 *
 * Central export for all LLM-powered agents.
 */

// Common sub-agent
export {
  SubAgent,
  type SubAgentConfig,
} from './common/index.js';

// Backward compatibility alias
export { SubAgent as OfficeSubAgent } from './common/index.js';

// Planning agent
export {
  PlanningLLM,
} from './planner/index.js';

// Office sub-agents (Agent as a Tool)
export {
  createWordCreateRequestTool,
  createWordModifyRequestTool,
  createExcelCreateRequestTool,
  createExcelModifyRequestTool,
  createPowerPointCreateRequestTool,
  createPowerPointModifyRequestTool,
} from './office/index.js';
