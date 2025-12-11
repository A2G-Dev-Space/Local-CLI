/**
 * LLM Client 테스트 시나리오
 * - chatCompletion (기본 대화)
 * - streaming (스트리밍 응답)
 * - Tool calling (도구 사용)
 */

import { TestScenario } from '../types.js';

export const llmClientScenarios: TestScenario[] = [
  {
    id: 'llm-basic-chat',
    name: '기본 대화 테스트',
    description: 'LLM과 기본적인 대화가 가능한지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '간단한 질문',
        action: {
          type: 'llm_chat',
          prompt: '1 + 1은 무엇인가요? 숫자만 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: '2' },
      },
    ],
  },

  {
    id: 'llm-korean-chat',
    name: '한국어 대화 테스트',
    description: 'LLM이 한국어를 이해하고 응답하는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '한국어 질문',
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
    id: 'llm-streaming',
    name: '스트리밍 응답 테스트',
    description: 'LLM 스트리밍 응답이 정상적으로 동작하는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '스트리밍 응답 수신',
        action: {
          type: 'llm_stream',
          prompt: '1부터 5까지 숫자를 나열해주세요.',
        },
        validation: { type: 'matches', pattern: '1.*2.*3.*4.*5' },
      },
    ],
  },

  {
    id: 'llm-long-response',
    name: '긴 응답 테스트',
    description: 'LLM이 긴 응답을 생성할 수 있는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 600000,
    steps: [
      {
        name: '긴 응답 요청',
        action: {
          type: 'llm_chat',
          prompt: '소프트웨어 개발에서 테스트의 중요성에 대해 3문단으로 설명해주세요.',
          useTools: false,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            // 최소 200자 이상
            return typeof result === 'string' && result.length >= 200;
          },
        },
      },
    ],
  },

  {
    id: 'llm-code-generation',
    name: '코드 생성 테스트',
    description: 'LLM이 코드를 생성할 수 있는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '간단한 함수 생성',
        action: {
          type: 'llm_chat',
          prompt: 'TypeScript로 두 숫자를 더하는 함수를 작성해주세요. 코드만 출력해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: 'function' },
      },
    ],
  },

  {
    id: 'llm-tool-calling',
    name: 'Tool Calling 테스트',
    description: 'LLM이 도구를 호출할 수 있는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '파일 도구 사용',
        action: {
          type: 'llm_chat',
          prompt: '현재 디렉토리에 어떤 파일들이 있는지 알려주세요.',
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
    ],
  },

  {
    id: 'llm-context-understanding',
    name: '컨텍스트 이해 테스트',
    description: 'LLM이 주어진 컨텍스트를 이해하는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    retryCount: 2, // LLM 비결정적 응답 대응
    steps: [
      {
        name: '컨텍스트 기반 질문',
        action: {
          type: 'llm_chat',
          prompt: `다음 정보를 참고해서 대답해주세요:
프로젝트 이름: OPEN-CLI
버전: 1.0.0
설명: 오프라인 기업용 LLM CLI 플랫폼

질문: 이 프로젝트의 이름은 무엇인가요?`,
          useTools: false,
        },
        validation: { type: 'contains', value: 'OPEN-CLI' },
      },
    ],
  },

  {
    id: 'llm-error-handling',
    name: '에러 처리 테스트',
    description: 'LLM이 에러 상황을 적절히 처리하는지 테스트합니다.',
    category: 'llm-client',
    enabled: true,
    timeout: 300000,
    steps: [
      {
        name: '존재하지 않는 파일 요청',
        action: {
          type: 'llm_chat',
          prompt: '/nonexistent/path/to/file.txt 파일을 읽어주세요.',
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            // 에러 메시지나 "존재하지 않음" 관련 응답이 있어야 함
            const lower = result.toLowerCase();
            return (
              lower.includes('error') ||
              lower.includes('not found') ||
              lower.includes('존재하지') ||
              lower.includes('없') ||
              lower.includes('찾을 수')
            );
          },
        },
      },
    ],
  },
];
