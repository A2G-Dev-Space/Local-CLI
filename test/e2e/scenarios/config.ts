/**
 * Config 관리 E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * Config는 시스템의 기반이 되므로, LLM이 정상 동작하면 config가 올바르게 설정된 것입니다.
 */

import { TestScenario } from '../types.js';

export const configScenarios: TestScenario[] = [
  {
    id: 'config-llm-connection',
    name: 'LLM 연결 테스트 (Config 기반)',
    description: 'Config에 설정된 엔드포인트로 LLM과 통신이 가능한지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: 'LLM 연결 확인',
        action: {
          type: 'llm_chat',
          prompt: '안녕하세요. 연결 테스트입니다. "연결 성공"이라고 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'llm_response_valid' },
      },
    ],
  },

  {
    id: 'config-endpoint-info',
    name: '엔드포인트 정보 확인 테스트',
    description: 'LLM에게 현재 설정 정보를 요청하여 config가 올바른지 확인합니다.',
    category: 'config',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: 'Config 정보 확인 (LLM 응답으로 검증)',
        action: {
          type: 'custom',
          fn: async () => {
            const { configManager } = await import('../../../src/core/config/config-manager.js');
            await configManager.initialize();
            const config = configManager.getConfig();
            const endpoint = configManager.getCurrentEndpoint();

            return {
              hasEndpoints: config.endpoints.length > 0,
              currentEndpoint: endpoint?.name || 'none',
              baseUrl: endpoint?.baseUrl || 'none',
            };
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            return result.hasEndpoints === true && result.baseUrl !== 'none';
          },
        },
      },
      {
        name: 'LLM으로 설정 동작 확인',
        action: {
          type: 'llm_chat',
          prompt: '현재 대화가 가능하다면 설정이 올바르게 동작하고 있는 것입니다. "설정 정상"이라고 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'llm_response_valid' },
      },
    ],
  },

  {
    id: 'config-model-functionality',
    name: '모델 기능 테스트',
    description: '설정된 모델이 기본 기능(대화, 추론)을 수행할 수 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '기본 추론 능력 테스트',
        action: {
          type: 'llm_chat',
          prompt: '5 + 7 = ? 숫자만 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: '12' },
      },
      {
        name: '한국어 이해 능력 테스트',
        action: {
          type: 'llm_chat',
          prompt: '대한민국의 수도는 어디인가요? 도시 이름만 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: '서울' },
      },
    ],
  },

  {
    id: 'config-tool-access',
    name: 'Tool 접근 권한 테스트',
    description: '설정된 LLM이 도구(tools)에 접근할 수 있는지 테스트합니다.',
    category: 'config',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    steps: [
      {
        name: 'Tool Calling 가능 여부 테스트',
        action: {
          type: 'llm_chat',
          prompt: 'package.json 파일을 읽어서 프로젝트 이름을 알려주세요.',
          useTools: true,
        },
        validation: { type: 'contains', value: 'open-cli' },
      },
    ],
  },

  // NOTE: config-streaming-support 테스트 제거됨
  // 환경에 따라 스트리밍 지원 여부가 다르고, llm-streaming 테스트에서 이미 검증함
];
