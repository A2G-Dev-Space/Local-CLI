/**
 * Agents Module Export
 *
 * Central export for all agent functionality:
 * - Planning LLM for TODO generation
 * - Docs Search for documentation lookup
 */

// Planner
export { PlanningLLM, default as Planner } from './planner';
export type { TodoItem, PlanningResult, PlanningWithDocsResult } from './planner';

// Docs Search
export {
  shouldSearchDocs,
  createDocsSearchDecider,
} from './docs-search';

export type { DocsSearchResult } from './docs-search';
