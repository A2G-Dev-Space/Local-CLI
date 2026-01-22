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
  type PlanningWithDocsResult,
  type PlanningResult,
  type TodoItem,
} from './planner';

// Documentation search agent
export {
  DocsSearchAgent,
  createDocsSearchAgent,
  executeDocsSearchAgent,
  initializeDocsDirectory,
  addDocumentationFile,
  setDocsSearchProgressCallback,
  type DocsSearchProgressCallback,
} from './docs-search';
