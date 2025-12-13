/**
 * Orchestration Module
 *
 * A robust implementation of the Plan -> Execute -> Debug workflow
 * inspired by Claude Code's architecture.
 *
 * Features:
 * - Structured LLM I/O schemas
 * - Sequential task execution with context passing
 * - Automatic error detection and debugging
 * - Comprehensive logging and state management
 * - Event-driven progress tracking
 *
 * @example
 * ```typescript
 * import { PlanExecuteOrchestrator } from './orchestration';
 * import { LLMClient } from './core/llm/llm-client';
 *
 * const llmClient = new LLMClient();
 * const orchestrator = new PlanExecuteOrchestrator(llmClient, {
 *   maxDebugAttempts: 3,
 *   verbose: true,
 * });
 *
 * orchestrator.on('todoStarted', (todo, step) => {
 *   console.log(`Starting task ${step}: ${todo.title}`);
 * });
 *
 * orchestrator.on('executionCompleted', (summary) => {
 *   console.log(`Completed ${summary.completedTasks}/${summary.totalTasks} tasks`);
 * });
 *
 * const result = await orchestrator.execute('Build a REST API with Express');
 * ```
 */

// Main orchestrator - DEPRECATED: Now using unified execution loop in usePlanExecution
// export { PlanExecuteOrchestrator } from './orchestrator.js';

// State management
export { PlanExecuteStateManager } from './state-manager.js';

// LLM schemas and validation
export {
  validateLLMOutput,
  parseLLMResponse,
  formatLLMInput,
  DEFAULT_SYSTEM_PROMPT,
  PLAN_EXECUTE_SYSTEM_PROMPT,
} from './llm-schemas.js';

// Types
export type {
  LogEntry,
  PlanExecuteLLMInput,
  PlanExecuteLLMOutput,
  ExecutionStep,
  PlanExecuteState,
  OrchestratorConfig,
  OrchestratorEvents,
  ExecutionSummary,
} from './types.js';
