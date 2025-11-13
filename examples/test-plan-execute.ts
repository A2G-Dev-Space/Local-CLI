/**
 * Test Script for Plan & Execute Module - REAL LLM VERSION
 *
 * This script tests the Plan & Execute module with your actual LLM endpoint.
 * It will make real API calls to test the complete workflow.
 *
 * Usage:
 *   npm run test:plan-execute
 *
 * Options:
 *   TEST_MODE=quick    - Run only 1 simple scenario
 *   TEST_MODE=full     - Run all scenarios (default)
 *   VERBOSE=true       - Enable detailed logging
 */

import { PlanExecuteOrchestrator } from '../src/plan-and-execute/index.js';
import { LLMClient } from '../src/core/llm-client.js';
import { configManager } from '../src/core/config-manager.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Test configuration
 */
const TEST_CONFIG = {
  mode: process.env.TEST_MODE || 'full', // 'quick' or 'full'
  verbose: process.env.VERBOSE === 'true',
  maxDebugAttempts: 3,
  taskTimeout: 300000, // 5 minutes per task
};

/**
 * Test scenarios with real user requests
 */
const TEST_SCENARIOS = [
  {
    name: 'Simple Calculator',
    description: 'Tests basic sequential execution',
    userRequest: 'Create a simple calculator module with add, subtract, multiply, and divide functions. Include basic error handling for division by zero.',
    category: 'simple',
    expectedMinTasks: 2,
    expectedMaxTasks: 5,
  },
  {
    name: 'Todo List Manager',
    description: 'Tests CRUD operations and state management',
    userRequest: 'Build a todo list manager with functions to add, remove, update, and list todo items. Store todos in memory.',
    category: 'simple',
    expectedMinTasks: 3,
    expectedMaxTasks: 6,
  },
  {
    name: 'User Authentication',
    description: 'Tests complex flow with dependencies',
    userRequest: 'Create a user authentication system with registration and login. Use JWT for tokens and bcrypt for password hashing.',
    category: 'medium',
    expectedMinTasks: 4,
    expectedMaxTasks: 7,
  },
  {
    name: 'REST API with Express',
    description: 'Tests complex multi-step project',
    userRequest: 'Build a simple REST API using Express with user CRUD endpoints, error handling middleware, and input validation.',
    category: 'complex',
    expectedMinTasks: 5,
    expectedMaxTasks: 10,
  },
];

/**
 * Get scenarios to run based on test mode
 */
function getScenariosToRun(): typeof TEST_SCENARIOS {
  if (TEST_CONFIG.mode === 'quick') {
    log(colors.yellow, '⚡ Quick mode: Running only 1 simple scenario\n');
    return TEST_SCENARIOS.filter((s) => s.category === 'simple').slice(0, 1);
  }
  return TEST_SCENARIOS;
}

/**
 * Run a single test scenario with REAL LLM
 */
