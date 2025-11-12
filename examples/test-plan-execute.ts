/**
 * Test Script for Plan & Execute Module
 *
 * This script demonstrates how to use and test the Plan & Execute module
 * with various example scenarios.
 */

import { PlanExecuteOrchestrator } from '../src/plan-and-execute/index.js';
import { LLMClient } from '../src/core/llm-client.js';
import { configManager } from '../src/core/config-manager.js';
import { TodoItem } from '../src/types/index.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Mock LLM Client for testing without real API calls
 */
class MockLLMClient extends LLMClient {
  private callCount = 0;

  async sendMessage(message: string, systemPrompt?: string): Promise<string> {
    this.callCount++;

    log(colors.cyan, `\n[Mock LLM Call #${this.callCount}]`);
    log(colors.blue, `System: ${systemPrompt?.substring(0, 100)}...`);
    log(colors.blue, `User: ${message.substring(0, 200)}...`);

    // Parse the input to determine which task we're working on
    const taskMatch = message.match(/"title":\s*"([^"]+)"/);
    const taskTitle = taskMatch ? taskMatch[1] : 'Unknown Task';

    const isDebug = message.includes('"is_debug": true');

    if (isDebug) {
      log(colors.yellow, `→ Debug mode detected for: ${taskTitle}`);
    }

