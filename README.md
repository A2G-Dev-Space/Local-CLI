# OPEN-CLI

**오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/HanSyngha/open-cli)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

---

## 📋 프로젝트 개요

OPEN-CLI는 **Gemini CLI의 개념을 기업 환경에 맞춰 완전히 재구축**한 프로젝트입니다. 인터넷 연결이 없는 회사 네트워크 환경에서 로컬 OpenAI Compatible 모델들을 활용하여 코드 작성, 분석, 문제 해결을 지원하는 **엔터프라이즈급 CLI 도구**입니다.

### 핵심 가치 제안
- ✅ **완전 오프라인 운영**: 인터넷 없이 독립적으로 작동
- ✅ **사내 모델 통합**: 기업의 로컬 LLM 서버와 직접 연결
- ✅ **제로 의존성 배포**: Git Clone만으로 설치 가능
- ✅ **침입적 LLM 도구**: 파일 시스템, 쉘 명령, 로컬 문서 접근 권한
- ✅ **엔터프라이즈 설정**: 멀티 모델 관리, 엔드포인트 검증, 팀 프리셋

---

## 🚀 빠른 시작

### 필수 요구사항
- Node.js >= 20.0.0
- npm >= 10.0.0
- OpenAI Compatible API 엔드포인트 (Gemini, LiteLLM 등)

### 1. 설치

```bash
# 저장소 클론
git clone https://github.com/HanSyngha/open-cli.git
cd open-cli

# 의존성 설치 (220개 패키지)
npm install

# TypeScript 빌드
npm run build
```

### 2. 초기 설정 (Interactive Init)

OPEN-CLI를 처음 사용하기 전에 대화형 초기화가 필요합니다:

```bash
# OPEN-CLI 초기화 (엔드포인트 설정 및 연결 확인)
node dist/cli.js config init
```

**대화형 설정 프로세스**:
```
🚀 OPEN-CLI 초기화

엔드포인트 정보를 입력해주세요:

? 엔드포인트 이름: My LLM Endpoint
? Base URL (HTTP/HTTPS): https://generativelanguage.googleapis.com/v1beta/openai/
? API Key (선택사항, Enter 키 입력 시 스킵): ********
? Model ID: gemini-2.0-flash
? Model 이름 (표시용): Gemini 2.0 Flash
? Max Tokens: 1048576

🔍 엔드포인트 연결 테스트 중...

✔ 연결 성공!

✅ 초기화 완료!

생성된 디렉토리:
  ~/.open-cli/
  ~/.open-cli/config.json
  ~/.open-cli/sessions/
  ~/.open-cli/docs/
  ~/.open-cli/backups/
  ~/.open-cli/logs/

📡 등록된 엔드포인트:
  이름: My LLM Endpoint
  URL: https://generativelanguage.googleapis.com/v1beta/openai/
  모델: Gemini 2.0 Flash (gemini-2.0-flash)
  상태: 🟢 연결 확인됨
```

**지원 엔드포인트**:
- ✅ **HTTPS**: Gemini, OpenAI, Claude 등 클라우드 API
- ✅ **HTTP**: LiteLLM, Ollama 등 로컬 서버

**API Key 없이 사용** (로컬 LLM):
```bash
# Ollama 예시 (API Key 불필요)
? Base URL: http://localhost:11434/v1/
? API Key: [Enter 키로 스킵]
```

### 3. 기본 사용법

**Global 명령어 사용** (권장):
```bash
# npm link 설정 (한 번만)
npm link

# 이제 'open' 명령어 사용 가능
open              # Interactive mode 시작
open help         # 도움말
open config show  # 설정 확인
```

**또는 직접 실행**:
```bash
node dist/cli.js              # Interactive mode 시작
node dist/cli.js help         # 도움말
node dist/cli.js config show  # 설정 확인
```

---

#### Interactive Mode (대화형 모드) - 추천!

`open` 명령어만 입력하면 대화형 모드가 시작됩니다:

