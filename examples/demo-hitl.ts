/**
 * Human-in-the-Loop (HITL) Demo
 *
 * This demo shows the HITL approval system in action.
 * You'll be prompted to approve:
 * 1. The overall plan
 * 2. Individual risky tasks (like file writes, installs, etc.)
 */

import { LLMClient } from '../src/core/llm-client.js';
import { configManager } from '../src/core/config-manager.js';
import { PlanExecuteOrchestrator } from '../src/plan-and-execute/orchestrator.js';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  HUMAN-IN-THE-LOOP (HITL) DEMO');
  console.log('='.repeat(80));
  console.log('\nThis demo will show you the HITL approval system.');
  console.log('You will be asked to approve:');
  console.log('  1. The overall plan (list of tasks)');
  console.log('  2. Individual risky tasks before they execute');
  console.log('\n' + '='.repeat(80) + '\n');

  // Initialize configuration
  await configManager.initialize();

  // Validate configuration
  const endpoint = configManager.getCurrentEndpoint();
  const model = configManager.getCurrentModel();

  if (!endpoint || !model) {
    console.error('❌ Error: LLM endpoint and model must be configured');
    console.error('\nPlease run:');
    console.error('  npm run config');
    process.exit(1);
  }

  console.log('✓ Using endpoint:', endpoint.name || endpoint.id);
  console.log('✓ Using model:', model.name || model.id);
  console.log('');

  // Create LLM client
  const llmClient = new LLMClient();

  // Create orchestrator with HITL ENABLED
  const orchestrator = new PlanExecuteOrchestrator(llmClient, {
    maxDebugAttempts: 2,
    hitl: {
      enabled: true,              // ← HITL is enabled
      approvePlan: true,           // ← Will prompt for plan approval
      riskConfig: {
        approvalThreshold: 'medium', // ← Approve medium+ risks
      },
    },
  });

  // Example 1: Simple request with file operations (will trigger approvals)
  const simpleRequest = 'Create a simple calculator.js file with add and subtract functions';

  console.log('📝 User Request:');
  console.log(`   "${simpleRequest}"`);
  console.log('');

  try {
    // This will trigger approval prompts!
    const summary = await orchestrator.execute(simpleRequest);

    console.log('\n' + '='.repeat(80));
    console.log('  EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tasks: ${summary.totalTasks}`);
    console.log(`Completed: ${summary.completedTasks}`);
    console.log(`Failed: ${summary.failedTasks}`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log(`Success: ${summary.success ? '✓ YES' : '✗ NO'}`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Execution failed:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('rejected')) {
      console.log('\n💡 This is normal - you rejected the plan or a task.');
    }
  }

  console.log('\n📚 HITL Demo Complete!');
  console.log('\nWhat happened:');
  console.log('  1. The orchestrator generated a plan (list of tasks)');
  console.log('  2. You were asked to approve the plan');
  console.log('  3. For each risky task (file write, install, etc.),');
  console.log('     you were asked to approve before execution');
  console.log('  4. You could approve, reject, or stop at any point');
  console.log('\nTo customize HITL behavior, see examples/README.md\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
