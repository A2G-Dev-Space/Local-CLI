/**
 * LLM Client Tests - Model Compatibility Layer
 *
 * 이 테스트는 ConfigManager를 모킹하여 실제 설정 파일을 변경하지 않습니다.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Message } from '../../src/types/index.js';

// Mock configManager to avoid modifying real config files
jest.unstable_mockModule('../../src/core/config/config-manager.js', () => ({
  configManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn().mockReturnValue({
      version: '0.1.0',
      currentEndpoint: 'test-endpoint',
      currentModel: 'gpt-oss-120b',
      endpoints: [
        {
          id: 'test-endpoint',
          name: 'Test Endpoint',
          baseUrl: 'http://localhost:3000/v1',
          apiKey: 'test-key',
          models: [
            {
              id: 'gpt-oss-120b',
              name: 'GPT-OSS 120B',
              maxTokens: 4096,
              enabled: true
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      settings: {
        autoApprove: false,
        debugMode: false,
        streamResponse: true,
        autoSave: true
      }
    }),
    getCurrentEndpoint: jest.fn().mockReturnValue({
      id: 'test-endpoint',
      name: 'Test Endpoint',
      baseUrl: 'http://localhost:3000/v1',
      apiKey: 'test-key',
      models: [
        {
          id: 'gpt-oss-120b',
          name: 'GPT-OSS 120B',
          maxTokens: 4096,
          enabled: true
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getCurrentModel: jest.fn().mockReturnValue({
      id: 'gpt-oss-120b',
      name: 'GPT-OSS 120B',
      maxTokens: 4096,
      enabled: true
    }),
  }
}));

// Dynamic import after mock setup
const { LLMClient } = await import('../../src/core/llm/llm-client.js');

describe('LLMClient - Model Compatibility Layer', () => {
  let client: LLMClient;

  beforeEach(() => {
    // Create client (will use mocked ConfigManager settings)
    client = new LLMClient();
  });

  describe('preprocessMessages for gpt-oss models', () => {
    it('should add content field to assistant messages with tool_calls for gpt-oss-120b', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: 'Test message',
        },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{}',
              },
            },
          ],
        },
      ];

      // Call private method using reflection
      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      expect(processedMessages[1].content).toBeDefined();
      expect(processedMessages[1].content).toBe('Calling tools: test_tool');
    });

    it('should add content field to assistant messages with tool_calls for gpt-oss-20b', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'read_file',
                arguments: '{"path": "test.txt"}',
              },
            },
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'write_file',
                arguments: '{"path": "output.txt", "content": "test"}',
              },
            },
          ],
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-20b');

      expect(processedMessages[0].content).toBeDefined();
      expect(processedMessages[0].content).toBe('Calling tools: read_file, write_file');
    });

    it('should preserve existing content if already present', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Existing content',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{}',
              },
            },
          ],
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      expect(processedMessages[0].content).toBe('Existing content');
    });

    it('should use reasoning_content if available', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{}',
              },
            },
          ],
          reasoning_content: 'Let me analyze this request',
        } as any,
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      expect(processedMessages[0].content).toBe('Let me analyze this request');
    });

    it('should not modify messages for non-gpt-oss models', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{}',
              },
            },
          ],
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-4');

      expect(processedMessages[0]).toEqual(messages[0]);
      expect(processedMessages[0].content).toBeUndefined();
    });

    it('should not modify user or system messages', () => {
      const messages: Message[] = [
        {
          role: 'system',
          content: 'System prompt',
        },
        {
          role: 'user',
          content: 'User message',
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      expect(processedMessages).toEqual(messages);
    });

    it('should handle mixed message types correctly', () => {
      const messages: Message[] = [
        {
          role: 'system',
          content: 'System prompt',
        },
        {
          role: 'user',
          content: 'User message',
        },
        {
          role: 'assistant',
          content: 'Regular assistant message',
        },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: '{}',
              },
            },
          ],
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      // First 3 messages should be unchanged
      expect(processedMessages[0]).toEqual(messages[0]);
      expect(processedMessages[1]).toEqual(messages[1]);
      expect(processedMessages[2]).toEqual(messages[2]);

      // Last message should have content added
      expect(processedMessages[3].content).toBe('Calling tools: test_tool');
    });

    it('should handle empty tool_calls array', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          tool_calls: [],
        },
      ];

      const processedMessages = (client as any).preprocessMessages(messages, 'gpt-oss-120b');

      expect(processedMessages[0]).toEqual(messages[0]);
      expect(processedMessages[0].content).toBeUndefined();
    });
  });

  describe('model pattern matching', () => {
    it('should match gpt-oss-120b case-insensitive', () => {
      const models = ['gpt-oss-120b', 'GPT-OSS-120B', 'Gpt-Oss-120b'];

      models.forEach(model => {
        const messages: Message[] = [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'test',
                  arguments: '{}',
                },
              },
            ],
          },
        ];

        const processedMessages = (client as any).preprocessMessages(messages, model);
        expect(processedMessages[0].content).toBe('Calling tools: test');
      });
    });

    it('should match gpt-oss-20b case-insensitive', () => {
      const models = ['gpt-oss-20b', 'GPT-OSS-20B', 'Gpt-Oss-20B'];

      models.forEach(model => {
        const messages: Message[] = [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'test',
                  arguments: '{}',
                },
              },
            ],
          },
        ];

        const processedMessages = (client as any).preprocessMessages(messages, model);
        expect(processedMessages[0].content).toBe('Calling tools: test');
      });
    });

    it('should not match similar but different model names', () => {
      const models = ['gpt-oss-120', 'gpt-oss-20', 'gpt-oss-120b-v2', 'gpt-120b', 'oss-120b'];

      models.forEach(model => {
        const messages: Message[] = [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'test',
                  arguments: '{}',
                },
              },
            ],
          },
        ];

        const processedMessages = (client as any).preprocessMessages(messages, model);
        expect(processedMessages[0].content).toBeUndefined();
      });
    });
  });
});