```bash
$ open

╔════════════════════════════════════════════════════════════╗
║                 OPEN-CLI Interactive Mode                  ║
╚════════════════════════════════════════════════════════════╝

모델: gemini-2.0-flash
엔드포인트: https://...

명령어:
  /exit, /quit    - 종료
  /context        - 대화 히스토리 보기
  /clear          - 대화 히스토리 초기화
  /save [name]    - 현재 대화 저장
  /load           - 저장된 대화 불러오기
  /sessions       - 저장된 대화 목록 보기
  /endpoint       - 엔드포인트 보기/전환
  /help           - 도움말

? You: Hello! How are you?

🤖 Assistant: Hello! I'm doing well, thank you! How can I help you today?

? You: /save my-first-chat

✅ 대화가 저장되었습니다!
  이름: my-first-chat
  메시지: 2개

? You: /exit
👋 Goodbye!
```

---

### 4. 설정 명령어

#### 초기화 및 설정 관리
```bash
# 초기화
node dist/cli.js config init

# 설정 확인
node dist/cli.js config show

# 설정 초기화 (공장 초기화)
node dist/cli.js config reset
```

#### 엔드포인트 관리 (Phase 2 신기능!)

여러 LLM 엔드포인트를 등록하고 전환할 수 있습니다:

```bash
# 모든 엔드포인트 목록 보기
node dist/cli.js config endpoints

# 새 엔드포인트 추가 (대화형)
node dist/cli.js config endpoint add

# 엔드포인트 삭제
node dist/cli.js config endpoint remove <endpoint-id>

# 엔드포인트 전환
node dist/cli.js config endpoint switch <endpoint-id>
```

**Interactive Mode에서 엔드포인트 전환**:
```bash
$ open

? You: /endpoint

📡 등록된 엔드포인트:

● Gemini 2.0 Flash (현재)
   ID: ep-1234567890
   URL: https://generativelanguage.googleapis.com/v1beta/openai/

○ Local Ollama
   ID: ep-0987654321
   URL: http://localhost:11434/v1/

? 전환할 엔드포인트를 선택하세요: Local Ollama

✅ 엔드포인트가 변경되었습니다!
  이름: Local Ollama
  URL: http://localhost:11434/v1/

⚠️  Interactive Mode를 재시작하면 새 엔드포인트가 적용됩니다.
```

#### LLM 대화
```bash
# 기본 대화
node dist/cli.js chat "메시지"

# 스트리밍 응답
node dist/cli.js chat "메시지" -s

# 시스템 프롬프트 지정
node dist/cli.js chat "메시지" --system "시스템 프롬프트"
```

#### 도움말
```bash
# 전체 도움말
node dist/cli.js help

# 버전 확인
node dist/cli.js --version
```

#### 세션 관리 (Phase 2 신기능!)

대화를 저장하고 나중에 다시 불러올 수 있습니다:

```bash
# Interactive Mode에서
$ open

? You: TypeScript의 제네릭에 대해 설명해줘

🤖 Assistant: 제네릭은...

? You: /save typescript-generics

✅ 대화가 저장되었습니다!
  이름: typescript-generics
  메시지: 2개

# 나중에 다시 시작
$ open

? You: /load
? 불러올 대화를 선택하세요: typescript-generics (2개 메시지, 2025-11-03)

✅ 대화가 복원되었습니다!
  이름: typescript-generics
  메시지: 2개

# 계속 대화...
? You: 그럼 유틸리티 타입은?

# 저장된 모든 대화 보기
? You: /sessions

📋 저장된 대화 목록:

  1. typescript-generics
     메시지: 4개 | 모델: gemini-2.0-flash
     생성: 2025. 11. 3.
     "TypeScript의 제네릭에 대해 설명해줘"
```

**세션 파일 위치**: `~/.open-cli/sessions/`

### 5. 개발 모드

개발 중에는 TypeScript를 직접 실행할 수 있습니다:

```bash
# ts-node로 직접 실행 (빌드 불필요)
npm run dev

# 자동 빌드 (변경 감지)
npm run watch
```

