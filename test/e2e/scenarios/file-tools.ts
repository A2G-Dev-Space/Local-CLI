/**
 * File Tools E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * 사용자 → LLM → Tool Calling → 도구 함수 실행
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-e2e-file-test';

export const fileToolsScenarios: TestScenario[] = [
  {
    id: 'file-tools-write',
    name: 'LLM을 통한 파일 쓰기 테스트',
    description: 'LLM이 write_file 도구를 사용하여 파일을 생성합니다.',
    category: 'file-tools',
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
          prompt: `${path.join(TEST_DIR, 'hello.txt')} 파일에 "Hello, OPEN-CLI!"라는 내용을 작성해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '파일 내용 검증',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const content = await fs.readFile(path.join(TEST_DIR, 'hello.txt'), 'utf-8');
              return content;
            } catch {
              return '';
            }
          },
        },
        validation: { type: 'contains', value: 'Hello' },
      },
    ],
  },

  {
    id: 'file-tools-read',
    name: 'LLM을 통한 파일 읽기 테스트',
    description: 'LLM이 read_file 도구를 사용하여 파일을 읽습니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'project.json'),
        JSON.stringify({ name: 'OPEN-CLI-TEST', version: '1.0.0' }, null, 2)
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
        name: 'LLM에게 파일 읽기 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'project.json')} 파일을 읽고 프로젝트 이름을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'OPEN-CLI-TEST' },
      },
    ],
  },

  {
    id: 'file-tools-list',
    name: 'LLM을 통한 디렉토리 목록 조회 테스트',
    description: 'LLM이 list_files 도구를 사용하여 디렉토리 내용을 확인합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(TEST_DIR, 'readme.md'), '# README');
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
        name: 'LLM에게 디렉토리 목록 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DIR} 디렉토리에 어떤 파일들이 있는지 알려주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            const lower = result.toLowerCase();
            // 최소 하나의 파일 이름이 언급되어야 함
            return lower.includes('file1') || lower.includes('file2') || lower.includes('readme');
          },
        },
      },
    ],
  },

  {
    id: 'file-tools-find',
    name: 'LLM을 통한 파일 검색 테스트',
    description: 'LLM이 find_files 도구를 사용하여 파일을 검색합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'app.ts'), 'console.log("app")');
      await fs.writeFile(path.join(TEST_DIR, 'utils.ts'), 'export const utils = {}');
      await fs.writeFile(path.join(TEST_DIR, 'config.json'), '{}');
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
        name: 'LLM에게 TypeScript 파일 검색 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DIR} 디렉토리에서 .ts 확장자를 가진 파일들을 찾아주세요.`,
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            const lower = result.toLowerCase();
            return lower.includes('app.ts') || lower.includes('utils.ts') || lower.includes('.ts');
          },
        },
      },
    ],
  },

  {
    id: 'file-tools-read-and-summarize',
    name: 'LLM을 통한 파일 읽기 및 요약 테스트',
    description: 'LLM이 파일을 읽고 내용을 요약합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'info.md'),
        `# 프로젝트 정보

## 개요
이 프로젝트는 OPEN-CLI라는 이름의 오프라인 LLM CLI 도구입니다.

## 주요 기능
- 파일 읽기/쓰기
- LLM 대화
- Plan & Execute

## 버전
현재 버전: 2.0.0
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
        name: 'LLM에게 파일 읽고 버전 정보 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'info.md')} 파일을 읽고 프로젝트의 현재 버전을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: '2.0.0' },
      },
    ],
  },

  {
    id: 'file-tools-multi-operation',
    name: 'LLM을 통한 다중 파일 작업 테스트',
    description: 'LLM이 여러 파일 작업을 연속으로 수행합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, 'source.txt'),
        'Source Content: Important Data 12345'
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
        name: 'LLM에게 파일 읽고 다른 파일에 쓰기 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DIR, 'source.txt')} 파일을 읽고, 그 내용을 ${path.join(TEST_DIR, 'backup.txt')} 파일에 복사해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '복사된 파일 내용 검증',
        action: {
          type: 'custom',
          fn: async () => {
            try {
              const content = await fs.readFile(path.join(TEST_DIR, 'backup.txt'), 'utf-8');
              return content;
            } catch {
              return '';
            }
          },
        },
        validation: { type: 'contains', value: '12345' },
      },
    ],
  },
];
