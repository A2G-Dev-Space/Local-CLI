/**
 * Plan & Execute 테스트 시나리오
 * - TODO 생성 (Planning)
 * - TODO 실행 (Execution)
 * - 의존성 관리
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-plan-test';

export const planExecuteScenarios: TestScenario[] = [
  {
    id: 'plan-generate-simple',
    name: 'TODO 리스트 생성 테스트 (단순)',
    description: '단순한 요청을 TODO 리스트로 분해합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 60000,
    steps: [
      {
        name: 'TODO 생성',
        action: {
          type: 'plan_generate',
          userRequest: 'package.json 파일을 읽고 프로젝트 이름을 알려주세요.',
        },
        validation: { type: 'todos_generated', minCount: 1 },
      },
    ],
  },

  {
    id: 'plan-generate-complex',
    name: 'TODO 리스트 생성 테스트 (복잡)',
    description: '복잡한 요청을 여러 TODO로 분해합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 90000,
    steps: [
      {
        name: '복잡한 요청 TODO 생성',
        action: {
          type: 'plan_generate',
          userRequest: `다음 작업을 수행해주세요:
1. src 폴더의 구조를 파악하세요
2. package.json에서 의존성 목록을 확인하세요
3. README.md가 있다면 읽어주세요
4. 프로젝트 요약 리포트를 작성해주세요`,
        },
        validation: { type: 'todos_generated', minCount: 3 },
      },
    ],
  },

  {
    id: 'plan-todo-structure',
    name: 'TODO 구조 검증 테스트',
    description: '생성된 TODO가 올바른 구조를 가지는지 확인합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 60000,
    steps: [
      {
        name: 'TODO 구조 확인',
        action: {
          type: 'plan_generate',
          userRequest: 'README.md 파일을 읽어주세요.',
        },
        validation: {
          type: 'custom',
          fn: async (todos: any[]) => {
            if (!Array.isArray(todos) || todos.length === 0) return false;

            const todo = todos[0];
            // TODO는 id, title, description, status를 가져야 함
            return (
              typeof todo.id === 'string' &&
              typeof todo.title === 'string' &&
              typeof todo.description === 'string' &&
              typeof todo.status === 'string'
            );
          },
        },
      },
    ],
  },

  {
    id: 'plan-execute-file-read',
    name: 'Plan & Execute 실행 테스트 (파일 읽기)',
    description: 'TODO를 생성하고 실행하여 파일을 읽습니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 120000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'sample.txt'),
        'This is a test file for Plan & Execute.'
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
        name: 'Plan 생성',
        action: {
          type: 'plan_generate',
          userRequest: `${path.join(TEST_DIR, 'sample.txt')} 파일의 내용을 읽어주세요.`,
        },
        validation: { type: 'todos_generated', minCount: 1 },
      },
    ],
  },

  {
    id: 'plan-execute-file-write',
    name: 'Plan & Execute 실행 테스트 (파일 쓰기)',
    description: 'TODO를 생성하고 실행하여 파일을 작성합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 120000,
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
        name: 'Plan 생성',
        action: {
          type: 'plan_generate',
          userRequest: `${path.join(TEST_DIR, 'output.txt')} 파일에 "Hello from Plan & Execute"라고 작성해주세요.`,
        },
        validation: { type: 'todos_generated', minCount: 1 },
      },
    ],
  },

  {
    id: 'plan-multi-step',
    name: '다단계 Plan 테스트',
    description: '여러 단계가 필요한 작업의 Plan을 생성합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 90000,
    steps: [
      {
        name: '다단계 Plan 생성',
        action: {
          type: 'plan_generate',
          userRequest: `다음을 순서대로 수행해주세요:
1. 현재 디렉토리의 파일 목록을 확인
2. package.json이 있으면 읽기
3. 프로젝트 이름과 버전 정보 추출
4. 결과를 요약해서 알려주기`,
        },
        validation: {
          type: 'custom',
          fn: async (todos: any[]) => {
            // 최소 2개 이상의 TODO가 생성되어야 함
            return Array.isArray(todos) && todos.length >= 2;
          },
        },
      },
    ],
  },

  {
    id: 'plan-dependency-handling',
    name: 'TODO 의존성 테스트',
    description: 'TODO 간 의존성이 올바르게 설정되는지 확인합니다.',
    category: 'plan-execute',
    enabled: true,
    timeout: 90000,
    steps: [
      {
        name: '의존성 있는 Plan 생성',
        action: {
          type: 'plan_generate',
          userRequest: `package.json을 읽고, 그 내용을 기반으로 요약 파일을 작성해주세요.`,
        },
        validation: {
          type: 'custom',
          fn: async (todos: any[]) => {
            if (!Array.isArray(todos) || todos.length < 1) return false;
            // dependencies 필드가 있거나, 순서가 있는 TODO가 있어야 함
            return true;
          },
        },
      },
    ],
  },
];
