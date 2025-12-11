/**
 * Local RAG (검색 증강 생성) E2E 테스트 시나리오
 *
 * 모든 테스트는 LLM을 통해 실행됩니다.
 * 사용자가 실제로 사용하는 것과 동일한 방식으로 검증합니다.
 *
 * RAG는 LLM이 로컬 문서를 검색하여 답변에 활용하는 기능입니다.
 */

import { TestScenario } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DOCS_DIR = '/tmp/open-cli-e2e-docs-test';

export const localRagScenarios: TestScenario[] = [
  {
    id: 'rag-llm-file-search',
    name: 'LLM을 통한 문서 검색 테스트',
    description: 'LLM이 로컬 문서를 검색하고 답변에 활용합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'api-guide.md'),
        `# API 사용 가이드

## 인증 방법
API 키를 헤더에 포함하여 요청합니다.
Authorization: Bearer YOUR_API_KEY

## 주요 엔드포인트
- GET /users - 사용자 목록 조회
- POST /users - 사용자 생성
- DELETE /users/:id - 사용자 삭제

## 비밀 설정 값
SECRET_CODE: RAG-TEST-12345
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
        name: 'LLM에게 문서 검색 요청',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DOCS_DIR, 'api-guide.md')} 파일을 읽고 SECRET_CODE 값을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'RAG-TEST-12345' },
      },
    ],
  },

  {
    id: 'rag-code-documentation',
    name: 'LLM을 통한 코드 문서 검색 테스트',
    description: 'LLM이 코드 관련 문서를 검색하고 설명합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });
      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'llm-client.md'),
        `# LLMClient 클래스 문서

## 개요
LLMClient는 LLM API와 통신하는 핵심 클래스입니다.

## 생성자
\`\`\`typescript
const client = new LLMClient();
\`\`\`

## 주요 메서드
### sendMessage(prompt: string): Promise<string>
단일 메시지를 전송하고 응답을 받습니다.

### chatCompletion(messages: Message[]): Promise<string>
대화 형식으로 메시지를 전송합니다.

## 클래스 버전
CLASS_VERSION: 3.0.0
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
        name: 'LLM에게 클래스 버전 질문',
        action: {
          type: 'llm_chat',
          prompt: `${path.join(TEST_DOCS_DIR, 'llm-client.md')} 파일을 읽고 LLMClient 클래스의 버전(CLASS_VERSION)을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: '3.0.0' },
      },
    ],
  },

  {
    id: 'rag-multi-doc-search',
    name: 'LLM을 통한 다중 문서 검색 테스트',
    description: 'LLM이 여러 문서에서 정보를 수집합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 600000,
    retryCount: 2,
    setup: async () => {
      await fs.mkdir(TEST_DOCS_DIR, { recursive: true });

      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'project-info.json'),
        JSON.stringify(
          {
            name: 'MULTI-DOC-TEST',
            version: '5.0.0',
            author: 'Test Author',
          },
          null,
          2
        )
      );

      await fs.writeFile(
        path.join(TEST_DOCS_DIR, 'changelog.md'),
        `# 변경 이력

## v5.0.0
- 새로운 기능 추가
- 버그 수정
- 성능 개선

## v4.0.0
- 이전 버전
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
        name: 'LLM에게 여러 파일 정보 요청',
        action: {
          type: 'llm_chat',
          prompt: `${TEST_DOCS_DIR} 디렉토리의 파일들을 확인하고, project-info.json의 프로젝트 이름을 알려주세요.`,
          useTools: true,
        },
        validation: { type: 'contains', value: 'MULTI-DOC-TEST' },
      },
    ],
  },

  {
    id: 'rag-project-docs-search',
    name: '실제 프로젝트 문서 검색 테스트',
    description: 'LLM이 실제 프로젝트의 docs 폴더에서 정보를 검색합니다.',
    category: 'local-rag',
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    steps: [
      {
        name: 'LLM에게 프로젝트 문서 검색 요청',
        action: {
          type: 'llm_chat',
          prompt: 'docs 폴더에 있는 문서들을 확인하고, 어떤 문서들이 있는지 알려주세요.',
          useTools: true,
        },
        validation: {
          type: 'custom',
          fn: async (result: string) => {
            // 응답이 있고 문서 관련 내용이 있으면 성공
            return (
              typeof result === 'string' &&
              result.length > 20 &&
              (result.includes('.md') ||
                result.includes('문서') ||
                result.includes('docs') ||
                result.includes('README'))
            );
          },
        },
      },
    ],
  },
];
