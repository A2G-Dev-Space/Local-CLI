/**
 * 통합 테스트 시나리오
 * - 전체 워크플로우 테스트
 * - 여러 기능의 연계 동작 확인
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-integration-test';

export const integrationScenarios: TestScenario[] = [
  {
    id: 'integration-full-workflow',
    name: '전체 워크플로우 테스트',
    description: 'LLM → Plan → Execute → Verify 전체 흐름을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 180000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'project-info.json'),
        JSON.stringify({
          name: 'Integration Test Project',
          version: '2.0.0',
          description: 'A test project for integration testing',
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
        name: '1. LLM으로 파일 읽기 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'project-info.json')} 파일을 읽고 프로젝트 이름과 버전을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'Integration Test Project' },
      },
      {
        name: '2. Plan 생성',
        action: {
          type: 'plan_generate',
          userRequest: `${TEST_DIR}에 summary.md 파일을 생성하고, project-info.json의 내용을 마크다운 형식으로 요약해주세요.`,
        },
        validation: { type: 'todos_generated', minCount: 1 },
      },
    ],
  },

  {
    id: 'integration-file-operations',
    name: '파일 작업 연계 테스트',
    description: '읽기 → 변환 → 쓰기 연계 동작을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 120000,
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
        name: 'CSV 파일 읽기',
        action: { type: 'file_read', path: path.join(TEST_DIR, 'data.csv') },
        validation: { type: 'contains', value: 'Alice' },
      },
      {
        name: 'LLM으로 데이터 분석 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'data.csv')} 파일을 읽고 평균 나이를 계산해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
    ],
  },

  {
    id: 'integration-session-workflow',
    name: '세션 저장/복원 워크플로우 테스트',
    description: '대화 → 세션 저장 → 세션 로드 → 대화 계속 흐름을 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 90000,
    steps: [
      {
        name: '1. 세션 저장',
        action: {
          type: 'custom',
          fn: async () => {
            const { sessionManager } = await import('../../../src/core/session-manager.js');
            const sessionId = `integration-test-${Date.now()}`;
            await sessionManager.saveSession(sessionId, {
              messages: [
                { role: 'user', content: '안녕하세요' },
                { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
              ],
              todos: [],
            });
            return sessionId;
          },
        },
        validation: { type: 'not_empty' },
      },
      {
        name: '2. 세션 목록에서 확인',
        action: { type: 'session_list' },
        validation: { type: 'is_array', minLength: 1 },
      },
    ],
  },

  {
    id: 'integration-error-recovery',
    name: '에러 복구 테스트',
    description: '에러 발생 후 정상적으로 복구되는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 60000,
    steps: [
      {
        name: '존재하지 않는 파일 읽기 시도',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const { executeReadFile } = await import('../../../src/tools/file-tools.js');
              await executeReadFile({ file_path: '/nonexistent/path/file.txt' });
              return { error: false };
            } catch (error: any) {
              return { error: true, message: error.message };
            }
          },
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => result.error === true,
        },
      },
      {
        name: '정상 파일 읽기 (복구 확인)',
        action: { type: 'file_read', path: 'package.json' },
        validation: { type: 'contains', value: 'open-cli' },
      },
    ],
  },

  {
    id: 'integration-concurrent-operations',
    name: '동시 작업 테스트',
    description: '여러 파일 작업이 동시에 처리되는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 60000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      for (let i = 1; i <= 3; i++) {
        await fs.writeFile(path.join(TEST_DIR, `file${i}.txt`), `Content of file ${i}`);
      }
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
        name: '여러 파일 동시 검색',
        action: { type: 'file_find', pattern: '*.txt', directory: TEST_DIR },
        validation: { type: 'is_array', minLength: 3 },
      },
      {
        name: '디렉토리 목록 확인',
        action: { type: 'file_list', directory: TEST_DIR },
        validation: { type: 'is_array', minLength: 3 },
      },
    ],
  },

  {
    id: 'integration-llm-tool-chain',
    name: 'LLM Tool Chain 테스트',
    description: 'LLM이 여러 도구를 연속으로 사용하는지 테스트합니다.',
    category: 'integration',
    enabled: true,
    timeout: 120000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'config.json'),
        JSON.stringify({ database: 'mongodb', port: 27017 })
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
          prompt: `${TEST_DIR} 디렉토리의 파일 목록을 확인하고, config.json 파일이 있으면 그 내용을 읽어서 어떤 데이터베이스를 사용하는지 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'mongodb' },
      },
    ],
  },
];