### 6. 실제 사용 예시

#### 예시 1: 코드 질문
```bash
$ node dist/cli.js chat "JavaScript의 async/await는 어떻게 동작하나요?" -s

💬 OPEN-CLI Chat

모델: gemini-2.0-flash
엔드포인트: https://generativelanguage.googleapis.com/v1beta/openai/

🤖 Assistant:
async/await는 JavaScript의 비동기 프로그래밍을 더 직관적으로...
(스트리밍으로 실시간 출력)
```

#### 예시 2: 시스템 프롬프트 활용
```bash
$ node dist/cli.js chat "React hooks 설명" --system "You are an expert React developer. Explain in Korean with examples."

🤖 Assistant:
React Hooks는 함수형 컴포넌트에서 상태와 생명주기 기능을...
```

#### 예시 3: 설정 확인
```bash
$ node dist/cli.js config show

📋 OPEN-CLI 설정

현재 엔드포인트:
  ID: ep-gemini-default
  이름: Gemini 2.0 Flash (Default)
  URL: https://generativelanguage.googleapis.com/v1beta/openai/
  API Key: ******** (마스킹)
  우선순위: 1

현재 모델:
  ID: gemini-2.0-flash
  이름: Gemini 2.0 Flash
  최대 토큰: 1,048,576
  상태: ✅ 활성
  헬스: 🟢 정상
```

---

## ✨ 현재 구현된 기능 (Phase 1: 100% 완료!)

- ✅ **프로젝트 초기 설정** - TypeScript, ESLint, Prettier
- ✅ **설정 파일 시스템** - ConfigManager, ~/.open-cli/ 디렉토리
- ✅ **OpenAI Compatible API 클라이언트** - LLMClient, 스트리밍 지원
- ✅ **Interactive 설정** - 대화형 초기화, 엔드포인트 연결 테스트
- ✅ **파일 시스템 도구 (LLM Tools)** - read_file, write_file, list_files, find_files
- ✅ **대화형 모드 (Interactive Mode)** - 메시지 히스토리, 메타 명령어, Context-aware 대화
- ✅ **글로벌 명령어** - npm link로 'open' 명령어 사용 가능

---

## 📦 프로젝트 구조

```
open-cli/
├── src/                    # 소스 코드
│   ├── cli.ts             # CLI Entry Point (Commander.js)
│   ├── index.ts           # Main Export
│   ├── constants.ts       # 프로젝트 상수
│   ├── core/              # 핵심 로직
│   │   ├── config-manager.ts    # 설정 관리 (싱글톤)
│   │   └── llm-client.ts        # LLM API 클라이언트
│   ├── ui/                # 터미널 UI 컴포넌트 (예정)
│   ├── tools/             # LLM Tools (예정)
│   ├── utils/             # 유틸리티 함수
│   │   └── file-system.ts       # 파일 시스템 유틸
│   └── types/             # TypeScript 타입 정의
│       └── index.ts              # 전역 타입
├── tests/                 # 테스트 파일
├── docs/                  # 문서
├── dist/                  # 빌드 출력 (tsc)
├── ~/.open-cli/          # 사용자 설정 디렉토리
│   ├── config.json       # 설정 파일
│   ├── sessions/         # 세션 저장
│   ├── docs/             # 로컬 문서
│   ├── backups/          # 백업
│   └── logs/             # 로그
├── PROGRESS.md           # 개발 진행 상황
├── INTEGRATED_PROJECT_DOCUMENT.md  # 프로젝트 전체 문서
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🎯 개발 로드맵

### Phase 1: 기초 구축 (진행률: 100% ✅)
- [x] 프로젝트 초기 설정
- [x] 기본 CLI 프레임워크
- [x] 설정 파일 시스템
- [x] 로컬 모델 엔드포인트 연결 (OpenAI Compatible API)
- [x] 파일 시스템 도구 (LLM Tools)
- [x] 대화형 모드 (Interactive Mode)

### Phase 2: 상호작용 고도화 (진행률: 50% 🚧)
- [x] 세션 저장/로드 기능 (대화 저장 및 복원)
- [x] 멀티 엔드포인트 관리 (추가, 삭제, 전환)
- [ ] 인터랙티브 터미널 UI (Ink/React 기반)
- [ ] 로컬 문서 시스템

### Phase 3: 엔터프라이즈 기능 (12-18개월)
- [ ] 팀 협업 기능
- [ ] 감사 로그 및 보안
- [ ] 고급 RAG/검색
- [ ] 커스텀 플러그인 시스템

### Phase 4: 최적화 & 확장 (18-24개월+)
- [ ] 성능 최적화
- [ ] 마이그레이션 도구
- [ ] IDE 통합
- [ ] 커뮤니티 기여 프레임워크

---

## 🛠️ 기술 스택

- **언어**: TypeScript
- **런타임**: Node.js v20+
- **CLI 프레임워크**: Commander.js
- **HTTP 클라이언트**: Axios
- **터미널 UI**: Chalk, Ora, Inquirer
- **타입 검사**: TypeScript Strict Mode
- **린팅**: ESLint + @typescript-eslint
- **포맷팅**: Prettier

---

## 🌐 지원 모델

### 현재 테스트 완료
- ✅ **Gemini 2.0 Flash** (Google)
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/openai/`
  - Context: 1M tokens
  - 기능: 일반 응답, 스트리밍 지원

