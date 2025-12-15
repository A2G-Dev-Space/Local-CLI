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
