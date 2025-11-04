# open-CLI (AI2Go CLI) - 종합 프로젝트 문서

**프로젝트 시작**: 2025년 11월
**예상 개발 기간**: 2년+
**최종 목표**: 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼

---

## 📋 Executive Summary

open-CLI는 **Gemini CLI의 개념을 기업 환경에 맞춰 완전히 재구축**한 프로젝트입니다. 인터넷 연결이 없는 회사 네트워크 환경에서 로컬 OpenAI Compatible 모델들을 활용하여 코드 작성, 분석, 문제 해결을 지원하는 **엔터프라이즈급 CLI 도구**입니다.

### 핵심 가치 제안
- **완전 오프라인 운영**: 인터넷 없이 독립적으로 작동
- **사내 모델 통합**: 기업의 로컬 LLM 서버와 직접 연결
- **제로 의존성 배포**: Git Clone만으로 설치 가능 (npm install 제약 우회)
- **침입적 LLM 도구**: 파일 시스템, 쉘 명령, 로컬 문서 접근 권한
- **엔터프라이즈 설정**: 멀티 모델 관리, 엔드포인트 검증, 팀 프리셋

---

## 🎯 최종 목표 아키텍처 (2년 이상 개발)

```
┌─────────────────────────────────────────────────────────────┐
│                         open-CLI v2.0+                        │
│                    (Ultimate Final State)                    │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐          ┌─────▼──────┐        ┌────▼────┐
    │  Core  │          │  Extensions│        │Enterprise│
    │  CLI   │          │  & Plugins │        │  Module  │
    └────────┘          └────────────┘        └──────────┘
        │                     │                     │
        │                     │                     │
    ┌───▼───────────────────────────────────────────▼────┐
    │           Unified Configuration System              │
    │  (~/.open-cli/, Team configs, Presets, Profiles)    │
    └───────────────────────────────────────────────────┘
        │                                          │
    ┌───▼───────────────────────────────────────────▼────┐
    │     Local Document Repository & RAG System         │
    │  (~/.open-cli/docs/, Full-text search, Embeddings)  │
    └───────────────────────────────────────────────────┘
        │
    ┌───▼───────────────────────────────────────────────┐
    │    OpenAI Compatible Endpoint Manager               │
    │  (Multi-endpoint, Health Check, Model Registry)    │
    └───────────────────────────────────────────────────┘
        │
    ┌───▼──────────────────────────────────────────────┐
    │    Context-Aware LLM Tool Execution Engine        │
    │  (Tool calling, Streaming, Error Recovery)       │
    └───────────────────────────────────────────────────┘
```

---

## 📐 프로젝트 페이즈 구분

### Phase 1️⃣: 기초 구축 (3-6개월) - ✅ 완료 (2025-11-03)
- ✅ 기본 CLI 프레임워크
- ✅ 로컬 모델 엔드포인트 연결
- ✅ 파일 시스템 도구 (read_file, write_file, list_files, find_files)
- ✅ 기본 명령어 시스템 (대화형 모드, 메타 명령어)

### Phase 2️⃣: 상호작용 고도화 (6-12개월) - ✅ 완료 (2025-11-03)
- ✅ 인터랙티브 터미널 UI (Ink/React 기반 - ESM)
- ✅ 고급 설정 관리 (멀티 엔드포인트)
- ✅ 로컬 문서 시스템 (마크다운 지식 베이스)
- ✅ 사용자 메모리/세션 관리
- ✅ ESM 마이그레이션 (CommonJS → ES Modules)

### Phase 2.5: Plan-and-Execute 아키텍처 + Agent Tool + UI/UX 고도화 (3-4주) - 🚧 진행 중 (2025-11-04)

**목표 1**: Plan-and-Execute 아키텍처 구현 (TODO 기반 실행) 🚨 **최최우선**
**목표 2**: 지능형 문서 검색 Agent Tool 구현
**목표 3**: Gemini CLI 수준의 세련된 터미널 UI 구현

#### A. Plan-and-Execute 아키텍처 🚨 **최최우선 과제**

**개요**:
사용자 요청을 자동으로 TODO list로 분해하고, 각 TODO를 순차적으로 실행하는 시스템.
Gemini CLI/Claude Code와 유사한 실행 패턴을 구현합니다.

**핵심 변경사항**:
- **현재 방식**: User Request → LLM → Direct Response
- **새로운 방식**: User Request → Planning LLM → TODO List → Execute Each TODO → All Done

**아키텍처**:
```
User Request
    ↓
Planning LLM (작업 계획)
    ↓
TODO List 생성 (UI에 표시)
    ├─ TODO 1 (pending)
    ├─ TODO 2 (pending)
    └─ TODO 3 (pending)
    ↓
For each TODO:
    ├─ Status: in_progress
    ├─ Docs Search Agent (선행 실행) ← 정보 수집
    ├─ Main LLM ReAct (Tools 사용)
    ├─ Status: completed ✓
    └─ Next TODO
    ↓
All TODOs Completed
    ↓
Session 저장 (TODO 상태 포함)
```

**주요 기능**:
1. **Planning LLM**: User request를 5-7개의 실행 가능한 TODO로 분해
2. **Docs Search 선행**: 각 TODO 실행 전 반드시 문서 검색 (requiresDocsSearch: true인 경우)
3. **순차 실행**: TODO를 하나씩 완료하며 진행
4. **TODO UI 고정**: 메시지는 스크롤되지만 TODO list는 화면 하단에 고정
5. **Session 복구**: TODO 진행 상황을 저장하여 나중에 복구 가능

**구현 컴포넌트**:
1. `planning-llm.ts` - TODO list 자동 생성
2. `todo-executor.ts` - TODO 순차 실행 엔진
3. `TodoListPanel.tsx` - 하단 고정 TODO UI
4. `session-manager.ts` 확장 - TODO 상태 저장

**UI 예시**:
```
┌────────────────────────────────────────────┐
│ Messages (scrollable)                      │
│                                            │
│ > User: TypeScript로 REST API 만들어줘    │
│ 🤖 Assistant: 5개 작업으로 계획했습니다    │
│ 🤖 Assistant: [TODO 1 시작]...            │
│ ...                                        │
├────────────────────────────────────────────┤
│ 📋 TODO List (2/5 completed)     [12:34]  │ ← 고정
├────────────────────────────────────────────┤
│ ✓ 1. TypeScript 설정 조사                  │
│ ✓ 2. Express.js 설치                       │
│ → 3. 라우트 구조 생성 (진행 중)            │ ← 현재
│ ☐ 4. API 엔드포인트 구현                   │
│ ☐ 5. 테스트 코드 작성                      │
└────────────────────────────────────────────┘
```

**예상 기간**: 5-7일
- Planning LLM: 1일
- TODO Executor: 1.5일
- TODO UI: 1일
- 통합: 1.5일
- 테스트: 1-2일

#### B. Docs Search Agent Tool 🆕 **최우선 과제**

**개요**:
LLM이 자동으로 ~/.open-cli/docs 폴더를 검색할 수 있는 "Agent Tool" 구현.
이 Tool은 내부에서 또 다른 LLM을 실행하여 bash 명령어로 복잡한 문서 검색을 수행합니다.

**아키텍처**:
```
Main LLM (사용자 대화)
    └─ search_docs_agent Tool
            └─ Sub LLM (문서 검색 전문가)
                    ├─ run_bash (find)
                    ├─ run_bash (grep)
                    ├─ run_bash (cat)
                    └─ Multi-iteration (최대 10회)
```

**핵심 기능**:
- **지능형 검색**: 폴더 구조, 파일명, 파일 내용 기반 검색
- **Multi-iteration**: 최대 10회 반복으로 복잡한 검색 수행
- **보안 검증**: 화이트리스트/블랙리스트 기반 명령어 제한
- **자동 요약**: 여러 파일에서 정보를 수집하여 종합

**구현 컴포넌트**:
1. `bash-command-tool.ts` - 안전한 bash 명령 실행
2. `docs-search-agent.ts` - Agent Tool 메인 로직
3. 보안 검증 시스템 (타임아웃, 디렉토리 제한)

**사용 예시**:
```
사용자: TypeScript 코딩 표준 문서를 찾아줘
    ↓
Main LLM: search_docs_agent(query="TypeScript 코딩 표준") 호출
    ↓
Sub LLM (Agent):
    1. run_bash("ls -la")
    2. run_bash("find . -name '*typescript*'")
    3. run_bash("cat coding-standards/typescript.md")
    → 정보 수집 및 요약
    ↓
Main LLM: 사용자에게 자연어로 결과 설명
```

**예상 기간**: 2-3일
- Bash Tool 생성: 0.5일
- Agent 구현: 1일
- 통합 및 보안: 0.5일
- 테스트: 1일

#### C. UI/UX 고도화

**주요 작업**:
- 🚧 Tool 사용 내역 UI 표시 (박스 형태)
- 📋 하단 상태바 구현 (경로, 모델, 컨텍스트)
- 📋 ASCII 로고 및 Welcome 화면
- 📋 입력 힌트 및 자동완성
- 📋 메시지 타입별 스타일링 강화

**기술적 접근**:
- Ink 컴포넌트 모듈화 (Header, StatusBar, ToolCallBox 등)
- 반응형 레이아웃 (터미널 너비에 따른 조정)
- 실시간 상태 업데이트 (토큰 사용량, 디렉토리)

**예상 기간**: 1-2주
- P0 작업 (Tool UI, 상태바): 3-4일
- P1 작업 (Welcome, 로고): 3-4일
- P2 작업 (스타일링, 힌트): 4-5일

#### 전체 예상 기간: 3-4주 ⚠️ 대폭 증가
- **Plan-and-Execute 아키텍처**: 5-7일 (최최우선)
- Docs Search Agent: 2-3일
- UI/UX 고도화: 10-13일
- 통합 테스트 및 문서화: 3-5일

**개발 순서**:
1. Planning LLM 구현 (TODO 생성)
2. Bash Command Tool (Docs Search용)
3. Docs Search Agent Tool
4. TODO Executor (실행 엔진)
5. TODO List UI (고정 패널)
6. InteractiveApp 통합
7. Session 개선
8. 전체 통합 테스트

**성공 지표**:
- ✓ User request가 자동으로 TODO list로 분해됨
- ✓ TODO list가 화면 하단에 고정 표시됨
- ✓ 각 TODO 실행 전 Docs Search Agent 선행 실행
- ✓ TODO 상태가 실시간으로 UI에 업데이트 (pending → in_progress → completed)
- ✓ Session에 TODO 진행 상황 저장 및 복구 가능
- ✓ LLM이 자동으로 문서 검색 (search_docs_agent)
- ✓ Agent가 multi-iteration으로 복잡한 검색 수행
- ✓ Tool 호출 시 박스로 시각적 피드백
- ✓ 상태바에서 실시간 컨텍스트 사용률 표시
- ✓ 첫 실행 시 Welcome 화면 및 Tips 제공
- ✓ Gemini CLI/Claude Code와 유사한 UX 수준 달성

---

## 🏗️ 기술 스택

