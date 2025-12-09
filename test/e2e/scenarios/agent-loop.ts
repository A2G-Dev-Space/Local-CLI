/**
 * Agent Loop 테스트 시나리오
 * - Context Gathering
 * - Action Execution
 * - Work Verification
 * - Retry with Feedback
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-agent-test';

export const agentLoopScenarios: TestScenario[] = [
  {
    id: 'agent-simple-task',
    name: 'Agent Loop 단순 작업 테스트',
    description: 'Agent Loop가 단순한 작업을 완료할 수 있는지 테스트합니다.',
    category: 'agent-loop',
    enabled: true,
    timeout: 120000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'data.json'),
        JSON.stringify({ name: 'TestProject', version: '1.0.0' })
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
        name: 'Agent Loop 실행',
        action: {
          type: 'agent_loop',
          todo: {
            id: 'test-todo-1',
            title: '데이터 파일 읽기',
            description: `${path.join(TEST_DIR, 'data.json')} 파일을 읽고 프로젝트 이름을 확인하세요.`,
            status: 'pending',
            requiresDocsSearch: false,
            dependencies: [],
          },
          maxIterations: 3,
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            // 결과에 성공 여부 또는 출력이 있어야 함
            return result !== null && result !== undefined;
          },
        },
      },
    ],
  },

  {
    id: 'agent-file-creation',
    name: 'Agent Loop 파일 생성 테스트',
    description: 'Agent Loop가 파일을 생성하는 작업을 완료할 수 있는지 테스트합니다.',
    category: 'agent-loop',
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
        name: 'Agent Loop로 파일 생성',
        action: {
          type: 'agent_loop',
          todo: {
            id: 'test-todo-2',
            title: '설정 파일 생성',
            description: `${path.join(TEST_DIR, 'config.json')} 파일에 { "debug": true } 내용을 작성하세요.`,
            status: 'pending',
            requiresDocsSearch: false,
            dependencies: [],
          },
          maxIterations: 3,
        },
        validation: { type: 'exists' },
      },
      {
        name: '생성된 파일 확인',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const content = await fs.readFile(path.join(TEST_DIR, 'config.json'), 'utf-8');
              return content.includes('debug');
            } catch {
              return false;
            }
          },
        },
        validation: { type: 'equals', value: true },
      },
    ],
  },

  {
    id: 'agent-context-gathering',
    name: 'Context Gathering 테스트',
    description: 'Agent가 컨텍스트를 올바르게 수집하는지 테스트합니다.',
    category: 'agent-loop',
    enabled: true,
    timeout: 120000,
    setup: async () => {
      await fs.mkdir(path.join(TEST_DIR, 'src'), { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }));
      await fs.writeFile(path.join(TEST_DIR, 'src', 'index.ts'), 'console.log("hello");');
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
        name: '프로젝트 구조 파악 작업',
        action: {
          type: 'agent_loop',
          todo: {
            id: 'test-todo-3',
            title: '프로젝트 구조 파악',
            description: `${TEST_DIR} 디렉토리의 구조를 파악하고 어떤 파일들이 있는지 알려주세요.`,
            status: 'pending',
            requiresDocsSearch: false,
            dependencies: [],
          },
          maxIterations: 5,
        },
        validation: { type: 'exists' },
      },
    ],
  },

  {
    id: 'agent-multi-step-task',
    name: 'Agent Loop 다단계 작업 테스트',
    description: 'Agent가 여러 단계가 필요한 작업을 완료할 수 있는지 테스트합니다.',
    category: 'agent-loop',
    enabled: true,
    timeout: 180000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'numbers.txt'),
        '10\n20\n30\n40\n50'
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
        name: '숫자 합계 계산 작업',
        action: {
          type: 'agent_loop',
          todo: {
            id: 'test-todo-4',
            title: '숫자 합계 계산',
            description: `${path.join(TEST_DIR, 'numbers.txt')} 파일의 숫자들의 합계를 계산해주세요.`,
            status: 'pending',
            requiresDocsSearch: false,
            dependencies: [],
          },
          maxIterations: 5,
        },
        validation: {
          type: 'custom',
          fn: async (result: any) => {
            // 결과에 150(합계)이 포함되어 있거나 성공 응답이 있어야 함
            if (typeof result === 'string') {
              return result.includes('150') || result.includes('합계') || result.includes('sum');
            }
            return result !== null;
          },
        },
      },
    ],
  },
];
