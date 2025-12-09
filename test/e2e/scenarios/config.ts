/**
 * Config 관리 테스트 시나리오
 * - 설정 읽기
 * - 엔드포인트 확인
 * - 모델 정보 확인
 */

import { TestScenario } from '../types.js';

export const configScenarios: TestScenario[] = [
  {
    id: 'config-read',
    name: '설정 읽기 테스트',
    description: '현재 설정을 읽을 수 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 10000,
    steps: [
      {
        name: '전체 설정 읽기',
        action: { type: 'config_get' },
        validation: { type: 'is_object', hasKeys: ['endpoints'] },
      },
    ],
  },

  {
    id: 'config-endpoints',
    name: '엔드포인트 설정 테스트',
    description: '엔드포인트가 올바르게 설정되어 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 10000,
    steps: [
      {
        name: '엔드포인트 목록 확인',
        action: { type: 'config_get', key: 'endpoints' },
        validation: {
          type: 'custom',
          fn: async (endpoints: any) => {
            if (!Array.isArray(endpoints)) return false;
            if (endpoints.length === 0) {
              console.log('Warning: No endpoints configured');
              return true; // 경고만 하고 통과
            }

            // 첫 번째 엔드포인트 구조 확인
            const ep = endpoints[0];
            return (
              typeof ep.name === 'string' &&
              typeof ep.baseURL === 'string' &&
              Array.isArray(ep.models)
            );
          },
        },
      },
    ],
  },

  {
    id: 'config-model-info',
    name: '모델 정보 테스트',
    description: '모델 정보가 올바르게 설정되어 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 10000,
    steps: [
      {
        name: '모델 정보 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { configManager } = await import('../../../src/core/config-manager.js');
            await configManager.initialize();
            const config = configManager.getConfig();
            const endpoint = config.endpoints[0];

            if (!endpoint) {
              return { warning: 'No endpoint configured' };
            }

            return {
              endpointName: endpoint.name,
              baseURL: endpoint.baseURL,
              models: endpoint.models,
            };
          },
        },
        validation: { type: 'exists' },
      },
    ],
  },

  {
    id: 'config-initialization',
    name: 'ConfigManager 초기화 테스트',
    description: 'ConfigManager가 올바르게 초기화되는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 10000,
    steps: [
      {
        name: 'ConfigManager 초기화',
        action: {
          type: 'custom',
          fn: async () => {
            const { configManager } = await import('../../../src/core/config-manager.js');
            await configManager.initialize();
            return configManager.isInitialized();
          },
        },
        validation: { type: 'equals', value: true },
      },
    ],
  },

  {
    id: 'config-llm-client-creation',
    name: 'LLM Client 생성 테스트',
    description: '설정을 기반으로 LLM Client를 생성할 수 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 30000,
    steps: [
      {
        name: 'LLM Client 생성 및 연결 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { configManager } = await import('../../../src/core/config-manager.js');
            const { LLMClient } = await import('../../../src/core/llm-client.js');

            await configManager.initialize();
            const config = configManager.getConfig();
            const endpoint = config.endpoints[0];

            if (!endpoint) {
              return { success: false, error: 'No endpoint configured' };
            }

            try {
              const client = new LLMClient({
                baseURL: endpoint.baseURL,
                apiKey: endpoint.apiKey,
                model: endpoint.models[0]?.id || 'default',
                maxTokens: endpoint.models[0]?.maxTokens || 4096,
              });

              // 간단한 테스트 요청
              const response = await client.sendMessage('Hi');
              return { success: true, responseReceived: response.length > 0 };
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.success === true || result.error?.includes('No endpoint');
          },
        },
      },
    ],
  },
];
