/**
 * Demo 테스트 시나리오
 *
 * test/demos/ 폴더의 데모들을 E2E 테스트로 실행
 */

import { TestScenario } from '../types.js';
import { PlanExecuteOrchestrator } from '../../../src/orchestration/index.js';
import { LLMClient } from '../../../src/core/llm/llm-client.js';
import { configManager } from '../../../src/core/config/config-manager.js';
import { PlanExecuteStateManager } from '../../../src/orchestration/state-manager.js';
import { logger } from '../../../src/utils/logger.js';

/**
 * Simple Mock LLM for demo tests
 */
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

export const demoScenarios: TestScenario[] = [
  // ============================================================
  // Simple Demo - Mock LLM 기반 Plan & Execute 테스트
  // ============================================================
  {
    id: 'demo-simple',
    name: 'Simple Demo (Mock LLM)',
    description: 'Mock LLM을 사용한 Plan & Execute 기본 동작 테스트',
    category: 'demos',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Mock LLM으로 Plan & Execute 실행',
        action: {
          type: 'custom',
          fn: async () => {
            await configManager.initialize();

            const mockLLM = new SimpleMockLLM();
            const orchestrator = new PlanExecuteOrchestrator(mockLLM, {
              maxDebugAttempts: 2,
              verbose: false,
            });

            // Test plan
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
            (orchestrator as any).stateManager = stateManager;

            // Execute the plan
            stateManager.setPlan(testPlan);
            const summary = await (orchestrator as any).executePhase(testPlan);

            // Get logs
            const logs = orchestrator.getAllLogs();

            return {
              summary,
              logsCount: logs.length,
              planSize: testPlan.length,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            return (
              result.planSize === 3 &&
              result.logsCount > 0
            );
          },
        },
      },
    ],
  },

  // ============================================================
  // Logger Demo - 로깅 시스템 기능 테스트
  // ============================================================
  {
    id: 'demo-logger',
    name: 'Logger Demo',
    description: '로깅 시스템의 다양한 기능 테스트',
    category: 'demos',
    enabled: true,
    timeout: 10000,
    steps: [
      {
        name: '로거 기본 기능 테스트',
        action: {
          type: 'custom',
          fn: async () => {
            const results: string[] = [];

            // Basic logging (debug/verbose only in non-normal mode)
            logger.debug('Test debug message', { version: '1.0.0' });
            results.push('debug');

            logger.warn('Test warning', { usage: '85%' });
            results.push('warn');

            // Function tracking
            logger.enter('testFunction', { param: 'value' });
            results.push('enter');

            logger.flow('Test flow step');
            results.push('flow');

            logger.exit('testFunction', { result: 'ok' });
            results.push('exit');

            // Variable tracking
            logger.vars({ name: 'testVar', value: 42, type: 'number' });
            results.push('vars');

            // State change
            logger.state('Test state change', 'old', 'new');
            results.push('state');

            // Timer
            logger.startTimer('test-timer');
            await new Promise(resolve => setTimeout(resolve, 10));
            const elapsed = logger.endTimer('test-timer');
            results.push('timer');

            return {
              functionsUsed: results,
              timerWorked: elapsed > 0,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            // info는 더 이상 사용하지 않음 - debug, warn, enter, flow, exit, vars, state, timer
            const expectedFunctions = ['debug', 'warn', 'enter', 'flow', 'exit', 'vars', 'state', 'timer'];
            const allPresent = expectedFunctions.every(f => result.functionsUsed.includes(f));
            return allPresent && result.timerWorked;
          },
        },
      },
    ],
  },

  // ============================================================
  // Real LLM Test - 실제 LLM을 사용한 Plan & Execute 테스트
  // ============================================================
  {
    id: 'demo-real-llm',
    name: 'Real LLM Plan & Execute',
    description: '실제 LLM 엔드포인트를 사용한 Plan & Execute 테스트',
    category: 'demos',
    enabled: true,
    timeout: 300000, // 5분 (LLM Plan & Execute는 시간이 오래 걸릴 수 있음)
    steps: [
      {
        name: 'Simple Calculator 시나리오',
        action: {
          type: 'custom',
          fn: async () => {
            await configManager.initialize();

            const endpoint = configManager.getCurrentEndpoint();
            const model = configManager.getCurrentModel();

            if (!endpoint || !model) {
              throw new Error('LLM endpoint and model must be configured');
            }

            const llmClient = new LLMClient();
            const orchestrator = new PlanExecuteOrchestrator(llmClient, {
              maxDebugAttempts: 3,
              taskTimeout: 60000,
              verbose: false,
            });

            let planCreated = false;
            let tasksCompleted = 0;

            orchestrator.on('planCreated', () => {
              planCreated = true;
            });

            orchestrator.on('todoCompleted', () => {
              tasksCompleted++;
            });

            const userRequest = 'Create a simple calculator module with add and subtract functions';

            const summary = await orchestrator.execute(userRequest);

            return {
              success: summary.success,
              planCreated,
              totalTasks: summary.totalTasks,
              completedTasks: summary.completedTasks,
              tasksCompleted,
              duration: summary.duration,
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result) => {
            // Plan이 생성되고 최소 1개 이상의 태스크가 완료되어야 함
            return result.planCreated && result.completedTasks >= 1;
          },
        },
      },
    ],
  },
];
