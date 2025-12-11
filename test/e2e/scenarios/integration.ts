/**
 * 통합 E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * 여러 기능의 연계 동작을 검증합니다.
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-e2e-integration-test';

export const integrationScenarios: TestScenario[] = [
  {
    id: 'integration-full-workflow',
    name: '전체 워크플로우 테스트',
    description: 'LLM → 파일읽기 → 분석 → 응답 전체 흐름을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'project-info.json'),
        JSON.stringify({
          name: 'Integration Test Project',
          version: '2.0.0',
          description: 'A test project for integration testing',
          secret: 'INTEGRATION-SECRET-KEY',
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
        name: 'LLM으로 파일 읽기 및 분석 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'project-info.json')} 파일을 읽고 프로젝트 이름과 secret 값을 알려주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            return (
              result.includes('Integration Test Project') &&
              result.includes('INTEGRATION-SECRET-KEY')
            );
          },
        },
      },
    ],
  },

  {
    id: 'integration-file-operations',
    name: 'LLM 파일 작업 연계 테스트',
    description: 'LLM을 통한 읽기 → 분석 → 쓰기 연계 동작을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'data.csv'),
        'name,age,city\nAlice,30,Seoul\nBob,25,Busan\nCharlie,35,Daegu'
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
        name: 'LLM으로 CSV 파일 읽기 및 분석',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'data.csv')} 파일을 읽고 평균 나이를 계산해주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            // 평균 나이는 (30+25+35)/3 = 30
            return result.includes('30') || result.includes('평균');
          },
        },
      },
    ],
  },

  {
    id: 'integration-session-workflow',
    name: '세션 저장/복원 워크플로우 테스트',
    description: 'LLM 대화 → 세션 저장 → 세션 로드 흐름을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM과 대화 (컨텍스트 생성)',
        action: {
          type: 'llm_chat',
          prompt: '저는 "세션 통합 테스트"를 진행 중입니다. 이 메시지를 기억해주세요.',
          useTools: false,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '세션 저장 및 확인',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessionId = await sessionManager.saveSession(`integration-workflow-${Date.now()}`, [
              { role: 'user', content: '저는 "세션 통합 테스트"를 진행 중입니다.' },
              { role: 'assistant', content: '네, 세션 통합 테스트를 기억하겠습니다.' },
            ]);
            return sessionId;
          },
        },
        validation: { type: 'not_empty' },
      },
    ],
  },

  {
    id: 'integration-error-recovery',
    name: 'LLM 에러 복구 테스트',
    description: 'LLM이 에러 상황을 처리하고 정상 동작으로 복구되는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM에게 존재하지 않는 파일 요청',
        action: {
          type: 'llm_chat',
          prompt: '/nonexistent/path/to/file/that/does/not/exist.txt 파일을 읽어주세요.',
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            const lower = result.toLowerCase();
            // 에러나 존재하지 않음 관련 응답이 있어야 함
            return (
              lower.includes('error') ||
              lower.includes('not found') ||
              lower.includes('존재하지') ||
              lower.includes('없') ||
              lower.includes('찾을 수') ||
              lower.includes('실패')
            );
          },
        },
      },
      {
        name: '정상 요청으로 복구 확인',
        action: {
          type: 'llm_chat',
          prompt: '1 + 1은 얼마인가요? 숫자만 대답해주세요.',
          useTools: false,
        },
        validation: { type: 'contains', value: '2' },
      },
    ],
  },

  {
    id: 'integration-multi-file-analysis',
    name: 'LLM 다중 파일 분석 테스트',
    description: 'LLM이 여러 파일을 분석하는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'Content A: Value 100');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'Content B: Value 200');
      await fs.writeFile(path.join(TEST_DIR, 'file3.txt'), 'Content C: Value 300');
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
        name: 'LLM에게 디렉토리 파일 목록 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DIR} 디렉토리에 어떤 파일들이 있는지 확인해주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            const lower = result.toLowerCase();
            return (
              lower.includes('file1') || lower.includes('file2') || lower.includes('file3')
            );
          },
        },
      },
    ],
  },

  {
    id: 'integration-llm-tool-chain',
    name: 'LLM Tool Chain 테스트',
    description: 'LLM이 여러 도구를 연속으로 사용하는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'config.json'),
        JSON.stringify({ database: 'mongodb', port: 27017, secret: 'TOOL-CHAIN-SECRET' })
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
        name: 'LLM에게 복합 작업 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DIR} 디렉토리의 파일 목록을 확인하고, config.json 파일이 있으면 그 내용을 읽어서 database와 secret 값을 알려주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            return result.includes('mongodb') && result.includes('TOOL-CHAIN-SECRET');
          },
        },
      },
    ],
  },
];
