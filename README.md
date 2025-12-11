# OPEN-CLI

**🇰🇷 한국어** | [🇺🇸 English](#english-version)

---

## 🇰🇷 한국어

### 📋 프로젝트 개요

**오프라인 기업 환경을 위한 로컬 LLM CLI 플랫폼**

OPEN-CLI는 인터넷 연결이 없는 기업 환경에서 로컬 AI 모델을 활용하여 개발자를 지원하는 터미널 기반 도구입니다.

### ✨ 핵심 가치

- 🔒 **완전 오프라인 운영**: 인터넷 없이 독립적으로 작동
- 🏢 **사내 모델 통합**: 기업의 로컬 LLM 서버 직접 연결 (OpenAI Compatible)
- 🚀 **빠른 설치**: Git clone 후 npm install만으로 즉시 사용
- 🛠️ **파일 시스템 접근**: AI가 직접 파일을 읽고 쓰고 검색
- 📚 **로컬 문서 관리**: 오프라인 지식 베이스 구축

### 🎯 타겟 유저

- **오프라인 기업 개발자**: 인터넷 접근이 제한된 환경에서 일하는 개발팀
- **보안 중시 조직**: 데이터를 외부로 전송할 수 없는 금융/국방/의료 분야
- **로컬 AI 사용자**: 사내에 구축된 LLM 서버를 활용하려는 엔터프라이즈 사용자
- **CLI 선호 개발자**: 터미널에서 AI와 대화하며 코딩하고 싶은 개발자

---

## 🚀 빠른 시작

### 1. 설치

```bash
# 저장소 클론
git clone https://github.com/A2G-Dev-Space/Open-Code-CLI.git
cd Open-Code-CLI

# 의존성 설치
npm install

# 빌드
npm run build

# Agno 프레임워크 문서 다운로드 (선택사항, 로컬 문서 지식베이스용)
npx tsx scripts/download-agno-docs.ts

# 글로벌 명령어 설정 (선택사항)
npm link
```

### 2. 초기 설정

```bash
# 대화형 초기화
open config init

# 또는
node dist/cli.js config init
```

**설정 과정**:
```
🚀 OPEN-CLI 초기화

? 엔드포인트 이름: My LLM Server
? Base URL: https://your-llm-server.com/v1/
? API Key (선택사항): ********
? Model ID: gemini-2.0-flash
? Model 이름: Gemini Flash
? Max Tokens: 1048576

🔍 연결 테스트 중...
✔ 연결 성공!

✅ 초기화 완료!
```

---

## 💻 사용법

### 기본 명령어

```bash
# 대화형 모드 시작 (추천!)
open

# Verbose 로깅 활성화 (상세 에러 메시지, HTTP 요청, Tool 실행 내역)
open --verbose

# Debug 로깅 활성화 (모든 디버그 정보 표시)
open --debug

# 자동 업데이트 비활성화
open --no-update

# 도움말
open help

# 설정 확인
open config show
```

### 🐛 디버깅 & 에러 처리

OPEN-CLI는 상세한 에러 로깅 시스템을 제공합니다:

**에러 타입별 상세 메시지**:
- ✅ **네트워크 에러**: 연결 실패, 타임아웃, DNS 오류 등
- ✅ **API 에러**: 인증 실패, Rate Limit, 잘못된 엔드포인트 등
- ✅ **Context 초과**: 대화 길이 초과, 토큰 제한 등
- ✅ **Tool 실행 실패**: 파일 접근 오류, JSON 파싱 실패 등

**Verbose 모드**:
```bash
# 상세 로깅으로 실행
open --verbose

# 출력 예시:
# [2025-11-05T12:00:00.000Z] [OPEN-CLI] → HTTP REQUEST: POST https://api.example.com/v1/chat/completions
# [2025-11-05T12:00:01.000Z] [OPEN-CLI] ← HTTP RESPONSE: 200 OK
# [2025-11-05T12:00:01.500Z] [OPEN-CLI] 🔧 TOOL SUCCESS: read_file
```

**에러 메시지 예시**:
```
❌ API 키가 유효하지 않습니다. 설정을 확인해주세요.
상세: Incorrect API key provided

📋 Error Code: API_ERROR

🔍 Details:
  • apiKeyProvided: true
  • apiKeyLength: 32
  • endpoint: https://api.example.com

💡 이 오류는 복구 가능하지 않습니다.

🕐 시간: 2025-11-05 12:00:00
```

### 대화형 모드 (Interactive Mode)

```bash
$ open

╔════════════════════════════════════════════════╗
║        OPEN-CLI Interactive Mode (Ink UI)      ║
╚════════════════════════════════════════════════╝

Model: gemini-2.0-flash
Commands: /exit /clear /help | Ctrl+C to quit

🧑 You: package.json 파일을 읽어서 프로젝트 이름 알려줘

🔧 Tool: read_file(file_path="package.json")

🤖 Assistant: 프로젝트 이름은 "open-cli"입니다.

You: _
```

**주요 메타 명령어**:
- `/exit` - 종료
- `/clear` - 대화 초기화
- `/load` - 저장된 대화 불러오기 (세션은 자동 저장됨)
- `/settings` - 설정 메뉴 열기
- `/model` - LLM 모델 전환
- `/help` - 도움말

### LLM 도구 (자동 실행)

대화형 모드에서 LLM이 자동으로 사용할 수 있는 도구:

- `read_file` - 파일 읽기
- `write_file` - 파일 쓰기
- `list_files` - 디렉토리 목록
- `find_files` - 파일 검색 (glob 패턴)

**예시**:
```bash
You: src 폴더에 있는 모든 TypeScript 파일을 찾아줘

🔧 Tool: find_files(pattern="*.ts", directory_path="src")

🤖 Assistant: 다음 TypeScript 파일들을 찾았습니다:
- src/cli.ts
- src/core/llm-client.ts
- src/core/config-manager.ts
...
```

### 세션 관리 (자동 저장)

모든 대화는 자동으로 저장됩니다!

```bash
# 대화 불러오기 (Classic UI)
You: /load
? 불러올 대화 선택: auto-save-session-123 (5개 메시지, 2025-11-10)

# 대화 불러오기 (Ink UI)
You: /load
→ 1. auto-save-session-123 (5개 메시지, 2025-11-10)
   2. auto-save-session-456 (10개 메시지, 2025-11-09)

You: /load 1

# 저장된 대화 목록
You: /sessions
```

### 로컬 문서 시스템

```bash
# 문서 목록
open docs list

# 문서 추가
open docs add

# 문서 검색
open docs search "typescript"

# Interactive Mode에서
You: /docs search typescript
```

---

## ✨ 주요 기능

### ✅ 완료된 기능 (Phase 1 & 2)

- ✅ OpenAI Compatible API 연결
- ✅ 대화형 모드 (Ink UI + Classic UI)
- ✅ 파일 시스템 도구 (LLM이 자동 사용)
- ✅ 세션 저장/복구
- ✅ 멀티 엔드포인트 관리
- ✅ 로컬 문서 시스템 (마크다운 지식 베이스)
- ✅ ESM 마이그레이션
- ✅ **GitHub Release Auto-Update System**
  - 자동 버전 체크 (GitHub Releases API)
  - 원클릭 업데이트 (Git pull 또는 Tarball 다운로드)
  - 롤백 지원 (자동 백업 생성)
  - `--no-update` 플래그로 비활성화 가능
- ✅ **Model Compatibility Layer**
  - gpt-oss-120b/20b 모델 Harmony format 422 에러 해결
  - tool_calls 메시지에 자동으로 content 필드 추가
  - 모든 OpenAI 호환 모델과의 완벽한 호환성
- ✅ **Plan-and-Execute Architecture**
  - 사용자 요청을 자동으로 TODO list로 분해하고 순차 실행
  - Agent Loop with Context Gathering 및 Work Verification
  - 의존성 관리 및 실시간 진행 상황 추적
- ✅ **6가지 도구 분류 시스템** 🆕
  - LLM Simple Tools (Sub-LLM 없음)
  - LLM Agent Tools (Sub-LLM 사용)
  - System Simple/Agent Tools (자동 트리거)
  - User Commands (/슬래시 명령어)
  - MCP Tools (Model Context Protocol)
- ✅ **도구 중앙 등록 시스템** 🆕
  - 다중 카테고리 등록 지원
  - 타입 안전한 도구 관리

### 🚧 개발 중 (Phase 2)

**Core Architecture Enhancements**

- 🎨 **Enhanced UI/UX**
  - Tool 사용 내역 박스 표시
  - 하단 상태바 (컨텍스트 사용률)
  - 실시간 진행 상황 시각화

- 🔍 **Advanced Search & Context**
  - Docs Search Agent Tool (multi-iteration bash 검색) ✅
  - 스마트 컨텍스트 우선순위 지정
  - 프로젝트별 컨텍스트 자동 감지

- 🧪 **Testing & Quality**
  - 시나리오 기반 E2E 테스트
  - 성능 벤치마크 시스템

- 📦 **Integration & Deployment**
  - Docker 컨테이너 지원
  - 플러그인 시스템 (확장 가능한 도구)

---

## 📦 디렉토리 구조

```
~/.open-cli/
├── config.json                # 설정 파일
├── endpoints.json             # 엔드포인트 설정
├── docs/                      # 로컬 문서 (마크다운)
├── backups/                   # 백업
├── repo/                      # Git 기반 자동 업데이트용
└── projects/                  # 프로젝트별 데이터
    └── {sanitized_cwd}/       # 현재 작업 디렉토리
        ├── {session-id}.json     # 자동 저장된 세션
        ├── {session-id}_log.json         # JSON 스트림 로그
        └── {session-id}_error.json       # 에러 로그 (발생 시)
```

---

## 🛠️ 기술 스택

- **언어**: TypeScript (ESM)
- **런타임**: Node.js v20+
- **CLI**: Commander.js
- **UI**: Ink (React), Chalk, Inquirer
- **HTTP**: Axios

---

## 📚 문서

- [01. 개발자 종합 가이드](docs/01_DEVELOPMENT.md) - **필독!** 아키텍처, 폴더 구조, 핵심 기능, 코딩 규칙
- [02. 로깅 시스템 가이드](docs/02_LOGGING.md) - CLI 실행 모드 및 상세 로깅 사용법 (필수!)
- [03. 테스트 가이드](docs/03_TESTING.md) - 시나리오 기반 E2E 테스트 가이드 (PR 전 필수!)
- [04. 로드맵](docs/04_ROADMAP.md) - 6가지 도구 분류 아키텍처 및 개발 계획

---

## 📄 라이선스

MIT License

---

## 🤝 기여 및 문의

**GitHub**: https://github.com/A2G-Dev-Space/Open-Code-CLI
**Email**: gkstmdgk2731@naver.com

---

---

<a name="english-version"></a>

## 🇺🇸 English

### 📋 Project Overview

**Local LLM CLI Platform for Offline Enterprise Environments**

OPEN-CLI is a terminal-based tool that helps developers in offline enterprise environments by utilizing local AI models without internet connectivity.

### ✨ Key Features

- 🔒 **Fully Offline**: Works independently without internet
- 🏢 **Enterprise LLM Integration**: Direct connection to company's local LLM servers (OpenAI Compatible)
- 🚀 **Quick Setup**: Ready to use after git clone and npm install
- 🛠️ **File System Access**: AI can directly read, write, and search files
- 📚 **Local Document Management**: Build offline knowledge base

### 🎯 Target Users

- **Offline Enterprise Developers**: Development teams working in internet-restricted environments
- **Security-Focused Organizations**: Finance/Defense/Healthcare sectors that cannot send data externally
- **Local AI Users**: Enterprise users who want to utilize in-house LLM servers
- **CLI-Loving Developers**: Developers who prefer coding while chatting with AI in terminal

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone repository
git clone https://github.com/A2G-Dev-Space/Open-Code-CLI.git
cd Open-Code-CLI

# Install dependencies
npm install

# Build
npm run build

# Download Agno framework documentation (optional, for local knowledge base)
npx tsx scripts/download-agno-docs.ts

# Global command setup (optional)
npm link
```

### 2. Initial Setup

```bash
# Interactive initialization
open config init

# Or
node dist/cli.js config init
```

**Setup Process**:
```
🚀 OPEN-CLI Initialization

? Endpoint name: My LLM Server
? Base URL: https://your-llm-server.com/v1/
? API Key (optional): ********
? Model ID: gemini-2.0-flash
? Model name: Gemini Flash
? Max Tokens: 1048576

🔍 Testing connection...
✔ Connection successful!

✅ Initialization complete!
```

---

## 💻 Usage

### Basic Commands

```bash
# Start interactive mode (Recommended!)
open

# Help
open help

# View config
open config show
```

### Interactive Mode

```bash
$ open

╔════════════════════════════════════════════════╗
║        OPEN-CLI Interactive Mode (Ink UI)      ║
╚════════════════════════════════════════════════╝

Model: gemini-2.0-flash
Commands: /exit /clear /help | Ctrl+C to quit

🧑 You: Read package.json and tell me the project name

🔧 Tool: read_file(file_path="package.json")

🤖 Assistant: The project name is "open-cli".

You: _
```

**Meta Commands**:
- `/exit` - Exit
- `/clear` - Clear conversation
- `/load` - Load saved conversation
- `/settings` - Open settings menu
- `/model` - Switch LLM model
- `/help` - Help

### LLM Tools (Auto-Execution)

Tools that LLM can automatically use in interactive mode:

- `read_file` - Read file
- `write_file` - Write file
- `list_files` - List directory
- `find_files` - Find files (glob pattern)

**Example**:
```bash
You: Find all TypeScript files in src folder

🔧 Tool: find_files(pattern="*.ts", directory_path="src")

🤖 Assistant: Found the following TypeScript files:
- src/cli.ts
- src/core/llm-client.ts
- src/core/config-manager.ts
...
```

### Session Management

```bash
# Save conversation
You: /save typescript-tutorial

# Load conversation
You: /load
? Select conversation: typescript-tutorial

# List saved conversations
You: /sessions
```

### Local Document System

```bash
# List documents
open docs list

# Add document
open docs add

# Search documents
open docs search "typescript"

# In Interactive Mode
You: /docs search typescript
```

---

## ✨ Features

### ✅ Completed (Phase 1 & 2)

- ✅ OpenAI Compatible API connection
- ✅ Interactive mode (Ink UI + Classic UI)
- ✅ File system tools (Auto-used by LLM)
- ✅ Session save/restore
- ✅ Multi-endpoint management
- ✅ Local document system (Markdown knowledge base)
- ✅ ESM migration
- ✅ **GitHub Release Auto-Update System**
  - Automatic version checking (GitHub Releases API)
  - One-click updates (Git pull or Tarball download)
  - Rollback support (automatic backup creation)
  - `--no-update` flag to disable
- ✅ **Model Compatibility Layer**
  - Fixes Harmony format 422 errors for gpt-oss-120b/20b models
  - Automatically adds content field to tool_calls messages
  - Full compatibility with all OpenAI-compatible models
- ✅ **Plan-and-Execute Architecture**
  - Auto-decompose user requests into TODO lists and execute sequentially
  - Agent Loop with Context Gathering and Work Verification
  - Dependency management and real-time progress tracking
- ✅ **6-Category Tool Classification System** 🆕
  - LLM Simple Tools (No Sub-LLM)
  - LLM Agent Tools (With Sub-LLM)
  - System Simple/Agent Tools (Auto-triggered)
  - User Commands (/slash commands)
  - MCP Tools (Model Context Protocol)
- ✅ **Central Tool Registry** 🆕
  - Multi-category registration support
  - Type-safe tool management

### 🚧 In Development (Phase 2)

**Core Architecture Enhancements**

- 🎨 **Enhanced UI/UX**
  - Tool usage display box
  - Bottom status bar (context usage)
  - Real-time progress visualization

- 🔍 **Advanced Search & Context**
  - Docs Search Agent Tool (multi-iteration bash search) ✅
  - Smart context prioritization
  - Auto-detect project-specific context

- 🧪 **Testing & Quality**
  - Scenario-based E2E testing
  - Performance benchmark system

- 📦 **Integration & Deployment**
  - Docker container support
  - Plugin system (extensible tools)

---

## 📦 Directory Structure

```
~/.open-cli/
├── config.json       # Configuration file
├── sessions/         # Saved conversations
├── docs/            # Local documents (Markdown)
├── backups/         # Backups
└── logs/            # Logs
```

---

## 🛠️ Tech Stack

- **Language**: TypeScript (ESM)
- **Runtime**: Node.js v20+
- **CLI**: Commander.js
- **UI**: Ink (React), Chalk, Inquirer
- **HTTP**: Axios

---

## 📚 Documentation

- [01. Development Guide](docs/01_DEVELOPMENT.md) - **Start Here!** Architecture, folder structure, core features, coding rules.
- [02. Logging System Guide](docs/02_LOGGING.md) - CLI execution modes and detailed logging usage (Required!).
- [03. Testing Guide](docs/03_TESTING.md) - Scenario-based E2E test guide (Required before PR!).
- [04. Roadmap](docs/04_ROADMAP.md) - 6-category tool architecture and development plan.

---

## 📄 License

MIT License

---

## 🤝 Contributing & Contact

**GitHub**: https://github.com/A2G-Dev-Space/Open-Code-CLI
**Email**: gkstmdgk2731@naver.com

---

**Version**: 0.4.0
**Last Updated**: 2025-12-11
