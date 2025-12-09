/**
 * Local RAG (검색 증강 생성) 테스트 시나리오
 * - 문서 검색
 * - 다단계 검색 전략
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DOCS_DIR = '/tmp/open-cli-docs-test';

export const localRagScenarios: TestScenario[] = [
  {
    id: 'rag-simple-search',
    name: '단순 문서 검색 테스트',
    description: '로컬 문서에서 키워드를 검색합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 60000,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'guide.md'),
        `# OPEN-CLI 사용 가이드

## 설치 방법
npm install로 설치할 수 있습니다.

## 사용법
open 명령어로 시작합니다.

## 주요 기능
- 파일 읽기/쓰기
- LLM 대화
- Plan & Execute
`
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DOCS_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: '문서 검색',
        action: { type: 'docs_search', query: '설치 방법', searchPath: TEST_DOCS_DIR },
        validation: { type: 'not_empty' },
      },
    ],
  },

  {
    id: 'rag-code-search',
    name: '코드 관련 문서 검색 테스트',
    description: '코드 관련 문서를 검색합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 60000,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'api.md'),
        `# API 문서

## LLMClient 클래스

\`\`\`typescript
const client = new LLMClient({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
  model: 'gpt-4'
});
\`\`\`

### 메서드
- sendMessage(prompt: string): Promise<string>
- chatCompletion(messages: Message[]): Promise<string>
`
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DOCS_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: 'LLMClient 관련 문서 검색',
        action: { type: 'docs_search', query: 'LLMClient', searchPath: TEST_DOCS_DIR },
        validation: { type: 'contains', value: 'LLMClient' },
      },
    ],
  },

  {
    id: 'rag-multi-file-search',
    name: '다중 파일 검색 테스트',
    description: '여러 문서에서 관련 정보를 검색합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 90000,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });

      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'intro.md'),
        `# 소개
OPEN-CLI는 오프라인 환경을 위한 CLI 도구입니다.
`
      );

      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'features.md'),
        `# 기능 목록
- 파일 관리
- LLM 통신
- 세션 관리
`
      );

      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'faq.md'),
        `# FAQ
Q: 오프라인에서 작동하나요?
A: 네, 완전히 오프라인으로 작동합니다.
`
      );
    },
    teardown: async () => {
      try {
        await fs.rm(TEST_DOCS_DIR, { recursive: true });
      } catch {
        // ignore
      }
    },
    steps: [
      {
        name: '오프라인 관련 검색',
        action: { type: 'docs_search', query: '오프라인', searchPath: TEST_DOCS_DIR },
        validation: { type: 'not_empty' },
      },
    ],
  },

  {
    id: 'rag-project-docs',
    name: '프로젝트 문서 검색 테스트',
    description: '실제 프로젝트 문서에서 검색합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 90000,
    steps: [
      {
        name: '프로젝트 docs 폴더 검색',
        action: {
          type: 'docs_search',
          query: '로깅',
          searchPath: process.cwd() + '/docs',
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            // 결과가 있거나, 문서가 없다는 메시지라도 괜찮음
            return typeof result === 'string' && result.length > 0;
          },
        },
      },
    ],
  },
];