```
┌─────────────────────────────────────────┐
│         Frontend (Terminal UI)           │
├─────────────────────────────────────────┤
│ • Ink + React (Component-based TUI)     │
│ • Commander.js (CLI parsing)            │
│ • Chalk (Colored output)                │
│ • Ora (Spinner/Progress)                │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│        Backend (Core Logic)              │
├─────────────────────────────────────────┤
│ • TypeScript (Type safety, ESM)         │
│ • Node.js v20+ (Runtime, Native ESM)   │
│ • Axios (HTTP client)                   │
│ • Zod (Schema validation)               │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│      Data Layer (Configuration)          │
├─────────────────────────────────────────┤
│ • SQLite (Profile/history storage)      │
│ • JSON (Endpoint configs)               │
│ • File system (Documents/context)       │
└─────────────────────────────────────────┘
                   │
┌─────────────────────────────────────────┐
│     External Integration                │
├─────────────────────────────────────────┤
│ • OpenAI Compatible API                 │
│ • Local Document indexing               │
│ • Git integration (optional)             │
└─────────────────────────────────────────┘
```

---

## 📦 배포 전략

### 현재 제약사항
```
❌ npm install 불가
❌ 인터넷 연결 불가
❌ 외부 저장소 접근 불가
```

### 해결 방안

#### 옵션 A: Bundled Node.js (추천)
```
open-cli/
├── bin/
│   ├── open (Shell wrapper - Unix/Linux)
│   ├── open.ps1 (PowerShell wrapper - Windows)
│   └── open.cmd (Batch wrapper - Windows)
├── runtime/
│   ├── node-v20.x-linux-x64/ (Pre-bundled Node.js)
│   ├── node-v20.x-darwin-x64/
│   └── node-v20.x-win-x64/
├── app/
│   ├── dist/ (Compiled JavaScript)
│   ├── package.json (Locked versions)
│   └── node_modules/ (Bundled dependencies)
└── docs/
    └── [offline documentation]

# 배포: git clone https://company.git/open-cli
# 실행: ./open-cli/bin/open 또는 ./open-cli/bin/open.cmd
```

#### 옵션 B: Standalone Binary
```
# Pkg.js를 사용하여 단일 실행 파일로 컴파일
open-cli-v1.0.0-linux-x64
open-cli-v1.0.0-darwin-x64
open-cli-v1.0.0-win-x64.exe
```

#### 옵션 C: Docker Container
```dockerfile
FROM node:20-alpine
COPY . /app
WORKDIR /app
RUN npm ci --only=production
ENTRYPOINT ["node", "dist/cli.js"]
```

### 초기 배포 전략
1. **개발/테스트**: 로컬 npm install로 개발
2. **스테이징**: Bundled Node.js로 재패키징
3. **프로덕션**: Standalone binary 또는 Docker 컨테이너

---

## 🎨 UI/UX 상세 설계

### 1. 전체 화면 구성

#### 1.1 기본 레이아웃

```
┌─────────────────────────────────────────────────────────────────────┐
│ open-CLI v1.0.0 | 모델: gpt-4-turbo | 세션: 1h 23m | 메시지: 15     │  ← 헤더
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [AI] 안녕하세요! open-CLI입니다. 무엇을 도와드릴까요?                │  ← 대화 영역
│                                                                       │
│  > 프로젝트 구조를 분석해줘                                          │
│                                                                       │
│  [AI] 프로젝트 구조를 분석하겠습니다.                                │
│                                                                       │
│  [도구 실행] find_files("**/*")                                      │  ← 도구 실행 표시
│  ✓ 127개 파일 발견                                                   │
│                                                                       │
│  분석 결과는 다음과 같습니다:                                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────┐                │  ← Rich 테이블
│  │ 디렉토리       │ 파일 수  │ 주요 언어            │                │
│  ├─────────────────────────────────────────────────┤                │
│  │ src/           │ 45       │ Python               │                │
│  │ tests/         │ 23       │ Python               │                │
│  │ docs/          │ 12       │ Markdown             │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                       │
│  더 상세한 분석이 필요하시면 말씀해주세요.                           │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ > _                                                                   │  ← 입력 프롬프트
├─────────────────────────────────────────────────────────────────────┤
│ /help: 도움말 | /model: 모델 변경 | Ctrl+D: 종료                    │  ← 푸터 (힌트)
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.2 화면 영역 설명

**헤더 (Header)**
- **위치**: 최상단 1줄
- **내용**: 버전, 현재 모델, 세션 정보, 메시지 수
- **색상**: 밝은 청록색 배경 + 흰색 텍스트
- **업데이트**: 모델 변경, 세션 시간 경과 시 자동 갱신

**대화 영역 (Conversation Area)**
- **위치**: 중앙 (동적 크기)
- **내용**: 사용자 메시지 + AI 응답 + 도구 실행 결과
- **스크롤**: 자동 스크롤 (최신 메시지로)
- **색상**:
  - 사용자: 초록색 `>`
  - AI: 파란색 `[AI]`
  - 도구: 노란색 `[도구 실행]`
  - 에러: 빨간색 `[오류]`

**입력 프롬프트 (Input Prompt)**
- **위치**: 하단에서 2번째 줄
- **형식**: `> ` (커서 깜빡임)
- **기능**:
  - 멀티라인 지원 (Shift+Enter)
  - 히스토리 (↑/↓)
  - 자동완성 (Tab)

**푸터 (Footer)**
- **위치**: 최하단 1줄
- **내용**: 주요 명령어 힌트 + 단축키
- **색상**: 회색 (덜 두드러지게)

### 2. 색상 스키마 (Color Scheme)

#### 2.1 기본 색상

```python
# Rich Console 테마 정의
from rich.theme import Theme

open_THEME = Theme({
    # 기본 요소
    "header": "bold cyan on dark_blue",
    "footer": "dim white",
    "prompt": "bold green",
    "user": "green",
    "ai": "blue",
    "tool": "yellow",
    "error": "bold red",
    "success": "bold green",
    "warning": "bold yellow",

    # 구문 강조
    "code": "cyan",
    "code.keyword": "magenta",
    "code.string": "green",
    "code.number": "cyan",
    "code.comment": "dim white",

    # UI 요소
    "table.header": "bold magenta",
    "table.border": "blue",
    "panel.border": "cyan",
    "progress.description": "cyan",
    "progress.percentage": "magenta",

    # 상태 표시
    "status.spinner": "cyan",
    "status.text": "dim white",
})
```

#### 2.2 색상 사용 예시

```python
from rich.console import Console

console = Console(theme=open_THEME)

# 사용자 입력
console.print("> 안녕?", style="user")

# AI 응답
console.print("[AI] 안녕하세요!", style="ai")

# 도구 실행
console.print("[도구 실행] read_file('main.py')", style="tool")

# 성공 메시지
console.print("✓ 파일이 저장되었습니다.", style="success")

# 에러 메시지
console.print("[오류] 파일을 찾을 수 없습니다.", style="error")
```

### 3. 화면별 상세 설계

#### 3.1 시작 화면 (첫 실행)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    ╔═══╗  ╔═══╗  ╔═══╗                              │
│                    ║ A ║  ║ 2 ║  ║ G ║                              │
│                    ╚═══╝  ╚═══╝  ╚═══╝                              │
│                         CLI v1.0.0                                   │
│                                                                       │
│                  Ask to Get - AI Assistant                           │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  환영합니다! open-CLI를 처음 사용하시는군요.                          │
│                                                                       │
│  시작하기 전에 사내 모델 엔드포인트를 설정해주세요.                  │
│                                                                       │
│  ┌──────────────────────────────────────────────────┐               │
│  │ 1. 엔드포인트 URL 입력                            │               │
│  │    http://company.com/v1                          │               │
│  │                                                    │               │
│  │ 2. API Key (선택)                                 │               │
│  │    sk-xxxxxxxxxxxxx                               │               │
│  │                                                    │               │
│  │ 3. 연결 테스트                                     │               │
│  │    [테스트 중] ●●●●●●                             │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                       │
│  [Enter] 계속   [Ctrl+C] 취소                                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**구현**:
```python
from rich.console import Console
from rich.panel import Panel
from rich.align import Align
from rich.prompt import Prompt

def show_welcome_screen():
    console = Console()
    console.clear()

    # ASCII 로고
    logo = """
    ╔═══╗  ╔═══╗  ╔═══╗
    ║ A ║  ║ 2 ║  ║ G ║
    ╚═══╝  ╚═══╝  ╚═══╝
         CLI v1.0.0
    """

    console.print(Align.center(logo, style="bold cyan"))
    console.print(Align.center("Ask to Get - AI Assistant", style="dim white"))
    console.print()

    welcome_text = """
    환영합니다! open-CLI를 처음 사용하시는군요.

    시작하기 전에 사내 모델 엔드포인트를 설정해주세요.
    """

    console.print(Panel(welcome_text, border_style="cyan"))

    # 엔드포인트 설정
    setup_endpoint(console)
```

#### 3.2 일반 대화 화면

```
┌─────────────────────────────────────────────────────────────────────┐
│ open-CLI v1.0.0 | gpt-4-turbo | 00:15:23 | 8 msgs                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  > src/main.py의 보안 취약점을 찾아줘                                │
│                                                                       │
│  [AI] 알겠습니다. src/main.py를 분석하겠습니다.                      │
│                                                                       │
│  [도구 실행] read_file("src/main.py")                                │
│  ✓ 파일 읽기 완료 (234 줄)                                           │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  발견된 보안 취약점 (3개)                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  1. SQL Injection 위험 (Line 45-47)                                  │
│                                                                       │
│     현재 코드:                                                        │
│     ┌─────────────────────────────────────────────────┐            │
│     │  45 | def get_user(user_id):                     │            │
│     │  46 |     query = f"SELECT * FROM users          │            │
│     │  47 |              WHERE id = {user_id}"         │            │
│     └─────────────────────────────────────────────────┘            │
│                                                                       │
│     권장 수정:                                                        │
│     ┌─────────────────────────────────────────────────┐            │
│     │  45 | def get_user(user_id):                     │            │
│     │  46 |     query = "SELECT * FROM users           │            │
│     │  47 |              WHERE id = ?"                 │            │
│     │  48 |     return db.execute(query, (user_id,))  │            │
│     └─────────────────────────────────────────────────┘            │
│                                                                       │
│  2. 평문 비밀번호 저장 (Line 78)                                     │
│     ... (생략) ...                                                    │
│                                                                       │
│  수정하시겠습니까? [y/N]: _                                          │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ /help | /model | Ctrl+D: 종료                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**특징**:
- 코드 블록은 라인 넘버 포함
- 코드는 Syntax Highlighting 적용
- 발견 사항은 번호 매김
- 인터랙티브 확인 (y/N)

#### 3.3 모델 선택 화면 (/model)

```
┌─────────────────────────────────────────────────────────────────────┐
│ open-CLI v1.0.0 | 모델 선택                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  현재 모델: gpt-4-turbo                                              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ #  │ 모델 ID           │ 컨텍스트  │ 속도  │ 엔드포인트       │  │
│  ├────┼──────────────────┼──────────┼───────┼─────────────────┤  │
│  │ →1 │ gpt-4-turbo      │ 128K     │ ●●○○  │ Production      │  │
│  │  2 │ gpt-3.5-turbo    │ 16K      │ ●●●●  │ Production      │  │
│  │  3 │ llama-3-70b      │ 8K       │ ●●○○  │ Dev Server      │  │
│  │  4 │ claude-3-opus    │ 200K     │ ●●○○  │ Production      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  선택 [1-4]: _                                                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────┐                │
│  │ 💡 팁                                            │                │
│  │ - 빠른 응답이 필요하면: gpt-3.5-turbo           │                │
│  │ - 긴 문서 분석이 필요하면: claude-3-opus        │                │
│  │ - 코드 생성에는: gpt-4-turbo 추천               │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ ESC: 취소 | Enter: 선택                                              │
└─────────────────────────────────────────────────────────────────────┘
```

