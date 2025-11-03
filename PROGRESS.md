# A2G-CLI 개발 진행 상황

## 📋 개발 프로세스 규칙 (RULES)

### 모든 작업은 다음 5단계를 엄격히 준수해야 합니다:

1. **계획 확인 (PLAN CHECK)**
   - PROGRESS.md에서 다음 작업 확인
   - 계획만 작성되고 진행되지 않은 내용 확인
   - 작업 우선순위 및 의존성 검토

2. **구현 (IMPLEMENTATION)**
   - 계획된 작업 또는 Feature 구현
   - 코드 작성 시 TypeScript 타입 안정성 보장
   - 모든 함수에 JSDoc 주석 작성
   - 에러 처리 및 엣지 케이스 고려

3. **테스트 (TESTING)**
   - 구현한 기능이 제대로 동작하는지 엄격히 테스트
   - 수동 테스트 수행 및 결과 기록
   - 에러 케이스 테스트
   - 통합 테스트 (다른 컴포넌트와의 상호작용)

4. **문서화 (DOCUMENTATION)**
   - PROGRESS.md에 진행한 내용 최대한 자세히 기록
   - 구현 세부사항, 기술적 결정, 이슈 및 해결 방법 명시
   - 코드 예시 및 사용법 포함

5. **다음 작업 계획 (NEXT STEPS)**
   - 다음에 진행할 작업 또는 Feature 작성
   - 우선순위 및 예상 시간 명시
   - 의존성 및 전제 조건 확인

---

## 🎯 프로젝트 개요

**프로젝트명**: A2G-CLI (AI2Go CLI)
**목표**: 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼
**시작일**: 2025년 11월 3일
**현재 Phase**: Phase 1 (기초 구축)

---

## 📅 Phase 1: 기초 구축 (3-6개월)

### 목표
- ✅ 기본 CLI 프레임워크 구축
- ✅ 설정 파일 시스템 구축
- ⬜ 로컬 모델 엔드포인트 연결 (OpenAI Compatible API 클라이언트)
- ⬜ 파일 시스템 도구
- ⬜ 기본 명령어 시스템

---

## 🚀 진행 중인 작업

현재 진행 중인 작업 없음

---

## 📊 완료된 작업

### [COMPLETED] 2025-11-03 14:15: 설정 파일 시스템 구축

**작업 내용**:
1. ConfigManager 클래스 구현
2. 파일 시스템 유틸리티 구현
3. 프로젝트 상수 정의
4. CLI config 명령어 추가 (init, show, reset)
5. Gemini 2.0 Flash 기본 엔드포인트 설정

**상태**: 완료됨 (COMPLETED) ✅

**체크리스트**:
- [x] ConfigManager 클래스 구현
- [x] ~/.a2g-cli/ 디렉토리 자동 생성
- [x] config.json 파일 읽기/쓰기
- [x] 파일 시스템 유틸리티
- [x] config CLI 명령어
- [x] Gemini 엔드포인트 설정

**구현 세부사항**:

#### 1. ConfigManager (src/core/config-manager.ts)
```typescript
export class ConfigManager {
  // 주요 메서드:
  - initialize(): 디렉토리 및 설정 파일 생성
  - getConfig(): 현재 설정 가져오기
  - getCurrentEndpoint(): 현재 엔드포인트 정보
  - getCurrentModel(): 현재 모델 정보
  - addEndpoint(): 엔드포인트 추가
  - removeEndpoint(): 엔드포인트 삭제
  - setCurrentEndpoint(): 엔드포인트 변경
  - setCurrentModel(): 모델 변경
  - updateSettings(): 설정 업데이트
  - reset(): 설정 초기화
}
```

**특징**:
- 싱글톤 패턴으로 전역 인스턴스 제공
- 자동 초기화 (디렉토리 및 파일 생성)
- JSON 기반 설정 저장
- 엔드포인트 및 모델 관리
- 타입 안정성 (TypeScript strict mode)