async function runScenario(scenario: typeof TEST_SCENARIOS[0], llmClient: LLMClient) {
  log(colors.bright, `\n${'='.repeat(80)}`);
  log(colors.bright, `TEST SCENARIO: ${scenario.name}`);
  log(colors.bright, '='.repeat(80));
  log(colors.blue, `Category: ${scenario.category.toUpperCase()}`);
  log(colors.blue, `Description: ${scenario.description}`);
  log(colors.cyan, `User Request: "${scenario.userRequest}"`);
  log(colors.reset, '');

  const orchestrator = new PlanExecuteOrchestrator(llmClient, {
    maxDebugAttempts: TEST_CONFIG.maxDebugAttempts,
    taskTimeout: TEST_CONFIG.taskTimeout,
    verbose: TEST_CONFIG.verbose,
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
    log(colors.green, 'EXECUTION COMPLETED ✓');
    log(colors.green, '='.repeat(80));
    log(colors.reset, `Total Tasks: ${summary.totalTasks}`);
    log(colors.green, `Completed: ${summary.completedTasks}`);
    if (summary.failedTasks > 0) {
      log(colors.red, `Failed: ${summary.failedTasks}`);
    }
    log(colors.reset, `Total Steps: ${summary.totalSteps}`);
    log(colors.reset, `Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    log(colors.reset, `Success: ${summary.success ? '✓ YES' : '✗ NO'}`);
  });

  orchestrator.on('executionFailed', (error) => {
    log(colors.red, `\n✗ Execution failed: ${error}`);
  });

  const startTime = Date.now();

  try {
    // Execute with REAL LLM - this will call the planning LLM and execute tasks
    log(colors.cyan, '🤖 Calling LLM to generate plan...\n');
    const summary = await orchestrator.execute(scenario.userRequest);

    // Validate results
    const planSize = orchestrator.getState()?.plan.length || 0;
    const inExpectedRange =
      planSize >= scenario.expectedMinTasks && planSize <= scenario.expectedMaxTasks;

    if (!inExpectedRange) {
      log(
        colors.yellow,
        `⚠ Warning: Plan size ${planSize} outside expected range [${scenario.expectedMinTasks}-${scenario.expectedMaxTasks}]`
      );
    }

    // Display logs
    const logs = orchestrator.getAllLogs();
    if (logs.length > 0) {
      log(colors.cyan, `\n${'─'.repeat(80)}`);
      log(colors.cyan, `LOG ENTRIES (${logs.length} total)`);
      log(colors.cyan, '─'.repeat(80));

      // Show first 20 logs, or all if verbose
      const logsToShow = TEST_CONFIG.verbose ? logs : logs.slice(0, 20);
      logsToShow.forEach((entry) => {
        const levelColor = {
          debug: colors.blue,
          info: colors.reset,
          warning: colors.yellow,
          error: colors.red,
        }[entry.level];
        log(levelColor, `[${entry.level.toUpperCase()}] ${entry.message}`);
      });

      if (!TEST_CONFIG.verbose && logs.length > 20) {
        log(colors.cyan, `... and ${logs.length - 20} more (use VERBOSE=true to see all)`);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      success: summary.success,
      tasksStarted,
      tasksCompleted,
      tasksFailed,
      debugAttempts,
      totalLogs: logs.length,
      planSize,
      totalTime,
      inExpectedRange,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    log(colors.red, `\n✗ Scenario failed with error: ${error}`);
    if (error instanceof Error && error.stack) {
      log(colors.red, error.stack);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tasksStarted,
      tasksCompleted,
      tasksFailed,
      debugAttempts,
      totalTime,
    };
  }
}

/**
 * Main test runner
 */
async function main() {
  log(colors.bright, '\n' + '█'.repeat(80));
  log(colors.bright, '  PLAN & EXECUTE MODULE - REAL LLM TEST SUITE');
  log(colors.bright, '█'.repeat(80) + '\n');

  // Initialize config manager (required for LLMClient)
  log(colors.cyan, '🔧 Initializing configuration...');
  await configManager.initialize();

  const endpoint = configManager.getCurrentEndpoint();
  const model = configManager.getCurrentModel();

  if (!endpoint || !model) {
    log(colors.red, '\n✗ Error: No LLM endpoint or model configured!');
    log(colors.yellow, '\nPlease configure your LLM endpoint first:');
    log(colors.reset, '  1. Run the CLI and go to configuration');
    log(colors.reset, '  2. Add your LLM endpoint (URL and API key)');
    log(colors.reset, '  3. Select a model\n');
    process.exit(1);
  }

  log(colors.green, `✓ Using endpoint: ${endpoint.name}`);
  log(colors.green, `✓ Using model: ${model.name}`);
  log(colors.cyan, `\nTest Configuration:`);
  log(colors.reset, `  Mode: ${TEST_CONFIG.mode}`);
  log(colors.reset, `  Max Debug Attempts: ${TEST_CONFIG.maxDebugAttempts}`);
  log(colors.reset, `  Task Timeout: ${TEST_CONFIG.taskTimeout / 1000}s`);
  log(colors.reset, `  Verbose: ${TEST_CONFIG.verbose}\n`);

  // Create LLM client
  const llmClient = new LLMClient();

  // Get scenarios to run
  const scenariosToRun = getScenariosToRun();
  log(colors.bright, `Running ${scenariosToRun.length} test scenario(s)...\n`);

  const results = [];

  for (let i = 0; i < scenariosToRun.length; i++) {
    const scenario = scenariosToRun[i]!;
    log(colors.magenta, `\n[${ i + 1}/${scenariosToRun.length}] Starting scenario: ${scenario.name}`);

    const result = await runScenario(scenario, llmClient);
    results.push({ scenario: scenario.name, category: scenario.category, ...result });

    // Wait a bit between scenarios to avoid rate limits
    if (i < scenariosToRun.length - 1) {
      log(colors.cyan, '\n⏳ Waiting 2 seconds before next scenario...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Summary
  log(colors.bright, '\n\n' + '█'.repeat(80));
  log(colors.bright, '  TEST SUMMARY');
  log(colors.bright, '█'.repeat(80) + '\n');

  results.forEach((result, i) => {
    const status = result.success ? colors.green + '✓ PASS' : colors.red + '✗ FAIL';
    log(colors.reset, `${i + 1}. [${result.category?.toUpperCase()}] ${result.scenario}`);
    log(colors.reset, `   Status: ${status}${colors.reset}`);
    if (result.planSize) {
      log(colors.reset, `   Plan Size: ${result.planSize} tasks`);
    }
    if (result.tasksCompleted !== undefined) {
      log(colors.reset, `   Completed: ${result.tasksCompleted}/${result.tasksStarted || 0}`);
    }
    if (result.debugAttempts && result.debugAttempts > 0) {
      log(colors.yellow, `   Debug Attempts: ${result.debugAttempts}`);
    }
    if (result.totalLogs) {
      log(colors.reset, `   Log Entries: ${result.totalLogs}`);
    }
    if (result.totalTime) {
      log(colors.reset, `   Duration: ${(result.totalTime / 1000).toFixed(2)}s`);
    }
    if (!result.success && result.error) {
      log(colors.red, `   Error: ${result.error}`);
    }
    log(colors.reset, '');
  });

  const totalPassed = results.filter((r) => r.success).length;
  const totalFailed = results.length - totalPassed;
  const totalTime = results.reduce((sum, r) => sum + (r.totalTime || 0), 0);

  log(colors.reset, '─'.repeat(80));
  log(
    colors.bright,
    `Results: ${totalPassed}/${results.length} passed | Total Time: ${(totalTime / 1000).toFixed(2)}s`
  );
  log(colors.reset, '─'.repeat(80) + '\n');

  if (totalPassed === results.length) {
    log(colors.green, '🎉 All tests passed!\n');
  } else {
    log(colors.yellow, `⚠ ${totalFailed} test(s) failed\n`);
  }

  // Tips
  log(colors.cyan, '💡 Tips:');
  if (TEST_CONFIG.mode === 'quick') {
    log(colors.reset, '   • Run full suite: TEST_MODE=full npm run test:plan-execute');
  }
  if (!TEST_CONFIG.verbose) {
    log(colors.reset, '   • See all logs: VERBOSE=true npm run test:plan-execute');
  }
  log(colors.reset, '   • Check unit tests: npm test -- test/plan-and-execute/');
  log(colors.reset, '   • See more prompts: examples/TEST_PROMPTS.md\n');

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}
