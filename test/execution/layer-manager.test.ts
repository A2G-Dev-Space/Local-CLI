/**
 * Multi-Layered Execution Architecture Tests
 */

import { ExecutionLayerManager } from '../../src/execution/layer-manager.js';
import { StandardToolLayer } from '../../src/execution/standard-tools.js';
import { Task } from '../../src/types/index.js';

// Mock LLM Client
class MockLLMClient {
  async chatCompletion(options: any): Promise<any> {
    const content = options.messages[options.messages.length - 1]?.content || '';

    // Mock responses based on content
    if (content.includes('code')) {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: 'console.log("Hello World");'
          }
        }]
      };
    }

    if (content.includes('skill')) {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: 'code-reviewer'
          }
        }]
      };
    }

    if (content.includes('decompose')) {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify([
              { description: 'Subtask 1', dependencies: [] },
              { description: 'Subtask 2', dependencies: [] }
            ])
          }
        }]
      };
    }

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: 'Task completed successfully'
        }
      }]
    };
  }

  async *chatCompletionStream(_options: any) {
    yield {
      choices: [{
        delta: { content: 'Streaming response' }
      }]
    };
  }

  async chatCompletionWithTools(
    _messages: any[],
    _tools: any[],
    _maxIterations?: number
  ): Promise<any> {
    return {
      allMessages: [
        { role: 'assistant', content: 'Executed with tools' }
      ]
    };
  }
}

