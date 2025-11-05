# TEST_SCENARIO.md

**OPEN-CLI 실사용 테스트 시나리오**

작성일: 2025-11-05
버전: 3.0.0

---

## 📋 목차

1. [환경 설정](#환경-설정)
2. [기본 사용 시나리오](#기본-사용-시나리오)
3. [파일 작업 시나리오](#파일-작업-시나리오)
4. [Plan-Execute 모드 시나리오](#plan-execute-모드-시나리오)
5. [세션 관리 시나리오](#세션-관리-시나리오)
6. [고급 사용 시나리오](#고급-사용-시나리오)
7. [문제 해결](#문제-해결)

---

## 환경 설정

### 사전 요구사항

```bash
# Node.js 버전 확인 (v20 이상 필요)
node --version

# OPEN-CLI 설치 확인
open --version
```

**처음 사용하는 경우:**

```bash
# 1. 초기 설정 (대화형)
open config init

# 프롬프트 예시:
? 엔드포인트 이름: My LLM Server
? Base URL: https://your-llm-server.com/v1/
? API Key (선택사항): [Enter your API key or press Enter to skip]
? Model ID: gemini-2.0-flash
? Model 이름: Gemini Flash
? Max Tokens: 1048576

# 연결 테스트 성공 메시지 확인
✅ 초기화 완료!
```

---

## 기본 사용 시나리오

### 시나리오 1: 첫 대화 시작하기

**목적**: OPEN-CLI를 처음 실행하고 간단한 대화를 나누기

```bash
# Interactive 모드 시작
$ open

# 예상 화면:
╔════════════════════════════════════════════════╗
║        OPEN-CLI Interactive Mode (Ink UI)      ║
╚════════════════════════════════════════════════╝

Model: gemini-2.0-flash
Endpoint: My LLM Server
Commands: /exit /clear /help | Ctrl+C to quit

🧑 You: _
```

**테스트 대화:**

```
🧑 You: 안녕하세요! OPEN-CLI가 무엇인가요?

[LLM 응답 스트리밍 중...]

🤖 Assistant: 안녕하세요! OPEN-CLI는 오프라인 환경에서 사용할 수
있는 로컬 LLM CLI 도구입니다. 인터넷 없이 기업 내부의 LLM 서버와
연결하여 AI 기능을 활용할 수 있습니다.

주요 기능:
- 파일 읽기/쓰기
- 코드 생성 및 수정
- 프로젝트 분석
- TODO 리스트 관리

무엇을 도와드릴까요?

🧑 You: _
```

**성공 조건:**
- ✅ UI가 정상적으로 표시됨
- ✅ 사용자 입력이 가능함
- ✅ LLM 응답이 스트리밍으로 표시됨
- ✅ 대화가 자연스럽게 이어짐

---

### 시나리오 2: 메타 명령어 사용하기

**목적**: /help, /clear, /exit 등 메타 명령어 테스트

```
🧑 You: /help

🤖 System:
사용 가능한 메타 명령어:
  /exit             - 종료
  /clear            - 대화 초기화
  /save [name]      - 현재 세션 저장
  /load             - 저장된 세션 불러오기
  /sessions         - 세션 목록 보기
  /endpoint         - 엔드포인트 전환
  /docs [keyword]   - 로컬 문서 검색
  /help             - 도움말 표시

🧑 You: /clear

🤖 System: 대화가 초기화되었습니다.

🧑 You: /exit

# 프로그램 종료
```

**성공 조건:**
- ✅ 모든 메타 명령어가 정상 작동
- ✅ /clear 후 대화 히스토리가 초기화됨
- ✅ /exit로 정상 종료

---

## 파일 작업 시나리오

### 시나리오 3: 파일 읽기

**목적**: LLM이 파일을 자동으로 읽는지 테스트

**준비:**
```bash
# 테스트 파일 생성
echo "Hello, OPEN-CLI!" > test.txt
```

**테스트:**
```bash
$ open

🧑 You: test.txt 파일의 내용을 알려주세요

[LLM이 자동으로 read_file 도구 사용]

🔧 Tool Call: read_file
📁 file_path: test.txt

🤖 Assistant: test.txt 파일의 내용은 "Hello, OPEN-CLI!" 입니다.

🧑 You: _
```

**성공 조건:**
- ✅ LLM이 자동으로 read_file 도구를 호출
- ✅ 파일 내용이 정확하게 읽힘
- ✅ 도구 사용이 UI에 표시됨

---

### 시나리오 4: 파일 생성 및 수정

**목적**: LLM이 파일을 생성하고 수정할 수 있는지 테스트

```
🧑 You: hello.py 파일을 만들어주세요. 내용은 "print('Hello, World!')" 로 해주세요.

🔧 Tool Call: write_file
📁 file_path: hello.py
📝 content: print('Hello, World!')

🤖 Assistant: hello.py 파일을 생성했습니다.
파이썬을 실행하면 "Hello, World!"가 출력됩니다.

🧑 You: 이제 "Hello, OPEN-CLI!"로 바꿔주세요

🔧 Tool Call: write_file
📁 file_path: hello.py
📝 content: print('Hello, OPEN-CLI!')

🤖 Assistant: hello.py 파일의 내용을 업데이트했습니다.

🧑 You: _
```

**검증:**
```bash
# 별도 터미널에서 확인
$ cat hello.py
print('Hello, OPEN-CLI!')

$ python hello.py
Hello, OPEN-CLI!
```

**성공 조건:**
- ✅ 파일이 정확하게 생성됨
- ✅ 파일 수정이 제대로 반영됨
- ✅ 생성된 코드가 실행 가능함

---

### 시나리오 5: 파일 검색

**목적**: 프로젝트 내 파일을 검색하는 시나리오

```
🧑 You: 현재 디렉토리에서 .js 파일을 모두 찾아주세요

🔧 Tool Call: find_files
📁 pattern: *.js
📂 directory_path: .

🤖 Assistant: 다음 JavaScript 파일들을 찾았습니다:
- src/cli.js
- src/core/llm-client.js
- src/core/config-manager.js
... (총 32개 파일)

🧑 You: src 폴더에서만 찾아주세요

🔧 Tool Call: find_files
📁 pattern: *.js
📂 directory_path: src

🤖 Assistant: src 폴더에서 다음 파일들을 찾았습니다:
- src/cli.js
- src/core/llm-client.js
... (총 28개 파일)

🧑 You: _
```

**성공 조건:**
- ✅ 패턴 매칭이 정확함
- ✅ 디렉토리 범위 지정이 작동함
- ✅ 검색 결과가 정확함

---

## Plan-Execute 모드 시나리오

### 시나리오 6: 복잡한 작업 자동 분해

**목적**: 복잡한 요청을 자동으로 TODO 리스트로 분해하고 실행

```bash
$ open

🧑 You: TypeScript로 간단한 TODO CLI 앱을 만들어주세요.
파일 저장/불러오기 기능도 포함해서요.

[Plan-Execute 모드 자동 활성화]

╔════════════════════════════════════════╗
║   OPEN-CLI Plan-and-Execute Mode      ║
╚════════════════════════════════════════╝

📋 Planning... (TODO 리스트 생성 중)

✅ TODO List Generated:

┌─ TODO List ─────────────────────────────┐
│                                          │
│ ✓ 1. TypeScript 프로젝트 구조 생성      │
│ ⟳ 2. package.json 및 tsconfig.json 생성 │ [IN PROGRESS]
│ ○ 3. TODO 데이터 타입 정의              │
│ ○ 4. 파일 저장/불러오기 모듈 구현       │
│ ○ 5. CLI 메인 로직 구현                 │
│ ○ 6. 테스트 코드 작성                   │
│                                          │
│ Progress: 1/6 completed (17%)            │
└──────────────────────────────────────────┘

┌─ Agent Loop Execution ──────────────────┐
│                                          │
│ TODO: package.json 및 tsconfig.json 생성 │
│                                          │
│ Iteration: 2/10 (20%)                    │
│                                          │
│ ● EXECUTING...                           │
│                                          │
│ Action: Creating package.json file       │
│                                          │
│ Recent Actions:                          │
│ • Created project directory              │
│ • Initialized Git repository             │
│ • Writing package.json                   │
│                                          │
└──────────────────────────────────────────┘

[Status Bar]
─────────────────────────────────────────────
● EXECUTING | Working on: package.json
Endpoint: My LLM Server | Model: gemini-2.0-flash
Context: 45% (2340/5000)
─────────────────────────────────────────────

[자동으로 각 TODO 순차 실행...]

✅ All tasks completed!

🧑 You: _
```

**성공 조건:**
- ✅ TODO 리스트가 자동 생성됨
- ✅ UI에 진행 상황이 실시간 표시됨
- ✅ 각 TODO가 순차적으로 실행됨
- ✅ 모든 파일이 정확하게 생성됨
- ✅ 최종 프로젝트가 실행 가능함

**검증:**
```bash
# 생성된 프로젝트 확인
$ cd todo-cli
$ npm install
$ npm run build
$ npm start

# 정상 작동 확인
TODO CLI >
```

---

### 시나리오 7: 의존성이 있는 TODO 실행

**목적**: TODO 간 의존성 관리가 제대로 작동하는지 테스트

```
🧑 You: REST API 서버를 만들어주세요. Express.js를 사용하고,
GET /users, POST /users, DELETE /users/:id 엔드포인트를
만들어주세요. 각각에 대한 테스트도 포함해주세요.

[Plan-Execute 모드]

✅ TODO List Generated:

┌─ TODO List ─────────────────────────────┐
│                                          │
│ ○ 1. Express.js 프로젝트 초기화         │ [Dependency: none]
│ ○ 2. 라우터 구조 생성                   │ [Dependency: 1]
│ ○ 3. GET /users 엔드포인트 구현         │ [Dependency: 2]
│ ○ 4. POST /users 엔드포인트 구현        │ [Dependency: 2]
│ ○ 5. DELETE /users/:id 엔드포인트 구현  │ [Dependency: 2]
│ ○ 6. 테스트 환경 설정 (Jest + Supertest)│ [Dependency: 1]
│ ○ 7. 각 엔드포인트 테스트 코드 작성     │ [Dependency: 3,4,5,6]
│                                          │
│ Progress: 0/7 completed (0%)             │
└──────────────────────────────────────────┘

[TODO 1 실행 → 완료]
[TODO 2 실행 → 완료]
[TODO 3, 4, 5 병렬 실행 가능하지만 순차 실행]
[TODO 6 실행 → 완료]
[TODO 7 실행 → 완료]

✅ All tasks completed!

🤖 Assistant: REST API 서버가 완성되었습니다!

생성된 파일:
- server.js: Express 서버 메인
- routes/users.js: 사용자 라우트
- tests/users.test.js: 테스트 코드

서버 시작: npm start
테스트 실행: npm test

🧑 You: _
```

**성공 조건:**
- ✅ 의존성이 올바르게 인식됨
- ✅ TODO가 의존성 순서대로 실행됨
- ✅ 의존성이 없는 TODO는 스킵하지 않음
- ✅ 모든 파일이 생성되고 테스트가 통과함

---

## 세션 관리 시나리오

### 시나리오 8: 세션 저장 및 불러오기

**목적**: 대화 세션을 저장하고 나중에 복원하기

```bash
$ open

🧑 You: Python으로 피보나치 수열을 계산하는 함수를 만들어주세요

🤖 Assistant: [코드 생성...]

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

🧑 You: 좋아요! 이 세션을 저장해주세요

🧑 You: /save fibonacci-tutorial

✅ 세션 'fibonacci-tutorial'이 저장되었습니다.

🧑 You: /exit

# 나중에 다시 시작

$ open

🧑 You: /load

? 불러올 세션을 선택하세요:
❯ fibonacci-tutorial (2025-11-05 14:30)
  typescript-project (2025-11-04 10:15)
  rest-api-guide (2025-11-03 16:45)

[Enter 선택]

✅ 세션 'fibonacci-tutorial'을 불러왔습니다.

[이전 대화 내역 복원됨]

🧑 You: 이제 메모이제이션을 추가해서 성능을 개선해주세요

🤖 Assistant: [이전 컨텍스트를 기억하며 개선된 코드 제공]

def fibonacci(n, memo={}):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fibonacci(n-1, memo) + fibonacci(n-2, memo)
    return memo[n]

🧑 You: _
```

**성공 조건:**
- ✅ 세션이 정확하게 저장됨
- ✅ 세션 목록이 올바르게 표시됨
- ✅ 세션을 불러오면 이전 컨텍스트가 복원됨
- ✅ 대화가 자연스럽게 이어짐

---

### 시나리오 9: 여러 세션 관리

**목적**: 여러 프로젝트의 세션을 독립적으로 관리

```
🧑 You: /sessions

저장된 세션 목록:
  1. fibonacci-tutorial (2025-11-05 14:30) - 5 messages
  2. typescript-project (2025-11-04 10:15) - 23 messages
  3. rest-api-guide (2025-11-03 16:45) - 15 messages

🧑 You: /load

? 불러올 세션 선택: typescript-project

[TypeScript 프로젝트 세션 로드]

🧑 You: 이전에 작업하던 타입 정의를 계속 해주세요

[컨텍스트 유지됨]

🤖 Assistant: 네, 계속하겠습니다. User 인터페이스에 email 필드를
추가하고 있었죠...
```

**성공 조건:**
- ✅ 여러 세션을 독립적으로 관리
- ✅ 각 세션의 컨텍스트가 섞이지 않음
- ✅ 세션 간 전환이 원활함

---

## 고급 사용 시나리오

### 시나리오 10: 로컬 문서 검색

**목적**: 프로젝트 문서를 검색하고 활용하기

```bash
$ open

🧑 You: /docs typescript

📚 로컬 문서 검색 결과:

1. TypeScript Best Practices.md
   - 타입 안전성, 인터페이스 설계, 제네릭 사용법

2. TypeScript Configuration.md
   - tsconfig.json 설정 가이드

3. TypeScript with React.md
   - React 프로젝트에서의 TypeScript 사용

? 어떤 문서를 보시겠습니까? [1]

[문서 내용 표시]

🧑 You: 이 문서의 내용을 참고해서 TypeScript 프로젝트를
초기화해주세요

🤖 Assistant: [문서 내용을 참고하여 적절한 설정으로 프로젝트 생성]
```

**성공 조건:**
- ✅ 키워드로 문서 검색이 가능함
- ✅ 검색 결과가 정확함
- ✅ 문서 내용이 LLM 컨텍스트에 반영됨

---

### 시나리오 11: 엔드포인트 전환

**목적**: 여러 LLM 서버 간 전환하기

```
🧑 You: /endpoint

사용 가능한 엔드포인트:
  ❯ 1. My LLM Server (gemini-2.0-flash) [현재]
    2. OpenAI Server (gpt-4)
    3. Local LLaMA (llama-3-70b)

? 전환할 엔드포인트를 선택하세요: [2]

✅ 엔드포인트가 'OpenAI Server'로 전환되었습니다.
Model: gpt-4

🧑 You: 안녕하세요

[새로운 엔드포인트의 LLM이 응답]

🤖 Assistant: Hello! How can I assist you today?
```

**성공 조건:**
- ✅ 엔드포인트 목록이 표시됨
- ✅ 엔드포인트 전환이 즉시 반영됨
- ✅ 새 엔드포인트로 정상 통신됨

---

### 시나리오 12: 다중 파일 프로젝트 생성

**목적**: 여러 파일로 구성된 프로젝트를 한 번에 생성

```
🧑 You: React + TypeScript 프로젝트를 만들어주세요.
- src/components/Header.tsx
- src/components/Footer.tsx
- src/App.tsx
- src/index.tsx
- src/types.ts
- package.json
- tsconfig.json
위 파일들을 모두 만들어주세요.

[Plan-Execute 모드 활성화]

✅ TODO List Generated:

┌─ TODO List ─────────────────────────────┐
│ ○ 1. package.json 생성                  │
│ ○ 2. tsconfig.json 생성                 │
│ ○ 3. src/types.ts 생성                  │
│ ○ 4. src/components/Header.tsx 생성     │
│ ○ 5. src/components/Footer.tsx 생성     │
│ ○ 6. src/App.tsx 생성                   │
│ ○ 7. src/index.tsx 생성                 │
└──────────────────────────────────────────┘

[각 파일 순차 생성...]

✅ All files created successfully!

🤖 Assistant: React + TypeScript 프로젝트가 완성되었습니다!

설치 및 실행:
$ npm install
$ npm start

🧑 You: _
```

**검증:**
```bash
# 파일 구조 확인
$ tree -L 2
.
├── package.json
├── tsconfig.json
└── src
    ├── App.tsx
    ├── components
    │   ├── Footer.tsx
    │   └── Header.tsx
    ├── index.tsx
    └── types.ts

# 빌드 및 실행
$ npm install
$ npm start

# 브라우저에서 http://localhost:3000 접속
# 정상 렌더링 확인
```

**성공 조건:**
- ✅ 모든 파일이 생성됨
- ✅ 파일 간 import가 정확함
- ✅ TypeScript 설정이 올바름
- ✅ 프로젝트가 빌드되고 실행됨

---

## 문제 해결

### 문제 1: LLM이 응답하지 않음

**증상:**
```
🧑 You: 안녕하세요

[아무 응답 없음, 커서만 깜빡임]
```

**확인 사항:**
1. 엔드포인트 연결 확인
   ```bash
   open config show
   ```

2. LLM 서버 상태 확인
   ```bash
   curl https://your-llm-server.com/v1/models
   ```

3. 로그 확인
   ```bash
   cat ~/.open-cli/logs/latest.log
   ```

**해결 방법:**
- 네트워크 연결 확인
- API 키 유효성 확인
- LLM 서버 재시작

---

### 문제 2: 파일 생성 실패

**증상:**
```
🔧 Tool Call: write_file
📁 file_path: test.txt

❌ Error: Permission denied
```

**해결 방법:**
```bash
# 디렉토리 권한 확인
ls -la

# 필요시 권한 변경
chmod 755 .

# 또는 다른 디렉토리에서 실행
cd ~/projects/my-project
open
```

---

### 문제 3: 세션 로드 실패

**증상:**
```
🧑 You: /load

❌ Error: No saved sessions found
```

**해결 방법:**
```bash
# 세션 디렉토리 확인
ls ~/.open-cli/sessions/

# 세션이 없으면 새로 생성
# 대화 후 /save로 저장
```

---

### 문제 4: Plan-Execute 모드가 활성화되지 않음

**증상:**
- 복잡한 요청을 해도 TODO 리스트가 생성되지 않음

**해결 방법:**
```
# 명시적으로 Plan-Execute 요청
🧑 You: [PLAN-EXECUTE] TypeScript 프로젝트를 만들어주세요

# 또는 복잡한 작업을 단계별로 요청
🧑 You: 다음 작업들을 순서대로 해주세요:
1. package.json 생성
2. tsconfig.json 생성
3. src 폴더 및 파일 생성
```

---

## 📊 테스트 결과 보고 템플릿

```markdown
## 테스트 결과 보고서

**날짜**: YYYY-MM-DD
**테스터**: [이름]
**버전**: 3.0.0

### 환경
- OS: [운영체제]
- Node.js: [버전]
- LLM 서버: [서버 정보]

### 시나리오별 결과

| 시나리오 | 상태 | 비고 |
|---------|------|------|
| 1. 첫 대화 시작 | ✅ Pass | |
| 2. 메타 명령어 | ✅ Pass | |
| 3. 파일 읽기 | ✅ Pass | |
| 4. 파일 생성/수정 | ✅ Pass | |
| 5. 파일 검색 | ✅ Pass | |
| 6. Plan-Execute | ✅ Pass | |
| 7. 의존성 TODO | ✅ Pass | |
| 8. 세션 저장/불러오기 | ✅ Pass | |
| 9. 여러 세션 관리 | ✅ Pass | |
| 10. 문서 검색 | ✅ Pass | |
| 11. 엔드포인트 전환 | ✅ Pass | |
| 12. 다중 파일 프로젝트 | ✅ Pass | |

### 발견된 이슈
[이슈 내용]

### 개선 제안
[제안 사항]

### 전반적 평가
[종합 의견]
```

---

## 🎯 다음 단계

테스트 완료 후:
1. 발견된 버그를 GitHub Issues에 보고
2. 성능 측정 결과 기록
3. 사용성 개선 제안 작성
4. 추가 테스트 시나리오 제안

---

**문서 버전**: 3.0.0 - 실사용 시나리오 기반
**마지막 업데이트**: 2025-11-05
