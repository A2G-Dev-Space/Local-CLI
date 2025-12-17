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
  type PlanningWithDocsResult,
} from './planner/index.js';

// Documentation search agent
export {
  DocsSearchAgent,
  createDocsSearchAgent,
  executeDocsSearchAgent,
  initializeDocsDirectory,
  addDocumentationFile,
  setDocsSearchProgressCallback,
  type DocsSearchProgressCallback,
} from './docs-search/index.js';

// performDocsSearchIfNeeded removed - docs search now integrated into planning