#### 2. 파일 시스템 유틸리티 (src/utils/file-system.ts)
```typescript
// 주요 함수:
- directoryExists(): 디렉토리 존재 확인
- fileExists(): 파일 존재 확인
- ensureDirectory(): 디렉토리 생성 (재귀적)
- readJsonFile<T>(): JSON 파일 읽기 (타입 안전)
- writeJsonFile<T>(): JSON 파일 쓰기
- readTextFile(): 텍스트 파일 읽기
- writeTextFile(): 텍스트 파일 쓰기
- getFileSize(): 파일 크기 조회
```

**특징**:
- Promise 기반 비동기 API
- 타입 제네릭 지원 (readJsonFile<T>, writeJsonFile<T>)
- 에러 처리 및 명확한 에러 메시지
- 자동 디렉토리 생성

#### 3. 프로젝트 상수 (src/constants.ts)
```typescript
// 디렉토리 경로
export const A2G_HOME_DIR = '~/.a2g-cli/'
export const CONFIG_FILE_PATH = '~/.a2g-cli/config.json'
export const SESSIONS_DIR = '~/.a2g-cli/sessions/'
export const DOCS_DIR = '~/.a2g-cli/docs/'
export const BACKUPS_DIR = '~/.a2g-cli/backups/'
export const LOGS_DIR = '~/.a2g-cli/logs/'

// 기본 설정
export const DEFAULT_ENDPOINT_ID = 'ep-gemini-default'
export const DEFAULT_MODEL_ID = 'gemini-2.0-flash'
```

#### 4. 기본 Gemini 엔드포인트 설정
```json
{
  "id": "ep-gemini-default",
  "name": "Gemini 2.0 Flash (Default)",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
  "apiKey": "AIzaSyAZWTQSWpv7SwK2WeIE28Oy3tjHDE4b5GI",
  "models": [{
    "id": "gemini-2.0-flash",
    "name": "Gemini 2.0 Flash",
    "maxTokens": 1048576,  // 1M tokens
    "enabled": true,
    "healthStatus": "healthy"
  }],
  "priority": 1,
  "description": "Google Gemini 2.0 Flash model via OpenAI-compatible API"
}
```

**특징**:
- OpenAI 호환 API 엔드포인트
- 1M 토큰 컨텍스트 윈도우
- 기본 활성화 및 정상 상태

#### 5. CLI config 명령어
**a2g config init**:
```bash
$ a2g config init
🚀 A2G-CLI 초기화 중...

✅ 초기화 완료!

생성된 디렉토리 및 파일:
  ~/.a2g-cli/
  ~/.a2g-cli/config.json
  ~/.a2g-cli/sessions/
  ~/.a2g-cli/docs/
  ~/.a2g-cli/backups/
  ~/.a2g-cli/logs/

📡 기본 엔드포인트 설정:
  이름: Gemini 2.0 Flash (Default)
  URL: https://generativelanguage.googleapis.com/v1beta/openai/
  모델: Gemini 2.0 Flash (gemini-2.0-flash)
```

**a2g config show**:
```bash
$ a2g config show
📋 A2G-CLI 설정

현재 엔드포인트:
  ID: ep-gemini-default
  이름: Gemini 2.0 Flash (Default)
  URL: https://generativelanguage.googleapis.com/v1beta/openai/
  API Key: ******** (마스킹됨)
  우선순위: 1

현재 모델:
  ID: gemini-2.0-flash
  이름: Gemini 2.0 Flash
  최대 토큰: 1,048,576
  상태: ✅ 활성
  헬스: 🟢 정상

전체 설정:
  버전: 0.1.0
  등록된 엔드포인트: 1개
  자동 승인: ❌ OFF
  디버그 모드: ❌ OFF
  스트리밍 응답: ✅ ON
  자동 저장: ✅ ON
```

**a2g config reset**:
```bash
$ a2g config reset
⚠️  경고: 모든 설정이 초기화됩니다.
세션 및 백업은 유지됩니다.

✅ 설정이 초기화되었습니다.
```

**테스트 결과**:
- ✅ config init: 디렉토리 및 파일 생성 확인
- ✅ config show: 설정 표시 및 API 키 마스킹 확인
- ✅ config reset: 설정 초기화 확인
- ✅ 이미 초기화된 경우 경고 메시지 확인
- ✅ TypeScript 빌드 성공 (tsc 에러 없음)
- ✅ ESLint 검사 통과
- ✅ Prettier 포맷팅 적용

