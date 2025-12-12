/**
 * Plan & Execute Orchestrator
 *
 * Main orchestration module that implements the Plan -> Execute -> Debug workflow.
 * This module coordinates planning, execution, and debugging phases with proper
 * state management and error handling.
 */

import { LLMClient } from '../core/llm/llm-client.js';
import { PlanningLLM } from '../core/llm/planning-llm.js';
import { TodoItem } from '../types/index.js';
import { logger } from '../utils/logger.js';
import {
  PlanExecuteLLMInput,
  PlanExecuteLLMOutput,
  PLAN_EXECUTE_SYSTEM_PROMPT,
} from './llm-schemas.js';
import {
  PlanExecuteStateManager,
  ExecutionStep,
} from './state-manager.js';
import { EventEmitter } from 'events';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Maximum debug attempts per task */
  maxDebugAttempts?: number;

  /** Timeout per task execution (ms) */
  taskTimeout?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Session ID for persistence */
  sessionId?: string;
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  planCreated: (plan: TodoItem[]) => void;
  todoStarted: (todo: TodoItem, step: number) => void;
  todoCompleted: (todo: TodoItem, result: string) => void;
  todoFailed: (todo: TodoItem, error: string) => void;
  debugStarted: (todo: TodoItem, attempt: number) => void;
  debugCompleted: (todo: TodoItem) => void;
  executionCompleted: (summary: ExecutionSummary) => void;
  executionFailed: (error: string) => void;
  logEntry: (entry: ExecutionStep) => void;
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalSteps: number;
  duration: number;
  success: boolean;
}

/**
 * Plan & Execute Orchestrator
 */
