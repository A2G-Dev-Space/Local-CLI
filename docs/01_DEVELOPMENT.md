# 개발자 종합 가이드 (Development Guide)

이 문서는 **OPEN-CLI** 프로젝트의 전체 구조, 아키텍처, 핵심 기능, 개발 규칙을 설명합니다.
**Python 개발자**도 쉽게 이해할 수 있도록 TypeScript/React 개념을 상세히 설명합니다.

---

## 목차

1. [프로젝트 정체성](#1-프로젝트-정체성)
2. [기술 스택 이해하기 (Python 개발자용)](#2-기술-스택-이해하기-python-개발자용)
3. [폴더 구조](#3-폴더-구조)
4. [핵심 기능 상세 설명](#4-핵심-기능-상세-설명)
   - 4.1 [File-Tools (파일 도구)](#41-file-tools-파일-도구)
   - 4.2 [LLM-Client (LLM 클라이언트)](#42-llm-client-llm-클라이언트)
   - 4.3 [Plan-Execute (계획 수립 및 실행)](#43-plan-execute-계획-수립-및-실행)
   - 4.4 [Session (세션 관리)](#44-session-세션-관리)
   - 4.5 [Config (설정 관리)](#45-config-설정-관리)
   - 4.6 [Local-RAG (로컬 문서 검색)](#46-local-rag-로컬-문서-검색)
   - 4.7 [Integration (통합 워크플로우)](#47-integration-통합-워크플로우)
   - 4.8 [Multi-Layer Execution (다계층 실행)](#48-multi-layer-execution-다계층-실행)
5. [데이터 흐름 아키텍처](#5-데이터-흐름-아키텍처)
6. [새 기능 추가하기](#6-새-기능-추가하기)
7. [코딩 규칙](#7-코딩-규칙)
8. [CLI 실행 모드](#8-cli-실행-모드)
9. [UI/UX 컴포넌트 상세](#9-uiux-컴포넌트-상세)

---

## 1. 프로젝트 정체성

### OPEN-CLI란?

**오프라인 기업 환경을 위한 로컬 LLM CLI 플랫폼**입니다.

- 인터넷 없이 독립적으로 작동
- 기업의 로컬 LLM 서버(OpenAI Compatible)와 연결
- AI가 직접 파일을 읽고, 쓰고, 검색하고, 코드를 실행
- 터미널에서 Interactive UI로 AI와 대화

### 핵심 가치

| 특징 | 설명 |
|------|------|
| 완전 오프라인 | 인터넷 연결 없이 작동 |
| 사내 모델 통합 | OpenAI Compatible API 지원 |
| Plan & Execute | 복잡한 작업을 자동으로 분해하여 순차 실행 |
| Human-in-the-Loop | 위험한 작업 전 사용자 승인 요청 |
| Local RAG | 로컬 문서 기반 지식 검색 |

---

## 2. 기술 스택 이해하기 (Python 개발자용)

### 2.1 TypeScript vs Python 비교

```python
# Python
def add(a: int, b: int) -> int:
    return a + b
```

```typescript
// TypeScript
function add(a: number, b: number): number {
    return a + b;
}
```

**핵심 차이점:**
- Python의 타입 힌트는 선택사항이지만, TypeScript는 컴파일 시점에 타입 검사
- `npm` = Python의 `pip`, `package.json` = `requirements.txt`
- `import { X } from './file'` = Python의 `from file import X`

### 2.2 React가 터미널에서 UI를 만드는 방법

Python으로 터미널 UI를 만들 때:
```python
# Python - 전통적인 방식
print("Hello, World!")
user_input = input("Enter name: ")
print(f"Welcome, {user_input}!")
```

이 방식의 문제점:
- 화면을 갱신하려면 전체를 다시 그려야 함
- 복잡한 레이아웃 구현이 어려움
- 실시간 상태 변화 반영이 어려움

**React + Ink 방식:**

```tsx
// TypeScript/React - 선언적 방식
import { Box, Text } from 'ink';
import { useState } from 'react';

function App() {
    const [name, setName] = useState('');  // 상태 관리

    return (
        <Box flexDirection="column">
            <Text color="cyan">Hello, World!</Text>
            <Text>Welcome, {name}!</Text>
        </Box>
    );
}
```

**동작 원리:**
1. **Virtual DOM**: React가 UI의 "가상 버전"을 메모리에 유지
2. **State (상태)**: `useState`로 데이터를 관리하고, 데이터가 변하면 UI가 자동 갱신
3. **Ink 렌더러**: React의 Virtual DOM을 터미널 문자열로 변환하여 출력

```
┌──────────────────────────────────────────────┐
│  React Component (JSX)                       │
│       ↓                                      │
│  Virtual DOM (메모리 내 UI 구조)              │
│       ↓                                      │
│  Ink Renderer (터미널 문자열로 변환)           │
│       ↓                                      │
│  Terminal Output (실제 화면에 표시)           │
└──────────────────────────────────────────────┘
```

Python의 `curses` 라이브러리와 비슷하지만, 선언적이고 컴포넌트 기반이라는 점이 다릅니다.

### 2.3 주요 Ink 컴포넌트

| Ink 컴포넌트 | Python 대응 | 설명 |
|-------------|-------------|------|
| `<Box>` | `curses.newwin()` | 레이아웃 컨테이너 |
| `<Text>` | `print()` | 텍스트 출력 |
| `useInput()` | `getch()` | 키보드 입력 처리 |
| `useState()` | 일반 변수 | 상태 관리 (변경 시 UI 자동 갱신) |

---

## 3. 폴더 구조

```
src/
├── cli.ts                          # 진입점 (main 함수) - open 명령 제공
├── index.ts                        # 라이브러리 진입점
├── constants.ts                    # 상수 정의
│
├── core/                           # 핵심 비즈니스 로직 (UI 무관)
│   ├── llm/                       # LLM 관련 모듈 (Phase 0 리팩토링)
│   │   ├── llm-client.ts          # LLM API 통신 클라이언트
│   │   └── planning-llm.ts        # TODO 리스트 생성 LLM
│   │
│   ├── config/                    # 설정 관리 모듈
│   │   ├── config-manager.ts      # 설정 파일 관리
│   │   └── project-config.ts      # 프로젝트별 설정
│   │
│   ├── session/                   # 세션 관리 모듈
│   │   └── session-manager.ts     # 세션 저장/복구
│   │
│   ├── knowledge/                 # 지식 관리 모듈
│   │   ├── docs-search-agent.ts   # 로컬 문서 RAG 검색
│   │   └── document-manager.ts    # 문서 인덱싱 관리
│   │
│   ├── llm-client.ts              # (re-export) → llm/llm-client.ts
│   ├── config-manager.ts          # (re-export) → config/config-manager.ts
│   ├── session-manager.ts         # (re-export) → session/session-manager.ts
│   ├── planning-llm.ts            # (re-export) → llm/planning-llm.ts
│   ├── docs-search-agent.ts       # (re-export) → knowledge/docs-search-agent.ts
│   ├── document-manager.ts        # (re-export) → knowledge/document-manager.ts
│   ├── project-config.ts          # (re-export) → config/project-config.ts
│   │
│   ├── bash-command-tool.ts       # Bash 명령 실행 (보안 검증)
│   ├── internal-monologue.ts      # Extended Thinking
│   ├── scratchpad.ts              # 외부 TODO 파일 관리
│   ├── auto-updater.ts            # GitHub 자동 업데이트
│   ├── git-auto-updater.ts        # Git 기반 자동 업데이트
│   ├── todo-executor.ts           # TODO 실행기
│   ├── slash-command-handler.ts   # 슬래시 명령 처리
│   └── agent-framework-handler.ts # 에이전트 프레임워크 핸들러
│
├── plan-and-execute/               # Plan & Execute 아키텍처
│   ├── orchestrator.ts            # 메인 오케스트레이터
│   ├── state-manager.ts           # 실행 상태 관리
│   ├── approval-manager.ts        # 사용자 승인 관리 (HITL)
│   ├── risk-analyzer.ts           # 위험도 분석
│   ├── llm-schemas.ts             # LLM 입출력 스키마
│   └── types.ts                   # 타입 정의
│
├── execution/                      # 다계층 실행 시스템
│   ├── layer-manager.ts           # 계층 선택 및 관리
│   ├── standard-tools.ts          # 표준 도구 계층
│   ├── sdk-layer.ts               # 동적 코드 생성 계층
│   ├── subagent-layer.ts          # 서브 에이전트 계층
│   └── skills-layer.ts            # 스킬 계층
│
├── tools/                          # AI 도구 정의 (6가지 분류 시스템)
│   ├── types.ts                   # 도구 타입 인터페이스 정의 ✅
│   ├── registry.ts                # 도구 중앙 등록 시스템 ✅
│   │
│   ├── llm/                       # LLM이 tool_call로 호출하는 도구
│   │   ├── simple/               # Sub-LLM 없는 단순 도구
│   │   │   ├── file-tools.ts     # 파일 시스템 도구 (read, write, list, find)
│   │   │   └── index.ts
│   │   ├── agents/               # Sub-LLM 사용 에이전트 도구
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── system/                    # 로직에서 자동 호출되는 도구
│   │   ├── simple/               # Sub-LLM 없는 시스템 도구
│   │   │   └── index.ts
│   │   ├── agents/               # Sub-LLM 사용 시스템 도구
│   │   │   ├── docs-search.ts    # 로컬 RAG 문서 검색 도구
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── user/                      # 사용자 /슬래시 명령어
│   │   └── index.ts
│   │
│   ├── mcp/                       # MCP (Model Context Protocol) 도구
│   │   └── index.ts
│   │
│   ├── native/                    # (하위 호환성) → llm/simple/ 참조
│   ├── file-tools.ts              # (하위 호환성) → llm/simple/file-tools.ts
│   └── index.ts                   # 통합 내보내기
│
├── ui/                             # UI 컴포넌트 (React/Ink)
│   ├── ink-entry.tsx              # Ink 렌더링 진입점
│   ├── TodoPanel.tsx              # TODO 패널 (미니맵, 예상시간, 토큰)
│   ├── components/
│   │   ├── views/                 # 뷰 컴포넌트 ✅
│   │   │   ├── ChatView.tsx       # 채팅 뷰 (마크다운 렌더링) ✅
│   │   │   └── index.ts           # 내보내기
│   │   ├── panels/                # 패널 컴포넌트 (폴더 생성됨)
│   │   ├── dialogs/               # 다이얼로그 컴포넌트 (폴더 생성됨)
│   │   ├── PlanExecuteApp.tsx     # 메인 앱 (가장 중요!)
│   │   ├── CustomTextInput.tsx    # 텍스트 입력 (한글 지원)
│   │   ├── FileBrowser.tsx        # @ 파일 선택기
│   │   ├── CommandBrowser.tsx     # / 명령어 선택기
│   │   ├── ApprovalPrompt.tsx     # HITL 승인 프롬프트
│   │   ├── TodoListView.tsx       # TODO 리스트 뷰
│   │   ├── StatusBar.tsx          # 상태바 (컨텍스트, 시계, 토큰)
│   │   ├── ProgressBar.tsx        # 진행 상태바
│   │   ├── SessionBrowser.tsx     # 세션 브라우저
│   │   ├── SettingsBrowser.tsx    # 설정 브라우저 (LLMs 관리 포함)
│   │   ├── LLMSetupWizard.tsx     # 첫 실행 LLM 설정 마법사
│   │   ├── ModelSelector.tsx      # /model 명령어용 모델 선택기
│   │   ├── Logo.tsx               # 시작 화면 로고 (애니메이션)
│   │   ├── MarkdownRenderer.tsx   # 마크다운/코드 구문 강조
│   │   ├── ActivityIndicator.tsx  # 활동 표시기 (토큰 메트릭)
│   │   └── index.ts               # 컴포넌트 내보내기
│   │
│   ├── contexts/                  # React Context (상태 관리)
│   │   └── TokenContext.tsx       # 토큰 사용량 추적 컨텍스트
│   │
│   └── hooks/                     # React 커스텀 훅 ✅
│       ├── usePlanExecution.ts    # Plan 실행 상태 관리 훅 ✅
│       ├── useFileBrowserState.ts # 파일 브라우저 상태 훅 ✅
│       ├── useCommandBrowserState.ts # 명령 브라우저 상태 훅 ✅
│       ├── slashCommandProcessor.ts  # /명령어 처리 ✅
│       ├── atFileProcessor.ts        # @파일 처리 ✅
│       ├── useFileList.ts            # 파일 목록 로드 ✅
│       └── index.ts               # 훅 내보내기
│
├── types/                          # 전역 타입 정의
│   └── index.ts
│
├── utils/                          # 유틸리티
│   ├── logger.ts                  # 로깅 시스템 (필독!)
│   ├── json-stream-logger.ts      # JSON 로그 스트림
│   ├── cache.ts                   # 캐싱
│   ├── file-system.ts             # 파일 시스템 헬퍼
│   └── retry.ts                   # 재시도 로직
│
├── errors/                         # 에러 클래스 정의
│   ├── base.ts                    # 기본 에러
│   ├── llm.ts                     # LLM 관련 에러
│   ├── network.ts                 # 네트워크 에러
│   ├── file.ts                    # 파일 에러
│   ├── config.ts                  # 설정 에러
│   ├── validation.ts              # 검증 에러
│   └── index.ts                   # 에러 내보내기
│
├── verification/                   # 검증 시스템
│   └── verification-system.ts     # Rule/Visual/LLM-Judge
│
└── workflows/                      # 워크플로우
    └── tdd-workflow.ts            # TDD 자동화
```

### 파일 저장 위치

```
~/.open-cli/                        # 설정 및 데이터 디렉토리
├── config.json                    # 메인 설정
├── endpoints.json                 # LLM 엔드포인트 목록
├── docs/                          # 로컬 문서 (RAG용)
├── backups/                       # 자동 백업
└── projects/{cwd}/                # 프로젝트별 데이터
    ├── {session-id}.json          # 세션 데이터
    ├── {session-id}_log.json      # JSON 로그
    └── {session-id}_error.json    # 에러 로그
```

---

## 4. 핵심 기능 상세 설명

이 섹션에서는 OPEN-CLI의 모든 핵심 기능을 상세히 설명합니다.
각 기능의 **역할**, **동작 원리**, **관계**를 명확히 이해할 수 있습니다.

---

### 4.1 File-Tools (파일 도구)

**목적**: AI가 파일 시스템을 조작할 수 있게 하는 도구 모음

**위치**: `src/tools/llm/simple/file-tools.ts`

**분류**: LLM Simple Tool (LLM이 tool_call로 호출, Sub-LLM 없음)

#### 제공 도구

| 도구 | 설명 | 파라미터 |
|------|------|----------|
| `read_file` | 파일 내용 읽기 | `file_path` |
| `write_file` | 파일 생성/수정 | `file_path`, `content` |
| `list_files` | 디렉토리 목록 조회 | `directory_path` |
| `find_files` | glob 패턴으로 파일 검색 | `pattern`, `directory_path?` |

#### 동작 흐름

```
사용자: "package.json 읽어줘"
        ↓
LLM이 Tool Call 생성:
{
  "name": "read_file",
  "arguments": { "file_path": "package.json" }
}
        ↓
executeReadFile() 실행
        ↓
파일 내용 반환 → LLM이 사용자에게 응답
```

#### 보안 검증

```typescript
// 경로 정규화 및 검증
const normalizedPath = path.resolve(filePath);

// 민감 파일 접근 차단
const BLOCKED_PATTERNS = [
  /\.env$/,
  /credentials\.json$/,
  /\.ssh\//,
  /\.aws\//,
];
```

#### Python 비교

```python
# Python에서의 파일 읽기
with open('package.json', 'r') as f:
    content = f.read()
```

```typescript
// TypeScript에서의 파일 읽기
import { promises as fs } from 'fs';
const content = await fs.readFile('package.json', 'utf-8');
```

---

### 4.2 LLM-Client (LLM 클라이언트)

**목적**: OpenAI Compatible API와 통신하는 클라이언트

**위치**: `src/core/llm/llm-client.ts` (re-export: `src/core/llm-client.ts`)

#### 주요 기능

| 기능 | 메서드 | 설명 |
|------|--------|------|
| 기본 대화 | `sendMessage()` | 단일 메시지 전송 및 응답 수신 |
| 스트리밍 | `sendMessageStream()` | 실시간 토큰 단위 응답 |
| Tool Calling | `sendMessageWithTools()` | AI가 도구를 호출하며 응답 |
| 에러 처리 | 자동 | 네트워크, API, Context 초과 에러 처리 |

#### 메시지 구조

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];     // AI가 호출할 도구
  tool_call_id?: string;       // 도구 응답 ID
}
```

#### 스트리밍 동작

```
┌──────────────────────────────────────────────────┐
│         Streaming Response Flow                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  LLM Server ─────────────────→ Client            │
│             chunk1: "안녕"                       │
│             chunk2: "하세요"                     │
│             chunk3: "!"                          │
│             [DONE]                               │
│                                                  │
│  화면 출력: "안녕" → "안녕하세요" → "안녕하세요!"  │
│            (실시간 업데이트)                      │
└──────────────────────────────────────────────────┘
```

#### Tool Calling 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Calling Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 사용자: "src 폴더의 파일 목록 보여줘"                    │
│                   ↓                                         │
│  2. LLM 응답: tool_calls: [{                                │
│       name: "list_files",                                   │
│       arguments: { directory_path: "src" }                  │
│     }]                                                      │
│                   ↓                                         │
│  3. Client가 도구 실행: executeListFiles({ directory: "src" })│
│                   ↓                                         │
│  4. 결과를 LLM에 전달: role: "tool", content: "[결과]"       │
│                   ↓                                         │
│  5. LLM이 최종 응답: "src 폴더에는 다음 파일들이 있습니다..."  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 에러 처리 계층

```typescript
try {
  await llmClient.sendMessage(message);
} catch (error) {
  if (error instanceof NetworkError) {
    // 연결 실패, DNS 오류, 타임아웃
  } else if (error instanceof APIError) {
    // 401: 인증 실패
    // 429: Rate Limit
    // 500: 서버 오류
  } else if (error instanceof ContextLengthError) {
    // 토큰 제한 초과
  }
}
```

---

### 4.3 Plan-Execute (계획 수립 및 실행)

**목적**: 복잡한 사용자 요청을 TODO 리스트로 분해하고 순차 실행

**위치**: `src/plan-and-execute/`

#### 핵심 컴포넌트

| 파일 | 역할 |
|------|------|
| `orchestrator.ts` | 전체 워크플로우 조율 (메인 컨트롤러) |
| `state-manager.ts` | 실행 상태 및 히스토리 관리 |
| `approval-manager.ts` | HITL 사용자 승인 관리 |
| `risk-analyzer.ts` | 작업 위험도 분석 |
| `llm-schemas.ts` | LLM 입출력 형식 정의 |

#### Plan-Execute의 역할

```
┌─────────────────────────────────────────────────────────────┐
│                    Plan-Execute 역할                        │
│               "무엇을 할지" 결정하는 상위 계층               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  입력: 사용자 자연어 요청                                    │
│       "src 폴더에 테스트 파일 만들고 실행해줘"               │
│                           ↓                                 │
│  Planning Phase:                                            │
│       LLM이 요청을 분석하여 TODO 리스트 생성                 │
│       ┌─────────────────────────────────┐                   │
│       │ TODO 1: src 폴더 구조 확인       │                   │
│       │ TODO 2: 테스트 파일 생성         │                   │
│       │ TODO 3: 테스트 실행              │                   │
│       └─────────────────────────────────┘                   │
│                           ↓                                 │
│  HITL Gate: 사용자에게 계획 승인 요청                        │
│                           ↓                                 │
│  Execute Phase:                                             │
│       각 TODO를 순차적으로 Agent-Loop에 위임                 │
│                           ↓                                 │
│  출력: 전체 실행 결과 요약                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 실행 상태 머신

```
┌──────────┐    planning    ┌──────────┐
│  IDLE    │ ─────────────→ │ PLANNING │
└──────────┘                └────┬─────┘
                                 │ plan created
                                 ↓
┌──────────┐    approved    ┌──────────┐
│  DONE    │ ←───────────── │ APPROVAL │
└──────────┘    rejected    └────┬─────┘
     ↑                           │ approved
     │                           ↓
     │         success      ┌──────────┐
     └───────────────────── │EXECUTING │ ←─┐
                            └────┬─────┘   │
                                 │ error   │ retry
                                 ↓         │
                            ┌──────────┐   │
                            │ DEBUGGING│ ──┘
                            └──────────┘
```

#### HITL (Human-in-the-Loop) 승인 게이트

```typescript
// 승인이 필요한 위험 레벨
const RISK_LEVELS = {
  CRITICAL: ['rm -rf', 'DROP DATABASE', 'chmod 777'],
  HIGH:     ['sudo', '소스코드 삭제', 'git push --force'],
  MEDIUM:   ['파일 수정', 'npm install', 'git commit'],
  LOW:      ['파일 읽기', '검색', '조회'],
};

// Critical, High는 반드시 승인 필요
// Medium은 설정에 따라
// Low는 자동 승인
```

---

### 4.4 Session (세션 관리)

**목적**: 대화 내역과 상태를 저장하고 복원

**위치**: `src/core/session/session-manager.ts` (re-export: `src/core/session-manager.ts`)

#### 세션 데이터 구조

```typescript
interface SessionData {
  id: string;                    // 세션 고유 ID
  messages: Message[];           // 대화 내역
  todos: TodoItem[];             // TODO 리스트
  createdAt: string;             // 생성 시간
  updatedAt: string;             // 마지막 업데이트
  metadata: {
    projectPath: string;         // 프로젝트 경로
    messageCount: number;        // 메시지 수
  };
}
```

#### 세션 라이프사이클

```
┌─────────────────────────────────────────────────────────────┐
│                   Session Lifecycle                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 앱 시작                                                 │
│     └─→ 새 세션 ID 생성 (auto-save-{timestamp})             │
│                                                             │
│  2. 대화 진행                                               │
│     └─→ 매 메시지마다 자동 저장                             │
│         ~/.open-cli/projects/{cwd}/{session-id}.json        │
│                                                             │
│  3. 앱 종료                                                 │
│     └─→ 최종 상태 저장                                      │
│                                                             │
│  4. 재시작 후 /load                                         │
│     └─→ 저장된 세션 목록 표시                               │
│     └─→ 선택한 세션 복원                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `saveSession(id, data)` | 세션 저장 |
| `loadSession(id)` | 세션 로드 |
| `listSessions()` | 현재 프로젝트의 세션 목록 |
| `deleteSession(id)` | 세션 삭제 |

---

### 4.5 Config (설정 관리)

**목적**: 앱 설정 및 LLM 엔드포인트 관리

**위치**: `src/core/config/config-manager.ts` (re-export: `src/core/config-manager.ts`)

#### 설정 파일 구조

```
~/.open-cli/
├── config.json           # 메인 설정
└── endpoints.json        # LLM 엔드포인트 목록
```

#### config.json

```json
{
  "activeEndpoint": "my-llm-server",
  "activeModel": "gpt-4",
  "ui": {
    "theme": "dark",
    "showTimestamps": true
  },
  "logging": {
    "level": "info",
    "jsonStream": true
  }
}
```

#### endpoints.json

```json
{
  "endpoints": [
    {
      "id": "my-llm-server",
      "name": "My LLM Server",
      "baseUrl": "https://llm.company.com/v1/",
      "apiKey": "sk-xxx",
      "models": [
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "maxTokens": 8192,
          "enabled": true,
          "healthStatus": "healthy"
        }
      ]
    }
  ]
}
```

#### 설정 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Config Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 앱 시작 (open)                                          │
│     └─→ ConfigManager.initialize()                          │
│     └─→ LLM 미등록 시 → LLMSetupWizard 자동 실행            │
│     └─→ Health Check 실행 (모든 엔드포인트)                 │
│                                                             │
│  2. /settings → LLMs (UI에서 설정)                          │
│     └─→ 엔드포인트 추가/수정/삭제                           │
│     └─→ 연결 테스트                                         │
│     └─→ Health Check 새로고침                               │
│                                                             │
│  3. /model (모델 전환)                                      │
│     └─→ Healthy 모델 목록 표시                              │
│     └─→ 방향키로 선택, Enter로 전환                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 주요 ConfigManager 메서드

| 메서드 | 설명 |
|--------|------|
| `initialize()` | 설정 파일 로드 및 초기화 |
| `hasEndpoints()` | LLM 엔드포인트 등록 여부 확인 |
| `getCurrentEndpoint()` | 현재 활성 엔드포인트 조회 |
| `getCurrentModel()` | 현재 활성 모델 조회 |
| `setCurrentEndpoint(id)` | 활성 엔드포인트 변경 |
| `setCurrentModel(id)` | 활성 모델 변경 |
| `getAllEndpoints()` | 모든 엔드포인트 목록 |
| `getAllModels()` | 모든 모델 목록 (엔드포인트별) |
| `getHealthyModels()` | Healthy 상태인 모델만 조회 |
| `updateEndpoint(id, updates)` | 엔드포인트 업데이트 |
| `deleteEndpoint(id)` | 엔드포인트 삭제 |
| `updateModelHealth(...)` | 모델 Health 상태 업데이트 |
| `updateAllHealthStatus(...)` | 전체 Health 상태 일괄 업데이트 |

---

### 4.6 Local-RAG (로컬 문서 검색)

**목적**: 로컬 마크다운 문서에서 관련 정보 검색 (Retrieval-Augmented Generation)

**위치**: `src/core/knowledge/docs-search-agent.ts`, `src/core/knowledge/document-manager.ts`
(re-export: `src/core/docs-search-agent.ts`, `src/core/document-manager.ts`)

#### RAG 개념 (Python 개발자용)

```python
# Python에서의 RAG 개념
def answer_question(question: str, documents: list[str]) -> str:
    # 1. 관련 문서 검색 (Retrieval)
    relevant_docs = search_documents(question, documents)

    # 2. 프롬프트에 문서 추가 (Augmentation)
    prompt = f"다음 문서를 참고하여 답변:\n{relevant_docs}\n\n질문: {question}"

    # 3. LLM으로 답변 생성 (Generation)
    return llm.generate(prompt)
```

#### 4단계 검색 전략

```
┌─────────────────────────────────────────────────────────────┐
│                  4-Tier Search Strategy                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Query: "React hooks 사용법"                                │
│                                                             │
│  Tier 1: 파일명 검색 (특정 디렉토리)                        │
│          ~/.open-cli/docs/ 에서 "react", "hooks" 포함 파일  │
│          → 결과 없음                                        │
│                                                             │
│  Tier 2: 파일명 검색 (광범위)                               │
│          프로젝트 전체에서 검색                             │
│          → docs/react-guide.md 발견                         │
│                                                             │
│  Tier 3: 내용 검색 (특정)                                   │
│          파일 내용에서 "hooks" 검색                         │
│          → 3개 섹션 발견                                    │
│                                                             │
│  Tier 4: 내용 검색 (광범위)                                 │
│          관련 키워드 확장 검색                              │
│          → 추가 컨텍스트 발견                               │
│                                                             │
│  결과: 관련 문서 조각들을 LLM 프롬프트에 추가               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 문서 인덱스 구조

```typescript
interface DocumentIndex {
  documents: DocumentMetadata[];
  lastUpdated: string;
}

interface DocumentMetadata {
  id: string;
  title: string;
  tags: string[];
  filePath: string;
  excerpt: string;        // 첫 200자
  createdAt: string;
  updatedAt: string;
}
```

#### 문서 검색 동작

> **참고**: `/docs` 슬래시 명령어는 현재 구현되어 있지 않습니다.
> 문서 검색은 TODO 실행 시 자동으로 수행됩니다.

- `requiresDocsSearch: true`로 설정된 TODO 실행 시 자동 검색
- `~/.open-cli/docs/` 폴더의 마크다운 문서 대상
- 검색 결과는 LLM 컨텍스트에 자동 추가

---

### 4.7 Integration (통합 워크플로우)

**목적**: 모든 기능이 연계되어 동작하는 전체 흐름

#### 전체 실행 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  사용자: "src 폴더에 유틸 함수 만들고 테스트해줘"           │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. LLM-Client: 요청 분석                              │  │
│  │    - 메시지를 LLM에 전송                               │  │
│  │    - Tool 사용 여부 결정                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. Plan-Execute: 계획 수립                            │  │
│  │    - TODO 1: src 폴더 구조 확인                       │  │
│  │    - TODO 2: 유틸 함수 파일 생성                       │  │
│  │    - TODO 3: 테스트 파일 생성                         │  │
│  │    - TODO 4: 테스트 실행                              │  │
│  │    → HITL: 사용자 승인 요청                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. Execution: 각 TODO 실행                            │  │
│  │                                                       │  │
│  │    TODO 1 실행:                                       │  │
│  │    └─ File-Tools로 list_files 호출                   │  │
│  │                                                       │  │
│  │    TODO 2 실행:                                       │  │
│  │    └─ File-Tools로 write_file 호출                   │  │
│  │                                                       │  │
│  │    TODO 3, 4 실행...                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 4. Session: 자동 저장                                 │  │
│  │    - 대화 내역 저장                                   │  │
│  │    - TODO 상태 저장                                   │  │
│  │    - 나중에 /load로 복원 가능                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  결과: "유틸 함수와 테스트를 생성했습니다. 테스트 통과!"    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 에러 복구 흐름

```
작업 중 에러 발생 시:

1. Plan-Execute 레벨:
   └─→ Debug 모드 진입 → LLM이 에러 분석 → 수정 시도 (최대 3회)

2. 복구 불가 시:
   └─→ 에러 로그 저장 ({session-id}_error.json)
   └─→ 사용자에게 상세 에러 정보 표시
   └─→ 세션 저장 (나중에 재시도 가능)
```

---

### 4.8 Multi-Layer Execution (다계층 실행)

**목적**: 작업 복잡도에 따라 적절한 실행 계층 선택

**위치**: `src/execution/`

#### 4개 실행 계층

```
┌─────────────────────────────────────────────────────────────┐
│                  Execution Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Standard Tools (가장 빠름)                        │
│           read_file, write_file, list_files, find_files     │
│           단순 파일 작업                                    │
│                                                             │
│  Layer 2: SDK/Code-Gen (중간)                               │
│           동적으로 TypeScript 코드 생성 및 실행             │
│           복잡한 데이터 처리                                │
│                                                             │
│  Layer 3: SubAgent (느림)                                   │
│           별도 LLM 세션으로 복잡한 작업 위임                │
│           대규모 리팩토링                                   │
│                                                             │
│  Layer 4: Skills (전문화)                                   │
│           특정 도메인 전문 기능                             │
│           TDD 워크플로우, 코드 리뷰 등                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 자동 계층 선택

```typescript
// LayerManager가 작업 복잡도를 분석하여 적절한 계층 선택
const layer = layerManager.selectLayer(task);

switch (layer) {
  case 'standard':
    // 단순 도구 호출
    return standardTools.execute(task);
  case 'code-gen':
    // 코드 생성 및 실행
    return sdkLayer.generateAndExecute(task);
  case 'subagent':
    // 서브 에이전트에 위임
    return subagentLayer.delegate(task);
  case 'skills':
    // 전문 스킬 사용
    return skillsLayer.apply(task);
}
```

---

## 5. 데이터 흐름 아키텍처

### 전체 실행 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│                    (터미널에서 메시지 입력)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   React/Ink UI Layer                             │
│              src/ui/components/PlanExecuteApp.tsx                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ TextInput    │  │ FileBrowser  │  │ CommandBrowser│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Logic Layer                            │
│                        src/core/                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Plan Phase (사용자 요청 → TODO 리스트 생성)              │   │
│  │   PlanningLLM.generateTODOList()                         │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │   Execute Phase (각 TODO 순차 실행)                        │   │
│  │   for each TODO:                                          │   │
│  │     1. TodoExecutor.execute()                             │   │
│  │     2. LayerManager.selectLayer() → 적절한 계층 선택       │   │
│  │     3. If fail → Debug 모드 재시도                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Execution Layer                               │
│                     src/execution/                               │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Standard   │ │ SDK/       │ │ SubAgent   │ │ Skills     │   │
│  │ Tools      │ │ Code-Gen   │ │ Layer      │ │ Layer      │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
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

### 6.1 새 Tool 추가 (6가지 분류 시스템)

#### 6가지 도구 분류

| 분류 | 위치 | 호출 방식 | Sub-LLM |
|------|------|-----------|---------|
| LLM Simple | `tools/llm/simple/` | LLM tool_call | 없음 |
| LLM Agent | `tools/llm/agents/` | LLM tool_call | 사용 |
| System Simple | `tools/system/simple/` | 자동 트리거 | 없음 |
| System Agent | `tools/system/agents/` | 자동 트리거 | 사용 |
| User Command | `tools/user/` | /슬래시 명령 | - |
| MCP | `tools/mcp/` | MCP 프로토콜 | - |

#### LLM Simple Tool 추가 예시

**1단계**: `src/tools/llm/simple/`에 도구 파일 생성

```typescript
// src/tools/llm/simple/my-tools.ts
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
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  }
};

async function _executeMyTool(args: Record<string, unknown>): Promise<ToolResult> {
  const param1 = args['param1'] as string;
  // 도구 로직 구현
  return { success: true, result: 'result' };
}

export const myTool: LLMSimpleTool = {
  definition: MY_TOOL_DEFINITION,
  execute: _executeMyTool,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'My tool description',
};
```

**2단계**: `src/tools/llm/simple/index.ts`에서 export

**3단계**: `src/tools/registry.ts`에 등록 (자동 등록됨)

### 6.2 새 UI 컴포넌트 추가

**1단계**: `src/ui/components/`에 컴포넌트 파일 생성

```tsx
// src/ui/components/MyComponent.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { logger } from '../../utils/logger.js';

interface MyComponentProps {
  title: string;
  onSelect: (value: string) => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onSelect }) => {
  logger.enter('MyComponent render', { title });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">{title}</Text>
      {/* 컴포넌트 내용 */}
    </Box>
  );
};
```

**2단계**: `PlanExecuteApp.tsx`에서 import 및 사용

### 6.3 새 Core 기능 추가

**1단계**: `src/core/`에 파일 생성 (kebab-case.ts)

```typescript
// src/core/my-feature.ts
import { logger } from '../utils/logger.js';

export class MyFeature {
  constructor() {
    logger.enter('MyFeature.constructor');
    logger.exit('MyFeature.constructor');
  }

  async execute(input: string): Promise<string> {
    logger.enter('MyFeature.execute', { input });

    try {
      logger.flow('Processing input');
      const result = await this.process(input);

      logger.vars({ name: 'result', value: result });
      logger.exit('MyFeature.execute', { success: true });

      return result;
    } catch (error) {
      logger.error('MyFeature.execute failed', error);
      throw error;
    }
  }
}
```

---

## 7. 코딩 규칙

### 7.1 파일 명명 규칙

| 종류 | 규칙 | 예시 |
|------|------|------|
| Core 로직 | kebab-case.ts | `llm-client.ts`, `config-manager.ts` |
| UI 컴포넌트 | PascalCase.tsx | `PlanExecuteApp.tsx`, `StatusBar.tsx` |
| 타입 정의 | index.ts 또는 types.ts | `types/index.ts` |
| 유틸리티 | kebab-case.ts | `file-system.ts`, `retry.ts` |

### 7.2 로깅 규칙 (필수!)

**모든 새 기능에는 반드시 상세한 로깅을 추가해야 합니다.**

```typescript
import { logger } from '../utils/logger.js';

async function myFunction(userId: string, options: Options) {
  // 1. 함수 진입 (필수)
  logger.enter('myFunction', { userId, options });

  try {
    // 2. 중요한 분기점마다 flow (권장)
    logger.flow('Validating user');

    // 3. 복잡한 계산 후 vars (권장)
    const result = calculateSomething();
    logger.vars({ name: 'result', value: result });

    // 4. 상태 변경 시 state (권장)
    logger.state('User status', oldStatus, newStatus);

    // 5. 시간 측정이 필요한 작업 (권장)
    logger.startTimer('database-query');
    const data = await database.query();
    logger.endTimer('database-query');

    // 6. 함수 종료 (필수)
    logger.exit('myFunction', { success: true });
    return data;

  } catch (error) {
    // 7. 에러 로깅 (필수)
    logger.error('myFunction failed', error);
    throw error;
  }
}
```

**상세한 로깅 가이드**: [02_LOGGING.md](./02_LOGGING.md) 참조

### 7.3 타입 안전성

```typescript
// 항상 명시적 타입 사용
interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// unknown 대신 구체적인 타입
function processData(data: ProcessedData): Result {
  // ...
}
```

### 7.4 에러 처리

```typescript
import { BaseError, LLMError, NetworkError } from '../errors/index.js';

try {
  await llmClient.sendMessage(message);
} catch (error) {
  if (error instanceof NetworkError) {
    logger.error('Network issue', error);
    // 네트워크 에러 처리
  } else if (error instanceof LLMError) {
    logger.error('LLM issue', error);
    // LLM 에러 처리
  } else {
    throw error;  // 알 수 없는 에러는 상위로 전파
  }
}
```

---

## 8. CLI 실행 모드

### 8.1 모드 비교

| 모드 | 명령어 | 로그 레벨 | 용도 |
|------|--------|----------|------|
| Normal | `open` | INFO | 일반 사용 |
| Verbose | `open --verbose` | DEBUG | 개발/디버깅 |
| Debug | `open --debug` | VERBOSE | 심층 분석 |

### 8.2 모드별 출력

**Normal Mode:**
```
[2025-11-12T10:30:00.123Z] [OPEN-CLI] ℹ️  INFO: 서버 시작됨
[2025-11-12T10:30:00.125Z] [OPEN-CLI] ⚠️  WARN: 설정 파일 없음
```

**Verbose Mode:**
```
[2025-11-12T10:30:00.123Z] [OPEN-CLI] [app.ts:42:startApp] ↓ ENTER: startApp
[2025-11-12T10:30:00.124Z] [OPEN-CLI] [app.ts:45:startApp] ➜ FLOW: 설정 로드 중
[2025-11-12T10:30:00.125Z] [OPEN-CLI] [app.ts:48:startApp] 📦 VARS:
   config.endpoint="https://api.example.com" (string)
[2025-11-12T10:30:00.126Z] [OPEN-CLI] [app.ts:52:startApp] ↑ EXIT: startApp
```

**Debug Mode:**
```
[2025-11-12T10:30:00.123Z] [OPEN-CLI] [http.ts:42:request] → HTTP REQUEST: POST https://api.example.com/v1/chat
  Body: { "messages": [...] }
[2025-11-12T10:30:00.456Z] [OPEN-CLI] [http.ts:67:request] ← HTTP RESPONSE: 200 OK
  Data: { "choices": [...] }
```

---

## 9. UI/UX 컴포넌트 상세

### 9.1 시작 화면 (Logo.tsx)

**위치**: `src/ui/components/Logo.tsx`

#### 애니메이션 효과
- **그라데이션 색상 순환**: ASCII 로고가 cyan → blue → magenta 색상으로 애니메이션
- **타이핑 효과**: 태그라인이 한 글자씩 타이핑되는 효과
- **초기화 단계 표시**: 체크마크 애니메이션으로 초기화 진행 상황 표시

```tsx
// 그라데이션 애니메이션
const GRADIENT_COLORS = ['cyan', 'cyanBright', 'blue', 'magenta', 'magentaBright'];
useEffect(() => {
  const interval = setInterval(() => {
    setColorIndex((prev) => (prev + 1) % GRADIENT_COLORS.length);
  }, 500);
  return () => clearInterval(interval);
}, []);
```

### 9.2 메시지 영역 (ChatView.tsx + MarkdownRenderer.tsx)

**위치**: `src/ui/components/views/ChatView.tsx`, `src/ui/components/MarkdownRenderer.tsx`

#### 마크다운 렌더링
- **헤더**: `#`, `##`, `###` 지원 (색상 및 스타일 구분)
- **코드 블록**: 구문 강조 지원 (TypeScript, JavaScript, Python, Bash)
- **인라인 스타일**: `**굵게**`, `*기울임*`, `` `코드` ``
- **목록**: 번호 목록, 글머리 기호 목록

```tsx
// 구문 강조 색상
const SYNTAX_COLORS = {
  keyword: 'magenta',   // const, function, class
  string: 'green',      // "문자열"
  number: 'yellow',     // 123
  comment: 'gray',      // // 주석
  function: 'cyan',     // 함수명()
};
```

### 9.3 입력 영역 (PlanExecuteApp.tsx)

**위치**: `src/ui/components/PlanExecuteApp.tsx`

#### 글자 수 카운터
- 입력 길이에 따른 색상 변화:
  - 0-2000자: gray (정상)
  - 2000-4000자: yellow (경고)
  - 4000자 이상: red (위험)

```tsx
{input.length > 0 && (
  <Text color={input.length > 4000 ? 'red' : input.length > 2000 ? 'yellow' : 'gray'}>
    {input.length.toLocaleString()}
  </Text>
)}
```

### 9.4 활동 표시기 (ActivityIndicator.tsx)

**위치**: `src/ui/components/ActivityIndicator.tsx`

#### 토큰 메트릭 표시
- **토큰 카운터**: 애니메이션된 브레일 스피너와 함께 실시간 토큰 수 표시
- **Tokens per Second**: 생성 속도 표시
- **레이턴시**: API 응답 시간 표시 (색상으로 상태 구분)
- **Prompt/Completion 분리**: ↑(입력) ↓(출력) 토큰 수

```tsx
// 토큰 애니메이션 프레임
const tokenAnimFrames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

// 레이턴시 색상
{latencyMs > 1000 ? 'red' : latencyMs > 500 ? 'yellow' : 'green'}
```

### 9.5 TODO 패널 (TodoPanel.tsx)

**위치**: `src/ui/TodoPanel.tsx`

#### 향상된 기능
- **미니맵 진행률**: `[✓✓▶○○]` 형식으로 전체 진행 상황 한눈에 표시
- **예상 시간**: 완료된 작업 기반으로 남은 시간 예측
- **토큰 사용량**: 작업별 토큰 사용량 표시
- **트리 구조**: 계층적 연결선으로 작업 관계 표시

```tsx
// 미니맵 컴포넌트
<Box>
  <Text color="gray">[</Text>
  {todos.map((todo) => (
    <Text color={config.color}>
      {todo.status === 'in_progress' ? '▶' : config.emoji}
    </Text>
  ))}
  <Text color="gray">]</Text>
</Box>
```

### 9.6 상태바 (StatusBar.tsx)

**위치**: `src/ui/components/StatusBar.tsx`

#### 표시 정보
- **Health 상태**: ● (healthy), ○ (unknown), ◐ (checking), ● (unhealthy)
- **실행 상태**: IDLE, THINK, EXEC, ERR
- **모델명**: 현재 사용 중인 모델
- **메시지 수**: 💬 카운트
- **세션 토큰**: ⚡ 총 사용 토큰
- **컨텍스트 사용률**: 색상 코딩된 미니 바 (녹색→노랑→빨강)
- **TODO 상태**: 완료/전체
- **실시간 시계**: HH:MM 형식

```tsx
// 컨텍스트 사용률 색상
let color: string;
if (percentage < 50) color = 'green';
else if (percentage < 75) color = 'yellow';
else if (percentage < 90) color = 'red';
else color = 'redBright';
```

### 9.7 토큰 추적 시스템 (TokenContext.tsx)

**위치**: `src/ui/contexts/TokenContext.tsx`

#### 기능
- **세션 토큰 합계**: 전체 대화의 토큰 사용량 추적
- **Tokens per Second**: 생성 속도 계산
- **Prompt/Completion 분리**: 입력과 출력 토큰 구분 추적

```tsx
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface TokenStats {
  sessionTotal: number;
  tokensPerSecond: number;
  lastPromptTokens: number;
  lastCompletionTokens: number;
}
```

---

## 문서 관리 규칙

- 모든 문서는 `docs/` 폴더에 마크다운(`.md`)으로 작성
- **핵심 문서만 유지** (중복 제거, 통합 권장)
- 기능 변경 시 반드시 관련 문서도 업데이트
- 문서 목록:
  1. `README.md` - 프로젝트 소개 및 빠른 시작
  2. `docs/01_DEVELOPMENT.md` - 개발자 종합 가이드 (이 문서)
  3. `docs/02_LOGGING.md` - 로깅 시스템 상세 가이드
  4. `docs/03_TESTING.md` - 테스트 가이드 (E2E, 단위, HITL, 평가 시스템)
  5. `docs/04_ROADMAP.md` - 프로젝트 로드맵 및 TODO

---

**질문이나 제안사항이 있으면 GitHub Issues를 이용해주세요!**