**생성된 파일 구조**:
```
~/.a2g-cli/
├── config.json           # 설정 파일 (881 bytes)
├── sessions/             # 세션 저장 디렉토리
├── docs/                 # 로컬 문서 디렉토리
├── backups/              # 백업 디렉토리
└── logs/                 # 로그 디렉토리
```

**이슈 및 해결**:
- ⚠️ ENDPOINTS_FILE_PATH 미사용 경고
  - **해결**: import에서 제거 (추후 멀티 엔드포인트 관리 시 사용 예정)
- ✅ API 키 노출 방지 (config show에서 마스킹 처리)

**Git Commit**:
- Commit Hash: `a1df98e`
- Commit Message: "feat: 설정 파일 시스템 구축 및 config 명령어 구현"

**완료 시간**: 2025-11-03 14:15

**소요 시간**: 약 1.5시간

---

### [COMPLETED] 2025-11-03: 프로젝트 초기 설정 및 기본 CLI 프레임워크

**작업 내용**:
1. Node.js/TypeScript 프로젝트 초기화
2. 기본 디렉토리 구조 생성 (src/, tests/, docs/)
3. 필수 의존성 설치 (220개 패키지)
4. 개발 환경 설정 (ESLint, Prettier, tsconfig)
5. CLI Entry Point 구현 (src/cli.ts)
6. TypeScript 타입 정의 추가
7. README.md 문서 작성

**상태**: 완료됨 (COMPLETED) ✅

**체크리스트**:
- [x] package.json 생성
- [x] TypeScript 설정 (strict mode)
- [x] 프로젝트 디렉토리 구조 생성
- [x] 기본 의존성 설치
- [x] ESLint/Prettier 설정
- [x] Git 초기화 및 .gitignore 설정

**구현 세부사항**:

#### 1. 프로젝트 구조
```
a2g-cli/
├── src/
│   ├── cli.ts              # CLI Entry Point (Commander.js 기반)
│   ├── index.ts            # Main Export
│   ├── types/
│   │   └── index.ts        # TypeScript 타입 정의
│   ├── core/               # 핵심 로직 (추후 구현)
│   ├── ui/                 # 터미널 UI (추후 구현)
│   ├── tools/              # LLM Tools (추후 구현)
│   └── utils/              # 유틸리티 (추후 구현)
├── tests/                  # 테스트 파일
├── docs/                   # 문서
├── dist/                   # 빌드 출력
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc.json
├── .gitignore
├── README.md
└── PROGRESS.md
```

#### 2. 의존성 설치
**프로덕션 의존성**:
- `commander@^11.1.0` - CLI 프레임워크
- `axios@^1.6.2` - HTTP 클라이언트
- `chalk@^4.1.2` - 터미널 색상 출력
- `ora@^5.4.1` - 스피너 애니메이션
- `inquirer@^8.2.6` - 인터랙티브 프롬프트

**개발 의존성**:
- `typescript@^5.3.3` - TypeScript 컴파일러
- `ts-node@^10.9.2` - TypeScript 직접 실행
- `eslint@^8.56.0` - 린팅
- `prettier@^3.1.1` - 코드 포맷팅

#### 3. TypeScript 설정
- **Strict Mode 활성화**: 모든 strict 옵션 활성화
- **Target**: ES2022
- **Module**: CommonJS (Node.js 호환)
- **Source Map**: 디버깅을 위한 소스맵 생성
- **Type Checking**: 엄격한 타입 체크 (noImplicitAny, strictNullChecks 등)

#### 4. CLI 기본 명령어
- `a2g` - 기본 실행 (정보 표시 + help)
- `a2g help` - 도움말 표시
- `a2g --version` - 버전 정보 표시

#### 5. TypeScript 타입 정의
다음 핵심 타입 정의 완료:
- `EndpointConfig` - 엔드포인트 설정
- `ModelInfo` - 모델 정보
- `Message` - LLM 메시지
- `ToolCall` - Tool Call 구조
- `LLMRequestOptions` - LLM 요청 옵션
- `ToolDefinition` - Tool 정의
- `SessionMemory` - 세션 메모리
- `A2GConfig` - 전역 설정