### 향후 지원 예정 (LiteLLM 기반)
- ⬜ **GLM4.5** (Zhipu AI)
- ⬜ **DeepSeek V3** (deepseek-v3-0324)
- ⬜ **GPT-OSS-120B**

모든 OpenAI Compatible API 엔드포인트와 호환됩니다.

---

## 🔧 트러블슈팅

### Q1: `config init` 후에도 설정이 없다고 나와요
```bash
# 초기화 상태 확인
ls -la ~/.open-cli/

# config.json 확인
cat ~/.open-cli/config.json

# 다시 초기화
node dist/cli.js config init
```

### Q2: API 키 에러가 발생해요
```bash
# 설정 확인
node dist/cli.js config show

# API 키 마스킹 해제하여 확인
cat ~/.open-cli/config.json | grep apiKey
```

Gemini API 키가 유효한지 확인하세요:
- 키 형식: `AIza...`
- 엔드포인트: `https://generativelanguage.googleapis.com/v1beta/openai/`

### Q3: 네트워크 에러가 발생해요
```
네트워크 에러: 엔드포인트에 연결할 수 없습니다.
```

원인:
- 인터넷 연결 확인
- 프록시 설정 확인
- 방화벽 설정 확인
- 엔드포인트 URL 확인

### Q4: TypeScript 빌드 에러
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 빌드
npm run build
```

### Q5: 스트리밍 응답이 느려요
이는 정상입니다. LLM이 텍스트를 생성하는 속도에 따라 다르며:
- Gemini 2.0 Flash: 빠른 응답 속도
- 일반 응답 (`-s` 없이): 전체 응답 후 한 번에 표시
- 스트리밍 응답 (`-s`): 실시간 생성 표시

---

## 📚 문서

자세한 문서는 다음 파일들을 참조하세요:

- [PROGRESS.md](./PROGRESS.md) - 개발 진행 상황 및 규칙
- [INTEGRATED_PROJECT_DOCUMENT.md](./INTEGRATED_PROJECT_DOCUMENT.md) - 전체 프로젝트 문서
- [docs/](./docs/) - 추가 문서 (추후 추가 예정)

---

## 🤝 기여

이 프로젝트는 현재 초기 개발 단계입니다. 기여 가이드라인은 추후 업데이트 예정입니다.

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

---

## 👥 팀 및 문의

**OPEN-CLI Team**

문의사항: gkstmdgk2731@naver.com
GitHub: https://github.com/HanSyngha/open-cli

---

**현재 버전**: 0.1.0
**마지막 업데이트**: 2025-11-03