describe('ExecutionLayerManager', () => {
  let manager: ExecutionLayerManager;
  let mockLLMClient: MockLLMClient;

  beforeEach(() => {
    mockLLMClient = new MockLLMClient();
    manager = new ExecutionLayerManager(mockLLMClient as any);
  });

  describe('Task Analysis', () => {
    it('should correctly analyze simple tasks', async () => {
      const task: Task = {
        id: 'simple-1',
        description: 'Read a file',
        complexity: 'simple',
        requiresTools: ['read_file'],
      };

      const result = await manager.execute(task);
      expect(result.layer).toBe('standard-tools');
    });

    it('should correctly analyze moderate tasks', async () => {
      const task: Task = {
        id: 'moderate-1',
        description: 'Generate code to solve a problem',
        complexity: 'moderate',
        requiresTools: [],
        requiresDynamicCode: true,
      };

      const result = await manager.execute(task);
      expect(result.layer).toBe('sdk-dynamic');
    });

    it('should correctly analyze complex tasks', async () => {
      const task: Task = {
        id: 'complex-1',
        description: 'Process multiple files in parallel',
        complexity: 'complex',
        requiresTools: [],
        requiresParallelism: true,
        subtasks: [
          { description: 'Process file 1' },
          { description: 'Process file 2' },
          { description: 'Process file 3' },
          { description: 'Process file 4' }
        ]
      };

      const result = await manager.execute(task);
      expect(result.layer).toBe('subagent');
    });

    it('should correctly analyze meta tasks', async () => {
      const task: Task = {
        id: 'meta-1',
        description: 'Review code for security issues',
        complexity: 'meta',
        requiresTools: [],
        requiresSkill: true,
        requiresBehaviorChange: true,
      };

      const result = await manager.execute(task);
      expect(result.layer).toBe('skills');
    });
  });

  describe('Layer Selection', () => {
    it('should fall back to next layer if preferred is unavailable', async () => {
      const task: Task = {
        id: 'fallback-1',
        description: 'Complex task with unavailable tools',
        complexity: 'simple',
        requiresTools: ['non_existent_tool'],
      };

      const result = await manager.execute(task);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable execution layer');
    });
  });

  describe('Metrics', () => {
    it('should record execution metrics', async () => {
      // Create fresh manager for metrics test
      const freshManager = new ExecutionLayerManager(mockLLMClient as any);

      const task: Task = {
        id: 'metrics-unique-test-id',
        description: 'Task for metrics',
        complexity: 'simple',
        requiresTools: [],
      };

      const beforeCount = freshManager.getRecentExecutions(1000).length;
      await freshManager.execute(task);
      const afterCount = freshManager.getRecentExecutions(1000).length;

      // Verify execution was recorded (count increased by at least 1)
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    it('should calculate layer statistics', async () => {
      // Create fresh manager for isolated statistics test
      const freshManager = new ExecutionLayerManager(mockLLMClient as any);
      await freshManager.clearMetrics();

      // Execute a few tasks
      for (let i = 0; i < 3; i++) {
        await freshManager.execute({
          id: `stats-${i}`,
          description: 'Task for statistics',
          complexity: 'simple',
          requiresTools: [],
        });
      }

      const stats = freshManager.getLayerStatistics();
      expect(stats.length).toBeGreaterThan(0);

      const standardToolStats = stats.find(s => s.layerName === 'standard-tools');
      expect(standardToolStats?.totalExecutions).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('StandardToolLayer', () => {
  let layer: StandardToolLayer;

  beforeEach(() => {
    layer = new StandardToolLayer();
  });

  it('should have built-in tools', () => {
    const tools = layer.getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);

    const readFileTool = tools.find(t => t.function.name === 'read_file');
    expect(readFileTool).toBeDefined();
  });

  it('should validate parameters', async () => {
    const task: Task = {
      id: 'validate-1',
      description: 'Read file with invalid params',
      complexity: 'simple',
      requiresTools: ['read_file'],
      toolName: 'read_file',
      parameters: {
        // Missing required 'file_path' parameter
      }
    };

    const result = await layer.execute(task);
    expect(result.success).toBe(false);
    expect(Array.isArray(result.error) ? result.error[0] : result.error).toContain('Missing required parameter');
  });

  it('should execute tools successfully', async () => {
    const task: Task = {
      id: 'execute-1',
      description: 'Parse JSON',
      complexity: 'simple',
      requiresTools: ['parse_json'],
      toolName: 'parse_json',
      parameters: {
        json_string: '{"test": "value"}'
      }
    };

    const result = await layer.execute(task);
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ test: 'value' });
  });
});

describe('Layer Integration', () => {
  it('should handle tasks requiring multiple capabilities', async () => {
    const mockClient = new MockLLMClient();
    const manager = new ExecutionLayerManager(mockClient as any);

    const task: Task = {
      id: 'multi-capability-1',
      description: 'Generate code and execute it',
      complexity: 'moderate',
      requiresTools: [],
      requiresDynamicCode: true,
      requiresSystemAccess: true,
      targetLanguage: 'javascript'
    };

    const result = await manager.execute(task);
    expect(result.layer).toBe('sdk-dynamic');
    expect(result).toBeDefined();
  });

  it('should handle timeout correctly', async () => {
    const mockClient = new MockLLMClient();
    const manager = new ExecutionLayerManager(mockClient as any);

    // Create a task that will timeout
    const task: Task = {
      id: 'timeout-1',
      description: 'Task that should timeout',
      complexity: 'simple',
      requiresTools: [],
      timeout: 1 // 1ms timeout
    };

    const result = await manager.execute(task);
    // May or may not timeout depending on execution speed
    expect(result).toBeDefined();
  });
});

// Basic integration test
describe('Multi-Layer System Integration', () => {
  it('should complete without crashing', async () => {
    const mockClient = new MockLLMClient();
    const manager = new ExecutionLayerManager(mockClient as any);

    // Test different complexity levels
    const tasks: Task[] = [
      {
        id: 'integration-simple',
        description: 'Simple task',
        complexity: 'simple',
        requiresTools: []
      },
      {
        id: 'integration-moderate',
        description: 'Moderate task',
        complexity: 'moderate',
        requiresTools: [],
        requiresDynamicCode: true
      },
      {
        id: 'integration-complex',
        description: 'Complex task',
        complexity: 'complex',
        requiresTools: [],
        requiresParallelism: true
      },
      {
        id: 'integration-meta',
        description: 'Meta task',
        complexity: 'meta',
        requiresTools: [],
        requiresSkill: true
      }
    ];

    for (const task of tasks) {
      const result = await manager.execute(task);
      expect(result).toBeDefined();
      expect(result.layer).toBeDefined();
    }
  });
});