**테스트 결과**:
- ✅ TypeScript 빌드 성공 (tsc 컴파일 에러 없음)
- ✅ CLI 실행 확인 (`node dist/cli.js`)
- ✅ 기본 명령어 동작 확인 (help, version)
- ✅ ESLint 검사 통과 (no warnings, no errors)
- ✅ Prettier 포맷팅 적용
- ✅ Git 커밋 생성 (b0e6825)

**실행 결과**:
```bash
$ node dist/cli.js
╔════════════════════════════════════════════════════════════╗
║                      A2G-CLI v0.1.0                        ║
║              오프라인 기업용 AI 코딩 어시스턴트              ║
╚════════════════════════════════════════════════════════════╝

⚠️  A2G-CLI가 아직 초기 설정 단계입니다.
Phase 1 기능이 현재 개발 중입니다.

✅ 완료된 작업:
  • 프로젝트 초기 설정
  • TypeScript 및 빌드 환경 구성
  • 기본 CLI 프레임워크 구축
```

**이슈 및 해결**:
- ⚠️ 일부 의존성에서 deprecated 경고 발생 (eslint@8, glob@7 등)
  - **해결**: 현재 기능에 영향 없음, Phase 2에서 업데이트 예정
- ✅ Node.js v25.0.0 호환성 확인 완료

**Git Commit**:
- Commit Hash: `b0e6825`
- Commit Message: "feat: 프로젝트 초기 설정 및 기본 CLI 프레임워크 구축"

**완료 시간**: 2025-11-03 13:46

**소요 시간**: 약 40분

---

### [COMPLETED] 2025-11-03: PROGRESS.md 생성

**작업 내용**:
- 개발 프로세스 규칙 정의 (5단계 프로세스)
- 프로젝트 진행 상황 추적 문서 생성
- Phase 1-2 작업 계획 수립

**구현 세부사항**:
- 모든 작업이 계획 → 구현 → 테스트 → 문서화 → 다음 계획의 5단계를 거치도록 규칙 정의
- 각 작업별 상태 추적: PLANNED, IN_PROGRESS, TESTING, COMPLETED
- 체크리스트를 통한 세부 작업 관리

**테스트 결과**:
- ✅ PROGRESS.md 파일 생성 완료
- ✅ 규칙이 명확히 문서화됨

**이슈 및 해결**:
- 없음

**완료 시간**: 2025-11-03

---

## 📋 다음 작업 목록 (우선순위 순)

### 1. [NEXT] 설정 파일 시스템 구축
**우선순위**: 🔴 높음
**예상 시간**: 1.5시간
**의존성**: CLI 기본 프레임워크 완료

**작업 내용**:
- ~/.a2g-cli/ 디렉토리 생성 및 관리
- 설정 파일 읽기/쓰기 (JSON 형식)
- 엔드포인트 설정 저장소 구현
- 기본 설정값 정의

---

### 4. [PLANNED] OpenAI Compatible API 클라이언트 구현
**우선순위**: 🔴 높음
**예상 시간**: 2시간
**의존성**: 설정 파일 시스템 완료

**작업 내용**:
- Axios 기반 HTTP 클라이언트 구현
- OpenAI API 호환 요청/응답 처리
- 스트리밍 응답 지원
- 에러 처리 및 재시도 로직

- 사용가능한 model과 key, endpoint
- model: gemini-2.0-flash
- key: AIzaSyAZWTQSWpv7SwK2WeIE28Oy3tjHDE4b5GI
- endpoint: https://generativelanguage.googleapis.com/v1beta/openai/
- 차후엔 http 기반 endpoint로도 동작해야됨
---

### 5. [PLANNED] 기본 파일 시스템 도구 구현
**우선순위**: 🟡 중간
**예상 시간**: 3시간
**의존성**: CLI 기본 프레임워크 완료

**작업 내용**:
- list_files: 디렉토리 목록 조회
- read_file: 파일 읽기
- write_file: 파일 쓰기
- find_files: Glob 패턴 파일 검색
- 권한 확인 및 에러 처리

