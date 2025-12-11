/**
 * Tool Registry E2E 테스트 시나리오
 *
 * 도구 중앙 등록 시스템 테스트
 */

import { TestScenario } from '../types.js';

export const toolRegistryScenarios: TestScenario[] = [
  {
    id: 'tool-registry-initialization',
    name: 'Tool Registry 초기화 테스트',
    description: 'Tool Registry가 정상적으로 초기화되고 도구들이 등록되었는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Registry 초기화 및 도구 목록 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { toolRegistry } = await import('../../../src/tools/registry.js');

            const stats = toolRegistry.getStats();
            const allTools = toolRegistry.listAll();

            return {
              llmSimpleCount: stats['llm-simple'],
              llmAgentCount: stats['llm-agent'],
              systemSimpleCount: stats['system-simple'],
              systemAgentCount: stats['system-agent'],
              userCommandCount: stats['user-command'],
              mcpCount: stats['mcp'],
              totalTools: allTools.length,
              hasFileTools: allTools.includes('read_file') && allTools.includes('write_file'),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            // LLM Simple tools should have file tools (read_file, write_file, list_files, find_files)
            return (
              result.llmSimpleCount >= 4 &&
              result.hasFileTools === true &&
              result.totalTools >= 4
            );
          },
        },
      },
    ],
  },

  {
    id: 'tool-registry-llm-tools',
    name: 'LLM Tool Definitions 테스트',
    description: 'LLM Tool Definitions이 정상적으로 생성되는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'LLM Tool Definitions 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { toolRegistry } = await import('../../../src/tools/registry.js');

            const definitions = toolRegistry.getLLMToolDefinitions();

            return {
              definitionCount: definitions.length,
              hasReadFile: definitions.some(d => d.function.name === 'read_file'),
              hasWriteFile: definitions.some(d => d.function.name === 'write_file'),
              hasListFiles: definitions.some(d => d.function.name === 'list_files'),
              hasFindFiles: definitions.some(d => d.function.name === 'find_files'),
              allHaveType: definitions.every(d => d.type === 'function'),
              allHaveFunction: definitions.every(d => d.function && d.function.name && d.function.description),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.definitionCount >= 4 &&
              result.hasReadFile === true &&
              result.hasWriteFile === true &&
              result.hasListFiles === true &&
              result.hasFindFiles === true &&
              result.allHaveType === true &&
              result.allHaveFunction === true
            );
          },
        },
      },
    ],
  },

  {
    id: 'tool-registry-system-agent-tools',
    name: 'System Agent Tools 테스트',
    description: 'System Agent Tools (docs-search)가 정상적으로 등록되었는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'System Agent Tools 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { toolRegistry } = await import('../../../src/tools/registry.js');

            const systemAgentTools = toolRegistry.getSystemAgentTools();

            return {
              toolCount: systemAgentTools.length,
              hasDocsSearch: systemAgentTools.some(t => t.name === 'docs-search'),
              allHaveTriggerCondition: systemAgentTools.every(t => typeof t.triggerCondition === 'function'),
              allRequireSubLLM: systemAgentTools.every(t => t.requiresSubLLM === true),
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.toolCount >= 1 &&
              result.hasDocsSearch === true &&
              result.allHaveTriggerCondition === true &&
              result.allRequireSubLLM === true
            );
          },
        },
      },
    ],
  },

  {
    id: 'tool-registry-category-types',
    name: 'Tool Category Types 테스트',
    description: '각 카테고리의 타입이 올바른지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'Type 인터페이스 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const {
              isLLMSimpleTool,
              isLLMAgentTool,
              isSystemSimpleTool,
              isSystemAgentTool,
              isUserCommand,
              isMCPTool,
            } = await import('../../../src/tools/types.js');

            // Create mock objects to test type guards
            const mockLLMSimple = {
              definition: { type: 'function', function: { name: 'test', description: 'test' } },
              execute: async () => ({ success: true }),
              categories: ['llm-simple'],
            };

            const mockLLMAgent = {
              definition: { type: 'function', function: { name: 'test', description: 'test' } },
              execute: async () => ({ success: true }),
              categories: ['llm-agent'],
              requiresSubLLM: true as const,
            };

            const mockSystemSimple = {
              name: 'test',
              execute: async () => ({ success: true }),
              triggerCondition: () => false,
              categories: ['system-simple'],
            };

            const mockSystemAgent = {
              name: 'test',
              execute: async () => ({ success: true }),
              triggerCondition: () => false,
              categories: ['system-agent'],
              requiresSubLLM: true as const,
            };

            return {
              isLLMSimpleCorrect: isLLMSimpleTool(mockLLMSimple as any),
              isLLMAgentCorrect: isLLMAgentTool(mockLLMAgent as any),
              isSystemSimpleCorrect: isSystemSimpleTool(mockSystemSimple as any),
              isSystemAgentCorrect: isSystemAgentTool(mockSystemAgent as any),
              functionsExist: typeof isUserCommand === 'function' && typeof isMCPTool === 'function',
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return (
              result.isLLMSimpleCorrect === true &&
              result.isLLMAgentCorrect === true &&
              result.isSystemSimpleCorrect === true &&
              result.isSystemAgentCorrect === true &&
              result.functionsExist === true
            );
          },
        },
      },
    ],
  },
];