**구현**:
```python
from rich.table import Table
from rich.panel import Panel

def show_model_selection(console, config):
    console.clear()

    # 현재 모델 표시
    current_model = config.get_current_model()
    console.print(f"현재 모델: [bold]{current_model}[/bold]\n")

    # 모델 테이블
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("#", style="cyan", width=3)
    table.add_column("모델 ID", style="green")
    table.add_column("컨텍스트", justify="right")
    table.add_column("속도", justify="center")
    table.add_column("엔드포인트")

    models = config.get_all_models()
    for idx, model in enumerate(models, 1):
        marker = "→" if model.id == current_model else " "
        speed_indicator = "●" * model.speed_level + "○" * (4 - model.speed_level)

        table.add_row(
            f"{marker}{idx}",
            model.id,
            model.context_window,
            speed_indicator,
            model.endpoint_name
        )

    console.print(table)
    console.print()

    # 팁 패널
    tip_text = """💡 팁
- 빠른 응답이 필요하면: gpt-3.5-turbo
- 긴 문서 분석이 필요하면: claude-3-opus
- 코드 생성에는: gpt-4-turbo 추천"""

    console.print(Panel(tip_text, border_style="yellow"))

    # 사용자 선택
    choice = IntPrompt.ask("선택", choices=[str(i) for i in range(1, len(models) + 1)])

    return models[choice - 1]
```

#### 3.4 설정 메뉴 (/settings)

```
┌─────────────────────────────────────────────────────────────────────┐
│ open-CLI v1.0.0 | 설정                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                         설정 메뉴                              │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │                                                                │ │
│  │  1. 엔드포인트 관리                                            │ │
│  │     • 사내 모델 서버 추가/삭제                                 │ │
│  │     • 연결 상태 확인                                           │ │
│  │                                                                │ │
│  │  2. 기본 모델 설정                                             │ │
│  │     현재: gpt-4-turbo                                          │ │
│  │                                                                │ │
│  │  3. 권한 설정                                                  │ │
│  │     • 파일 쓰기: 확인 필요 ✓                                   │ │
│  │     • 쉘 명령: 경고 + 확인 ✓                                   │ │
│  │                                                                │ │
│  │  4. 테마 설정                                                  │ │
│  │     현재: default                                              │ │
│  │                                                                │ │
│  │  5. 고급 설정                                                  │ │
│  │     • 스트리밍 응답: 활성화 ✓                                  │ │
│  │     • 자동 저장: 활성화 ✓                                      │ │
│  │     • 디버그 모드: 비활성화                                    │ │
│  │                                                                │ │
│  │  0. 뒤로 가기                                                  │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  선택 [0-5]: _                                                       │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ ESC: 취소                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.5 엔드포인트 추가 화면

```
┌─────────────────────────────────────────────────────────────────────┐
│ open-CLI v1.0.0 | 엔드포인트 추가                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  새 엔드포인트를 추가합니다.                                         │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 1단계: 기본 정보                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  별칭 (선택):                                                        │
│  > Production Server_                                                │
│                                                                       │
│  엔드포인트 URL:                                                     │
│  > http://company.com/v1_                                            │
│                                                                       │
│  API Key (선택, Enter로 건너뛰기):                                   │
│  > sk-xxxxxxxxxxxxxxxxxxxxxxxxxx_                                    │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 2단계: 연결 테스트                                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [테스트 중] http://company.com/v1에 연결 중...                      │
│  ●●●●●●●●●●●●●●●●●●●●○○○○○○○○○○ 75%                              │
│                                                                       │
│  ✓ 연결 성공! (응답 시간: 123ms)                                     │
│  ✓ 사용 가능한 모델 발견: 3개                                        │
│                                                                       │
│  ┌──────────────────────────────────────────────────┐               │
│  │ 발견된 모델:                                      │               │
│  │  • gpt-4-turbo (128K context)                    │               │
│  │  • gpt-3.5-turbo (16K context)                   │               │
│  │  • claude-3-opus (200K context)                  │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                       │
│  이 엔드포인트를 추가하시겠습니까? [Y/n]: _                          │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ ESC: 취소                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**구현**:
```python
from rich.progress import Progress

async def add_endpoint(console):
    console.clear()
    console.print(Panel("엔드포인트 추가", style="bold cyan"))

    # 1단계: 기본 정보 입력
    name = Prompt.ask("별칭 (선택)", default="")
    url = Prompt.ask("엔드포인트 URL")
    api_key = Prompt.ask("API Key (선택)", password=True, default="")

    # 2단계: 연결 테스트
    console.print("\n[bold]2단계: 연결 테스트[/bold]\n")

    with Progress() as progress:
        task = progress.add_task(f"[cyan]{url}에 연결 중...", total=100)

        # 연결 테스트
        success, result = await test_endpoint(url, api_key)

        progress.update(task, completed=100)

    if success:
        console.print("✓ 연결 성공!", style="success")
        console.print(f"✓ 사용 가능한 모델: {len(result)}개\n")

        # 모델 목록 표시
        model_list = "\n".join([f"  • {m['id']}" for m in result])
        console.print(Panel(f"발견된 모델:\n{model_list}", border_style="green"))

        # 확인
        if Confirm.ask("이 엔드포인트를 추가하시겠습니까?", default=True):
            save_endpoint(name, url, api_key, result)
            console.print("✓ 엔드포인트가 추가되었습니다.", style="success")
    else:
        console.print(f"[error]연결 실패: {result}[/error]")
```

#### 3.6 도구 실행 피드백

```
┌─────────────────────────────────────────────────────────────────────┐
│  > src 폴더의 모든 Python 파일을 찾아줘                              │
│                                                                       │
│  [AI] 알겠습니다. src 폴더에서 Python 파일을 검색하겠습니다.         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔧 도구 실행: find_files                                      │  │
│  │ 패턴: src/**/*.py                                             │  │
│  │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● 처리 중...                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ✓ 45개 파일 발견 (0.3초)                                            │
│                                                                       │
│  src 폴더에서 45개의 Python 파일을 찾았습니다:                       │
│                                                                       │
│  ┌──────────────────────────────────────────────────┐               │
│  │ 파일명                │ 크기      │ 최종 수정일    │               │
│  ├──────────────────────────────────────────────────┤               │
│  │ src/main.py           │ 2.3 KB    │ 2025-11-03    │               │
│  │ src/config.py         │ 1.1 KB    │ 2025-11-02    │               │
│  │ src/utils.py          │ 3.4 KB    │ 2025-11-01    │               │
│  │ ... (42개 더)                                     │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**특징**:
- 도구 실행 중 프로그레스 바 표시
- 실행 시간 측정
- 결과를 테이블로 시각화

### 4. 사용자 상호작용 플로우

#### 4.1 일반 대화 플로우

```
사용자 입력
    ↓
입력 파싱 (@경로, !명령어, /슬래시 감지)
    ↓
┌─────────────────────────────────────────┐
│ @경로 있음? → ReadFile/ReadManyFiles 실행 │
│ !명령어? → 쉘 명령 실행                    │
│ /슬래시? → 명령어 핸들러 실행              │
│ 일반 텍스트? → LLM에 전달                 │
└─────────────────────────────────────────┘
    ↓
LLM 처리
    ↓
┌─────────────────────────────────────────┐
│ Tool Call 있음?                          │
│  → 도구 실행 (권한 확인)                  │
│  → 결과를 LLM에 전달                     │
│  → LLM이 최종 응답 생성                  │
└─────────────────────────────────────────┘
    ↓
응답 렌더링 (Markdown, 코드, 테이블)
    ↓
대화 히스토리에 저장
```

#### 4.2 파일 수정 플로우 (Edit)

```
LLM이 edit_file 호출
    ↓
[1] 원본 파일 읽기
    ↓
[2] old_content 검증 (파일에 존재하는지)
    ↓
[3] 수정 적용 (old → new)
    ↓
[4] Diff 생성
    ↓
[5] 사용자에게 Diff 표시
    ↓
┌─────────────────────────────────────────┐
│ ┌──────────────────────────────────┐    │
│ │ --- src/main.py                   │    │
│ │ +++ src/main.py                   │    │
│ │ @@ -45,3 +45,4 @@                 │    │
│ │  def get_user(user_id):           │    │
│ │ -    query = f"SELECT * FROM..."  │    │  ← 빨간색
│ │ +    query = "SELECT * FROM..."   │    │  ← 초록색
│ │ +    return db.execute(query, ..) │    │  ← 초록색
│ └──────────────────────────────────┘    │
│                                          │
│ 이 변경사항을 적용하시겠습니까? [y/N]: _ │
└─────────────────────────────────────────┘
    ↓
사용자 확인 (y)
    ↓
[6] 파일 저장
    ↓
[7] 백업 생성 (~/.open-cli/backups/)
    ↓
[8] 성공 메시지
```

#### 4.3 쉘 명령 실행 플로우

```
LLM이 run_shell_command 호출
    ↓
[1] 위험한 명령어 감지
    ↓
┌──────────────────────────────────────┐
│ 감지됨?                               │
│  Yes → 경고 표시                      │
│  No → 일반 확인                       │
└──────────────────────────────────────┘
    ↓
[2] 사용자에게 명령어 표시
    ↓
┌─────────────────────────────────────────┐
│ [경고] 위험한 명령어가 감지되었습니다.   │
│                                          │
│ 실행할 명령어: rm -rf temp/              │
│                                          │
│ 정말 실행하시겠습니까? [y/N]: _          │
└─────────────────────────────────────────┘
    ↓
사용자 확인 (y)
    ↓
[3] subprocess로 명령어 실행
    ↓
[4] stdout/stderr 캡처
    ↓
[5] 실시간 출력 (스트리밍)
    ↓
┌─────────────────────────────────────────┐
│ [실행 중] rm -rf temp/                   │
│                                          │
│ Removing temp/file1.txt...               │
│ Removing temp/file2.txt...               │
│ Done.                                    │
│                                          │
│ ✓ 명령어 실행 완료 (exit code: 0)        │
└─────────────────────────────────────────┘
```

### 5. 컴포넌트 상세 설계

#### 5.1 입력 프롬프트 컴포넌트

```python
from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
from prompt_toolkit.completion import PathCompleter, WordCompleter

class openPrompt:
    """open-CLI 입력 프롬프트"""

    def __init__(self):
        # 명령어 자동완성
        slash_commands = WordCompleter([
            '/help', '/model', '/chat', '/settings', '/memory',
            '/clear', '/stats', '/about', '/exit'
        ])

        # 파일 경로 자동완성
        path_completer = PathCompleter()

        # 세션 생성
        self.session = PromptSession(
            message='> ',
            history=FileHistory('~/.open-cli/history'),
            auto_suggest=AutoSuggestFromHistory(),
            completer=slash_commands,  # 동적으로 전환
            multiline=False,
            enable_history_search=True,
        )

    def get_input(self) -> str:
        """사용자 입력 받기"""
        try:
            user_input = self.session.prompt()
            return user_input.strip()
        except KeyboardInterrupt:
            return ""
        except EOFError:
            return "/exit"

    def get_multiline_input(self) -> str:
        """멀티라인 입력 (코드 블록 등)"""
        lines = []
        console.print("[dim]멀티라인 모드 (빈 줄 두 번 입력하여 종료)[/dim]")

        while True:
            line = self.session.prompt('... ')
            if line == "" and (len(lines) == 0 or lines[-1] == ""):
                break
            lines.append(line)

        return "\n".join(lines)