---

## 📈 진행률

### Phase 1 진행률: 25%
```
[█████░░░░░░░░░░░░░░░] 25%
```

**완료**: 3 / 12 작업
**진행 중**: 0
**계획됨**: 3

### 작업 완료 이력
- ✅ PROGRESS.md 생성 (5%)
- ✅ 프로젝트 초기 설정 및 기본 CLI 프레임워크 (15%)
- ✅ 설정 파일 시스템 구축 (25%)

---

## 🐛 이슈 및 버그

현재 이슈 없음

---

## 💡 기술적 결정 로그

### 2025-11-03: 싱글톤 패턴으로 ConfigManager 구현
**결정**: ConfigManager를 싱글톤 패턴으로 구현
**이유**:
- 전역적으로 하나의 설정 인스턴스만 유지
- 메모리 효율성
- 일관된 설정 상태 보장
**영향**:
- `export const configManager = new ConfigManager()` 형태로 export
- 모든 모듈에서 동일한 인스턴스 공유

### 2025-11-03: Promise 기반 비동기 파일 시스템 API
**결정**: fs.promises 대신 promisify 사용
**이유**:
- Node.js 10+ 호환성
- 명시적인 에러 처리
- 커스텀 에러 메시지 추가 가능
**영향**:
- 모든 파일 시스템 작업이 async/await 패턴
- try-catch로 명확한 에러 처리

### 2025-11-03: JSON 기반 설정 저장
**결정**: SQLite 대신 JSON 파일로 설정 저장
**이유**:
- 간단한 설정 구조
- 사람이 읽고 수정 가능
- 의존성 최소화 (SQLite 패키지 불필요)
- 백업 및 공유 용이
**대안 검토**:
- SQLite: 복잡한 쿼리 불필요, 오버스펙
- YAML: JSON이 JavaScript 네이티브, 파싱 빠름
**영향**:
- config.json 파일 하나로 모든 설정 관리
- 향후 세션/히스토리는 SQLite 사용 검토

### 2025-11-03: TypeScript Strict Mode 사용
**결정**: TypeScript Strict Mode 전체 활성화
**이유**:
- 타입 안정성 최대화
- 런타임 에러 사전 방지
- 코드 품질 향상
**영향**:
- 모든 코드에서 명시적 타입 선언 필수
- null/undefined 체크 강제
- 개발 초기 단계부터 높은 코드 품질 유지

### 2025-11-03: Commander.js 선택
**결정**: CLI 프레임워크로 Commander.js 사용
**이유**:
- Node.js CLI 표준 라이브러리
- 간단한 API와 강력한 기능
- TypeScript 타입 지원
- 활발한 커뮤니티 및 유지보수
**대안 검토**:
- yargs: 더 복잡한 API
- oclif: 과도하게 무거움
**영향**: 빠른 CLI 명령어 구축 가능

### 2025-11-03: CommonJS 모듈 시스템 사용
**결정**: ES Modules 대신 CommonJS 사용
**이유**:
- Node.js 환경에서의 호환성
- 대부분의 npm 패키지가 CommonJS 지원
- Bundling 시 안정성
**영향**: require/module.exports 사용

### 2025-11-03: 개발 프로세스 규칙 정의
**결정**: 5단계 엄격 프로세스 도입 (계획 → 구현 → 테스트 → 문서화 → 다음 계획)
**이유**: 체계적인 개발 진행 및 품질 보장
**영향**: 모든 작업이 문서화되고 추적 가능

---

## 📚 참고 자료

- [INTEGRATED_PROJECT_DOCUMENT.md](./INTEGRATED_PROJECT_DOCUMENT.md) - 전체 프로젝트 문서
- Phase 1 목표: 기본 CLI 프레임워크, 로컬 모델 연결, 파일 시스템 도구, 기본 명령어 시스템
- Phase 2 목표: 인터랙티브 터미널 UI, 고급 설정 관리, 로컬 문서 시스템, 세션 관리

---

**마지막 업데이트**: 2025-11-03 14:15
**다음 업데이트 예정**: OpenAI Compatible API 클라이언트 구현 완료 후
