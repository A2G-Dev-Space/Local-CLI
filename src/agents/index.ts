/**
 * Agents Index
 *
 * Central export for all LLM-powered agents.
 */

// Base agent
export {
  BaseAgent,
  type AgentContext,
  type AgentResult,
  type AgentConfig,
} from './base/base-agent.js';

// RequestClassifier removed - all requests now go through planning

// Planning agent
export {
  PlanningLLM,
} from './planner/index.js';

// Office sub-agents (Agent as a Tool)
export {
  OfficeSubAgent,
  createWordWorkRequestTool,
  createExcelWorkRequestTool,
  createPowerPointWorkRequestTool,
} from './office/index.js';