```

#### 5.2 메시지 렌더러 컴포넌트

```python
from rich.console import Console
from rich.markdown import Markdown
from rich.syntax import Syntax
from rich.panel import Panel

class MessageRenderer:
    """메시지 렌더링 컴포넌트"""

    def __init__(self, console: Console):
        self.console = console

    def render_user_message(self, message: str):
        """사용자 메시지 렌더링"""
        self.console.print(f"> {message}", style="user")

    def render_ai_message(self, message: str):
        """AI 응답 렌더링 (마크다운 지원)"""
        self.console.print("[AI] ", style="ai", end="")

        # 마크다운인지 확인
        if self._is_markdown(message):
            self.console.print(Markdown(message))
        else:
            self.console.print(message)

    def render_tool_call(self, tool_name: str, args: dict):
        """도구 호출 렌더링"""
        args_str = ", ".join([f"{k}={v!r}" for k, v in args.items()])
        self.console.print(
            f"[도구 실행] {tool_name}({args_str})",
            style="tool"
        )

    def render_tool_result(self, result: dict, duration: float):
        """도구 실행 결과 렌더링"""
        if result.get("error"):
            self.console.print(
                f"[오류] {result['error']}",
                style="error"
            )
        else:
            self.console.print(
                f"✓ 완료 ({duration:.2f}초)",
                style="success"
            )

    def render_code_block(self, code: str, language: str = "python"):
        """코드 블록 렌더링"""
        syntax = Syntax(code, language, theme="monokai", line_numbers=True)
        self.console.print(syntax)

    def render_diff(self, diff: str):
        """Diff 렌더링"""
        syntax = Syntax(diff, "diff", theme="monokai", line_numbers=False)
        self.console.print(Panel(syntax, title="변경 사항", border_style="yellow"))

    def _is_markdown(self, text: str) -> bool:
        """마크다운 여부 확인"""
        md_indicators = ['#', '```', '**', '*', '-', '|']
        return any(indicator in text for indicator in md_indicators)
```

#### 5.3 스트리밍 응답 컴포넌트

```python
from rich.live import Live
from rich.text import Text

class StreamingRenderer:
    """스트리밍 응답 렌더러"""

    def __init__(self, console: Console):
        self.console = console

    def stream_response(self, stream):
        """LLM 응답 스트리밍"""
        self.console.print("[AI] ", style="ai", end="")

        text = Text()

        with Live(text, console=self.console, refresh_per_second=20) as live:
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    text.append(content)
                    live.update(text)

        self.console.print()  # 줄바꿈
```

### 6. 키보드 단축키

#### 6.1 기본 단축키

| 단축키 | 동작 | 설명 |
|--------|------|------|
| `Ctrl+D` | 종료 | 프로그램 종료 |
| `Ctrl+C` | 취소 | 현재 입력 취소 |
| `Ctrl+L` | 화면 지우기 | `/clear`와 동일 |
| `↑` | 이전 명령 | 히스토리에서 이전 명령 |
| `↓` | 다음 명령 | 히스토리에서 다음 명령 |
| `Tab` | 자동완성 | 명령어/경로 자동완성 |
| `Shift+Enter` | 멀티라인 | 여러 줄 입력 |
| `Ctrl+R` | 검색 | 히스토리 검색 |

#### 6.2 구현

```python
from prompt_toolkit.key_binding import KeyBindings

bindings = KeyBindings()

@bindings.add('c-d')
def _(event):
    """Ctrl+D: 종료"""
    event.app.exit(result="/exit")

@bindings.add('c-l')
def _(event):
    """Ctrl+L: 화면 지우기"""
    event.app.renderer.clear()
    # /clear 명령어 실행

@bindings.add('c-r')
def _(event):
    """Ctrl+R: 히스토리 검색"""
    event.app.current_buffer.start_history_search()
```

### 7. 애니메이션 및 피드백

#### 7.1 로딩 애니메이션

```python
from rich.spinner import Spinner

# 스피너 스타일들
SPINNERS = {
    "dots": "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏",
    "line": "-\\|/",
    "arrow": "←↖↑↗→↘↓↙",
    "dot_pulse": "⣾⣽⣻⢿⡿⣟⣯⣷",
}

# 사용
with console.status("[bold green]LLM 응답 생성 중...", spinner="dots") as status:
    response = await llm.generate(...)
```

#### 7.2 프로그레스 바

```python
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

with Progress(
    SpinnerColumn(),
    TextColumn("[progress.description]{task.description}"),
    BarColumn(),
    TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
) as progress:

    task = progress.add_task("[cyan]파일 처리 중...", total=len(files))

    for file in files:
        process_file(file)
        progress.update(task, advance=1)
```

#### 7.3 타이핑 효과 (선택)

```python
import time

def typewriter_effect(text: str, delay: float = 0.03):
    """타자기 효과로 텍스트 출력"""
    for char in text:
        console.print(char, end="")
        time.sleep(delay)
    console.print()

# 사용 (환영 메시지 등)
typewriter_effect("안녕하세요! open-CLI입니다.")
```

### 8. 에러 처리 및 표시

#### 8.1 에러 레벨

1. **Info**: 정보성 메시지 (파란색)
2. **Warning**: 경고 (노란색)
3. **Error**: 에러 (빨간색)
4. **Critical**: 치명적 에러 (빨간색 + 굵게)

#### 8.2 에러 표시 예시

```python
from rich.panel import Panel

def show_error(title: str, message: str, traceback: str = None):
    """에러 표시"""
    content = f"[bold]{message}[/bold]"

    if traceback:
        content += f"\n\n[dim]{traceback}[/dim]"

    console.print(Panel(
        content,
        title=f"[red]⚠ {title}[/red]",
        border_style="red",
        padding=(1, 2)
    ))

# 사용
try:
    result = read_file("nonexistent.txt")
except FileNotFoundError as e:
    show_error(
        "파일을 찾을 수 없습니다",
        f"'{e.filename}' 파일이 존재하지 않습니다.",
        traceback=str(e)
    )
```

**표시 예시**:
```
┌─ ⚠ 파일을 찾을 수 없습니다 ────────────────────┐
│                                                │
│  'nonexistent.txt' 파일이 존재하지 않습니다.   │
│                                                │
│  [Errno 2] No such file or directory:         │
│  'nonexistent.txt'                             │
│                                                │
└────────────────────────────────────────────────┘
```

### 9. 반응형 레이아웃

#### 9.1 터미널 크기 감지

```python
import shutil

def get_terminal_size():
    """터미널 크기 가져오기"""
    columns, lines = shutil.get_terminal_size()
    return columns, lines

def adjust_layout():
    """터미널 크기에 따라 레이아웃 조정"""
    width, height = get_terminal_size()

    if width < 80:
        # 좁은 화면: 테이블 축약
        return "compact"
    elif width < 120:
        # 중간 화면: 기본
        return "normal"
    else:
        # 넓은 화면: 확장
        return "wide"
```

#### 9.2 레이아웃별 조정

```python
layout_mode = adjust_layout()

if layout_mode == "compact":
    # 테이블 열 줄이기
    table.add_column("모델", width=15)
    table.add_column("상태", width=5)
elif layout_mode == "wide":
    # 모든 열 표시
    table.add_column("모델 ID", width=20)
    table.add_column("컨텍스트 윈도우", width=15)
    table.add_column("속도", width=10)
    table.add_column("엔드포인트", width=20)
    table.add_column("상태", width=10)
```

### 10. 접근성 (Accessibility)

#### 10.1 스크린 리더 지원

- 중요한 정보는 심볼과 함께 텍스트로 표시
  - `✓ 성공` (not just ✓)
  - `[오류] 실패` (not just ❌)

#### 10.2 색상 없이도 구분 가능

```python
# 좋은 예
console.print("✓ [성공] 파일이 저장되었습니다.", style="success")

# 나쁜 예 (색상에만 의존)
console.print("파일이 저장되었습니다.", style="green")
```

### 11. 성능 최적화

#### 11.1 가상 스크롤링

대화 히스토리가 길어질 경우 가상 스크롤링 사용:

```python
from collections import deque

class ConversationBuffer:
    """대화 버퍼 (최근 N개만 화면에 표시)"""

    def __init__(self, max_display=50):
        self.messages = []
        self.display_buffer = deque(maxlen=max_display)

    def add_message(self, message):
        self.messages.append(message)
        self.display_buffer.append(message)

    def render(self):
        """화면에 표시할 메시지만 렌더링"""
        for msg in self.display_buffer:
            render_message(msg)
```

#### 11.2 레이지 렌더링

긴 응답은 레이지 렌더링:

```python
def render_long_response(response: str, threshold=1000):
    """긴 응답은 페이징"""
    if len(response) < threshold:
        console.print(response)
    else:
        # 페이징
        from rich.pager import Pager
        with Pager() as pager:
            pager.print(response)
