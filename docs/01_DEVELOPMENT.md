# 개발자 종합 가이드 (Development Guide)

> **문서 버전**: 10.0.0 (v2.5.0)
> **최종 수정일**: 2025-12-16

이 문서는 **LOCAL-CLI** 프로젝트의 전체 구조, 아키텍처, 핵심 기능, 개발 규칙을 설명합니다.

---

## 목차

1. [프로젝트 정체성](#1-프로젝트-정체성)
2. [기술 스택](#2-기술-스택)
3. [폴더 구조](#3-폴더-구조)
4. [핵심 기능 상세](#4-핵심-기능-상세)
5. [데이터 흐름 아키텍처](#5-데이터-흐름-아키텍처)
6. [새 기능 추가하기](#6-새-기능-추가하기)
7. [코딩 규칙](#7-코딩-규칙)
8. [CLI 실행 모드](#8-cli-실행-모드)

---

## 1. 프로젝트 정체성

### LOCAL-CLI란?

**오프라인 기업 환경을 위한 로컬 LLM CLI 플랫폼**입니다.

- 인터넷 없이 독립적으로 작동
- 기업의 로컬 LLM 서버(OpenAI Compatible)와 연결
- AI가 직접 파일을 읽고, 쓰고, 검색하고, 코드를 실행
- 터미널에서 Interactive UI로 AI와 대화

### 핵심 기능 (v2.5.0)

| 기능 | 설명 |
|------|------|
| **LLM-based Docs Search** | 폴더 구조 기반 LLM 결정으로 문서 검색 트리거 |
| **Hierarchical Docs Navigation** | 폴더 탐색 기반 문서 검색 (list_directory, read_docs_file, preview_file) |
| **Docs Search Progress UI** | 문서 검색 중 실시간 진행 상황 표시 |
| **Centralized Prompts** | 모든 프롬프트 `src/prompts/`로 중앙 집중화 |
| **Unified Agents** | `src/agents/`에 모든 에이전트 통합 (classifier, planner, docs-search) (v2.5.0) |
| **Simplified Tools** | `src/tools/`에서 미사용 폴더 제거, registry 패턴 적용 (v2.5.0) |
| **Orchestration Refactor** | `src/orchestration/`에서 비즈니스 로직 분리, usePlanExecution을 thin wrapper로 (v2.5.0) |
| **Supervised Mode** | 파일 수정 도구 실행 전 사용자 승인 (Tab 키 토글) |
| **Plan & Execute** | 복잡한 작업을 자동으로 분해하여 순차 실행 |
| **Unified Execution Loop** | Planning/Direct 모드 통합 실행 루프 |
| **TODO Context Injection** | TODO 상태를 매 호출마다 LLM에 주입 (히스토리 오염 방지) |
| **Bash Tool** | Shell 명령어 실행 (git, npm, build 등) 보안 검증 포함 |
| **Language Priority** | 사용자 입력 언어와 동일한 언어로 응답 |
| 요청 분류 | simple_response vs requires_todo 자동 분류 |
| ask-to-user Tool | LLM이 사용자에게 질문 (2-4 선택지 + Other) |
| tell_to_user Tool | LLM이 사용자에게 진행 상황 메시지 전달 |
| 사용량 추적 | 세션/일별/월별 토큰 통계 |
| 문서 다운로드 | /docs download agno, adk |
| **Auto-Compact** | Context 80% 도달 시 자동 대화 압축 (마지막 2개 메시지 보존) |
| Context 표시 | `Context (1.3K / 13%)` 형식으로 토큰/비율 표시 |
| 단일 Tool 실행 | `parallel_tool_calls: false` API 파라미터로 강제 |
| Claude Code 스타일 상태바 | `✶ ~하는 중… (esc to interrupt · 2m 7s · ↑ 3.6k tokens)` |
| Static Log 시스템 | 스크롤 가능한 로그 이력 (Ink Static 컴포넌트) |
| Tool 아이콘 표시 | 각 도구별 이모지 아이콘 (📖📝✏️📂🔍🔧💬) |

---

## 2. 기술 스택

| 항목 | 기술 |
|------|------|
| 언어 | TypeScript (ESM) |
| 런타임 | Node.js v20+ |
| CLI | Commander.js |
| UI | Ink (React), Chalk |
| HTTP | Axios |
| 빌드 | tsc |

---

## 3. 폴더 구조

### 3.1 전체 구조

```
src/
├── cli.ts                          # CLI 진입점 (lcli 명령)
├── index.ts                        # 라이브러리 진입점
├── constants.ts                    # 상수 정의
│
├── core/                           # 핵심 인프라 로직
│   ├── llm/                        # LLM 통신
│   │   ├── llm-client.ts           # LLM API 클라이언트
│   │   └── index.ts
│   │
│   ├── config/                     # 설정 관리
│   │   ├── config-manager.ts       # 설정 파일 관리
│   │   └── index.ts
│   │
│   ├── session/                    # 세션 관리
│   │   ├── session-manager.ts      # 세션 저장/복구
│   │   └── index.ts
│   │
│   ├── compact/                    # 대화 압축 (Auto-Compact)
│   │   ├── context-tracker.ts      # Context 사용량 추적
│   │   ├── compact-prompts.ts      # 압축 프롬프트 템플릿
│   │   ├── compact-manager.ts      # 압축 실행 로직
│   │   └── index.ts
│   │
│   ├── docs-manager.ts             # 문서 다운로드 관리 (/docs)
│   ├── usage-tracker.ts            # 사용량 추적 (/usage)
│   ├── slash-command-handler.ts    # 슬래시 명령 처리
│   └── git-auto-updater.ts         # Git 기반 자동 업데이트
│
├── agents/                         # LLM 에이전트 (v2.5.0)
│   ├── base/                       # 기본 에이전트
│   │   └── base-agent.ts           # 추상 베이스 클래스
│   ├── classifier/                 # 요청 분류기
│   │   └── index.ts                # simple_response vs requires_todo
│   ├── planner/                    # 플래닝 에이전트
│   │   └── index.ts                # TODO 리스트 생성
│   ├── docs-search/                # 문서 검색 에이전트
│   │   ├── index.ts                # DocsSearchAgent 구현
│   │   └── executor.ts             # LLM 기반 문서 검색 결정 + 실행
│   └── index.ts
│
├── orchestration/                  # Plan & Execute 오케스트레이션 (v2.5.0)
│   ├── plan-executor.ts            # 메인 실행 로직 (핵심!)
│   ├── types.ts                    # 타입 정의
│   ├── utils.ts                    # 헬퍼 함수
│   └── index.ts
│
├── prompts/                        # 프롬프트 중앙 관리
│   ├── shared/                     # 공유 규칙
│   │   ├── language-rules.ts       # 언어 우선순위 규칙
│   │   ├── tool-usage.ts           # 도구 사용 가이드
│   │   └── codebase-rules.ts       # 코드베이스 규칙
│   ├── system/                     # 시스템 프롬프트
│   │   ├── default.ts              # 기본 시스템 프롬프트
│   │   ├── plan-execute.ts         # Plan & Execute 프롬프트
│   │   └── compact.ts              # 압축 프롬프트
│   ├── agents/                     # 에이전트 프롬프트
│   │   ├── planning.ts             # 플래닝 LLM 프롬프트
│   │   ├── classifier.ts           # 분류기 프롬프트
│   │   ├── docs-search.ts          # 문서 검색 에이전트 프롬프트
│   │   └── docs-search-decision.ts # 문서 검색 결정 프롬프트
│   └── index.ts
│
├── tools/                          # AI 도구 (v2.5.0 - 간소화)
│   ├── types.ts                    # 도구 타입 인터페이스
│   ├── registry.ts                 # 도구 중앙 등록 시스템
│   │
│   ├── llm/                        # LLM이 tool_call로 호출하는 도구
│   │   ├── simple/                 # Sub-LLM 없는 단순 도구
│   │   │   ├── file-tools.ts       # 파일 도구 + 콜백 시스템
│   │   │   ├── bash-tool.ts        # Bash 명령 실행 도구
│   │   │   ├── todo-tools.ts       # TODO 관리 도구
│   │   │   ├── ask-user-tool.ts    # ask-to-user 도구
│   │   │   └── index.ts
│   │   ├── agents/                 # Sub-LLM 사용 에이전트 도구
│   │   │   ├── docs-search-tools.ts # 문서 검색 도구
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   └── index.ts
│
├── ui/                             # UI 컴포넌트 (React/Ink)
│   ├── index.ts
│   │
│   ├── components/
│   │   ├── PlanExecuteApp.tsx      # 메인 앱 (가장 중요!)
│   │   │                           # - Static log 시스템
│   │   │                           # - LogEntry 타입 및 렌더링
│   │   │                           # - Tool 아이콘/이모지
│   │   ├── StatusBar.tsx           # 상태바 (Claude Code 스타일, Context %)
│   │   ├── Logo.tsx                # 시작 화면 로고 (컬러 그라데이션)
│   │   ├── CustomTextInput.tsx     # 텍스트 입력 (한글 지원)
│   │   ├── FileBrowser.tsx         # @ 파일 선택기
│   │   ├── CommandBrowser.tsx      # / 명령어 선택기
│   │   ├── TodoListView.tsx        # TODO 리스트 뷰
│   │   ├── ProgressBar.tsx         # 진행 상태바
│   │   ├── LLMSetupWizard.tsx      # 첫 실행 LLM 설정 마법사
│   │   ├── ModelSelector.tsx       # /model 모델 선택기
│   │   ├── MarkdownRenderer.tsx    # 마크다운/코드 구문 강조
│   │   ├── ActivityIndicator.tsx   # 활동 표시기 (토큰 메트릭)
│   │   ├── ThinkingIndicator.tsx   # 생각 중 표시기
│   │   ├── index.ts
│   │   │
│   │   ├── dialogs/                # 다이얼로그 컴포넌트
│   │   │   ├── AskUserDialog.tsx   # ask-to-user 다이얼로그
│   │   │   ├── SettingsDialog.tsx  # 설정 다이얼로그
│   │   │   ├── DocsBrowser.tsx     # /docs 문서 브라우저
│   │   │   └── index.ts
│   │   │
│   │   ├── panels/                 # 패널 컴포넌트
│   │   │   ├── SessionPanel.tsx    # 세션 패널
│   │   │   └── index.ts
│   │   │
│   │   └── views/                  # 뷰 컴포넌트
│   │       ├── ChatView.tsx        # 채팅 뷰 (마크다운 렌더링)
│   │       └── index.ts
│   │
│   ├── contexts/                   # React Context
│   │   └── TokenContext.tsx        # 토큰 사용량 추적
│   │
│   ├── hooks/                      # React 커스텀 훅
│   │   ├── usePlanExecution.ts     # Plan 실행 상태 관리 (thin wrapper)
│   │   ├── useFileBrowserState.ts  # 파일 브라우저 상태
│   │   ├── useCommandBrowserState.ts # 명령 브라우저 상태
│   │   ├── useFileList.ts          # 파일 목록 로드
│   │   ├── slashCommandProcessor.ts # /명령어 처리
│   │   ├── atFileProcessor.ts      # @파일 처리
│   │   └── index.ts
│   │
│   ├── TodoPanel.tsx               # TODO 패널
│   └── UpdateNotification.tsx      # 업데이트 알림
│
├── types/                          # 전역 타입 정의
│   └── index.ts
│
├── utils/                          # 유틸리티
│   ├── logger.ts                   # 로깅 시스템 (전역 logger)
│   ├── json-stream-logger.ts       # JSON 로그 스트림
│   └── file-system.ts              # 파일 시스템 헬퍼
│
└── errors/                         # 에러 클래스
    ├── base.ts                     # 기본 에러
    ├── llm.ts                      # LLM 관련 에러
    ├── network.ts                  # 네트워크 에러
    ├── file.ts                     # 파일 에러
    ├── config.ts                   # 설정 에러
    ├── validation.ts               # 검증 에러
    └── index.ts
```

### 3.2 데이터 저장 위치

```
~/.local-cli/                        # 설정 및 데이터 디렉토리
├── config.json                     # 메인 설정
├── endpoints.json                  # LLM 엔드포인트 목록
├── usage.json                      # 사용량 통계
├── docs/                           # 로컬 문서 (RAG용)
│   └── agent_framework/            # 다운로드된 문서
│       ├── agno/                   # Agno Framework 문서
│       └── adk/                    # Google ADK 문서
├── backups/                        # 자동 백업
└── projects/{cwd}/                 # 프로젝트별 데이터
    ├── {session-id}.json           # 세션 데이터
    ├── {session-id}_log.json       # JSON 로그
    └── {session-id}_error.json     # 에러 로그
```

---

## 4. 핵심 기능 상세

### 4.1 요청 분류 시스템

**위치**: `src/agents/classifier/index.ts`

사용자 요청을 자동으로 분류하여 적절한 처리 방식을 결정합니다.

```typescript
type ClassificationType = 'simple_response' | 'requires_todo';

// 분류 흐름
User 요청
    ↓
┌─────────────────────────────────┐
│  RequestClassifier.classify()   │
│  - LLM이 요청 유형 분석         │
└─────────────────────────────────┘
    ↓                    ↓
simple_response      requires_todo
(바로 응답)          (TODO 생성 후 실행)
```

### 4.2 File-Tools (파일 도구)

**위치**: `src/tools/llm/simple/file-tools.ts`

| 도구 | 아이콘 | 설명 | 파라미터 |
|------|--------|------|----------|
| `read_file` | 📖 | 파일 내용 읽기 | `reason`, `file_path` |
| `create_file` | 📝 | 새 파일 생성 (기존 파일 있으면 실패) | `reason`, `file_path`, `content` |
| `edit_file` | ✏️ | 기존 파일 수정 (줄 단위 편집) | `reason`, `file_path`, `edits[]` |
| `list_files` | 📂 | 디렉토리 목록 조회 | `reason`, `directory_path?`, `recursive?` |
| `find_files` | 🔍 | glob 패턴으로 파일 검색 | `reason`, `pattern`, `directory_path?` |
| `tell_to_user` | 💬 | 사용자에게 메시지 전달 | `message` |

**중요**: 모든 파일 도구는 `reason` 파라미터 필수 (사용자에게 무엇을 하는지 설명)

#### edit_file 사용법

```typescript
// 줄 단위 편집 (line_number는 1-based)
{
  "file_path": "src/app.ts",
  "edits": [
    { "line_number": 5, "original_text": "const x = 1;", "new_text": "const x = 2;" },
    { "line_number": 10, "original_text": "// delete this", "new_text": "" }  // 삭제
  ]
}
```

### 4.3 Static Log 시스템

**위치**: `src/ui/components/PlanExecuteApp.tsx`

Ink의 `Static` 컴포넌트를 사용한 스크롤 가능한 로그 시스템입니다.

```typescript
// LogEntry 타입
type LogEntryType =
  | 'logo'              // 시작 로고
  | 'user_input'        // 사용자 입력
  | 'assistant_message' // AI 응답
  | 'tool_start'        // 도구 실행 시작
  | 'tool_result'       // 도구 실행 결과
  | 'tell_user'         // tell_to_user 메시지
  | 'plan_created'      // 플랜 생성됨
  | 'todo_start'        // TODO 시작
  | 'todo_complete'     // TODO 완료
  | 'todo_fail'         // TODO 실패
  | 'compact';          // 대화 압축됨

interface LogEntry {
  id: string;
  type: LogEntryType;
  content: string;
  details?: string;
  toolArgs?: Record<string, unknown>;  // tool_start, tool_result용
  success?: boolean;
  items?: string[];     // plan_created용
  diff?: string[];      // edit_file diff용
}
```

#### 콜백 시스템

`file-tools.ts`에서 UI로 이벤트를 전달하는 콜백 함수들:

```typescript
// Tool 실행 시작/결과
setToolExecutionCallback((toolName, reason, args) => { ... });
setToolResponseCallback((toolName, success, result) => { ... });

// 메시지/플랜/TODO 이벤트
setTellToUserCallback((message) => { ... });
setPlanCreatedCallback((todoTitles) => { ... });
setTodoStartCallback((title) => { ... });
setTodoCompleteCallback((title) => { ... });
setTodoFailCallback((title) => { ... });
setCompactCallback((originalCount, newCount) => { ... });
```

### 4.4 Tool 결과 표시 규칙

| Tool | 표시 방식 |
|------|----------|
| `read_file` | 5줄까지만 표시 + "... (N more lines)" |
| `list_files` | "N개 항목 (preview...)" |
| `find_files` | "N개 항목 (preview...)" |
| `create_file` | diff 형식 (+ 로 전체 줄 표시, 녹색) |
| `edit_file` | diff 형식 (- / + 전체 표시, 빨강/녹색) |
| `tell_to_user` | tool_result 숨김 (tell_user 로그에서 표시) |

### 4.5 TODO 관리 LLM Tools

**위치**: `src/tools/llm/simple/todo-tools.ts`

| 도구 | 설명 |
|------|------|
| `update-todo-list` | TODO 상태 업데이트 (in_progress, completed, failed) |
| `get-todo-list` | 현재 TODO 목록 조회 |

### 4.6 ask-to-user Tool

**위치**: `src/tools/llm/simple/ask-user-tool.ts`

LLM이 사용자에게 질문할 수 있는 도구입니다.

```typescript
interface AskUserRequest {
  question: string;
  options: string[];  // 2-4개 선택지
  // "Other (직접 입력)" 옵션은 UI에서 자동 추가
}
```

**UI**: `src/ui/components/dialogs/AskUserDialog.tsx`
- 방향키와 Enter로 선택
- 숫자 키(1-4)로 빠른 선택
- "Other" 선택 시 텍스트 입력

### 4.7 Auto-Compact (대화 압축)

**위치**: `src/core/compact/`

Context window가 80%에 도달하면 자동으로 대화를 압축합니다.

| 파일 | 역할 |
|------|------|
| `context-tracker.ts` | prompt_tokens 추적, 80% 감지 |
| `compact-prompts.ts` | 압축 프롬프트 템플릿, 동적 컨텍스트 주입 |
| `compact-manager.ts` | LLM 호출로 압축 실행 |

```typescript
// 수동 압축
/compact

// 자동 압축
- Context 80% 도달 시 메시지 전송 전 자동 실행
- StatusBar에 "Context XX%" 표시 (초록/노랑/빨강)
```

### 4.8 사용량 추적

**위치**: `src/core/usage-tracker.ts`

```typescript
interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  startTime: number;
  models: Record<string, number>;
  lastPromptTokens: number;  // Context 추적용
}

// 주요 메서드
usageTracker.recordUsage(model, inputTokens, outputTokens);
usageTracker.getSessionUsage();
usageTracker.getSessionElapsedSeconds();
usageTracker.resetSession();
usageTracker.formatSessionStatus(activity);  // Claude Code 스타일
```

**슬래시 명령어**: `/usage`

### 4.9 문서 다운로드

**위치**: `src/core/docs-manager.ts`

개발팀이 사전 정의한 문서 소스만 다운로드 가능합니다.

```typescript
// 사용 가능한 소스
AVAILABLE_SOURCES = [
  { id: 'agno', name: 'Agno Framework', repoUrl: '...' },
  { id: 'adk', name: 'Google ADK', repoUrl: '...' },
];

// 슬래시 명령어
/docs                    # 문서 브라우저 UI 표시 (↑↓ 이동, Enter 다운로드)
/docs download agno      # Agno 문서 다운로드
/docs download adk       # ADK 문서 다운로드
```

**UI**: `src/ui/components/dialogs/DocsBrowser.tsx`
- 방향키와 Enter로 선택
- 숫자 키(1-9)로 빠른 다운로드
- 설치 상태 표시 (✅ 설치됨 / ⬜ 미설치)

### 4.10 LLM-Client

**위치**: `src/core/llm/llm-client.ts`

| 기능 | 메서드 | 설명 |
|------|--------|------|
| 기본 대화 | `sendMessage()` | 단일 메시지 전송 |
| 스트리밍 | `sendMessageStream()` | 실시간 토큰 응답 |
| Tool Calling | `sendMessageWithTools()` | AI 도구 호출 |
| Tool + 반복 | `chatCompletionWithTools()` | 도구 호출 반복 실행 |

### 4.11 Plan-Execute (Orchestration)

**위치**: `src/orchestration/`

| 파일 | 역할 |
|------|------|
| `plan-executor.ts` | 메인 실행 로직 (핵심!) |
| `types.ts` | 타입 정의 (ExecutionPhase, PlanExecutionState 등) |
| `utils.ts` | 헬퍼 함수 (formatErrorMessage, buildTodoContext 등) |

### 4.12 슬래시 명령어

**위치**: `src/ui/hooks/slashCommandProcessor.ts`

| 명령어 | 설명 |
|--------|------|
| `/exit`, `/quit` | 앱 종료 |
| `/clear` | 대화 및 TODO 초기화 |
| `/compact` | 대화 압축 (수동) |
| `/settings` | 설정 메뉴 열기 |
| `/model` | 모델 선택기 열기 |
| `/load` | 저장된 세션 불러오기 |
| `/docs` | 문서 브라우저 열기 |
| `/usage` | 토큰 사용량 통계 |
| `/help` | 도움말 표시 |

---

## 5. 데이터 흐름 아키텍처

### 5.1 전체 실행 흐름

```
User Input (터미널 메시지)
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                   React/Ink UI Layer                             │
│              src/ui/components/PlanExecuteApp.tsx                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Static Log System                                         │   │
│  │ - LogEntry[] 배열로 이력 관리                              │   │
│  │ - Ink Static 컴포넌트로 스크롤 가능                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Auto-Compact Check                             │
│              Context 80% 이상이면 압축 먼저 실행                   │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              Docs Search Decision (v2.5.0)                        │
│         src/agents/docs-search/executor.ts                        │
│                                                                  │
│  1. 폴더 구조를 LLM에게 보여줌                                     │
│  2. LLM이 Yes/No로 검색 필요 여부 결정                             │
│  3. Yes → DocsSearchAgent 실행                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Request Classifier                             │
│              src/agents/classifier/index.ts                      │
│                                                                  │
│              simple_response  ←→  requires_todo                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Plan-Execute (Orchestration)                   │
│                     src/orchestration/                           │
│                                                                  │
│              Planning → Execution → Debugging                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Tool Execution Layer                           │
│                     src/tools/                                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              LLM Tools (tool_call 호출)                   │    │
│  │  ┌────────────────┐  ┌────────────────────────────┐     │    │
│  │  │ Simple Tools   │  │ Agent Tools                │     │    │
│  │  │ (file, bash,   │  │ (docs-search with Sub-LLM) │     │    │
│  │  │  todo, ask)    │  │                            │     │    │
│  │  └────────────────┘  └────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tool Callbacks → PlanExecuteApp → Static Log                   │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│               External Systems / LLM API                         │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ File       │  │ LLM API    │  │ Bash       │                 │
│  │ System     │  │ (OpenAI)   │  │ Commands   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 새 기능 추가하기

### 6.1 새 LLM Tool 추가

**1단계**: `src/tools/llm/simple/`에 도구 파일 생성

```typescript
// src/tools/llm/simple/my-tool.ts
import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { ToolDefinition } from '../../../types/index.js';

const MY_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'my_tool',
    description: 'Description of what the tool does',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user...`
        },
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['reason', 'param1']
    }
  }
};

async function executeMyTool(args: Record<string, unknown>): Promise<ToolResult> {
  const param1 = args['param1'] as string;
  // 도구 로직 구현
  return { success: true, result: 'result' };
}

export const myTool: LLMSimpleTool = {
  definition: MY_TOOL_DEFINITION,
  execute: executeMyTool,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'My tool description',
};
```

**2단계**: `src/tools/llm/simple/index.ts`에서 export

**3단계**: Tool 아이콘 추가 (PlanExecuteApp.tsx의 `getToolIcon` 함수)

```typescript
const getToolIcon = (toolName: string): string => {
  switch (toolName) {
    // ... 기존 도구들
    case 'my_tool':
      return '🔧';  // 적절한 아이콘 선택
    default:
      return '🔧';
  }
};
```

### 6.2 새 슬래시 명령어 추가

**1단계**: `src/ui/hooks/slashCommandProcessor.ts`에 명령어 등록

```typescript
export const SLASH_COMMANDS: CommandMetadata[] = [
  // ... 기존 명령어
  {
    name: '/mycommand',
    description: 'My command description',
  },
];
```

**2단계**: `src/core/slash-command-handler.ts`에 핸들러 추가

```typescript
// /mycommand 명령어 추가
if (trimmedCommand === '/mycommand') {
  // 명령어 로직
  const resultMessage = '결과 메시지';
  const updatedMessages = [
    ...context.messages,
    { role: 'assistant' as const, content: resultMessage },
  ];
  context.setMessages(updatedMessages);
  return {
    handled: true,
    shouldContinue: false,
    updatedContext: { messages: updatedMessages },
  };
}
```

### 6.3 새 문서 소스 추가

**위치**: `src/core/docs-manager.ts`의 `AVAILABLE_SOURCES` 배열에 추가

```typescript
export const AVAILABLE_SOURCES: DocsSource[] = [
  // ... 기존 소스
  {
    id: 'new-source',
    name: 'New Framework',
    description: '새 프레임워크 문서',
    repoUrl: 'https://github.com/org/repo',
    branch: 'main',
    subPath: 'docs',
    targetDir: 'agent_framework/new-source',
  },
];
```

---

## 7. 코딩 규칙

### 7.1 파일 명명 규칙

| 종류 | 규칙 | 예시 |
|------|------|------|
| Core 로직 | kebab-case.ts | `llm-client.ts`, `usage-tracker.ts` |
| UI 컴포넌트 | PascalCase.tsx | `PlanExecuteApp.tsx`, `AskUserDialog.tsx` |
| 타입 정의 | index.ts 또는 types.ts | `types/index.ts` |

### 7.2 로깅 규칙 (필수!)

자세한 내용은 `docs/02_LOGGING.md` 참조.

```typescript
import { logger } from '../utils/logger.js';

async function myFunction(input: string) {
  logger.enter('myFunction', { input });

  try {
    logger.flow('Processing input');
    const result = await process(input);
    logger.vars({ name: 'result', value: result });

    logger.exit('myFunction', { success: true });
    return result;
  } catch (error) {
    logger.error('myFunction failed', error);
    throw error;
  }
}
```

**주의**: `logger.info()`는 deprecated. `logger.debug()` 또는 `logger.flow()` 사용.

### 7.3 Index Signature 접근

TypeScript에서 Record 타입의 속성 접근 시 bracket notation 사용:

```typescript
// 올바른 방법
const value = args['param_name'];

// 틀린 방법 (TS4111 에러)
const value = args.param_name;
```

### 7.4 Tool reason 파라미터

모든 LLM Tool은 `reason` 파라미터를 포함해야 합니다:

```typescript
reason: {
  type: 'string',
  description: `A natural, conversational explanation for the user about what you're doing (in user's language).
Write as if you're talking to the user directly.
Examples:
- "현재 인증 로직이 어떻게 구현되어 있는지 확인해볼게요"
- "에러가 발생한 파일을 열어서 문제를 찾아볼게요"`
}
```

---

## 8. CLI 실행 모드

| 모드 | 명령어 | 로그 레벨 | 용도 |
|------|--------|----------|------|
| Normal | `open` | INFO | 일반 사용 |
| Verbose | `open --verbose` | DEBUG | 개발/디버깅 |
| Debug | `open --debug` | VERBOSE | 심층 분석 |

---

## 문서 목록

1. `README.md` - 프로젝트 소개 및 빠른 시작
2. `docs/01_DEVELOPMENT.md` - 개발자 종합 가이드 (이 문서)
3. `docs/02_LOGGING.md` - 로깅 시스템 상세 가이드
4. `docs/03_TESTING.md` - 테스트 가이드
5. `docs/04_ROADMAP.md` - 프로젝트 로드맵

---

**질문이나 제안사항이 있으면 GitHub Issues를 이용해주세요!**
