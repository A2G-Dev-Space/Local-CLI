# OPEN-CLI v1.1.0 <!-- test change for todo-4 -->

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

### LLM 도구 (자동 실행)
- `read_file` - 파일 읽기
- `write_file` - 파일 쓰기
- `list_files` - 디렉토리 목록
- `find_files` - 파일 검색 (glob 패턴)
- `ask-to-user` - 사용자에게 질문

### 슬래시 명령어
| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 표시 |
| `/clear` | 대화 초기화 |
| `/compact` | 대화 압축 (Context 절약) |
| `/load` | 저장된 세션 불러오기 |
| `/model` | LLM 모델 전환 |
| `/settings` | 설정 메뉴 |
| `/usage` | 토큰 사용량 통계 |
| `/docs` | 문서 브라우저 (↑↓ 선택, Enter 다운로드) |
| `/docs download <source>` | 문서 다운로드 (agno, adk) |

### 키보드 단축키
- `Ctrl+C` - 종료
- `ESC` - 현재 실행 중단
- `@` - 파일 선택 브라우저
- `/` - 명령어 자동완성

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

**GitHub**: https://github.com/A2G-Dev-Space/Open-Code-CLI
