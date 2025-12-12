# OPEN-CLI v1.3.1

[![GitHub release](https://img.shields.io/github/v/release/A2G-Dev-Space/Open-Code-CLI)](https://github.com/A2G-Dev-Space/Open-Code-CLI/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)

**AI Coding Assistant CLI for Offline Enterprise Environments**

> Local LLM CLI platform with Plan & Execute architecture, Supervised Mode, and session management.
> Works with vLLM, Ollama, LM Studio, and any OpenAI-compatible API.

**오프라인 기업 환경을 위한 로컬 LLM CLI 플랫폼**

---

## 빠른 시작

```bash
# 1. 설치
git clone https://github.com/A2G-Dev-Space/Open-Code-CLI.git
cd Open-Code-CLI
npm install && npm run build

# 2. 실행
node dist/cli.js       # 또는 npm link 후 'open' 명령어 사용
```

첫 실행 시 LLM 엔드포인트 설정 마법사가 자동 실행됩니다.

---

## 핵심 기능

### 🆕 Supervised Mode (v1.2.x)
파일 수정 도구(`create_file`, `edit_file`) 실행 전 사용자 승인을 요청합니다.

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 create_file                                              │
│  ─────────────────────────────────────────────────────────   │
│  📁 file_path: /src/utils/helper.ts                          │
│  📝 content: export function helper() { ... }                │
│  ─────────────────────────────────────────────────────────   │
│  ▸ [1] ✅ Approve                                            │
│    [2] ❌ Reject                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Tab 키** - Auto ↔ Supervised 모드 전환
- **파일 수정 도구만** 승인 필요 (read_file, list_files 등은 자동 실행)
- **Reject 시** 코멘트 입력 → AI가 피드백 반영하여 재시도

### Plan & Execute Architecture
사용자 요청을 자동으로 TODO 리스트로 분해하고 순차 실행합니다.

```
You: 프로젝트에 로깅 시스템을 추가해줘

✶ 계획 수립 중… (esc to interrupt · 5s · ↑ 1.2k tokens)

📋 3개의 작업이 생성되었습니다:
  1. logger.ts 파일 생성
  2. 기존 파일에 로거 import 추가
  3. 에러 핸들링 로거 적용
```

### Static Log UI
Claude Code 스타일의 스크롤 가능한 로그 히스토리:
- 도구별 아이콘 표시 (📖 read, 📝 create, ✏️ edit, 📂 list, 🔍 find, 💬 message)
- Diff 형식으로 파일 변경사항 표시 (파란색: 추가, 빨간색: 삭제)
- 실시간 진행 상황 표시

### LLM 도구
| 도구 | 설명 | 승인 필요 |
|------|------|----------|
| `read_file` | 파일 읽기 | ❌ |
| `create_file` | 새 파일 생성 | ✅ |
| `edit_file` | 기존 파일 수정 (줄 단위 편집) | ✅ |
| `list_files` | 디렉토리 목록 | ❌ |
| `find_files` | 파일 검색 (glob 패턴) | ❌ |
| `tell_to_user` | 사용자에게 메시지 전달 | ❌ |
| `ask_user` | 사용자에게 질문 | ❌ |

### 슬래시 명령어
| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 표시 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (Context 절약) |
| `/load` | 저장된 세션 불러오기 |
| `/model` | LLM 모델 전환 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 통계 (누적) |
| `/docs` | 문서 브라우저 (↑↓ 선택, Enter 다운로드) |
| `/docs download <source>` | 문서 다운로드 (agno, adk) |

### 키보드 단축키
- `Ctrl+C` - 종료
- `ESC` - 현재 실행 중단
- `Tab` - Auto ↔ Supervised 모드 전환
- `@` - 파일 선택 브라우저
- `/` - 명령어 자동완성

---

## 주요 특징

### Supervised Mode (v1.2.x)
- 파일 수정 전 사용자 승인 요청
- Tab 키로 Auto/Supervised 모드 전환
- Reject 시 코멘트로 피드백 전달

### 대화 히스토리 유지
- 모든 TODO task 간 대화 히스토리 자동 유지
- Tool call/response 포함한 전체 컨텍스트 보존
- `/compact` 시에만 히스토리 초기화

### Context 사용량 표시
- 상태바에 `Context (1.3K / 13%)` 형식으로 표시
- 80% 도달 시 Auto-Compact 자동 실행

### 단일 Tool 실행
- `parallel_tool_calls: false` API 파라미터로 강제
- LLM이 한 번에 하나의 도구만 호출하여 안정적 실행

### 스마트 TODO 패널
- TODO 작업 시에만 패널 표시
- 단순 응답 요청 시 자동 숨김

---

## 문서 다운로드

AI Agent 개발에 필요한 문서를 로컬에 다운로드하여 오프라인에서 참조할 수 있습니다.

```bash
# 사용 가능한 문서 확인
/docs

# Agno Framework 문서 다운로드
/docs download agno

# Google ADK 문서 다운로드
/docs download adk
```

다운로드된 문서는 `~/.open-cli/docs/` 에 저장되며, AI가 자동으로 검색하여 응답에 활용합니다.

---

## 설정

### LLM 엔드포인트 추가

```bash
# 설정 마법사 실행
open config init

# 설정 확인
open config show
```

OpenAI Compatible API를 지원하는 모든 LLM 서버와 연결 가능합니다:
- vLLM, Ollama, LM Studio
- Azure OpenAI, Google Gemini (OpenAI Compatible)
- 사내 LLM 서버

### CLI 옵션

```bash
open              # 기본 실행
open --verbose    # 상세 로깅
open --debug      # 디버그 모드
open --no-update  # 자동 업데이트 비활성화
```

---

## 디렉토리 구조

```
~/.open-cli/
├── config.json        # 설정 파일
├── endpoints.json     # 엔드포인트 설정
├── usage.json         # 사용량 통계
├── docs/              # 다운로드된 문서
│   └── agent_framework/
│       ├── agno/
│       └── adk/
└── projects/          # 프로젝트별 세션
```

---

## 요구사항

- Node.js v20+
- npm v10+
- Git (문서 다운로드용)

---

## 문서

- [개발자 가이드](docs/01_DEVELOPMENT.md)
- [로깅 시스템](docs/02_LOGGING.md)
- [테스트 가이드](docs/03_TESTING.md)
- [로드맵](docs/04_ROADMAP.md)

---

## 라이선스

MIT License

---

## Keywords

`AI coding assistant` `local LLM` `offline AI` `enterprise AI` `CLI tool` `vLLM` `Ollama` `LM Studio` `OpenAI compatible` `code generation` `developer tools` `TypeScript` `Node.js` `plan and execute` `supervised mode` `session management`

---

**GitHub**: https://github.com/A2G-Dev-Space/Open-Code-CLI