export class PlanExecuteOrchestrator extends EventEmitter {
  private llmClient: LLMClient;
  private planningLLM: PlanningLLM;
  private stateManager: PlanExecuteStateManager | null = null;
  private config: Required<OrchestratorConfig>;
  /** Conversation history maintained across all tasks - only reset on compact */
  private conversationHistory: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }> = [];

  constructor(llmClient: LLMClient, config: OrchestratorConfig = {}) {
    super();

    this.llmClient = llmClient;
    this.planningLLM = new PlanningLLM(llmClient);

    this.config = {
      maxDebugAttempts: config.maxDebugAttempts ?? 3,
      taskTimeout: config.taskTimeout ?? 300000, // 5 minutes
      verbose: config.verbose ?? false,
      sessionId: config.sessionId ?? `pe-${Date.now()}`,
    };

    logger.enter('PlanExecuteOrchestrator.constructor', this.config);
  }

  /**
   * Execute the full Plan & Execute workflow
   */
  async execute(userRequest: string): Promise<ExecutionSummary> {
    logger.enter('PlanExecuteOrchestrator.execute', { userRequest });

    try {
      // Phase 1: Planning
      const plan = await this.planPhase(userRequest);

      if (plan.length === 0) {
        throw new Error('Planning phase produced no tasks');
      }

      // Phase 2: Execution
      const summary = await this.executePhase(plan);

      this.emit('executionCompleted', summary);
      logger.exit('PlanExecuteOrchestrator.execute', { summary });

      return summary;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Orchestrator execution failed', error);
      this.emit('executionFailed', errorMessage);
      throw error;
    }
  }

  /**
   * Phase 1: Planning - Convert user request into TODO list
   */
  private async planPhase(userRequest: string): Promise<TodoItem[]> {
    logger.enter('PlanExecuteOrchestrator.planPhase', { userRequest });

    try {
      const planningResult = await this.planningLLM.generateTODOList(
        userRequest
      );

      if (!planningResult.todos || planningResult.todos.length === 0) {
        throw new Error('Planning LLM returned no tasks');
      }

      logger.debug(
        `Planning phase created ${planningResult.todos.length} tasks (${planningResult.complexity} complexity)`
      );

      this.stateManager = new PlanExecuteStateManager(
        this.config.sessionId,
        planningResult.todos
      );
      this.stateManager.setPlan(planningResult.todos);

      this.emit('planCreated', planningResult.todos);

      logger.exit('PlanExecuteOrchestrator.planPhase', {
        taskCount: planningResult.todos.length,
      });

      return planningResult.todos;
    } catch (error) {
      logger.error('Planning phase failed', error);
      throw new Error(
        `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Phase 2: Execution - Execute tasks sequentially
   */
  private async executePhase(plan: TodoItem[]): Promise<ExecutionSummary> {
    logger.enter('PlanExecuteOrchestrator.executePhase', {
      planSize: plan.length,
    });

    if (!this.stateManager) {
      throw new Error('State manager not initialized');
    }

    this.stateManager.startExecution();
    const startTime = Date.now();

    let completedCount = 0;
    let failedCount = 0;
    let totalSteps = 0;

    while (this.stateManager.hasMoreSteps()) {
      const currentTask = this.stateManager.getCurrentTask();
      if (!currentTask) break;

      totalSteps++;
      this.emit('todoStarted', currentTask, totalSteps);

      logger.flow(
        `Executing task ${totalSteps}/${plan.length}: ${currentTask.title}`
      );

      try {
        // Execute the task with full plan context
        const success = await this.executeTask(currentTask, plan, totalSteps);

        if (success) {
          completedCount++;
          this.emit(
            'todoCompleted',
            currentTask,
            this.stateManager.getCompletedTasks().find(
              (t) => t.id === currentTask.id
            )?.result || ''
          );
        } else {
          failedCount++;
          this.emit(
            'todoFailed',
            currentTask,
            currentTask.error || 'Unknown error'
          );

          // If a task fails and debug couldn't fix it, stop execution
          logger.warn(`Task ${currentTask.id} failed permanently`);
          break;
        }

        // Move to next step
        this.stateManager.nextStep();
      } catch (error) {
        failedCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Task ${currentTask.id} threw exception`, error);
        this.emit('todoFailed', currentTask, errorMessage);
        break;
      }
    }

    const duration = Date.now() - startTime;
    const summary: ExecutionSummary = {
      totalTasks: plan.length,
      completedTasks: completedCount,
      failedTasks: failedCount,
      totalSteps,
      duration,
      success: completedCount === plan.length,
    };

    logger.exit('PlanExecuteOrchestrator.executePhase', summary);
    return summary;
  }

  /**
   * Execute a single task with Plan -> Execute -> Debug workflow
   */
  private async executeTask(
    task: TodoItem,
    allTodos: TodoItem[],
    currentIndex: number
  ): Promise<boolean> {
    logger.enter('PlanExecuteOrchestrator.executeTask', { taskId: task.id, currentIndex, totalTodos: allTodos.length });

    if (!this.stateManager) {
      throw new Error('State manager not initialized');
    }

    let debugAttempts = 0;
    let lastError: { message: string; details?: string } | undefined;

    while (debugAttempts <= this.config.maxDebugAttempts) {
      try {
        // Build LLM input
        const input = this.buildLLMInput(task, debugAttempts > 0, lastError);

        // Call LLM with structured input and full plan context
        const output = await this.callLLMForTask(input, allTodos, currentIndex);

        // Handle different status outcomes
        if (output.status === 'success') {
          // Success - record and move on
          this.stateManager.recordSuccess(task.id, output);
          logger.debug(`Task ${task.id} completed successfully`);
          return true;
        } else if (output.status === 'needs_debug' || output.status === 'failed') {
          // Need to debug
          debugAttempts++;
          lastError = output.error;

          if (debugAttempts > this.config.maxDebugAttempts) {
            // Max debug attempts reached
            this.stateManager.recordFailure(task.id, {
              message: `Max debug attempts (${this.config.maxDebugAttempts}) reached`,
              details: output.error?.message,
            });
            logger.warn(
              `Task ${task.id} failed after ${debugAttempts} debug attempts`
            );
            return false;
          }

          // Enter debug mode
          this.emit('debugStarted', task, debugAttempts);
          this.stateManager.enterDebugMode();
          logger.flow(
            `Task ${task.id} needs debugging (attempt ${debugAttempts}/${this.config.maxDebugAttempts})`
          );

          // Continue to next debug iteration
        } else {
          // Unknown status
          logger.warn(`Unknown task status: ${output.status}`);
          return false;
        }
      } catch (error) {
        logger.error(`Error executing task ${task.id}`, error);
        debugAttempts++;
        lastError = {
          message: error instanceof Error ? error.message : String(error),
        };

        if (debugAttempts > this.config.maxDebugAttempts) {
          this.stateManager.recordFailure(task.id, {
            message: `Exception during execution`,
            details: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Build LLM input for a task
   */
  private buildLLMInput(
    task: TodoItem,
    isDebug: boolean,
    lastError?: { message: string; details?: string }
  ): PlanExecuteLLMInput {
    if (!this.stateManager) {
      throw new Error('State manager not initialized');
    }

    const completedTasks = this.stateManager.getCompletedTasks();
    const lastResult = this.stateManager.getLastStepResult();
    const history = this.stateManager.getHistoryForLLM();

    return {
      current_task: {
        id: task.id,
        title: task.title,
        description: task.description,
        dependencies: task.dependencies || [],
      },
      previous_context: {
        last_step_result: lastResult,
        completed_tasks: completedTasks,
      },
      error_log: {
        is_debug: isDebug,
        error_message: lastError?.message,
        error_details: lastError?.details,
      },
      history,
    };
  }

  /**
   * Call LLM for task execution with tools support
   * Now uses chatCompletionWithTools for actual file operations
   * Maintains conversation history across all tasks (only reset on compact)
   */
  private async callLLMForTask(
    input: PlanExecuteLLMInput,
    allTodos: TodoItem[],
    currentIndex: number
  ): Promise<PlanExecuteLLMOutput> {
    logger.enter('PlanExecuteOrchestrator.callLLMForTask', {
      taskId: input.current_task.id,
      historyLength: this.conversationHistory.length,
      currentIndex,
      totalTodos: allTodos.length,
    });

    try {
      // Import FILE_TOOLS for actual file operations
      const { FILE_TOOLS } = await import('../tools/llm/simple/file-tools.js');

      // Build TODO list overview
      const todoListOverview = allTodos.map((todo, idx) => {
        const status = input.previous_context.completed_tasks.find(t => t.id === todo.id)
          ? '✅'
          : idx + 1 === currentIndex
            ? '🔄'
            : '⏳';
        return `${idx + 1}. ${status} ${todo.title}`;
      }).join('\n');

      // Get completed task titles
      const completedTitles = input.previous_context.completed_tasks
        .map(t => `- ${t.title}`)
        .join('\n') || 'None yet';

      // Get next task info
      const nextTask = currentIndex < allTodos.length ? allTodos[currentIndex] : null;
      const nextTaskInfo = nextTask
        ? `**Title**: ${nextTask.title}\n**Description**: ${nextTask.description || 'No description'}`
        : 'This is the last task.';

      // Build user message with full context
      const taskContext = `
## Progress: ${currentIndex}/${allTodos.length}

## TODO List Overview
${todoListOverview}

## Current Task (Task ${currentIndex})
**Title**: ${input.current_task.title}
**Description**: ${input.current_task.description || 'No description provided'}

## Completed Tasks
${completedTitles}

## Next Task Preview
${nextTaskInfo}

${input.error_log.is_debug
  ? `## ⚠️ Debug Mode
**Error to Fix**: ${input.error_log.error_message || 'Unknown error'}
**Details**: ${input.error_log.error_details || 'No details'}
`
  : ''}

---
**Instructions**: Focus ONLY on the current task. Complete it fully, then stop. The next task will be given separately.
`;

      // Initialize conversation history with system prompt if empty
      if (this.conversationHistory.length === 0) {
        this.conversationHistory.push({
          role: 'system' as const,
          content: PLAN_EXECUTE_SYSTEM_PROMPT,
        });
      }

      // Add the new user message to conversation history
      this.conversationHistory.push({
        role: 'user' as const,
        content: taskContext,
      });

      // Execute with tools using full conversation history
      const result = await this.llmClient.chatCompletionWithTools(
        this.conversationHistory as any,
        FILE_TOOLS
      );

      // Update conversation history with all new messages from this execution
      // allMessages includes the original history plus new messages
      this.conversationHistory = result.allMessages as any;

      // Extract final response content
      const responseContent = result.message.content || '';

      // Build tool call summary
      const toolCallSummary = result.toolCalls.length > 0
        ? result.toolCalls.map(tc => `- ${tc.tool}: ${tc.result.substring(0, 200)}${tc.result.length > 200 ? '...' : ''}`).join('\n')
        : '';

      // Build log entries from tool calls
      const logEntries: Array<{
        level: 'debug' | 'info' | 'warning' | 'error';
        message: string;
        timestamp: string;
        context?: Record<string, any>;
      }> = result.toolCalls.map(tc => ({
        level: 'info' as const,
        message: `Tool executed: ${tc.tool}`,
        timestamp: new Date().toISOString(),
        context: { args: tc.args, resultPreview: tc.result.substring(0, 100) },
      }));

      // Determine status based on response
      const hasError = result.toolCalls.some(tc => tc.result.startsWith('Error:'));
      const status = hasError ? 'needs_debug' : 'success';

      logger.exit('PlanExecuteOrchestrator.callLLMForTask', {
        status,
        toolCallCount: result.toolCalls.length,
        updatedHistoryLength: this.conversationHistory.length,
      });

      return {
        status,
        result: `${responseContent}\n\n### Tool Execution Summary\n${toolCallSummary || 'No tools were called.'}`,
        log_entries: logEntries,
        files_changed: result.toolCalls
          .filter(tc => ['create_file', 'edit_file'].includes(tc.tool))
          .map(tc => ({
            path: (tc.args as any).path || (tc.args as any).file_path || 'unknown',
            action: tc.tool === 'create_file' ? 'created' as const : 'modified' as const,
          })),
        error: hasError ? {
          message: 'Some tool executions failed',
          details: result.toolCalls.filter(tc => tc.result.startsWith('Error:')).map(tc => tc.result).join('\n'),
        } : undefined,
      };
    } catch (error) {
      logger.error('LLM call with tools failed', error);
      return {
        status: 'failed',
        result: '',
        log_entries: [{
          level: 'error',
          message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        }],
        error: {
          message: error instanceof Error ? error.message : 'LLM call failed',
        },
      };
    }
  }

  /**
   * Reset conversation history (called on compact)
   */
  resetConversationHistory(): void {
    logger.flow('Resetting conversation history (compact)');
    this.conversationHistory = [];
  }

  /**
   * Get current conversation history length
   */
  getConversationHistoryLength(): number {
    return this.conversationHistory.length;
  }

  /**
   * Get current conversation history (for syncing with external state)
   */
  getConversationHistory(): Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }> {
    return [...this.conversationHistory];
  }

  /**
   * Set conversation history from external source (for syncing with external state)
   */
  setConversationHistory(history: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>): void {
    logger.flow(`Setting conversation history from external source (${history.length} messages)`);
    this.conversationHistory = [...history];
  }

  /**
   * Get all execution logs
   */
  getAllLogs(): ExecutionStep[] {
    return this.stateManager?.getHistoryForLLM().map(h => ({
      step: h.step,
      task_id: h.task_id,
      task_title: h.task_title,
      status: h.status,
      summary: h.summary,
      timestamp: h.timestamp,
      log_entries: [],
    })) || [];
  }

  /**
   * Get current state
   */
  getState() {
    return this.stateManager?.getState() || null;
  }
}
