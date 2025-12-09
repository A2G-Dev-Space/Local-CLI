/**
 * File Tools 테스트 시나리오
 * - read_file
 * - write_file
 * - list_files
 * - find_files
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '/tmp/open-cli-test';
const TEST_FILE = path.join(TEST_DIR, 'test-file.txt');
const TEST_CONTENT = 'Hello, OPEN-CLI Test!';

export const fileToolsScenarios: TestScenario[] = [
  {
    id: 'file-tools-write',
    name: '파일 쓰기 테스트',
    description: 'write_file 도구로 파일을 생성하고 내용을 작성합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 10000,
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
        name: '파일 쓰기',
        action: { type: 'file_write', path: TEST_FILE, content: TEST_CONTENT },
        validation: { type: 'contains', value: 'success' },
      },
      {
        name: '파일 존재 확인',
        action: { type: 'custom', fn: async () => fs.access(TEST_FILE).then(() => true).catch(() => false) },
        validation: { type: 'equals', value: true },
      },
    ],
  },

  {
    id: 'file-tools-read',
    name: '파일 읽기 테스트',
    description: 'read_file 도구로 파일 내용을 읽습니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 10000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(TEST_FILE, TEST_CONTENT);
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
        name: '파일 읽기',
        action: { type: 'file_read', path: TEST_FILE },
        validation: { type: 'contains', value: TEST_CONTENT },
      },
    ],
  },

  {
    id: 'file-tools-list',
    name: '디렉토리 목록 테스트',
    description: 'list_files 도구로 디렉토리 내 파일 목록을 조회합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 10000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(TEST_DIR, 'file3.md'), 'content3');
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
        name: '디렉토리 목록 조회',
        action: { type: 'file_list', directory: TEST_DIR },
        validation: { type: 'is_array', minLength: 3 },
      },
    ],
  },

  {
    id: 'file-tools-find',
    name: '파일 검색 테스트',
    description: 'find_files 도구로 패턴에 맞는 파일을 검색합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 10000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(TEST_DIR, 'doc.md'), 'content3');
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
        name: '.txt 파일 검색',
        action: { type: 'file_find', pattern: '*.txt', directory: TEST_DIR },
        validation: { type: 'is_array', minLength: 2 },
      },
      {
        name: '.md 파일 검색',
        action: { type: 'file_find', pattern: '*.md', directory: TEST_DIR },
        validation: { type: 'is_array', minLength: 1 },
      },
    ],
  },

  {
    id: 'file-tools-llm-read',
    name: 'LLM을 통한 파일 읽기 테스트',
    description: 'LLM이 read_file 도구를 사용하여 파일을 읽습니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 60000,
    setup: async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(TEST_FILE, 'Project Name: OPEN-CLI\nVersion: 1.0.0');
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
          prompt: `${TEST_FILE} 파일을 읽고 프로젝트 이름을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'OPEN-CLI' },
      },
    ],
  },

  {
    id: 'file-tools-llm-write',
    name: 'LLM을 통한 파일 쓰기 테스트',
    description: 'LLM이 write_file 도구를 사용하여 파일을 작성합니다.',
    category: 'file-tools',
    enabled: true,
    timeout: 60000,
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
          prompt: `${path.join(TEST_DIR, 'hello.txt')} 파일에 "Hello World"라고 작성해주세요.`,
          useTools: true,
        },
        validation: { type: 'llm_response_valid' },
      },
      {
        name: '파일 내용 확인',
        action: { type: 'file_read', path: path.join(TEST_DIR, 'hello.txt') },
        validation: { type: 'contains', value: 'Hello' },
      },
    ],
  },
];
