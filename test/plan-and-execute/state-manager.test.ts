/**
 * Tests for Plan & Execute State Manager
 *
 * Verifies Core Loop & State Management section from CHECKLIST_PLAN_AND_EXECUTE.md
 */

import { PlanExecuteStateManager } from '../../src/plan-and-execute/state-manager.js';
import { TodoItem } from '../../src/types/index.js';

describe('Plan & Execute State Manager', () => {
  let todos: TodoItem[];

  beforeEach(() => {
    todos = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'First task',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: 'Second task',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
      {
        id: 'task-3',
        title: 'Task 3',
        description: 'Third task',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-2'],
      },
    ];
  });

  describe('Sequential execution', () => {
    test('executes tasks in order according to the plan', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      // Task 1 should be current
      let currentTask = stateManager.getCurrentTask();
      expect(currentTask?.id).toBe('task-1');

      // Complete task 1 and move to next
      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Task 1 done',
        log_entries: [
          {
            level: 'info',
            message: 'Task 1 completed',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      // Task 2 should be current
      currentTask = stateManager.getCurrentTask();
      expect(currentTask?.id).toBe('task-2');

      // Complete task 2 and move to next
      stateManager.recordSuccess('task-2', {
        status: 'success',
        result: 'Task 2 done',
        log_entries: [
          {
            level: 'info',
            message: 'Task 2 completed',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      // Task 3 should be current
      currentTask = stateManager.getCurrentTask();
      expect(currentTask?.id).toBe('task-3');
    });
  });

  describe('Context passing between steps', () => {
    test('last_step_result from Step 1 is correctly passed to Step 2', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      const task1Result = 'Task 1 completed with output XYZ';

      // Complete first task
      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: task1Result,
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Move to next task
      stateManager.nextStep();

      // Verify previous context
      const lastStepResult = stateManager.getLastStepResult();
      expect(lastStepResult).toBe(task1Result);

      const completedTasks = stateManager.getCompletedTasks();
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].id).toBe('task-1');
      expect(completedTasks[0].result).toBe(task1Result);
    });

    test('previous_context contains all completed tasks', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      // Complete task 1
      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Result 1',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      // Complete task 2
      stateManager.recordSuccess('task-2', {
        status: 'success',
        result: 'Result 2',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      // Check that both tasks are in completed tasks
      const completedTasks = stateManager.getCompletedTasks();
      expect(completedTasks).toHaveLength(2);
      expect(completedTasks[0].id).toBe('task-1');
      expect(completedTasks[0].result).toBe('Result 1');
      expect(completedTasks[1].id).toBe('task-2');
      expect(completedTasks[1].result).toBe('Result 2');
    });
  });

  describe('History tracking', () => {
    test('history array is accurately updated after each successful step', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      expect(stateManager.getHistoryForLLM()).toHaveLength(0);

      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Completed',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const history = stateManager.getHistoryForLLM();
      expect(history).toHaveLength(1);
      expect(history[0].task_id).toBe('task-1');
      expect(history[0].status).toBe('completed');
      expect(history[0].summary).toContain('Done');
    });

    test('history includes failed steps', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.recordFailure('task-1', {
        message: 'Execution failed',
        details: 'Error details',
      });

      const history = stateManager.getHistoryForLLM();
      expect(history).toHaveLength(1);
      expect(history[0].task_id).toBe('task-1');
      expect(history[0].status).toBe('failed');
      expect(history[0].summary).toContain('Failed');
    });

    test('history includes debug steps', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.recordDebug('task-1', {
        status: 'success',
        result: 'Debug successful',
        log_entries: [
          {
            level: 'info',
            message: 'Fixed',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const history = stateManager.getHistoryForLLM();
      expect(history).toHaveLength(1);
      expect(history[0].task_id).toBe('task-1');
      expect(history[0].status).toBe('debug');
    });
  });

  describe('Loop termination', () => {
    test('loop terminates correctly when plan is complete', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      expect(stateManager.hasMoreSteps()).toBe(true);

      // Complete all tasks
      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      stateManager.recordSuccess('task-2', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      stateManager.recordSuccess('task-3', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const hasNext = stateManager.nextStep();

      expect(hasNext).toBe(false);
      expect(stateManager.hasMoreSteps()).toBe(false);
      expect(stateManager.getState().status).toBe('completed');
    });

    test('can mark execution as failed', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.markAsFailed('Maximum retries exceeded');

      expect(stateManager.getState().status).toBe('failed');
      expect(stateManager.getState().completedAt).toBeDefined();
    });
  });

  describe('Debug mode', () => {
    test('error_log field is correctly populated when execution fails', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.recordFailure('task-1', {
        message: 'Execution failed',
        details: 'Detailed error information',
        stderr: 'Error output from stderr',
      });

      const state = stateManager.getState();

      expect(state.lastError).toBeDefined();
      expect(state.lastError!.task_id).toBe('task-1');
      expect(state.lastError!.message).toBe('Execution failed');
      expect(state.lastError!.details).toBe('Detailed error information');
      expect(state.lastError!.stderr).toBe('Error output from stderr');
    });

    test('enters and exits debug mode', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      expect(stateManager.getState().isDebugMode).toBe(false);

      stateManager.enterDebugMode();
      expect(stateManager.getState().isDebugMode).toBe(true);

      stateManager.recordDebug('task-1', {
        status: 'success',
        result: 'Fixed',
        log_entries: [
          {
            level: 'info',
            message: 'Fixed',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      expect(stateManager.getState().isDebugMode).toBe(false);
    });
  });

  describe('Logging integration', () => {
    test('log_entries from LLM are captured and stored correctly', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      const logEntries = [
        {
          level: 'info' as const,
          message: 'Starting execution',
          timestamp: '2025-01-01T00:00:00Z',
        },
        {
          level: 'debug' as const,
          message: 'Processing data',
          timestamp: '2025-01-01T00:00:01Z',
        },
        {
          level: 'info' as const,
          message: 'Execution complete',
          timestamp: '2025-01-01T00:00:02Z',
        },
      ];

      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Done',
        log_entries: logEntries,
      });

      const allLogs = stateManager.getAllLogEntries();
      expect(allLogs).toHaveLength(3);
      expect(allLogs[0].message).toBe('Starting execution');
      expect(allLogs[1].message).toBe('Processing data');
      expect(allLogs[2].message).toBe('Execution complete');
    });

    test('log entries accumulate across multiple tasks', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Log 1',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      stateManager.recordSuccess('task-2', {
        status: 'success',
        result: 'Done',
        log_entries: [
          {
            level: 'info',
            message: 'Log 2',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const allLogs = stateManager.getAllLogEntries();
      expect(allLogs).toHaveLength(2);
      expect(allLogs[0].message).toBe('Log 1');
      expect(allLogs[1].message).toBe('Log 2');
    });
  });

  describe('State persistence', () => {
    test('can export and import state', () => {
      const stateManager = new PlanExecuteStateManager('test-session', todos);
      stateManager.startExecution();

      stateManager.recordSuccess('task-1', {
        status: 'success',
        result: 'Task 1 result',
        log_entries: [
          {
            level: 'info',
            message: 'Done',
            timestamp: new Date().toISOString(),
          },
        ],
      });
      stateManager.nextStep();

      const exportedState = stateManager.export();

      const importedManager = PlanExecuteStateManager.import(exportedState);
      const importedState = importedManager.getState();

      expect(importedState.sessionId).toBe('test-session');
      expect(importedState.currentStep).toBe(1);
      expect(importedState.history).toHaveLength(1);
      expect(importedManager.getCompletedTasks()).toHaveLength(1);
    });
  });
});
