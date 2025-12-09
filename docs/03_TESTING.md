# 테스트 가이드 (Testing Guide)

이 문서는 OPEN-CLI의 E2E 테스트 시스템을 설명합니다.
**모든 PR은 테스트 통과 후 생성해야 합니다.**

---

## 목차

1. [빠른 시작](#1-빠른-시작)
2. [테스트 명령어](#2-테스트-명령어)
3. [테스트 카테고리](#3-테스트-카테고리)
4. [테스트 출력 이해하기](#4-테스트-출력-이해하기)
5. [새 테스트 추가하기](#5-새-테스트-추가하기)
6. [문제 해결](#6-문제-해결)

---

## 1. 빠른 시작

### PR 생성 전 필수 실행

```bash
# 모든 테스트 실행 (단위 + E2E)
npm run test:all

# 또는 E2E만 실행
npm run test:e2e
```

### 테스트 통과 시 출력

```
╔════════════════════════════════════════════════════════════╗
║          OPEN-CLI E2E Test Suite                          ║
╚════════════════════════════════════════════════════════════╝

테스트 시나리오 현황:
  file-tools     ██████░░░░ 6개
  llm-client     ████████░░ 8개
  plan-execute   ███████░░░ 7개
  ...

════════════════════════════════════════════════════════════
                        테스트 결과 요약
════════════════════════════════════════════════════════════

  ████████████████████████████████████████

  Total:   45
  Passed:  45
  Failed:  0

  ✓ 모든 테스트가 통과했습니다!
```

---

## 2. 테스트 명령어

### 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run test:e2e` | E2E 테스트 실행 |
| `npm run test:e2e:verbose` | 상세 로그와 함께 실행 |
| `npm run test:e2e:list` | 테스트 목록만 출력 |
| `npm run test:all` | 단위 테스트 + E2E 테스트 |
| `npm run prepr` | PR 전 검증 (lint + E2E) |

### 옵션

```bash
# 상세 로그 출력
npm run test:e2e -- --verbose

# 특정 카테고리만 실행
npm run test:e2e -- --filter llm-client

# 첫 실패 시 중단
npm run test:e2e -- --fail-fast

# 조합 사용
npm run test:e2e -- --verbose --filter file-tools --fail-fast
```

---

## 3. 테스트 카테고리

### file-tools (파일 도구)
- `read_file`: 파일 읽기
- `write_file`: 파일 쓰기
- `list_files`: 디렉토리 목록
- `find_files`: 파일 검색
- LLM을 통한 파일 작업

### llm-client (LLM 클라이언트)
- 기본 대화
- 한국어 대화
- 스트리밍 응답
- 코드 생성
- Tool Calling
- 에러 처리

### plan-execute (Plan & Execute)
- TODO 리스트 생성
- 복잡한 요청 분해
- TODO 구조 검증
- 의존성 처리

### agent-loop (Agent Loop)
- 단순 작업 실행
- 파일 생성 작업
- Context Gathering
- 다단계 작업

### session (세션 관리)
- 세션 저장
- 세션 로드
- 세션 목록 조회
- 영속성 검증

### config (설정 관리)
- 설정 읽기
- 엔드포인트 확인
- 모델 정보 확인
- LLM Client 생성

### local-rag (로컬 RAG)
- 단순 문서 검색
- 코드 관련 검색
- 다중 파일 검색
- 프로젝트 문서 검색

### integration (통합 테스트)
- 전체 워크플로우
- 파일 작업 연계
- 세션 워크플로우
- 에러 복구
- LLM Tool Chain

---

## 4. 테스트 출력 이해하기

### 시나리오 실행 출력

```
┌─ [file-tools] 파일 쓰기 테스트 (file-tools-write)
│ write_file 도구로 파일을 생성하고 내용을 작성합니다.
│
│  ✓ Setup
│  ✓ 파일 쓰기
│  ✓ 파일 존재 확인
│  ✓ Teardown
│
└─ ✓ PASSED 1234ms
```

### 상태 아이콘

| 아이콘 | 의미 |
|--------|------|
| ✓ | 성공 |
| ✗ | 실패 |
| ○ | 실행 중 / 대기 |

### 실패 시 출력

```
┌─ [llm-client] 기본 대화 테스트 (llm-basic-chat)
│ LLM과 기본적인 대화가 가능한지 테스트합니다.
│
│  ✗ 간단한 질문 - Timeout after 60000ms
│
└─ ✗ FAILED 60001ms
   Error: Timeout after 60000ms

실패한 테스트:
  ✗ 기본 대화 테스트
    Timeout after 60000ms
    - 간단한 질문: Timeout after 60000ms
```

---

## 5. 새 테스트 추가하기

### 5.1 시나리오 파일 위치

```
test/e2e/scenarios/
├── file-tools.ts
├── llm-client.ts
├── plan-execute.ts
├── agent-loop.ts
├── session.ts
├── config.ts
├── local-rag.ts
├── integration.ts
└── index.ts
```

### 5.2 시나리오 구조

```typescript
import { TestScenario } from '../types.js';

export const myScenarios: TestScenario[] = [
  {
    id: 'my-test-id',           // 고유 ID
    name: '테스트 이름',          // 표시 이름
    description: '테스트 설명',   // 설명
    category: 'integration',    // 카테고리
    enabled: true,              // 활성화 여부
    timeout: 60000,             // 타임아웃 (ms)

    // 테스트 전 설정 (선택)
    setup: async () => {
      // 테스트 환경 설정
    },

    // 테스트 후 정리 (선택)
    teardown: async () => {
      // 테스트 환경 정리
    },

    // 테스트 단계
    steps: [
      {
        name: '단계 이름',
        action: { type: 'llm_chat', prompt: '테스트 질문' },
        validation: { type: 'contains', value: '예상 응답' },
      },
    ],
  },
];
```

### 5.3 Action 타입

| 타입 | 설명 | 파라미터 |
|------|------|----------|
| `llm_chat` | LLM 대화 | prompt, useTools? |
| `llm_stream` | 스트리밍 대화 | prompt |
| `file_read` | 파일 읽기 | path |
| `file_write` | 파일 쓰기 | path, content |
| `file_list` | 디렉토리 목록 | directory |
| `file_find` | 파일 검색 | pattern, directory? |
| `plan_generate` | Plan 생성 | userRequest |
| `agent_loop` | Agent Loop | todo, maxIterations? |
| `docs_search` | 문서 검색 | query, searchPath? |
| `session_save` | 세션 저장 | sessionId? |
| `session_load` | 세션 로드 | sessionId |
| `session_list` | 세션 목록 | - |
| `config_get` | 설정 조회 | key? |
| `custom` | 커스텀 함수 | fn |

### 5.4 Validation 타입

| 타입 | 설명 | 파라미터 |
|------|------|----------|
| `exists` | 결과가 존재 | - |
| `not_empty` | 빈 값 아님 | - |
| `contains` | 문자열 포함 | value |
| `not_contains` | 문자열 미포함 | value |
| `equals` | 값 동일 | value |
| `matches` | 정규식 매칭 | pattern |
| `is_array` | 배열인지 | minLength? |
| `is_object` | 객체인지 | hasKeys? |
| `file_exists` | 파일 존재 | path |
| `llm_response_valid` | 유효한 LLM 응답 | - |
| `todos_generated` | TODO 생성됨 | minCount? |
| `custom` | 커스텀 검증 | fn |

### 5.5 시나리오 등록

`test/e2e/scenarios/index.ts`에 추가:

```typescript
export { myScenarios } from './my-scenarios.js';

import { myScenarios } from './my-scenarios.js';

export function getAllScenarios(): TestScenario[] {
  return [
    // ... 기존 시나리오
    ...myScenarios,
  ];
}
```

---

## 6. 문제 해결

### Q: 테스트가 타임아웃됩니다

**A:** LLM 응답 시간이 길 수 있습니다. 시나리오의 `timeout`을 늘려보세요.

```typescript
{
  timeout: 180000, // 3분
  // ...
}
```

### Q: LLM 연결 에러가 발생합니다

**A:** 설정을 확인하세요.

```bash
# 설정 확인
open config show

# 재설정
open config init
```

### Q: 특정 테스트만 실행하고 싶습니다

**A:** `--filter` 옵션을 사용하세요.

```bash
npm run test:e2e -- --filter llm-client
npm run test:e2e -- --filter file-tools-write  # ID로 필터
```

### Q: 상세 로그를 보고 싶습니다

**A:** `--verbose` 옵션을 사용하세요.

```bash
npm run test:e2e -- --verbose
```

### Q: 테스트 파일을 정리하지 못하고 종료됐습니다

**A:** 임시 파일을 수동으로 삭제하세요.

```bash
rm -rf /tmp/open-cli-*
```

---

## PR 체크리스트

PR 생성 전 다음을 확인하세요:

- [ ] `npm run lint` 통과
- [ ] `npm run test:e2e` 통과
- [ ] 새 기능에 테스트 시나리오 추가 (해당 시)
- [ ] 기존 테스트가 깨지지 않음

```bash
# 한 번에 검증
npm run prepr
```

---

**질문이 있으면 GitHub Issues를 이용해주세요!**
