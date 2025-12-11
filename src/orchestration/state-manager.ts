/**
 * State Manager for Plan & Execute Module
 *
 * Manages the execution state, history, and progress tracking
 * for the Plan & Execute workflow.
 */

import { TodoItem } from '../types/index.js';
import { PlanExecuteLLMOutput, LogEntry } from './llm-schemas.js';
import { logger } from '../utils/logger.js';

/**
 * Execution step record
 */
export interface ExecutionStep {
  step: number;
  task_id: string;
  task_title: string;
  status: 'completed' | 'failed' | 'debug';
  summary: string;
  timestamp: string;
  result?: string;
  error?: string;
  log_entries: LogEntry[];
  files_changed?: Array<{
    path: string;
    action: 'created' | 'modified' | 'deleted';
  }>;
}

/**
 * Plan & Execute state
 */
export interface PlanExecuteState {
  /** Unique session ID */
  sessionId: string;

  /** Current plan (list of TODOs) */
  plan: TodoItem[];

  /** Current step index (0-based) */
  currentStep: number;

  /** Execution history */
  history: ExecutionStep[];

  /** Results from completed tasks */
  completedTasks: Map<string, string>;

  /** Whether currently in debug mode */
  isDebugMode: boolean;

  /** Error from last execution (if any) */
  lastError?: {
    task_id: string;
    message: string;
    details?: string;
    stderr?: string;
  };

  /** Start time */
  startedAt: string;

  /** End time */
  completedAt?: string;

  /** Overall status */
  status: 'idle' | 'planning' | 'executing' | 'completed' | 'failed';
}

/**
 * State Manager class
 */
export class PlanExecuteStateManager {
  private state: PlanExecuteState;

  constructor(sessionId: string, plan: TodoItem[] = []) {
    this.state = {
      sessionId,
      plan,
      currentStep: 0,
      history: [],
      completedTasks: new Map(),
      isDebugMode: false,
      startedAt: new Date().toISOString(),
      status: 'idle',
    };

    logger.enter('PlanExecuteStateManager.constructor', {
      sessionId,
      planSize: plan.length,
    });
  }

  /**
   * Get the current state
   */
  getState(): Readonly<PlanExecuteState> {
    return { ...this.state, completedTasks: new Map(this.state.completedTasks) };
  }

  /**
   * Get the current task
   */
  getCurrentTask(): TodoItem | undefined {
    if (this.state.currentStep >= this.state.plan.length) {
      return undefined;
    }
    return this.state.plan[this.state.currentStep];
  }

  /**
   * Get the result from the last successfully completed step
   */
  getLastStepResult(): string | undefined {
    if (this.state.history.length === 0) {
      return undefined;
    }

    // Find the last successfully completed step
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      const step = this.state.history[i];
      if (step && step.status === 'completed' && step.result) {
        return step.result;
      }
    }

