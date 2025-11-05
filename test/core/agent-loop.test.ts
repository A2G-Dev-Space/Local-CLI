/**
 * Agent Loop Tests
 *
 * Test the gather → act → verify → repeat loop implementation
 */

import { AgentLoopController } from '../../src/core/agent-loop.js';
import { TodoItem, Message, LLMResponse } from '../../src/types/index.js';

// Simple mock LLM client for testing
class MockLLMClient {
  private iterationCount = 0;

  async chatCompletion(options: any): Promise<LLMResponse> {
    const userContent = options.messages[options.messages.length - 1]?.content || '';
    this.iterationCount++;

    // Simulate different responses based on iteration
    if (userContent.includes('Iteration: 0')) {
      // First iteration - return action that will fail verification
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              description: 'Create test file',
              toolName: 'write_file',
              parameters: { file_path: 'test.txt', content: 'Hello' },
              reasoning: 'Creating initial test file',
            }),
          },
          finish_reason: 'stop',
        }],
      };
    } else if (userContent.includes('Iteration: 1')) {
      // Second iteration - fix based on feedback
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              description: 'Fix test file content',
              toolName: 'write_file',
              parameters: { file_path: 'test.txt', content: 'Hello World' },
              reasoning: 'Fixing content based on feedback',
            }),
          },
          finish_reason: 'stop',
        }],
      };
    } else {
      // Default response
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              description: 'Complete task',
              reasoning: 'Task should be complete',
            }),
          },
          finish_reason: 'stop',
        }],
      };
    }
  }

  async *chatCompletionStream(_options: any) {
    // Simplified stream mock
    yield {
      choices: [{
        delta: { content: 'Test response' },
      }],
    };
  }
}

describe('AgentLoopController', () => {
  let controller: AgentLoopController;
  let mockLLMClient: MockLLMClient;

  beforeEach(() => {
    mockLLMClient = new MockLLMClient();
    controller = new AgentLoopController(
      mockLLMClient as any, // Cast to any to avoid type issues
      [],
      {
        maxIterations: 3,
        verbose: false,
        enableLLMJudge: false,
      }
    );
  });

  describe('executeTodoWithLoop', () => {
    it('should execute a simple TODO successfully', async () => {
      const todo: TodoItem = {
        id: 'test-1',
        title: 'Create test file',
        description: 'Create a test.txt file with "Hello World"',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      };

      const messages: Message[] = [];

      const result = await controller.executeTodoWithLoop(todo, messages);

      expect(result).toBeDefined();
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });

    it('should handle iteration limits', async () => {
      const todo: TodoItem = {
        id: 'test-2',
        title: 'Complex task',
        description: 'A task that requires multiple iterations',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      };

      const messages: Message[] = [];

      // Create controller with only 1 iteration allowed
      const limitedController = new AgentLoopController(
        mockLLMClient as any,
        [],
        {
          maxIterations: 1,
          verbose: false,
        }
      );

      const result = await limitedController.executeTodoWithLoop(todo, messages);

      expect(result.iterations).toBe(1);
    });

    it('should provide progress updates', async () => {
      const todo: TodoItem = {
        id: 'test-3',
        title: 'Task with progress',
        description: 'Task that reports progress',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      };

      const messages: Message[] = [];
      const progressUpdates: any[] = [];

      await controller.executeTodoWithLoop(
        todo,
        messages,
        (update) => {
          progressUpdates.push(update);
        }
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      progressUpdates.forEach(update => {
        expect(update.iteration).toBeDefined();
        expect(update.action).toBeDefined();
      });
    });
  });

  describe('executeMultipleTodos', () => {
    it('should execute multiple TODOs sequentially', async () => {
      const todos: TodoItem[] = [
        {
          id: 'multi-1',
          title: 'First task',
          description: 'Do first thing',
          status: 'pending',
          requiresDocsSearch: false,
          dependencies: [],
        },
        {
          id: 'multi-2',
          title: 'Second task',
          description: 'Do second thing',
          status: 'pending',
          requiresDocsSearch: false,
          dependencies: ['multi-1'],
        },
      ];

      const { results, messages } = await controller.executeMultipleTodos(todos);

      expect(results).toHaveLength(2);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should skip TODOs with unmet dependencies', async () => {
      const todos: TodoItem[] = [
        {
          id: 'dep-1',
          title: 'Dependent task',
          description: 'This depends on non-existent task',
          status: 'pending',
          requiresDocsSearch: false,
          dependencies: ['non-existent'],
        },
      ];

      const { results } = await controller.executeMultipleTodos(todos);

      expect(results).toHaveLength(1);
      if (results[0]) {
        expect(results[0].success).toBe(false);
        expect(results[0].error).toContain('Dependencies not met');
      }
    });
  });

  describe('timeout handling', () => {
    it('should timeout if execution takes too long', async () => {
      const todo: TodoItem = {
        id: 'timeout-1',
        title: 'Timeout test',
        description: 'This should timeout',
        status: 'pending',
        requiresDocsSearch: false,
        dependencies: [],
      };

      // Create controller with very short timeout
      const timeoutController = new AgentLoopController(
        mockLLMClient as any,
        [],
        {
          maxIterations: 10,
          timeout: 1, // 1ms timeout
          verbose: false,
        }
      );

      // Add artificial delay in mock
      const originalChatCompletion = mockLLMClient.chatCompletion;
      mockLLMClient.chatCompletion = async function(this: MockLLMClient, options: any) {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
        return originalChatCompletion.call(this, options);
      };

      const result = await timeoutController.executeTodoWithLoop(todo, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});

// Simple integration test
describe('Agent Loop Basic Integration', () => {
  it('should complete without crashing', async () => {
    const mockClient = new MockLLMClient();
    const controller = new AgentLoopController(
      mockClient as any,
      [],
      {
        maxIterations: 2,
        verbose: false,
        enableLLMJudge: false,
      }
    );

    const todo: TodoItem = {
      id: 'integration-1',
      title: 'Integration test',
      description: 'Test full agent loop with all components',
      status: 'pending',
      requiresDocsSearch: false, // Disable to avoid file system operations
      dependencies: [],
    };

    // This will use real Context Gatherer, Action Executor, and Work Verifier
    const result = await controller.executeTodoWithLoop(todo, []);

    // Basic assertions - the actual execution might fail due to missing tools
    // but the loop should complete without crashing
    expect(result).toBeDefined();
    expect(result.iterations).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
  });
});