```

### 12. 디버그 모드

#### 12.1 디버그 모드 활성화

```bash
$ open-cli --debug
```

#### 12.2 디버그 정보 표시

```
┌─────────────────────────────────────────────────────────────────────┐
│ [DEBUG] Request                                                      │
│ {                                                                    │
│   "model": "gpt-4-turbo",                                            │
│   "messages": [                                                      │
│     {"role": "user", "content": "안녕?"}                             │
│   ],                                                                 │
│   "tools": [...]                                                     │
│ }                                                                    │
│                                                                      │
│ [DEBUG] Response (1.23s)                                             │
│ {                                                                    │
│   "choices": [                                                       │
│     {"message": {"content": "안녕하세요!"}}                          │
│   ]                                                                  │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 💡 핵심 기능 상세 설명

### 1. CLI 사용자 인터페이스 (터미널 UI)

#### 1.1 Main Entry Point
```
$ open

╔════════════════════════════════════════════════════════════╗
║                      open-CLI v1.0.0                        ║
║              오프라인 기업용 AI 코딩 어시스턴트              ║
╚════════════════════════════════════════════════════════════╝

🤖 현재 모델: gpt-4-turbo (http://company.com:8000/v1)
📁 작업 디렉토리: /home/user/project
🧠 컨텍스트: 8,192 / 100,000 tokens

> 입력 (도움말은 /help):
```

#### 1.2 3가지 인터페이스 모드

**Mode A: Interactive Conversation Mode** (기본)
```
> 이 함수의 성능을 개선해줄 수 있니?
@src/utils.ts 파일을 분석 중...
[█████████░] 50% 처리 중

🤖 Assistant:
이 함수를 몇 가지 방식으로 개선할 수 있습니다...

제안:
1. 캐싱 추가
2. 알고리즘 최적화
3. 병렬 처리

변경사항을 적용하시겠습니까? (y/n)
```

**Mode B: Project Context Mode**
```
> @src
현재 src 디렉토리 분석...
├── components/
│   ├── App.tsx (234 lines)
│   ├── Header.tsx (89 lines)
│   └── Footer.tsx (67 lines)
├── services/
│   └── api.ts (456 lines)
└── utils/
    └── helpers.ts (123 lines)

프로젝트 구조 요약:
- React 컴포넌트 기반 아키텍처
- REST API 통합
- 유틸리티 함수 분리

이 프로젝트에 대해 무엇을 도와드릴까요?
```

**Mode C: Command-Driven Mode**
```
> /model
[현재 모델 목록]
✓ gpt-4-turbo (활성)
  엔드포인트: http://company.com:8000/v1
  상태: ✅ 건강함

○ qwen-14b
  엔드포인트: http://company.com:8001/v1
  상태: ✅ 건강함

○ llama-2-70b
  엔드포인트: http://company.com:8002/v1
  상태: ⚠️ 응답 느림 (평균 2.5s)

# 모델 선택: (1-3)
```

#### 1.3 UI 컴포넌트 구조 (Ink/React)

```typescript
// src/ui/components/ChatInterface.tsx
<Box flexDirection="column" width={100} height={30}>
  {/* 헤더 */}
  <Header
    model={currentModel}
    contextSize={contextSize}
    isOffline={true}
  />

  {/* 메시지 히스토리 */}
  <MessageHistory
    messages={messages}
    isLoading={isProcessing}
  />

  {/* 입력 영역 */}
  <InputBox
    onSubmit={handleUserInput}
    placeholder="입력 또는 /help"
    suggestions={getContextualSuggestions()}
  />

  {/* 상태 바 */}
  <StatusBar
    tokens={currentTokens}
    maxTokens={maxTokens}
    mode={currentMode}
  />
</Box>

// src/ui/components/ModelSelector.tsx
<Box flexDirection="column">
  <Text>사용 가능한 모델:</Text>
  {models.map((model, idx) => (
    <Box key={idx} marginY={1}>
      <Text color={selected === idx ? "cyan" : "white"}>
        {selected === idx ? "❯" : " "} {model.name}
      </Text>
      <Text dimColor fontSize="small">
        {model.endpoint} - {model.status}
      </Text>
    </Box>
  ))}
</Box>
```

---

### 2. OpenAI Compatible 모델 연결 (핵심 기능)

#### 2.1 엔드포인트 관리 구조

```json
{
  "endpoints": [
    {
      "id": "ep-001",
      "name": "Production GPT-4",
      "baseUrl": "http://company.com:8000/v1",
      "apiKey": "sk-...encrypted...",
      "models": [
        {
          "id": "gpt-4-turbo",
          "name": "GPT-4 Turbo (128k context)",
          "maxTokens": 128000,
          "costPerMToken": 0.015,
          "enabled": true,
          "lastHealthCheck": "2025-11-03T12:00:00Z",
          "healthStatus": "healthy"
        }
      ],
      "healthCheckInterval": 300000,
      "priority": 1,
      "fallbackTo": "ep-002",
      "description": "메인 프로덕션 엔드포인트",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-11-03T10:00:00Z"
    }
  ]
}
```

#### 2.2 엔드포인트 추가/삭제/수정 워크플로우

```bash
$ open /endpoint add

? 엔드포인트 이름: Production GPT-4
? 기본 URL (예: http://company.com:8000/v1): http://company.com:8000/v1
? API Key (선택사항, Enter 건너뛰기): sk-123456789

🔍 엔드포인트 검증 중...
  ✓ 연결 테스트: 성공 (응답시간: 125ms)
  ✓ 모델 목록 조회: 성공 (4개 모델 발견)

발견된 모델:
  1. gpt-4-turbo (128k context)
  2. gpt-4-32k
  3. gpt-3.5-turbo
  4. embeddings-v2

? 어떤 모델을 추가하시겠습니까? (다중 선택: 1,2,3)
> 1,2

✅ 엔드포인트 저장 성공!
  • 엔드포인트 ID: ep-prod-001
  • 저장 위치: ~/.open-cli/endpoints.json

현재 모델 설정:
  [ ] gpt-4-turbo (기본값으로 설정됨)
  [ ] gpt-4-32k
  [ ] gpt-3.5-turbo
  [ ] embeddings-v2

? gpt-4-turbo을 기본 모델로 설정하시겠습니까? (Y/n): Y
```

#### 2.3 엔드포인트 수정 워크플로우

```bash
$ open /endpoint edit ep-prod-001

현재 설정:
┌─────────────────────────────────────┐
│ 엔드포인트: Production GPT-4         │
│ URL: http://company.com:8000/v1      │
│ 상태: ✅ 건강함                       │
│ 마지막 체크: 2025-11-03 12:00:00    │
│ 활성 모델: 2개                       │
└─────────────────────────────────────┘

수정할 항목을 선택하세요:
  1. 이름 수정
  2. URL 수정
  3. API Key 수정
  4. 모델 추가/제거
  5. 우선순위 변경
  6. 삭제

선택 (1-6): 2

현재 URL: http://company.com:8000/v1
새로운 URL (Enter로 취소): http://company.com:9000/v1

🔍 새로운 엔드포인트 검증 중...
  ✓ 연결 테스트: 성공
  ✓ 모델 호환성: 일치

✅ URL 업데이트 완료
```

#### 2.4 헬스 체크 및 자동 재연결

```typescript
// src/core/endpoint-manager.ts

interface HealthCheckResult {
  endpointId: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastCheck: Date;
  availableModels: string[];
  errorMessage?: string;
}

// 주기적 헬스 체크 (5분마다)
async function performHealthCheck(endpointId: string): Promise<HealthCheckResult> {
  try {
    const endpoint = await getEndpoint(endpointId);

    // 1. 연결 테스트
    const startTime = Date.now();
    const response = await axios.get(`${endpoint.baseUrl}/models`, {
      headers: { "Authorization": `Bearer ${endpoint.apiKey}` },
      timeout: 5000
    });
    const responseTime = Date.now() - startTime;

    // 2. 응답 시간 기반 상태 결정
    let status: "healthy" | "degraded" | "unhealthy";
    if (responseTime < 500) status = "healthy";
    else if (responseTime < 2000) status = "degraded";
    else status = "unhealthy";

    // 3. 모델 가용성 확인
    const availableModels = response.data.data.map(m => m.id);

    return {
      endpointId,
      status,
      responseTime,
      lastCheck: new Date(),
      availableModels
    };
  } catch (error) {
    return {
      endpointId,
      status: "unhealthy",
      responseTime: -1,
      lastCheck: new Date(),
      availableModels: [],
      errorMessage: error.message
    };
  }
}

// 자동 재연결 로직
async function selectBestEndpoint(): Promise<string> {
  const endpoints = await getEndpoints();
  const healthChecks = await Promise.all(
    endpoints.map(ep => performHealthCheck(ep.id))
  );

  // 우선순위: 상태 > 응답시간 > 설정된 우선순위
  const sorted = healthChecks.sort((a, b) => {
    const statusPriority = { healthy: 0, degraded: 1, unhealthy: 2 };
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    return a.responseTime - b.responseTime;
  });

  return sorted[0].endpointId;
}
```

---

### 3. 로컬 문서 시스템 (오프라인 지식 베이스)

#### 3.1 문서 저장 구조

```
~/.open-cli/
├── docs/
│   ├── company-api/
│   │   ├── overview.md
│   │   ├── authentication.md
│   │   ├── endpoints.md
│   │   └── examples/
│   │       └── quick-start.md
│   ├── internal-libraries/
│   │   ├── utils/
│   │   │   └── README.md
│   │   └── components/
│   │       └── README.md
│   ├── coding-standards/
│   │   ├── typescript.md
│   │   ├── react.md
│   │   └── backend.md
│   ├── architecture/
│   │   ├── system-design.md
│   │   ├── database-schema.md
│   │   └── deployment.md
│   └── index.json
├── docs-index.db (SQLite - Full-text search index)
└── docs-cache/
    └── embeddings.db (Optional - for RAG)
```

#### 3.2 문서 인덱싱 시스템

```typescript
// src/core/document-indexer.ts

interface DocumentIndex {
  docId: string;
  title: string;
  path: string;
  content: string;
  tags: string[];
  lastIndexed: Date;
  wordCount: number;
}

// 문서 자동 색인화 (초기 실행 + 주기적 갱신)
async function indexDocuments(docsPath: string): Promise<void> {
  const docs = await recursiveReadDocs(docsPath);

  for (const doc of docs) {
    // 1. 파일 해시로 변경 감지
    const hash = getFileHash(doc.fullPath);
    if (hash === getCachedHash(doc.id)) continue;

    // 2. 전문 검색 인덱스 생성
    await db.insertDocument({
      docId: doc.id,
      title: doc.title,
      path: doc.relativePath,
      content: doc.content,
      tags: extractTags(doc.content),
      wordCount: doc.content.split(/\s+/).length
    });

    // 3. 벡터 임베딩 생성 (선택사항)
    if (enableRAG) {
      const embedding = await generateEmbedding(doc.content);
      await embeddingDb.store(doc.id, embedding);
    }
  }
}

// 문서 검색 함수
async function searchDocuments(query: string, limit: number = 5): Promise<DocumentIndex[]> {
  // Full-text search 사용
  const results = await db.query(`
    SELECT * FROM documents
    WHERE content MATCH ?
    ORDER BY rank
    LIMIT ?
  `, [query, limit]);

  return results;
}

// LLM이 사용할 문서 검색 도구
export const DocumentSearchTool = {
  name: "search_docs",
  description: "회사 문서에서 정보 검색",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "검색 쿼리"
      },
      limit: {
        type: "integer",
        default: 5,
        description: "반환할 결과 수"
      }
    }
  },
  async execute(query: string, limit?: number) {
    const results = await searchDocuments(query, limit);
    return results.map(doc => ({
      title: doc.title,
      path: doc.path,
      excerpt: doc.content.substring(0, 300) + "..."
    }));
  }
};
```

#### 3.3 문서 동기화 및 갱신

```bash
$ open /docs sync

🔍 문서 동기화 중...

새 문서 발견:
  + coding-standards/kotlin.md (2.3 KB)
  + architecture/kubernetes.md (5.1 KB)

변경된 문서:
  ~ company-api/endpoints.md (수정: 2025-11-02 14:30)
  ~ internal-libraries/utils/README.md (수정: 2025-11-01 09:15)

삭제된 문서:
  - deprecated/old-api.md
  - deprecated/legacy-auth.md

? 동기화를 진행하시겠습니까? (Y/n): Y

📊 인덱싱 진행 중:
  [████████░░] 42/50 문서 처리됨

✅ 동기화 완료!
  • 새 문서: 2개 추가
  • 변경 문서: 2개 갱신
  • 삭제 문서: 2개 제거
  • 인덱스 크기: 12.4 MB → 14.1 MB

문서 통계:
  • 총 문서: 87개
  • 전체 단어: 425,000개
  • 마지막 갱신: 2025-11-03 12:00:00
```

---

### 4. LLM Tool Calling 시스템 (LLM이 자동 사용)

#### 4.1 사용 가능한 Tools (오프라인 전용)

```typescript
// src/core/llm-tools.ts

export const LLMTools = {
  // 📁 파일 시스템 도구
  list_files: {
    name: "list_files",
    description: "디렉토리의 파일과 폴더 목록을 반환합니다",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "탐색할 디렉토리 경로" }
      }
    }
  },

  read_file: {
    name: "read_file",
    description: "파일의 내용을 읽습니다 (텍스트, 코드, PDF, 이미지)",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "파일의 전체 경로" },
        start_line: { type: "integer", description: "시작 라인 (선택사항)" },
        end_line: { type: "integer", description: "종료 라인 (선택사항)" }
      }
    }
  },

  write_file: {
    name: "write_file",
    description: "파일을 생성하거나 기존 파일을 덮어씁니다",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      }
    }
  },

  replace_in_file: {
    name: "replace_in_file",
    description: "파일의 특정 부분을 수정합니다 (diff 기반)",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string", description: "찾을 텍스트" },
        new_text: { type: "string", description: "새로운 텍스트" }
      }
    }
  },

  find_files: {
    name: "find_files",
    description: "패턴에 맞는 파일들을 찾습니다 (glob 패턴)",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "glob 패턴 (예: **/*.ts)" },
        limit: { type: "integer", default: 100 }
      }
    }
  },

  search_in_files: {
    name: "search_in_files",
    description: "여러 파일에서 텍스트를 검색합니다",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색 쿼리" },
        pattern: { type: "string", description: "파일 패턴" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // 🖥️ 시스템 명령 도구
  run_command: {
    name: "run_command",
    description: "쉘 명령을 실행합니다 (사용자 승인 필수)",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "실행할 명령어" },
        cwd: { type: "string", description: "작업 디렉토리 (선택사항)" }
      }
    },
    requiresApproval: true // 🔐 중요: 사용자 확인 필수
  },

  // 📚 문서 도구
  search_docs_agent: { // 🆕 Agent Tool (Phase 2.5)
    name: "search_docs_agent",
    description: `
      ~/.open-cli/docs 폴더에서 지능적으로 문서를 검색합니다.
      내부적으로 AI Agent를 사용하여 bash 명령어로 복잡한 검색을 수행합니다.
      폴더 구조, 파일명, 파일 내용을 기반으로 원하는 정보를 자동으로 찾습니다.
    `,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색하려는 정보 (예: 'TypeScript 코딩 표준', 'API 인증 방법')"
        }
      }
    },
    internalTools: [
      "run_bash (find, grep, cat, ls, tree)"
    ],
    maxIterations: 10
  },

  // 💾 메모리 도구
  save_memory: {
    name: "save_memory",
    description: "중요한 정보를 세션 메모리에 저장합니다",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string" }
      }
    }
  },

  load_memory: {
    name: "load_memory",
    description: "저장된 메모리에서 정보를 로드합니다",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string" }
      }
    }
  }
};
```

#### 4.2 Tool Calling 실행 흐름

```
사용자 입력
    │
    ├─ @src/utils.ts 이 파일을 최적화해주세요
    │
    ▼
LLM에 전달 (Streaming)
    │
    ├─ System Prompt:
    │  "당신은 엔터프라이즈 코딩 어시스턴트입니다.
    │   도구를 사용하여 작업을 완료하세요."
    │
    ├─ Tools 정의: [list_files, read_file, run_command, ...]
    │
    ├─ Context:
    │  - 현재 문서: company-api.md, typescript.md
    │  - 프로젝트 구조: React + Node.js
    │
    ▼
LLM 응답 (Tool Use)
    │
    ├─ Tool Call 1: read_file("src/utils.ts")
    │
    ▼
Tool 실행 (사용자 승인 체크)
    │
    ├─ read_file ✓ (자동 승인)
    ├─ run_command ⚠️ (승인 필요)
    │
    ▼
결과를 LLM에 반환
    │
    ├─ 파일 내용: [...코드...]
    │
    ▼
LLM 최종 응답
    │
    └─ "이 함수를 다음과 같이 개선할 수 있습니다..."
```

#### 4.2.1 Agent Tool 실행 흐름 (🆕 Phase 2.5)

**search_docs_agent Tool 예시**:

```
사용자 입력
    │
    ├─ "TypeScript 코딩 표준 문서를 찾아줘"
    │
    ▼
Main LLM에 전달
    │
    ├─ Tools: [read_file, write_file, search_docs_agent, ...]
    │
    ▼
Main LLM 응답 (Tool Call)
    │
    ├─ Tool Call: search_docs_agent(query="TypeScript 코딩 표준")
    │
    ▼
Agent Tool 실행 (내부 프로세스)
    │
    ├─ Sub LLM 초기화
    │   ├─ System Prompt: "당신은 문서 검색 전문가입니다..."
    │   └─ Tools: [run_bash]
    │
    ├─ Iteration 1:
    │   ├─ Sub LLM: run_bash("ls -la")
    │   └─ Result: [디렉토리 목록]
    │
    ├─ Iteration 2:
    │   ├─ Sub LLM: run_bash("find . -name '*typescript*'")
    │   └─ Result: [./coding-standards/typescript.md]
    │
    ├─ Iteration 3:
    │   ├─ Sub LLM: run_bash("cat coding-standards/typescript.md")
    │   └─ Result: [파일 내용]
    │
    ├─ Iteration 4:
    │   └─ Sub LLM: "정보 수집 완료, 요약 생성"
    │
    ▼
Agent 최종 결과 (to Main LLM)
    │
    └─ "TypeScript 코딩 표준 문서 내용:\n1. 타입 선언...\n2. 네이밍 규칙..."
    │
    ▼
Main LLM 최종 응답 (to 사용자)
    │
    └─ "TypeScript 코딩 표준 문서를 찾았습니다. 주요 내용은..."
```

**Agent Tool의 장점**:
- 🧠 **지능형 검색**: 단순 키워드가 아닌 의도 기반 검색
- 🔄 **Multi-iteration**: 여러 단계를 거쳐 복잡한 검색 수행
- 🎯 **자동 요약**: 여러 파일의 정보를 수집하여 종합
- 🔒 **보안**: 제한된 bash 명령어만 허용

#### 4.2.2 Plan-and-Execute 실행 흐름 (🆕 Phase 2.5)

**전체 플로우**:

```
사용자 요청
    │
    ├─ "TypeScript로 REST API를 만들어줘"
    │
    ▼
Phase 1: Planning (TODO List 생성)
    │
    ├─ Planning LLM 호출
    │   ├─ System Prompt: "작업 계획 전문가"
    │   └─ User Request 분석
    │
    ▼
TODO List 생성 (UI에 표시)
    │
    ├─ ☐ 1. TypeScript 프로젝트 설정 조사 (requiresDocsSearch: true)
    ├─ ☐ 2. Express.js 설치 및 설정
    ├─ ☐ 3. 기본 라우트 구조 생성
    ├─ ☐ 4. API 엔드포인트 구현
    └─ ☐ 5. 테스트 코드 작성
    │
    ▼
Phase 2: Execution (TODO 순차 실행)
    │
    ├─ TODO 1 실행:
    │   ├─ Status: in_progress (UI 업데이트: → )
    │   │
    │   ├─ Step 1: Docs Search Agent (선행)
    │   │   ├─ Sub LLM: run_bash("find . -name '*typescript*'")
    │   │   ├─ Sub LLM: run_bash("cat setup-guides/typescript.md")
    │   │   └─ Result: [문서 내용 요약]
    │   │
    │   ├─ Step 2: Main LLM ReAct
    │   │   ├─ Context: [Docs Search 결과]
    │   │   ├─ Tools: [read_file, write_file, ...]
    │   │   └─ Iteration (최대 5회)
    │   │
    │   └─ Status: completed (UI 업데이트: ✓ )
    │
    ├─ TODO 2 실행:
    │   ├─ Status: in_progress
    │   ├─ Docs Search (선행)
    │   ├─ Main LLM ReAct
    │   └─ Status: completed
    │
    ├─ TODO 3, 4, 5... (동일한 패턴)
    │
    ▼
Phase 3: Completion
    │
    ├─ All TODOs: completed ✓
    │
    ├─ Session 저장
    │   ├─ messages: [전체 대화 내역]
    │   ├─ todos: [완료된 TODO 상태]
    │   └─ metadata: [세션 정보]
    │
    └─ 최종 응답: "모든 작업이 완료되었습니다."
```

**UI 상태 변화**:

```
T=0 (Planning 완료)
┌────────────────────────────────────────┐
│ 📋 TODO List (0/5 completed)           │
├────────────────────────────────────────┤
│ ☐ 1. TypeScript 프로젝트 설정 조사     │
│ ☐ 2. Express.js 설치                   │
│ ☐ 3. 라우트 구조 생성                  │
│ ☐ 4. API 엔드포인트 구현               │
│ ☐ 5. 테스트 코드 작성                  │
└────────────────────────────────────────┘

T=30s (TODO 1 진행 중)
┌────────────────────────────────────────┐
│ 📋 TODO List (0/5 completed)           │
├────────────────────────────────────────┤
│ → 1. TypeScript 프로젝트 설정 조사     │ ← Docs Search 중
│ ☐ 2. Express.js 설치                   │
│ ☐ 3. 라우트 구조 생성                  │
│ ☐ 4. API 엔드포인트 구현               │
│ ☐ 5. 테스트 코드 작성                  │
└────────────────────────────────────────┘

T=60s (TODO 1 완료, TODO 2 시작)
┌────────────────────────────────────────┐
│ 📋 TODO List (1/5 completed)           │
├────────────────────────────────────────┤
│ ✓ 1. TypeScript 프로젝트 설정 조사     │
│ → 2. Express.js 설치 (진행 중)         │ ← LLM 실행 중
│ ☐ 3. 라우트 구조 생성                  │
│ ☐ 4. API 엔드포인트 구현               │
│ ☐ 5. 테스트 코드 작성                  │
└────────────────────────────────────────┘

T=5분 (모든 TODO 완료)
┌────────────────────────────────────────┐
│ 📋 TODO List (5/5 completed) ✅        │
├────────────────────────────────────────┤
│ ✓ 1. TypeScript 프로젝트 설정 조사     │
│ ✓ 2. Express.js 설치                   │
│ ✓ 3. 라우트 구조 생성                  │
│ ✓ 4. API 엔드포인트 구현               │
│ ✓ 5. 테스트 코드 작성                  │
└────────────────────────────────────────┘
```

**Session 복구 플로우**:

```
세션 저장
    ↓
{
  "metadata": {
    "id": "session-123",
    "name": "rest-api-project",
    "todoCount": 5,
    "completedTodoCount": 3
  },
  "messages": [...],
  "todos": [
    { "id": "todo-1", "status": "completed", "result": "..." },
    { "id": "todo-2", "status": "completed", "result": "..." },
    { "id": "todo-3", "status": "completed", "result": "..." },
    { "id": "todo-4", "status": "pending", ... },
    { "id": "todo-5", "status": "pending", ... }
  ]
}
    ↓
세션 로드 (/load rest-api-project)
    ↓
TODO 상태 복구
    ├─ TODO 1-3: ✓ completed
    └─ TODO 4-5: ☐ pending
    ↓
TODO 4부터 재개
```

**Plan-and-Execute의 장점**:
- 📋 **투명성**: 사용자가 전체 작업 계획을 미리 볼 수 있음
- 🎯 **진행 추적**: 실시간으로 어떤 작업이 진행 중인지 확인 가능
- 💾 **복구 가능성**: 세션 저장/복구로 중단된 작업 재개 가능
- 🧠 **문서 활용**: 각 TODO마다 Docs Search로 관련 정보 자동 수집
- 🔄 **반복 가능성**: 실패한 TODO를 다시 실행할 수 있음

#### 4.3 권한 관리 시스템

```bash
# 기본 모드: 민감한 작업 승인 필수
$ open

> 이 프로젝트 구조를 정리해줄래?
🤖 Assistant:
  프로젝트를 정리하기 위해 다음 명령을 실행하려고 합니다:

  rm -rf node_modules
  npm install

⚠️  명령 실행 승인이 필요합니다.
보안을 위해 다음을 확인하세요:
  • 명령어: rm -rf node_modules
  • 작업 디렉토리: /home/user/project

? 이 명령을 실행하시겠습니까? (y/n): y

---

# 고급 모드: 모든 작업 자동 승인 (신중하게 사용!)
$ open --yolo

⚠️  경고: --yolo 모드가 활성화되었습니다.
  모든 LLM 도구 호출이 자동으로 승인됩니다.
  악의적인 프롬프트에 주의하세요.

? 계속하시겠습니까? (y/n): y
```

---

### 5. 대화 관리 및 메모리 시스템

#### 5.1 세션 저장/복구

```bash
# 현재 대화 저장
> /chat save optimization-task

✅ 대화 저장 완료
  • 태그: optimization-task
  • 메시지: 12개
  • 토큰 사용: 8,234개
  • 저장 위치: ~/.open-cli/sessions/optimization-task.json

---

# 저장된 대화 목록 표시
$ open /chat list

저장된 대화 목록:
┌──────────────────────────────────────────────────────────┐
│ 태그                    시간        메시지  토큰  모델    │
├──────────────────────────────────────────────────────────┤
│ optimization-task      2시간 전    12개   8.2K  gpt-4  │
│ bug-investigation      1일 전     24개   21.5K gpt-4  │
│ api-design            3일 전     18개   14.2K gpt-4  │
│ database-schema       1주 전     31개   28.9K gpt-4  │
└──────────────────────────────────────────────────────────┘

? 복구할 대화를 선택하세요 (1-4): 1

✅ 대화 복구 완료!
  12개 메시지가 로드되었습니다.

> [여기서 계속 대화...]
```

#### 5.2 메모리 및 컨텍스트 관리

```typescript
// src/core/session-manager.ts

interface SessionMemory {
  sessionId: string;
  tags: string[];
  messages: Message[];
  memory: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    model: string;
    totalTokens: number;
    directories: string[];
    includedFiles: string[];
  };
}

// 메모리 저장
> /memory add project-root=/home/user/project
✅ 메모리 저장됨: project-root=/home/user/project

> /memory add team=backend-team
✅ 메모리 저장됨: team=backend-team

# 메모리 표시
> /memory show

저장된 메모리:
  • project-root: /home/user/project
  • team: backend-team
  • current-sprint: Sprint 47
  • focus-area: Performance optimization

---

# 메모리 새로고침 (모든 open-CLI.md 파일 재로드)
$ open /memory refresh

✅ 모든 프로젝트 컨텍스트 파일(open-CLI.md) 로드 완료
  • 발견된 파일: 5개
  • 새 메모리: 23개 항목 추가
```

#### 5.3 프로젝트 컨텍스트 파일 (open-CLI.md)

```markdown
# open-CLI.md
# 프로젝트 컨텍스트 파일 (자동으로 로드됨)

## 📋 프로젝트 정보
- **이름**: MyProject
- **타입**: React + Node.js
- **팀**: Backend Team
- **작업 중인 스프린트**: Sprint 47

## 🎯 현재 작업
- 성능 최적화
- 데이터베이스 쿼리 개선
- API 응답 시간 단축

## 🏗️ 아키텍처
- Frontend: React 18 + TypeScript
- Backend: Node.js Express
- Database: PostgreSQL
- Cache: Redis

## 📚 관련 문서
- /docs/architecture/system-design.md
- /docs/database/optimization-guide.md

## ⚠️ 주의사항
- 스테이징 DB에서만 테스트
- 프로덕션 변경은 코드 리뷰 필수
- 마이그레이션은 오프피크 시간에만 실행

## 🔑 핵심 정보
- 메인 서버: http://api.company.com
- 스테이징 서버: http://staging.company.com
- 데이터베이스: postgresql://user:pass@db-server/mydb

```

---

### 6. 고급 명령어 시스템 (/commands)

#### 6.1 빌트인 Slash 명령어

```
기본 명령어:
  /help              - 도움말 표시
  /clear             - 화면 및 스크롤백 초기화 (Ctrl+L)
  /about             - 버전 및 정보
  /privacy           - 개인정보 보호 공지

설정 관리:
  /settings          - 설정 편집기 열기 (~/.open-cli/settings.json)
  /theme             - 테마 변경 (dark/light/auto)
  /auth              - 인증 방법 변경
  /model             - 모델 선택 또는 목록 표시

파일/컨텍스트:
  /init              - open-CLI.md 파일 생성
  /directory add     - 작업 공간 디렉토리 추가
  /directory show    - 추가된 디렉토리 표시
  /docs sync         - 문서 동기화 및 인덱싱

메모리 관리:
  /memory add        - 메모리에 정보 추가
  /memory show       - 저장된 메모리 표시
  /memory refresh    - 모든 컨텍스트 파일 재로드

대화 관리:
  /chat save         - 현재 대화 저장
  /chat resume       - 저장된 대화 복구
  /chat list         - 저장된 대화 목록
  /chat delete       - 저장된 대화 삭제
  /compress          - 대화 컨텍스트 요약 및 압축

엔드포인트 관리:
  /endpoint add      - 새로운 엔드포인트 추가
  /endpoint list     - 엔드포인트 목록
  /endpoint edit     - 엔드포인트 수정
  /endpoint delete   - 엔드포인트 삭제
  /endpoint test     - 엔드포인트 연결 테스트

도구 및 정보:
  /tools             - 사용 가능한 도구 목록
  /tools desc        - 도구 상세 정보 표시
  /stats             - 세션 통계 (토큰, 지속 시간)
  /extensions        - 활성 확장 프로그램 목록

개발 모드:
  /vim               - Vim 모드 토글
  /debug             - 디버그 정보 표시
  /bug               - 버그 보고

고급:
  /restore [id]      - 파일 변경 되돌리기
  /export            - 대화 내용 내보내기 (Markdown/JSON)
  /copy              - 마지막 출력을 클립보드 복사
```

#### 6.2 커스텀 명령어 작성

```bash
# 커스텀 명령어 위치
~/.open-cli/commands/
├── my-review.json
├── code-audit.json
└── deploy-checklist.json

---

# 예: PR 코드 리뷰 명령어
$ open /review 123

명령어 정의 (~/.open-cli/commands/my-review.json):
{
  "name": "review",
  "description": "Pull Request 코드 리뷰",
  "parameters": [
    {
      "name": "pr_number",
      "type": "number",
      "description": "PR 번호"
    }
  ],
  "prompt": "GitHub PR #{pr_number} 코드를 리뷰해주세요.\n\n검토 항목:\n1. 코드 품질\n2. 성능 영향\n3. 보안 문제\n4. 테스트 커버리지\n5. 문서화\n\n상세한 피드백을 제공해주세요."
}

$ open /review 123

📋 PR #123 코드 리뷰 시작...

🔍 변경사항 분석 중...
  • 추가된 줄: 245개
  • 삭제된 줄: 89개
  • 수정된 파일: 12개

📊 리뷰 결과:

✅ 긍정:
  • 코드 스타일 일관성 유지
  • 타입 안전성 확보
  • 테스트 커버리지 95%

⚠️  주의:
  • N+1 쿼리 패턴 발견
  • 에러 처리 누락된 부분
  • 로깅 개선 필요

❌ 문제:
  • SQL Injection 위험 (서번트 쿼리 필수)
  • 권한 검증 누락

💡 제안:
  1. PreparedStatement 사용
  2. Error boundary 추가
  3. 재시도 로직 구현
```

---

### 7. @ 명령 (파일/디렉토리 포함)

```bash
# 단일 파일 포함
> @src/utils.ts 이 파일을 리팩토링해줄 수 있니?
[파일 내용 자동으로 LLM에 전달]

---

# 디렉토리 포함 (자동 재귀)
> @src 현재 디렉토리 구조를 설명해줘
[src 디렉토리 하위 모든 파일 분석]

---

# 여러 파일 포함
> @src/components @src/services 이 부분들을 통합해줄 수 있니?
[두 디렉토리 모두 LLM에 전달]

---

# 글로브 패턴
> @**/*.test.ts 모든 테스트 파일의 커버리지를 분석해줘
[모든 .test.ts 파일이 자동으로 포함됨]
```

---

### 8. 쉘 모드 (!)

```bash
# 단일 명령어 실행
$ open
> !git status
[현재 Git 상태 표시]

> !npm test
[테스트 실행]

---

# 쉘 모드 진입
$ open
> !

쉘 모드 활성화됨 (Ctrl+D로 종료)
open-shell> git status
open-shell> npm test
open-shell> ps aux
open-shell> ctrl+d
[쉘 모드 종료, 다시 LLM 모드로]
```

---

## 🛠️ 프로젝트 구조 (최종 목표)

```
open-cli/
│
├── 📄 README.md
├── 📄 CONTRIBUTING.md
├── 📄 LICENSE (Apache 2.0)
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 webpack.config.js (Bundling)
├── 📄 .eslintrc.json
├── 📄 .prettierrc
│
├── 📁 bin/
│   ├── open (Unix/Linux shell wrapper)
│   ├── open.cmd (Windows batch wrapper)
│   └── open.ps1 (Windows PowerShell wrapper)
│
├── 📁 src/
│   ├── 📁 cli/
│   │   ├── index.ts (Entry point)
│   │   ├── commander.ts (Commander.js 설정)
│   │   └── args.ts (Argument parsing)
│   │
│   ├── 📁 core/
│   │   ├── llm-client.ts (OpenAI Compatible API)
│   │   ├── llm-tools.ts (Tool definitions)
│   │   ├── tool-executor.ts (Tool execution)
│   │   ├── endpoint-manager.ts (모델 & 엔드포인트 관리)
│   │   ├── session-manager.ts (대화 저장/복구)
│   │   ├── document-indexer.ts (문서 인덱싱)
│   │   └── permission-manager.ts (권한 체크)
│   │
│   ├── 📁 ui/
│   │   ├── app.tsx (Ink 메인 컴포넌트)
│   │   ├── 📁 components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── EndpointManager.tsx
│   │   │   ├── DocumentSearch.tsx
│   │   │   ├── SettingsEditor.tsx
│   │   │   ├── MessageHistory.tsx
│   │   │   ├── InputBox.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── ProgressIndicator.tsx
│   │   └── 📁 themes/
│   │       ├── dark.ts
│   │       ├── light.ts
│   │       └── auto.ts
│   │
│   ├── 📁 commands/
│   │   ├── slash-commands.ts (모든 /cmd 처리)
│   │   ├── at-commands.ts (@파일 처리)
│   │   └── shell-commands.ts (!쉘 처리)
│   │
│   ├── 📁 storage/
│   │   ├── config-store.ts (JSON 설정 저장소)
│   │   ├── session-store.ts (SQLite 세션 저장소)
│   │   ├── document-store.ts (SQLite 문서 인덱스)
│   │   └── migrations/
│   │
│   ├── 📁 utils/
│   │   ├── validators.ts (Zod 스키마)
│   │   ├── formatters.ts (출력 포맷팅)
│   │   ├── file-operations.ts (파일 I/O)
│   │   ├── shell-executor.ts (쉘 명령)
│   │   ├── logger.ts (로깅)
│   │   └── constants.ts
│   │
│   └── 📁 types/
│       ├── models.ts (타입 정의)
│       ├── config.ts
│       └── errors.ts
│
├── 📁 dist/ (컴파일된 결과물)
│   └── cli.js
│
├── 📁 docs/
│   ├── 📁 guides/
│   │   ├── getting-started.md
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   ├── tutorial.md
│   │   └── best-practices.md
│   │
│   ├── 📁 api/
│   │   ├── llm-tools.md
│   │   ├── endpoint-api.md
│   │   ├── storage-api.md
│   │   └── plugin-api.md
│   │
│   ├── 📁 architecture/
│   │   ├── overview.md
│   │   ├── data-flow.md
│   │   ├── security.md
│   │   └── deployment.md
│   │
│   └── 📁 examples/
│       ├── basic-usage.md
│       ├── advanced-workflows.md
│       ├── custom-commands.md
│       └── plugin-development.md
│
├── 📁 tests/
│   ├── unit/
│   │   ├── core/
│   │   ├── commands/
│   │   └── utils/
│   ├── integration/
│   │   ├── endpoint-manager.test.ts
│   │   ├── llm-client.test.ts
│   │   └── tool-executor.test.ts
│   └── e2e/
│       ├── workflows.test.ts
│       └── scenarios.test.ts
│
├── 📁 scripts/
│   ├── build.js (TypeScript 컴파일)
│   ├── bundle.js (Webpack bundling)
│   ├── package.js (배포 패키징)
│   └── test.js (테스트 실행)
│
└── 📁 offline-resources/ (배포 시 포함)
    ├── docs.db (문서 인덱스)
    ├── templates/
    │   ├── endpoint-template.json
    │   ├── command-template.json
    │   └── project-template.json
    └── sample-docs/
        ├── quick-start.md
        └── faq.md
```

---

## 📝 상세 개발 Todo List (Phase 1-4)

### Phase 1: 기초 구축 (Month 1-6)

#### Month 1-2: 프로젝트 초기화 & Core 설정
- [ ] TypeScript 프로젝트 세팅 (Node v20)
- [ ] 디렉토리 구조 생성
- [ ] ESLint + Prettier 설정
- [ ] GitHub 저장소 생성 (초기 커밋)
- [ ] CI/CD 파이프라인 설정
- [ ] 기본 테스트 프레임워크 (Jest) 설정

**Deliverable**: 개발 환경 완성, 첫 번째 컴파일 성공

#### Month 2-3: CLI 기본 프레임워크
- [ ] Commander.js 통합
- [ ] 기본 /help 명령어 구현
- [ ] 설정 저장소 (config-store.ts) 구현
- [ ] ~/.open-cli 디렉토리 초기화 로직
- [ ] 기본 로깅 시스템

**Deliverable**: `open --help` 정상 작동

#### Month 3-4: OpenAI Compatible 클라이언트
- [ ] LLM 클라이언트 구현 (axios 기반)
- [ ] 기본 채팅 API 연결
- [ ] 토큰 계산 로직
- [ ] 에러 핸들링 및 재시도 로직
- [ ] 스트리밍 응답 처리

**Deliverable**: 로컬 OpenAI Compatible 엔드포인트와 정상 통신

#### Month 4-5: 엔드포인트 관리 (핵심 기능 #1)
- [ ] 엔드포인트 저장소 구현 (endpoints.json)
- [ ] `/endpoint add` 명령어
- [ ] `/endpoint list` 명령어
- [ ] 헬스 체크 로직 구현
- [ ] 모델 검증 로직
- [ ] 엔드포인트 선택 로직

**Deliverable**: 여러 엔드포인트 추가/관리 가능

#### Month 5-6: 기본 LLM 도구 시스템
- [ ] Tool 정의 시스템
- [ ] read_file 도구
- [ ] list_files 도구
- [ ] write_file 도구 (권한 체크)
- [ ] run_command 도구 (권한 체크)
- [ ] Tool 실행 엔진 (Tool use response 처리)

**Deliverable**: LLM이 자동으로 기본 도구 사용 가능

---

### Phase 2: 상호작용 고도화 (Month 6-12)

#### Month 7-8: 터미널 UI (Ink/React)
- [ ] Ink 프로젝트 설정
- [ ] 메인 ChatInterface 컴포넌트
- [ ] 메시지 히스토리 렌더링
- [ ] 입력 박스 컴포넌트
- [ ] 상태 바 컴포넌트
- [ ] 기본 인터랙션 처리

**Deliverable**: 터미널에서 기본적인 대화 가능

#### Month 8-9: 문서 인덱싱 시스템 (핵심 기능 #2)
- [ ] 문서 감지 및 읽기 로직
- [ ] SQLite FTS (Full-Text Search) 구현
- [ ] 문서 인덱싱 스크립트
- [ ] `/docs sync` 명령어
- [ ] search_docs LLM 도구
- [ ] 문서 검색 UI 컴포넌트

**Deliverable**: 로컬 문서 검색 및 LLM이 자동으로 문서 활용

#### Month 9-10: 세션 & 메모리 관리 (핵심 기능 #3)
- [ ] 세션 저장소 구현 (SQLite)
- [ ] `/chat save` 명령어
- [ ] `/chat resume` 명령어
- [ ] `/chat list` 명령어
- [ ] `/memory add/show` 명령어
- [ ] open-CLI.md 자동 감지 및 로드

**Deliverable**: 대화 저장/복구 및 프로젝트 컨텍스트 관리

#### Month 10-11: Slash 명령어 시스템
- [ ] 모든 /cmd 명령어 구현
- [ ] 커스텀 명령어 로더
- [ ] @ 명령어 처리 (@file, @directory)
- [ ] ! 쉘 명령어 처리
- [ ] 명령어 자동완성

**Deliverable**: 모든 기본 명령어 작동

#### Month 11-12: 테마 & 설정
- [ ] 테마 시스템 (dark/light/auto)
- [ ] `/settings` 편집기
- [ ] 설정 마이그레이션
- [ ] 단축키 커스터마이징
- [ ] 로깅 레벨 설정

**Deliverable**: 사용자 환경 커스터마이징 완료

---

## 📊 Feature List (최종 완성 상태)

### Core Features
- [ ] Interactive Terminal CLI (Ink/React)
- [ ] OpenAI Compatible Endpoint Management
- [ ] Multi-Model Support
- [ ] Local Document Indexing & Search (Full-Text + Semantic)
- [ ] Session Management (Save/Resume)
- [ ] Context-Aware LLM Tools
- [ ] Permission-Based Execution

### User Interface
- [ ] Real-time Chat Display
- [ ] Model Selector UI
- [ ] Endpoint Manager UI
- [ ] Settings Editor
- [ ] Progress Indicators
- [ ] Color-coded Output
- [ ] Keyboard Navigation
- [ ] Auto-complete

### Commands
- [ ] 30+ Built-in Slash Commands
- [ ] Custom Command System
- [ ] @ File Inclusion
- [ ] ! Shell Mode
- [ ] Command History

### Storage & Configuration
- [ ] JSON-based Endpoint Config
- [ ] SQLite Session Storage
- [ ] SQLite Document Index
- [ ] Team Presets
- [ ] User Profiles

### Tools & Integrations
- [ ] File System Tools (7 types)
- [ ] Shell Command Execution
- [ ] Document Search Tool
- [ ] Memory Management
- [ ] Git Integration (optional)
- [ ] Python Execution (optional)

### Enterprise Features
- [ ] Audit Logging
- [ ] Team Collaboration
- [ ] Plugin System
- [ ] Custom Tool Development
- [ ] Batch Mode (Scripting)
- [ ] Advanced RBAC

### Deployment & Distribution
- [ ] Bundled Node.js Distribution
- [ ] Standalone Binary
- [ ] Docker Container
- [ ] Zero npm Install Setup
- [ ] Cross-platform (Linux, macOS, Windows)

---

## 🔐 보안 고려사항

### API Key 관리
```typescript
// ~/.open-cli/endpoints.json의 API Key는 암호화되어야 함
{
  "apiKey": "sk-...encrypted..."  // AES-256 암호화
}

// 복호화는 런타임에만 메모리에서
const decryptedKey = decrypt(endpoint.apiKey, masterPassword);
```

### 권한 모델
```
Public Tools (자동 승인):
  - read_file, list_files, search_docs

Confirmation Required:
  - write_file, replace_in_file, run_command

Forbidden:
  - Network calls (외부 인터넷)
  - System-level operations (sudo, rm -rf /)
```

### 감사 로그
```json
{
  "timestamp": "2025-11-03T12:00:00Z",
  "action": "run_command",
  "command": "npm install",
  "user": "john.doe",
  "approved": true,
  "result": "success"
}
```

---

## 🚀 배포 & 배포판 만들기

### 1단계: 로컬 개발 환경 설정
```bash
git clone https://company.git/open-cli
cd open-cli
npm install
npm run build
npm test
```

### 2단계: Bundled Node.js 준비
```bash
# Node.js v20 다운로드 후 ./runtime에 배치
./runtime/node-v20.x-linux-x64/bin/node --version
# v20.x.x

npm run bundle:complete
```

### 3단계: 테스트 배포
```bash
# 테스트 서버에서
git clone file:///path/to/open-cli
cd open-cli
./bin/open --version
./bin/open --help
```

### 4단계: 프로덕션 배포
```bash
# 사내 Git 저장소에 푸시
git push origin main

# 또는 Docker 이미지 빌드
docker build -t company/open-cli:v1.0.0 .
docker push company-registry/open-cli:v1.0.0
```

---

## 📚 최종 문서 구조

모든 사용자는 이 문서들을 오프라인으로 접근 가능:

```
~/.open-cli/docs/
├── getting-started/
│   ├── what-is-open.md
│   ├── installation.md
│   └── first-conversation.md
├── user-guide/
│   ├── commands-reference.md
│   ├── model-selection.md
│   ├── document-management.md
│   └── settings-customization.md
├── workflows/
│   ├── code-review-workflow.md
│   ├── debugging-workflow.md
│   ├── refactoring-workflow.md
│   └── documentation-workflow.md
├── api/
│   ├── llm-tools-api.md
│   ├── custom-commands-api.md
│   ├── plugin-development.md
│   └── configuration-api.md
├── troubleshooting/
│   ├── common-issues.md
│   ├── faq.md
│   ├── error-messages.md
│   └── performance-tuning.md
└── examples/
    ├── basic-examples.md
    ├── advanced-workflows.md
    └── enterprise-setup.md
```

---

## 🎓 학습 경로 & 리소스

### 필수 기술 학습
1. **TypeScript 심화**: 고급 타입 시스템, Generic, Utility Types
2. **Node.js**: 스트림, 이벤트, 비동기 패턴
3. **React**: Hooks, Context, 상태 관리
4. **Terminal UI**: Ink, Chalk, CLI 디자인 패턴
5. **Database**: SQLite, Full-Text Search
6. **API 설계**: REST, OpenAI API 호환성

### 추천 오픈소스 프로젝트 분석
- Gemini CLI (원본 영감)
- Ink (터미널 UI 라이브러리)
- Commander.js (CLI 프레임워크)
- Obsidian (문서 관리 시스템)
- Cursor AI (IDE 통합 사례)

---

## 📈 성공 메트릭

### Development
- 코드 커버리지: 80%+
- 빌드 시간: < 30초
- 테스트 실행: < 60초

### User Experience
- 시작 시간: < 2초
- 메모리 사용: < 150MB
- 응답 시간: < 1초 (UI)

### Enterprise
- 지원하는 엔드포인트: 10+
- 동시 모델: 20+
- 저장된 세션: 1,000+
- 문서 인덱싱: 10,000+개

---

## 🎯 결론

open-CLI는 지속적인 기능 추가를 통해 **엔터프라이즈급 오프라인 AI 코딩 어시스턴트**로 성장할 것입니다. 핵심 기능을 단계적으로 구축하고, 사용자 피드백을 반영하여 지속적으로 개선하는 것이 핵심입니다.

Phase 1과 Phase 2에서 기본 CLI 프레임워크, OpenAI Compatible 연결, 인터랙티브 UI를 완성했으며, 앞으로는 사용자 요구사항에 따라 필요한 기능을 유연하게 추가해 나갈 예정입니다.

**시작: 2025년 11월**

---

**문서 버전**: 통합 1.0
**작성일**: 2025-11-03
**출처**: PROJECT_VISION.md + BLUEPRINT.md 통합
**다음 단계**: 개발 시작
