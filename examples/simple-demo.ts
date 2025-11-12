/**
 * Simple Demo - Plan & Execute Module
 *
 * This is a minimal example showing how to use the Plan & Execute module.
 * Perfect for quick testing and understanding the basics.
 */

import { PlanExecuteOrchestrator } from '../src/plan-and-execute/index.js';
import { LLMClient } from '../src/core/llm-client.js';
import { configManager } from '../src/core/config-manager.js';

// Simple mock that always succeeds
class SimpleMockLLM extends LLMClient {
  private taskNumber = 0;

  async sendMessage(): Promise<string> {
    this.taskNumber++;
    return JSON.stringify({
      status: 'success',
      result: `Task ${this.taskNumber} completed successfully! This is a simulated result.`,
      log_entries: [
        {
          level: 'info',
          message: `Executing task ${this.taskNumber}`,
          timestamp: new Date().toISOString(),
        },
        {
          level: 'info',
          message: `Task ${this.taskNumber} finished`,
          timestamp: new Date().toISOString(),
        },
      ],
      files_changed: [
        {
          path: `/src/task-${this.taskNumber}.ts`,
          action: 'created',
        },
      ],
    });
  }
}

async function main() {
  console.log('\n🚀 Plan & Execute - Simple Demo\n');

  // Initialize config manager (required for LLMClient)
  await configManager.initialize();

  // Create orchestrator with mock LLM
  const mockLLM = new SimpleMockLLM();
  const orchestrator = new PlanExecuteOrchestrator(mockLLM, {
    maxDebugAttempts: 2,
    verbose: false,
  });

  // Listen to events
  orchestrator.on('planCreated', (plan) => {
    console.log(`📋 Plan created with ${plan.length} tasks:\n`);
    plan.forEach((task, i) => {
      console.log(`   ${i + 1}. ${task.title}`);
    });
    console.log('');
  });

  orchestrator.on('todoStarted', (todo, step) => {
    console.log(`⚙️  [${step}] ${todo.title}...`);
  });

  orchestrator.on('todoCompleted', (todo) => {
    console.log(`✅ ${todo.title} - Done!\n`);
  });

  orchestrator.on('executionCompleted', (summary) => {
    console.log('─'.repeat(60));
    console.log('🎉 Execution Complete!\n');
    console.log(`   Total Tasks: ${summary.totalTasks}`);
    console.log(`   Completed: ${summary.completedTasks}`);
    console.log(`   Duration: ${summary.duration}ms`);
    console.log('─'.repeat(60) + '\n');
  });

  // Manually create a simple test plan
  const { PlanExecuteStateManager } = await import('../src/plan-and-execute/state-manager.js');
  const testPlan = [
    {
      id: 'task-1',
      title: 'Setup project structure',
      description: 'Create initial files and folders',
      status: 'pending' as const,
      requiresDocsSearch: false,
      dependencies: [],
    },
    {
      id: 'task-2',
      title: 'Implement core functionality',
      description: 'Write the main business logic',
      status: 'pending' as const,
      requiresDocsSearch: false,
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      title: 'Add tests',
      description: 'Create unit tests',
      status: 'pending' as const,
      requiresDocsSearch: false,
      dependencies: ['task-2'],
    },
  ];

  // Initialize state manager with our plan
  const stateManager = new PlanExecuteStateManager('demo-session', testPlan);
  orchestrator['stateManager'] = stateManager;

  // Emit plan created event
  orchestrator.emit('planCreated', testPlan);

  // Execute the plan
  stateManager.setPlan(testPlan);
  const summary = await orchestrator['executePhase'](testPlan);

  // Show logs
  const logs = orchestrator.getAllLogs();
  console.log('\n📝 Execution Logs:');
  console.log('─'.repeat(60));
  logs.forEach((log) => {
    const icon = { info: 'ℹ️', debug: '🔍', warning: '⚠️', error: '❌' }[log.level];
    console.log(`${icon}  [${log.level.toUpperCase()}] ${log.message}`);
  });
  console.log('─'.repeat(60) + '\n');

  console.log('✨ Demo completed successfully!\n');
  console.log('💡 Tips:');
  console.log('   - Check examples/TEST_PROMPTS.md for more test scenarios');
  console.log('   - Run "npm test -- test/plan-and-execute/" to run unit tests');
  console.log('   - See PLAN_AND_EXECUTE_IMPLEMENTATION.md for full documentation\n');
}

main().catch(console.error);
