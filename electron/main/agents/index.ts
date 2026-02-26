/**
 * Agents Index
 *
 * Central export for all LLM-powered agents.
 *
 * CLI parity: src/agents/index.ts
 */

// Base agent
export {
  BaseAgent,
  type AgentContext,
  type AgentResult,
  type AgentConfig,
} from './base/base-agent';

// Planning agent
export {
  PlanningLLM,
  type PlanningResult,
  type TodoItem,
} from './planner';

// Office sub-agents (Agent as a Tool)
export {
  OfficeSubAgent,
  createWordWorkRequestTool,
  createExcelWorkRequestTool,
  createPowerPointWorkRequestTool,
} from './office';