    // Simulate different responses based on task
    if (taskTitle.includes('Create')) {
      return JSON.stringify({
        status: 'success',
        result: `Successfully created files for: ${taskTitle}`,
        log_entries: [
          {
            level: 'info',
            message: `Starting task: ${taskTitle}`,
            timestamp: new Date().toISOString(),
          },
          {
            level: 'debug',
            message: 'Creating directory structure',
            timestamp: new Date().toISOString(),
          },
          {
            level: 'info',
            message: 'Files created successfully',
            timestamp: new Date().toISOString(),
          },
        ],
        files_changed: [
          { path: '/src/example.ts', action: 'created' as const },
        ],
      });
    } else if (taskTitle.includes('Implement') || taskTitle.includes('Write')) {
      // First time fails, second time (debug) succeeds
      if (isDebug || this.callCount % 3 === 0) {
        return JSON.stringify({
          status: 'success',
          result: `Implemented: ${taskTitle}`,
          log_entries: [
            {
              level: 'info',
              message: 'Debug successful - fixed implementation',
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } else {
        return JSON.stringify({
          status: 'failed',
          result: '',
          log_entries: [
            {
              level: 'error',
              message: 'Type error in implementation',
              timestamp: new Date().toISOString(),
            },
          ],
          error: {
            message: 'TypeScript compilation error',
            details: 'Property "name" does not exist on type "User"',
          },
        });
      }
    } else if (taskTitle.includes('Test')) {
      return JSON.stringify({
        status: 'success',
        result: `Tests written and passing for: ${taskTitle}`,
        log_entries: [
          {
            level: 'info',
            message: 'Writing test cases',
            timestamp: new Date().toISOString(),
          },
          {
            level: 'info',
            message: 'All tests passing',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } else {
      return JSON.stringify({
        status: 'success',
        result: `Completed: ${taskTitle}`,
        log_entries: [
          {
            level: 'info',
            message: `Task completed: ${taskTitle}`,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
  }
}

/**
 * Test scenarios with example questions
 */
const TEST_SCENARIOS = [
  {
    name: 'Simple 3-step task',
    description: 'Tests basic sequential execution',
    userRequest: 'Create a simple calculator with add, subtract, multiply, and divide functions',
    expectedTasks: 3,
  },
  {
    name: 'Task with error and debug',
    description: 'Tests error handling and debug workflow',
    userRequest: 'Create a user authentication system with login and registration',
    expectedTasks: 3,
  },
  {
    name: 'Complex multi-step',
    description: 'Tests complex dependencies',
    userRequest: 'Build a REST API with Express, including routes, middleware, and database integration',
    expectedTasks: 4,
  },
];

/**
 * Manually create a test plan (since we're mocking)
 */
function createMockPlan(scenario: typeof TEST_SCENARIOS[0]): TodoItem[] {
  const plans: Record<string, TodoItem[]> = {
    'Create a simple calculator with add, subtract, multiply, and divide functions': [
      {
        id: 'task-1',
        title: 'Create calculator module structure',
        description: 'Set up the basic file structure and exports',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      },
      {
        id: 'task-2',
        title: 'Implement arithmetic operations',
        description: 'Write functions for add, subtract, multiply, divide',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
      {
        id: 'task-3',
        title: 'Write unit tests',
        description: 'Create test cases for all operations',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-2'],
      },
    ],
    'Create a user authentication system with login and registration': [
      {
        id: 'task-1',
        title: 'Create user model and schema',
        description: 'Define user data structure',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      },
      {
        id: 'task-2',
        title: 'Implement registration endpoint',
        description: 'Create API endpoint for user registration',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
      {
        id: 'task-3',
        title: 'Implement login endpoint',
        description: 'Create API endpoint for user login',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
    ],
    'Build a REST API with Express, including routes, middleware, and database integration': [
      {
        id: 'task-1',
        title: 'Create Express app structure',
        description: 'Initialize Express application',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      },
      {
        id: 'task-2',
        title: 'Implement middleware',
        description: 'Add logging, error handling, and auth middleware',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
      {
        id: 'task-3',
        title: 'Create database models',
        description: 'Define database schema and models',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-1'],
      },
      {
        id: 'task-4',
        title: 'Implement CRUD routes',
        description: 'Create REST endpoints for all operations',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: ['task-2', 'task-3'],
      },
    ],
  };

  return plans[scenario.userRequest] || [];
}

/**
 * Run a single test scenario
 */
async function runScenario(scenario: typeof TEST_SCENARIOS[0]) {
  log(colors.bright, `\n${'='.repeat(80)}`);
  log(colors.bright, `TEST SCENARIO: ${scenario.name}`);
  log(colors.bright, '='.repeat(80));
  log(colors.blue, `Description: ${scenario.description}`);
  log(colors.blue, `User Request: "${scenario.userRequest}"`);
  log(colors.reset, '');

  const mockClient = new MockLLMClient();
  const orchestrator = new PlanExecuteOrchestrator(mockClient, {
    maxDebugAttempts: 2,
    verbose: true,
    sessionId: `test-${Date.now()}`,
  });

  // Track events
  let tasksStarted = 0;
  let tasksCompleted = 0;
  let tasksFailed = 0;
  let debugAttempts = 0;

  orchestrator.on('planCreated', (plan) => {
    log(colors.green, `\n✓ Plan created with ${plan.length} tasks:`);
    plan.forEach((task, i) => {
      log(colors.reset, `  ${i + 1}. ${task.title}`);
      log(colors.reset, `     ${task.description}`);
    });
  });

  orchestrator.on('todoStarted', (todo, step) => {
    tasksStarted++;
    log(colors.cyan, `\n[Step ${step}] Starting: ${todo.title}`);
  });

  orchestrator.on('todoCompleted', (todo, result) => {
    tasksCompleted++;
    log(colors.green, `✓ Completed: ${todo.title}`);
    log(colors.reset, `  Result: ${result.substring(0, 100)}...`);
  });

  orchestrator.on('todoFailed', (todo, error) => {
    tasksFailed++;
    log(colors.red, `✗ Failed: ${todo.title}`);
    log(colors.red, `  Error: ${error}`);
  });

  orchestrator.on('debugStarted', (todo, attempt) => {
    debugAttempts++;
    log(colors.yellow, `⚠ Debug attempt ${attempt} for: ${todo.title}`);
  });

  orchestrator.on('debugCompleted', (todo) => {
    log(colors.green, `✓ Debug successful for: ${todo.title}`);
  });

  orchestrator.on('executionCompleted', (summary) => {
    log(colors.green, '\n' + '='.repeat(80));
    log(colors.green, 'EXECUTION COMPLETED');
    log(colors.green, '='.repeat(80));
    log(colors.reset, `Total Tasks: ${summary.totalTasks}`);
    log(colors.green, `Completed: ${summary.completedTasks}`);
    log(colors.red, `Failed: ${summary.failedTasks}`);
    log(colors.reset, `Total Steps: ${summary.totalSteps}`);
    log(colors.reset, `Duration: ${summary.duration}ms`);
    log(colors.reset, `Success: ${summary.success ? '✓' : '✗'}`);
  });

  orchestrator.on('executionFailed', (error) => {
    log(colors.red, `\n✗ Execution failed: ${error}`);
  });

  try {
    // Mock the planning phase by directly using our mock plan
    const plan = createMockPlan(scenario);
    orchestrator['stateManager'] = new (await import('../src/plan-and-execute/state-manager.js')).PlanExecuteStateManager(
      `test-${Date.now()}`,
      plan
    );
    orchestrator.emit('planCreated', plan);

    // Execute the plan
    orchestrator['stateManager'].setPlan(plan);
    const summary = await orchestrator['executePhase'](plan);

    // Display logs
    const logs = orchestrator.getAllLogs();
    log(colors.cyan, `\n${'─'.repeat(80)}`);
    log(colors.cyan, `LOG ENTRIES (${logs.length} total)`);
    log(colors.cyan, '─'.repeat(80));
    logs.forEach((entry) => {
      const levelColor = {
        debug: colors.blue,
        info: colors.reset,
        warning: colors.yellow,
        error: colors.red,
      }[entry.level];
      log(levelColor, `[${entry.level.toUpperCase()}] ${entry.message}`);
    });

    return {
      success: summary.success,
      tasksStarted,
      tasksCompleted,
      tasksFailed,
      debugAttempts,
      totalLogs: logs.length,
    };
  } catch (error) {
    log(colors.red, `\n✗ Scenario failed with error: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main test runner
 */
async function main() {
  log(colors.bright, '\n' + '█'.repeat(80));
  log(colors.bright, '  PLAN & EXECUTE MODULE - TEST SUITE');
  log(colors.bright, '█'.repeat(80) + '\n');

  // Initialize config manager (required for LLMClient)
  await configManager.initialize();

  const results = [];

  for (const scenario of TEST_SCENARIOS) {
    const result = await runScenario(scenario);
    results.push({ scenario: scenario.name, ...result });

    // Wait a bit between scenarios
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  log(colors.bright, '\n\n' + '█'.repeat(80));
  log(colors.bright, '  TEST SUMMARY');
  log(colors.bright, '█'.repeat(80) + '\n');

  results.forEach((result, i) => {
    const status = result.success ? colors.green + '✓ PASS' : colors.red + '✗ FAIL';
    log(colors.reset, `${i + 1}. ${result.scenario}: ${status}${colors.reset}`);
    if (!result.success && result.error) {
      log(colors.red, `   Error: ${result.error}`);
    }
  });

  const totalPassed = results.filter((r) => r.success).length;
  const totalFailed = results.length - totalPassed;

  log(colors.reset, '\n' + '─'.repeat(80));
  log(colors.bright, `Total: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
  log(colors.reset, '─'.repeat(80) + '\n');

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}
