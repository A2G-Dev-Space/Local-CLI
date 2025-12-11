/**
 * Plan & Execute E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * Plan & Execute는 LLM이 복잡한 요청을 TODO로 분해하고 실행하는 기능입니다.
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-e2e-plan-test';

export const planExecuteScenarios: TestScenario[] = [
  {
    id: 'plan-simple-request',
    name: 'LLM을 통한 단순 Plan 생성 테스트',
    description: 'LLM이 단순한 요청을 TODO로 분해합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM에게 단순 작업 요청',
        action: {
          type: 'llm_chat',
          prompt: 'package.json 파일을 읽고 프로젝트 이름을 알려주세요.',
          useTools: true,
        },
        validation: { type: 'contains', value: 'open-cli' },
      },
    ],
  },

  {
    id: 'plan-complex-request',
    name: 'LLM을 통한 복잡한 Plan 생성 테스트',
    description: 'LLM이 복잡한 요청을 처리합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'config.json'),
        JSON.stringify({
          app: 'TestApp',
          version: '1.2.3',
          features: ['feature1', 'feature2'],
        })
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 복잡한 분석 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'config.json')} 파일을 읽고 다음 정보를 알려주세요:
1. 앱 이름
2. 버전
3. 기능 개수`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            return (
              result.includes('TestApp') &&
              result.includes('1.2.3') &&
              (result.includes('2') || result.includes('두'))
            );
          },
        },
      },
    ],
  },

  {
    id: 'plan-file-read-execute',
    name: 'Plan & Execute 파일 읽기 실행 테스트',
    description: 'LLM이 파일 읽기 계획을 세우고 실행합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'sample.txt'),
        'Sample Content: PLAN-EXECUTE-TEST-VALUE'
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 파일 읽기 및 값 추출 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'sample.txt')} 파일을 읽고 "PLAN-EXECUTE-TEST-VALUE" 값이 있는지 확인해주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'PLAN-EXECUTE-TEST-VALUE' },
      },
    ],
  },

  {
    id: 'plan-file-write-execute',
    name: 'Plan & Execute 파일 쓰기 실행 테스트',
    description: 'LLM이 파일 쓰기 계획을 세우고 실행합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 파일 쓰기 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'output.txt')} 파일에 "Plan Execute Success 2024"라고 작성해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '파일 내용 확인',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const content = await fs.readFile(path.join(TEST_DIR, 'output.txt'), 'utf-8');
              return content;
            } catch {
              return '';
            }
          },
        },
        validation: { type: 'contains', value: 'Plan Execute Success' },
      },
    ],
  },

  {
    id: 'plan-multi-step',
    name: 'LLM 다단계 Plan 테스트',
    description: 'LLM이 여러 단계가 필요한 작업을 처리합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(path.join(TEST_DIR, 'subdir'), { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'multi-step-test', version: '3.0.0' })
      );
      await fs.writeFile(
        path.join(TEST_DIR, 'subdir', 'data.json'),
        JSON.stringify({ key: 'MULTI-STEP-KEY', value: 12345 })
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 다단계 분석 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DIR} 디렉토리의 파일 구조를 파악하고, subdir/data.json의 key 값을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'MULTI-STEP-KEY' },
      },
    ],
  },

  {
    id: 'plan-dependency-handling',
    name: 'LLM 의존성 처리 Plan 테스트',
    description: 'LLM이 의존성이 있는 작업을 순서대로 처리합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'source.json'),
        JSON.stringify({ data: 'DEPENDENCY-SOURCE-DATA', timestamp: '2024-01-01' })
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 읽기 후 쓰기 요청 (의존성)',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'source.json')} 파일을 읽고, 그 data 값을 ${path.join(TEST_DIR, 'target.txt')} 파일에 작성해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '의존성 작업 결과 확인',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const content = await fs.readFile(path.join(TEST_DIR, 'target.txt'), 'utf-8');
              return content;
            } catch {
              return '';
            }
          },
        },
        validation: { type: 'contains', value: 'DEPENDENCY-SOURCE-DATA' },
      },
    ],
  },

  {
    id: 'plan-code-analysis',
    name: 'LLM 코드 분석 Plan 테스트',
    description: 'LLM이 코드 파일을 분석합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'example.ts'),
        `// Example TypeScript file
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export const VERSION = "CODE-ANALYSIS-VERSION-1.0";
`
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLM에게 코드 분석 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'example.ts')} 파일을 읽고 VERSION 상수의 값을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'CODE-ANALYSIS-VERSION-1.0' },
      },
    ],
  },
];