    return undefined;
  }

  /**
   * Get all completed tasks with their results
   */
  getCompletedTasks(): Array<{ id: string; title: string; result: string }> {
    const completed: Array<{ id: string; title: string; result: string }> = [];

    for (const [taskId, result] of this.state.completedTasks.entries()) {
      const task = this.state.plan.find((t) => t.id === taskId);
      if (task) {
        completed.push({
          id: taskId,
          title: task.title,
          result,
        });
      }
    }

    return completed;
  }

  /**
   * Set the plan
   */
  setPlan(plan: TodoItem[]): void {
    logger.flow(`Setting plan with ${plan.length} tasks`);
    this.state.plan = plan;
    this.state.currentStep = 0;
    this.state.status = 'planning';
  }

  /**
   * Start execution
   */
  startExecution(): void {
    logger.flow('Starting execution');
    this.state.status = 'executing';
    this.state.startedAt = new Date().toISOString();
  }

  /**
   * Record a successful execution step
   */
  recordSuccess(taskId: string, output: PlanExecuteLLMOutput): void {
    const task = this.getCurrentTask();
    if (!task) {
      logger.warn('No current task to record success for');
      return;
    }

    logger.enter('PlanExecuteStateManager.recordSuccess', {
      taskId,
      step: this.state.currentStep,
    });

    const step: ExecutionStep = {
      step: this.state.currentStep,
      task_id: taskId,
      task_title: task.title,
      status: 'completed',
      summary: output.result.substring(0, 200),
      timestamp: new Date().toISOString(),
      result: output.result,
      log_entries: output.log_entries,
      files_changed: output.files_changed,
    };

    this.state.history.push(step);
    this.state.completedTasks.set(taskId, output.result);
    this.state.isDebugMode = false;
    this.state.lastError = undefined;

    // Update the task in the plan
    const taskIndex = this.state.plan.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      this.state.plan[taskIndex]!.status = 'completed';
      this.state.plan[taskIndex]!.result = output.result;
      this.state.plan[taskIndex]!.completedAt = new Date().toISOString();
    }

    logger.exit('PlanExecuteStateManager.recordSuccess', {
      historySize: this.state.history.length,
    });
  }

  /**
   * Record a failed execution step
   */
  recordFailure(
    taskId: string,
    error: { message: string; details?: string; stderr?: string }
  ): void {
    const task = this.getCurrentTask();
    if (!task) {
      logger.warn('No current task to record failure for');
      return;
    }

    logger.enter('PlanExecuteStateManager.recordFailure', {
      taskId,
      error: error.message,
    });

    const step: ExecutionStep = {
      step: this.state.currentStep,
      task_id: taskId,
      task_title: task.title,
      status: 'failed',
      summary: `Failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      error: error.message,
      log_entries: [
        {
          level: 'error',
          message: error.message,
          timestamp: new Date().toISOString(),
          context: {
            details: error.details,
            stderr: error.stderr,
          },
        },
      ],
    };

    this.state.history.push(step);
    this.state.lastError = {
      task_id: taskId,
      message: error.message,
      details: error.details,
      stderr: error.stderr,
    };

    // Update the task in the plan
    const taskIndex = this.state.plan.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      this.state.plan[taskIndex]!.status = 'failed';
      this.state.plan[taskIndex]!.error = error.message;
    }

    logger.exit('PlanExecuteStateManager.recordFailure');
  }

  /**
   * Record a debug step
   */
  recordDebug(taskId: string, output: PlanExecuteLLMOutput): void {
    const task = this.getCurrentTask();
    if (!task) {
      logger.warn('No current task to record debug for');
      return;
    }

    logger.enter('PlanExecuteStateManager.recordDebug', {
      taskId,
      step: this.state.currentStep,
    });

    const step: ExecutionStep = {
      step: this.state.currentStep,
      task_id: taskId,
      task_title: task.title,
      status: 'debug',
      summary: `Debug: ${output.result.substring(0, 200)}`,
      timestamp: new Date().toISOString(),
      result: output.result,
      log_entries: output.log_entries,
      files_changed: output.files_changed,
    };

    this.state.history.push(step);
    this.state.isDebugMode = false;

    logger.exit('PlanExecuteStateManager.recordDebug');
  }

  /**
   * Enter debug mode
   */
  enterDebugMode(): void {
    logger.flow('Entering debug mode');
    this.state.isDebugMode = true;
  }

  /**
   * Move to the next step
   */
  nextStep(): boolean {
    this.state.currentStep++;
    logger.flow(`Moving to step ${this.state.currentStep}`);

    if (this.state.currentStep >= this.state.plan.length) {
      this.state.status = 'completed';
      this.state.completedAt = new Date().toISOString();
      logger.flow('Plan execution completed');
      return false;
    }

    return true;
  }

  /**
   * Check if there are more steps
   */
  hasMoreSteps(): boolean {
    return this.state.currentStep < this.state.plan.length;
  }

  /**
   * Get the execution history for LLM context
   */
  getHistoryForLLM(): Array<{
    step: number;
    task_id: string;
    task_title: string;
    status: 'completed' | 'failed' | 'debug';
    summary: string;
    timestamp: string;
  }> {
    return this.state.history.map((h) => ({
      step: h.step,
      task_id: h.task_id,
      task_title: h.task_title,
      status: h.status,
      summary: h.summary,
      timestamp: h.timestamp,
    }));
  }

  /**
   * Mark the entire execution as failed
   */
  markAsFailed(reason: string): void {
    logger.flow(`Marking execution as failed: ${reason}`);
    this.state.status = 'failed';
    this.state.completedAt = new Date().toISOString();
  }

  /**
   * Get all log entries from execution history
   */
  getAllLogEntries(): LogEntry[] {
    return this.state.history.flatMap((step) => step.log_entries);
  }

  /**
   * Export state for persistence
   */
  export(): any {
    return {
      ...this.state,
      completedTasks: Array.from(this.state.completedTasks.entries()),
    };
  }

  /**
   * Import state from persistence
   */
  static import(savedState: any): PlanExecuteStateManager {
    const manager = new PlanExecuteStateManager(
      savedState.sessionId,
      savedState.plan
    );

    const completedTasksMap = new Map(
      Array.isArray(savedState.completedTasks)
        ? savedState.completedTasks
        : Object.entries(savedState.completedTasks || {})
    );

    manager.state = {
      ...savedState,
      completedTasks: completedTasksMap,
    };
    return manager;
  }
}
