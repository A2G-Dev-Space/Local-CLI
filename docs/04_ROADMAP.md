# OPEN-CLI Roadmap & TODO List

> **문서 버전**: 3.0.0
> **최종 수정일**: 2025-12-11
> **작성자**: Development Team

## 목차

1. [개요](#1-개요)
2. [Phase 1: Plan-Execute Auto Mode 강화](#2-phase-1-plan-execute-auto-mode-강화)
3. [Phase 2: 승인 모드 / 자율 모드](#3-phase-2-승인-모드--자율-모드)
4. [Phase 3: 사용량 추적](#4-phase-3-사용량-추적)
5. [Phase 4: 문서 다운로드 내재화](#5-phase-4-문서-다운로드-내재화)
6. [Phase 5: Codebase RAG](#6-phase-5-codebase-rag)
7. [Phase 6: MCP 기능 지원](#7-phase-6-mcp-기능-지원)
8. [Phase 7: Tool Selector](#8-phase-7-tool-selector)
9. [우선순위 매트릭스](#9-우선순위-매트릭스)

---

## 1. 개요

### 1.1 현재 아키텍처 (v0.4.0)

| 항목 | 상태 |
|------|------|
| 실행 모드 | **auto only** (단일 모드) ✅ |
| 도구 분류 | **6가지 분류 시스템** ✅ |
| 도구 등록 | **중앙 등록 시스템** ✅ |

---

## 2. Phase 1: Plan-Execute Auto Mode 강화

> **목표**: 기존 Plan-Execute 시스템을 더 스마트하고 유연하게 강화
> **우선순위**: 🔴 높음

### 2.1 요청 분류 시스템

**현재**: 모든 요청에 Plan 생성
**목표**: LLM이 요청 유형을 자동 분류

```
User 요청
    ↓
┌─────────────────────────────────┐
│  LLM 요청 분류                   │
│  - 단순 응답 (simple_response)   │
│  - TODO 필요 (requires_todo)     │
└─────────────────────────────────┘
    ↓                    ↓
단순 응답            TODO 생성
(바로 출력)          (2.2로 진행)
```

- [ ] 요청 분류 프롬프트 설계
- [ ] 분류 결과에 따른 분기 처리
- [ ] 단순 응답 시 바로 사용자에게 출력

### 2.2 TODO List 생성 및 표시

**TODO 구조**:
```typescript
interface TodoItem {
  id: string;
  title: string;           // 사용자에게 표시
  description: string;     // Ctrl+T로 토글 표시
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
```

- [ ] TODO 생성 프롬프트 (title + description)
- [ ] UI: title만 기본 표시
- [ ] UI: `Ctrl+T`로 description 토글 (show/hide)
- [ ] TODO 상태 표시 UI 개선

### 2.3 TODO 관리 LLM Tool

**`update-todo-list` Tool 설계**:
```typescript
interface UpdateTodoListTool {
  name: 'update-todo-list';
  parameters: {
    todo_id: string;
    status: 'in_progress' | 'completed' | 'failed';
    note?: string;  // 선택적 메모
  };
}
```

- [ ] `update-todo-list` LLM Tool 구현
- [ ] 모든 LLM 요청에 현재 TODO 상태 포함
- [ ] TODO 관리 유의사항 프롬프트 추가
- [ ] 마지막 TODO 완료 시 프롬프트에서 TODO 관련 내용 제거

### 2.4 Human Interrupt 처리

**현재 상태 확인 필요**:
- [ ] ESC 키로 진행 중단 기능 확인/구현
- [ ] 중단 후 사용자 입력 처리
- [ ] 중단 없이 사용자 입력 처리 (병렬 입력)

**구현 방향**:
```
LLM 작업 중
    ↓
┌─────────────────────────────────┐
│  사용자 입력 감지                │
│  - ESC: 현재 작업 중단           │
│  - 텍스트: 큐에 저장 또는 즉시 처리│
└─────────────────────────────────┘
```

- [ ] 입력 이벤트 리스너 분리
- [ ] 작업 중단 시그널 처리
- [ ] 중단 후 상태 복구

### 2.5 사용자 승인 제거

**현재**: Plan 생성 후 사용자 승인 필요
**목표**: 승인 없이 자동 진행 (Phase 2에서 모드로 분리)

- [ ] Plan 승인 프롬프트 제거
- [ ] TODO 업데이트 승인 제거
- [ ] 자동 진행 로직 구현

---

## 3. Phase 2: 승인 모드 / 자율 모드

> **목표**: Human-in-the-Loop 강화 및 모드 분리
> **우선순위**: 🔴 높음
> **의존성**: Phase 1

### 3.1 Ask-to-User LLM Tool

**Tool 설계**:
```typescript
interface AskToUserTool {
  name: 'ask-to-user';
  parameters: {
    question: string;
    options: string[];      // 최소 2개 필수
    allow_other: boolean;   // "Other" 선택 시 주관식 입력
  };
}
```

**UI 표시**:
```
┌─────────────────────────────────┐
│  LLM 질문: 어떤 방식을 선호하시나요? │
│                                 │
│  [1] Option A                   │
│  [2] Option B                   │
│  [3] Other (직접 입력)           │
│                                 │
│  선택: _                         │
└─────────────────────────────────┘
```

- [ ] `ask-to-user` LLM Tool 구현
- [ ] 선택지 UI 컴포넌트
- [ ] "Other" 선택 시 텍스트 입력

### 3.2 승인 모드 (Approval Mode)

**Native Tool 실행 시 승인 요청**:
```
┌─────────────────────────────────┐
│  LLM이 다음 동작을 시도합니다:    │
│                                 │
│  [bash] rm -rf ./temp           │
│                                 │
│  [A] 승인                        │
│  [Y] 승인 (이 동작 항상 허용)     │
│  [N] 거부                        │
│  [C] 거부 + 코멘트               │
│                                 │
│  선택: _                         │
└─────────────────────────────────┘
```

- [ ] 승인 요청 UI 구현
- [ ] "항상 허용" 패턴 저장
- [ ] 거부 시 코멘트 입력 및 LLM 전달

### 3.3 자율 모드 (Autonomous Mode)

- [ ] 모드 전환 설정 (`/settings` 또는 `/mode`)
- [ ] 자율 모드에서 승인 없이 진행
- [ ] 모드별 동작 분기

### 3.4 설정 구조

```json
// ~/.open-cli/config.json
{
  "executionMode": "approval",  // "approval" | "autonomous"
  "approvedPatterns": [
    "bash:ls *",
    "bash:cat *",
    "file:read *"
  ],
  "blockedPatterns": [
    "bash:rm -rf *",
    "bash:sudo *"
  ]
}
```

---

## 4. Phase 3: 사용량 추적

> **목표**: 토큰 사용량 및 비용 추적
> **우선순위**: 🟡 중간 (독립적, 빠르게 구현 가능)

### 4.1 `/usage` User Command

```
/usage                    # 현재 세션 사용량
/usage today              # 오늘 사용량
/usage week               # 이번 주 사용량
/usage month              # 이번 달 사용량
```

- [ ] `/usage` 명령어 구현
- [ ] 세션별 토큰 추적
- [ ] 일별/주별/월별 집계

### 4.2 UI 표시

- [ ] StatusBar에 토큰 사용량 표시 (현재 일부 구현됨)
- [ ] 비용 계산 및 표시 (설정 기반)

### 4.3 데이터 저장

```
~/.open-cli/
├── usage/
│   ├── 2025-12-11.json   # 일별 사용량
│   └── ...
```

- [ ] 사용량 데이터 구조 정의
- [ ] 저장/조회 로직 구현

---

## 5. Phase 4: 문서 다운로드 내재화

> **목표**: scripts/ 하위 문서 다운로드 기능을 `/docs` 명령어로 내재화
> **우선순위**: 🟡 중간

### 5.1 현재 구조 분석

```
scripts/
├── download-docs.sh      # 문서 다운로드 스크립트
└── ...
```

- [ ] 기존 scripts 분석
- [ ] 다운로드 대상 문서 목록 파악

### 5.2 `/docs` User Command 구현

```
/docs                     # 도움말 표시
/docs list                # 다운로드 가능한 문서 목록
/docs download <name>     # 특정 문서 다운로드
/docs add <url> <name>    # 새 문서 소스 추가
/docs remove <name>       # 문서 소스 제거
```

- [ ] `/docs` 명령어 구현
- [ ] 다운로드 진행률 표시
- [ ] 다운로드된 문서 인덱싱 (Local RAG 연동)

### 5.3 사용자 정의 문서 소스

**설정 파일 구조**:
```json
// ~/.open-cli/docs-sources.json
{
  "sources": [
    {
      "name": "react-docs",
      "type": "git",
      "url": "https://internal.company.com/docs/react.git",
      "branch": "main",
      "path": "docs/"
    },
    {
      "name": "api-spec",
      "type": "url",
      "url": "https://internal.company.com/api/openapi.yaml"
    }
  ]
}
```

- [ ] 문서 소스 설정 파일 구조 정의
- [ ] Git 기반 문서 다운로드
- [ ] URL 기반 문서 다운로드
- [ ] 기업 내부망 인증 지원 (SSH, Token)

---

## 6. Phase 5: Codebase RAG

> **목표**: 대규모 코드베이스를 LLM이 이해하기 쉽게 인덱싱
> **우선순위**: 🟡 중간
> **의존성**: Local RAG 분석 필요

### 6.1 현재 Local RAG 분석

**현재 구조**:
- 폴더/파일 이름 기반 분류 (책 목차처럼)
- Vector 기반이 아닌 구조적 검색

- [ ] 현재 Local RAG 코드 분석
- [ ] 검색 로직 파악
- [ ] 개선점 도출

### 6.2 Local RAG 강화

- [ ] 검색 정확도 개선
- [ ] 캐싱 최적화
- [ ] 증분 인덱싱

### 6.3 `/indexing` User Command

```
/indexing                 # 도움말
/indexing start           # 코드베이스 인덱싱 시작
/indexing status          # 인덱싱 상태 확인
/indexing refresh         # 변경된 파일만 재인덱싱
```

**인덱싱 과정**:
```
코드베이스
    ↓
┌─────────────────────────────────┐
│  1. 파일 구조 스캔               │
│  2. 주요 파일 식별               │
│     - 진입점 (main, index)      │
│     - 설정 파일                  │
│     - 핵심 모듈                  │
│  3. LLM으로 요약 생성            │
│  4. 인덱스 저장                  │
└─────────────────────────────────┘
    ↓
~/.open-cli/projects/{cwd}/index.json
```

- [ ] `/indexing` 명령어 구현
- [ ] 코드 구조 분석기
- [ ] LLM 기반 코드 요약
- [ ] 인덱스 저장/로드

### 6.4 인덱스 구조

```typescript
interface CodebaseIndex {
  projectPath: string;
  lastIndexed: string;
  structure: {
    entryPoints: string[];      // 진입점 파일
    configFiles: string[];      // 설정 파일
    modules: ModuleSummary[];   // 모듈별 요약
  };
  files: {
    [path: string]: {
      type: 'code' | 'config' | 'docs' | 'test';
      summary: string;          // LLM 생성 요약
      exports?: string[];       // 내보내는 함수/클래스
      dependencies?: string[];  // 의존성
    };
  };
}
```

---

## 7. Phase 6: MCP 기능 지원

> **목표**: Model Context Protocol 통합
> **우선순위**: 🟡 중간

### 7.1 MCP Client 구현

- [ ] MCP 프로토콜 구현 (JSON-RPC)
- [ ] stdio 전송 지원
- [ ] SSE 전송 지원
- [ ] 서버 연결/해제 관리

### 7.2 MCP Registry

```
/mcp                      # 도움말
/mcp list                 # 연결된 서버 목록
/mcp add <config>         # 서버 추가
/mcp remove <server>      # 서버 제거
/mcp enable <tool>        # 도구 활성화
/mcp disable <tool>       # 도구 비활성화
```

- [ ] `/mcp` 명령어 구현
- [ ] MCP 서버 설정 저장
- [ ] Tool enable/disable 관리

### 7.3 MCP Tool 통합

- [ ] MCP Tool을 LLM Tool로 자동 등록
- [ ] Tool Selector와 연동 (Phase 7)

---

## 8. Phase 7: Tool Selector

> **목표**: LLM Tool이 많아질 경우 성능 저하 방지
> **우선순위**: 🟢 낮음 (Tool이 많아진 후 구현)

### 8.1 문제 정의

```
현재: 모든 LLM Tool을 프롬프트에 포함
문제: Tool 수 증가 → 프롬프트 길이 증가 → 성능 저하
```

### 8.2 해결 방안

```
User 요청
    ↓
┌─────────────────────────────────┐
│  Tool Selector (경량 LLM 호출)   │
│  "이 요청에 필요한 도구 선택"     │
└─────────────────────────────────┘
    ↓
선택된 Tool만 포함하여 메인 LLM 호출
```

### 8.3 구조 준비

- [ ] `tools/selector/` 폴더 구조 생성
- [ ] Tool 메타데이터 정의 (name, description, keywords)
- [ ] Tool Selector 인터페이스 정의

**폴더 구조**:
```
tools/
├── selector/
│   ├── index.ts              # Tool Selector 진입점
│   ├── tool-metadata.ts      # Tool 메타데이터 정의
│   └── selector-prompt.ts    # 선택 프롬프트
```

---

## 9. 우선순위 매트릭스

### 9.1 구현 순서

| Phase | 항목 | 우선순위 | 의존성 |
|-------|------|----------|--------|
| 1 | Plan-Execute Auto Mode 강화 | 🔴 높음 | - |
| 2 | 승인 모드 / 자율 모드 | 🔴 높음 | Phase 1 |
| 3 | 사용량 추적 | 🟡 중간 | - |
| 4 | 문서 다운로드 내재화 | 🟡 중간 | - |
| 5 | Codebase RAG | 🟡 중간 | Local RAG 분석 |
| 6 | MCP 기능 지원 | 🟡 중간 | - |
| 7 | Tool Selector | 🟢 낮음 | Tool 수 증가 후 |

### 9.2 권장 구현 순서

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
   ↓         ↓         ↓         ↓         ↓         ↓         ↓
 핵심      HITL      빠른      문서      코드      외부      최적화
 UX       강화      구현      관리      분석      연동     (나중에)
```

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
