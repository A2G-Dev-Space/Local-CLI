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

// Request classifier agent
export {
  RequestClassifier,
  type RequestType,
  type ClassificationResult,
} from './classifier/index.js';

// Planning agent
export { PlanningLLM } from './planner/index.js';

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

// Documentation search executor (decision + execution)
export { performDocsSearchIfNeeded } from './docs-search/executor.js';
