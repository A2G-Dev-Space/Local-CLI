# TEST_SCENARIO.md

**OPEN-CLI 테스트 시나리오 문서**

작성일: 2025-11-05
버전: 0.3.0

---

## 📋 목차

1. [환경 설정](#환경-설정)
2. [기본 기능 테스트](#기본-기능-테스트)
3. [Plan-and-Execute 테스트](#plan-and-execute-테스트)
4. [Multi-Layered Execution 테스트](#multi-layered-execution-테스트)
5. [Internal Monologue 테스트](#internal-monologue-테스트)
6. [TDD Workflow 테스트](#tdd-workflow-테스트)
7. [통합 테스트](#통합-테스트)
8. [성능 테스트](#성능-테스트)

---

## 환경 설정

### 사전 요구사항

```bash
# Node.js 버전 확인
node --version  # v20 이상 필요

# 프로젝트 클론
git clone https://github.com/A2G-Dev-Space/Open-Code-CLI.git
cd Open-Code-CLI

# 의존성 설치
npm install

# 빌드
npm run build
```

### 테스트 환경 확인

```bash
# 단위 테스트 실행
npm test

# 빌드 확인
npm run build

# 설정 파일 초기화
rm -rf ~/.open-cli  # 기존 설정 삭제 (선택사항)
```

---

## 기본 기능 테스트

### 1. 초기 설정 테스트

**목적**: CLI 초기 설정이 정상적으로 작동하는지 확인

**테스트 단계**:

```bash
# 1. 초기화 명령 실행
node dist/cli.js config init

# 예상 출력:
# 🚀 OPEN-CLI 초기화
# ? 엔드포인트 이름: [입력 대기]
```

**입력 값**:
- 엔드포인트 이름: `Test LLM Server`
- Base URL: `https://your-llm-server.com/v1/`
- API Key: (선택사항, 비워두기)
- Model ID: `gpt-4`
- Model 이름: `GPT-4`
- Max Tokens: `8192`

**성공 조건**:
- ✅ 설정 파일 생성 확인: `~/.open-cli/config.json` 파일 존재
- ✅ 엔드포인트 정보가 올바르게 저장됨
- ✅ 연결 테스트 성공 메시지 출력

**실패 시 조치**:
- 네트워크 연결 확인
- LLM 서버 URL 및 API 키 재확인
- 로그 파일 확인: `~/.open-cli/logs/`

---

### 2. 설정 확인 테스트

**목적**: 저장된 설정을 올바르게 불러오는지 확인

```bash
# 설정 보기
node dist/cli.js config show

# 예상 출력:
# 📋 현재 설정
#
# 엔드포인트: Test LLM Server
# Base URL: https://your-llm-server.com/v1/
# Model: GPT-4 (gpt-4)
# Max Tokens: 8192
```

**성공 조건**:
- ✅ 모든 설정 항목이 정확하게 표시됨
- ✅ JSON 형식이 올바름

---

### 3. 파일 시스템 도구 테스트

**목적**: LLM이 파일을 읽고 쓸 수 있는지 확인

**테스트 파일 준비**:
```bash
# 테스트용 파일 생성
echo "Hello, OPEN-CLI!" > test.txt
```

**테스트 시나리오**:

#### 3-1. 파일 읽기
```bash
# 대화형 모드 시작
node dist/cli.js

# 프롬프트 입력
You: test.txt 파일의 내용을 읽어줘
```

**예상 동작**:
```
🔧 Tool: read_file(file_path="test.txt")

🤖 Assistant: test.txt 파일의 내용은 "Hello, OPEN-CLI!" 입니다.
```

**성공 조건**:
- ✅ `read_file` 도구가 자동으로 호출됨
- ✅ 파일 내용이 정확하게 읽힘
- ✅ 응답이 자연스러움

#### 3-2. 파일 쓰기
```bash
You: "OPEN-CLI is awesome!" 내용으로 awesome.txt 파일을 만들어줘
```

**예상 동작**:
```
🔧 Tool: write_file(file_path="awesome.txt", content="OPEN-CLI is awesome!")

🤖 Assistant: awesome.txt 파일을 생성했습니다.
```

**검증**:
```bash
cat awesome.txt
# 출력: OPEN-CLI is awesome!
```

**성공 조건**:
- ✅ `write_file` 도구가 자동으로 호출됨
- ✅ 파일이 올바른 내용으로 생성됨
- ✅ 파일 권한이 적절함

#### 3-3. 파일 검색
```bash
You: 현재 디렉토리에서 *.txt 파일을 모두 찾아줘
```

**예상 동작**:
```
🔧 Tool: find_files(pattern="*.txt", directory_path=".")

🤖 Assistant: 다음 .txt 파일들을 찾았습니다:
- test.txt
- awesome.txt
```

**성공 조건**:
- ✅ `find_files` 도구가 자동으로 호출됨
- ✅ 모든 .txt 파일이 검색됨
- ✅ 경로가 정확함

---

### 4. 세션 저장/복구 테스트

**목적**: 대화 세션을 저장하고 불러올 수 있는지 확인

**테스트 단계**:

```bash
# 1. 대화 시작
You: 안녕하세요!
🤖 Assistant: 안녕하세요! 무엇을 도와드릴까요?

You: TypeScript에 대해 알려주세요
🤖 Assistant: TypeScript는... [응답]

# 2. 세션 저장
You: /save typescript-session

# 예상 출력:
# ✅ 세션 저장 완료: typescript-session

# 3. 대화 종료
You: /exit

# 4. 새로운 세션 시작 후 불러오기
node dist/cli.js

You: /load
# ? 불러올 세션 선택:
#   > typescript-session
#   [선택]

# 예상: 이전 대화 내역이 복원됨
```

**성공 조건**:
- ✅ 세션이 `~/.open-cli/sessions/` 디렉토리에 저장됨
- ✅ 불러온 세션의 대화 내역이 정확함
- ✅ 컨텍스트가 유지됨

---

## Plan-and-Execute 테스트

### 5. TODO 리스트 자동 생성 테스트

**목적**: 복잡한 작업을 자동으로 TODO로 분해하는지 확인

**테스트 시나리오**:

```typescript
// 테스트 코드 (test/integration/plan-execute.test.ts)
import { PlanningLLM } from '../src/core/planning-llm';
import { LLMClient } from '../src/core/llm-client';

describe('Plan-and-Execute Architecture', () => {
  it('should decompose task into TODO list', async () => {
    const userRequest = "TypeScript로 간단한 REST API 서버를 만들어줘";

    const planner = new PlanningLLM(llmClient);
    const result = await planner.plan(userRequest);

    // 검증
    expect(result.todos.length).toBeGreaterThan(0);
    expect(result.todos[0]).toHaveProperty('title');
    expect(result.todos[0]).toHaveProperty('description');
    expect(result.todos[0]).toHaveProperty('status', 'pending');
  });
});
```

**성공 조건**:
- ✅ TODO 리스트가 생성됨
- ✅ 각 TODO에 title, description, status가 있음
- ✅ 의존성이 올바르게 설정됨

---

### 6. Agent Loop 실행 테스트

**목적**: TODO가 순차적으로 실행되고 검증되는지 확인

**테스트 시나리오**:

```typescript
import { AgentLoopController } from '../src/core/agent-loop';

describe('Agent Loop Execution', () => {
  it('should execute TODO with verification', async () => {
    const todo = {
      id: 'test-1',
      title: '간단한 파일 생성',
      description: 'hello.txt 파일을 "Hello World" 내용으로 생성',
      status: 'pending',
      requiresDocsSearch: false,
      dependencies: []
    };

    const controller = new AgentLoopController(llmClient, workVerifier);
    const result = await controller.executeTodoWithLoop(todo, context);

    // 검증
    expect(result.success).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(5);
  });
});
```

**성공 조건**:
- ✅ TODO가 성공적으로 실행됨
- ✅ Work Verifier가 작업을 검증함
- ✅ 최대 반복 횟수 내에 완료됨
- ✅ 실패 시 재시도 로직이 작동함

---

### 7. Context Gathering 테스트

**목적**: 파일 시스템 탐색 및 컨텍스트 수집이 작동하는지 확인

**테스트 시나리오**:

```bash
# 테스트 프로젝트 구조 생성
mkdir -p test-project/src
echo "export const hello = 'world';" > test-project/src/index.ts
echo "# Test Project" > test-project/README.md

# Context Gatherer 테스트
node dist/cli.js
You: test-project 디렉토리의 구조를 파악하고 요약해줘
```

**예상 동작**:
```
🔍 Context Gathering...
  - 디렉토리 구조 분석
  - 관련 파일 검색
  - 컨텍스트 요약

🤖 Assistant: test-project는 다음과 같은 구조입니다:
- src/index.ts: TypeScript 소스 파일
- README.md: 프로젝트 설명 파일
```

**성공 조건**:
- ✅ 디렉토리 구조가 올바르게 분석됨
- ✅ 관련 파일이 검색됨
- ✅ 컨텍스트가 요약됨

---

## Multi-Layered Execution 테스트

### 8. 계층 선택 테스트

**목적**: 작업 복잡도에 따라 올바른 계층이 선택되는지 확인

**테스트 케이스**:

#### 8-1. Tool Layer (단순 작업)
```typescript
const simpleTask = {
  id: 'task-1',
  description: 'package.json 파일 읽기',
  complexity: 'simple',
  requiresTools: ['read_file']
};

// 예상: ToolLayer 선택
```

#### 8-2. Code-Gen Layer (코드 생성)
```typescript
const codeGenTask = {
  id: 'task-2',
  description: 'fibonacci 함수를 TypeScript로 구현',
  complexity: 'moderate',
  requiresDynamicCode: true,
  targetLanguage: 'typescript'
};

// 예상: CodeGenLayer 선택
```

#### 8-3. SubAgent Layer (병렬 작업)
```typescript
const parallelTask = {
  id: 'task-3',
  description: 'REST API의 여러 엔드포인트를 동시에 구현',
  complexity: 'complex',
  requiresParallelism: true,
  subtasks: [
    { description: 'GET /users 엔드포인트' },
    { description: 'POST /users 엔드포인트' },
    { description: 'DELETE /users/:id 엔드포인트' }
  ]
};

// 예상: SubAgentLayer 선택, 병렬 실행
```

#### 8-4. Skills Layer (행동 변경)
```typescript
const skillTask = {
  id: 'task-4',
  description: '코드 리뷰 수행',
  complexity: 'meta',
  requiresSkill: 'code-reviewer'
};

// 예상: SkillsLayer 선택, code-reviewer 스킬 적용
```

**성공 조건**:
- ✅ 각 작업에 적절한 계층이 선택됨
- ✅ 계층 간 전환이 원활함
- ✅ 결과가 정확함

---

### 9. 병렬 실행 테스트

**목적**: SubAgent 계층이 작업을 병렬로 실행하는지 확인

**테스트 시나리오**:

```typescript
import { SubAgentLayer } from '../src/execution/subagent-layer';

describe('SubAgent Parallel Execution', () => {
  it('should execute subtasks in parallel', async () => {
    const task = {
      id: 'parallel-test',
      description: '3개의 파일을 동시에 생성',
      complexity: 'complex',
      requiresParallelism: true,
      subtasks: [
        { description: 'file1.txt 생성' },
        { description: 'file2.txt 생성' },
        { description: 'file3.txt 생성' }
      ]
    };

    const startTime = Date.now();
    const layer = new SubAgentLayer(llmClient);
    const result = await layer.execute(task);
    const executionTime = Date.now() - startTime;

    // 검증
    expect(result.success).toBe(true);
    expect(result.parallelism).toBeGreaterThan(1);
    // 병렬 실행이므로 순차 실행보다 빨라야 함
  });
});
```

**성공 조건**:
- ✅ 작업이 병렬로 실행됨
- ✅ 실행 시간이 순차 실행보다 짧음
- ✅ 모든 서브태스크 결과가 합성됨
- ✅ 의존성이 있는 작업은 순서대로 실행됨

---

## Internal Monologue 테스트

### 10. Extended Thinking 테스트

**목적**: Question Decomposition이 작동하는지 확인

**테스트 시나리오**:

```typescript
import { InternalMonologue } from '../src/core/internal-monologue';

describe('Internal Monologue System', () => {
  it('should perform extended thinking', async () => {
    const context = {
      task: '효율적인 REST API를 설계하는 방법',
      context: loopContext,
      background: 'TypeScript와 Express.js 사용'
    };

    const monologue = new InternalMonologue(llmClient, 'extended');
    const session = await monologue.think(context);

    // 검증
    expect(session.thoughts.length).toBeGreaterThan(0);
    expect(session.questions.length).toBeGreaterThan(0);
    expect(session.evaluations.length).toBeGreaterThan(0);
    expect(session.finalPlan).toBeDefined();
  });
});
```

**성공 조건**:
- ✅ 작업이 여러 질문으로 분해됨
- ✅ 각 질문에 대한 답변이 생성됨
- ✅ 옵션들이 평가됨
- ✅ 최종 계획이 합성됨

---

### 11. Scratchpad 관리 테스트

**목적**: 외부 Scratchpad 파일로 TODO를 관리하는지 확인

**테스트 시나리오**:

```typescript
import { Scratchpad } from '../src/core/scratchpad';

describe('Scratchpad System', () => {
  it('should manage TODO list in markdown', async () => {
    const scratchpad = new Scratchpad('./test-project');

    // TODO 추가
    await scratchpad.addTodo('파일 생성', '테스트 파일 생성');
    await scratchpad.addTodo('테스트 실행', '단위 테스트 실행');

    // 파일 확인
    const content = await scratchpad.getContent();

    // 검증
    expect(content.sections).toHaveLength(1);
    expect(content.sections[0].type).toBe('todo-list');
    expect(content.sections[0].items).toHaveLength(2);
  });
});
```

**검증**:
```bash
# Scratchpad 파일 확인
cat ./test-project/.open-cli/scratchpad.md

# 예상 내용:
# # OPEN-CLI Scratchpad
#
# ## TODO List
#
# - [ ] 파일 생성 - 테스트 파일 생성
# - [ ] 테스트 실행 - 단위 테스트 실행
```

**성공 조건**:
- ✅ Scratchpad 파일이 생성됨
- ✅ TODO가 마크다운 형식으로 저장됨
- ✅ 상태 업데이트가 반영됨

---

## TDD Workflow 테스트

### 12. 자동 테스트 생성 테스트

**목적**: 요구사항으로부터 테스트 코드가 자동 생성되는지 확인

**테스트 시나리오**:

```typescript
import { TDDWorkflow } from '../src/workflows/tdd-workflow';

describe('TDD Workflow', () => {
  it('should generate tests from requirements', async () => {
    const request = {
      requirement: '숫자 배열의 합을 계산하는 sum 함수',
      testFramework: 'jest',
      language: 'typescript'
    };

    const workflow = new TDDWorkflow(llmClient);
    const result = await workflow.execute(request);

    // 검증
    expect(result.success).toBe(true);
    expect(result.session.tests.length).toBeGreaterThan(0);
    expect(result.finalImplementation).toBeDefined();
  });
});
```

**예상 생성 테스트**:
```typescript
describe('sum', () => {
  it('should return 0 for empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('should return sum of positive numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it('should handle negative numbers', () => {
    expect(sum([-1, -2, -3])).toBe(-6);
  });
});
```

**성공 조건**:
- ✅ 테스트 케이스가 자동 생성됨
- ✅ Edge case가 포함됨
- ✅ 테스트가 실행 가능함

---

### 13. Red-Green-Refactor 사이클 테스트

**목적**: TDD 사이클이 자동으로 실행되는지 확인

**테스트 시나리오**:

```typescript
describe('TDD Workflow - Red-Green-Refactor', () => {
  it('should follow Red-Green-Refactor cycle', async () => {
    const request = {
      requirement: 'fibonacci 수를 계산하는 함수',
      testFramework: 'jest',
      language: 'typescript',
      maxIterations: 5
    };

    const workflow = new TDDWorkflow(llmClient);
    const result = await workflow.execute(request);

    // 검증
    expect(result.session.iterations.length).toBeGreaterThan(0);

    // 첫 번째 반복: RED (테스트 실패)
    const firstIteration = result.session.iterations[0];
    expect(firstIteration.testResult.passed).toBe(0);

    // 마지막 반복: GREEN (테스트 통과)
    const lastIteration = result.session.iterations[result.session.iterations.length - 1];
    expect(lastIteration.testResult.passed).toBeGreaterThan(0);
    expect(lastIteration.testResult.failed).toBe(0);
  });
});
```

**성공 조건**:
- ✅ Red 단계: 테스트가 실패함
- ✅ Green 단계: 구현 후 테스트가 통과함
- ✅ Refactor 단계: 코드가 개선됨
- ✅ 최대 반복 횟수 내에 완료됨

---

### 14. Verification System 테스트

**목적**: 3가지 검증 모드가 작동하는지 확인

#### 14-1. Rule-based Verification
```typescript
const rule = {
  name: 'lint-check',
  type: 'lint',
  description: 'ESLint 검사',
  command: 'npm run lint',
  failureMessage: 'Linting 오류 발견',
  suggestions: ['ESLint 오류를 수정하세요']
};

const outcome = await verifier.verifyRules(work, [rule]);
expect(outcome[0].passed).toBe(true);
```

#### 14-2. Visual Verification (UI 테스트)
```typescript
const visualCriteria = {
  url: 'http://localhost:3000',
  expectedElements: ['#header', '.main-content', 'footer']
};

const outcome = await verifier.verifyVisual(work, visualCriteria);
expect(outcome.allFound).toBe(true);
```

#### 14-3. LLM-as-Judge
```typescript
const fuzzyC criteria = [
  '코드가 읽기 쉽고 유지보수 가능한가?',
  '적절한 주석이 포함되어 있는가?'
];

const outcome = await verifier.verifyWithLLM(work, fuzzyCriteria);
expect(outcome.every(o => o.passed)).toBe(true);
```

**성공 조건**:
- ✅ Rule-based: 명확한 규칙이 정확히 검증됨
- ✅ Visual: UI 요소가 올바르게 감지됨
- ✅ LLM-as-Judge: 모호한 기준이 합리적으로 평가됨

---

## 통합 테스트

### 15. End-to-End 테스트

**목적**: 전체 워크플로우가 통합되어 작동하는지 확인

**시나리오: TypeScript 프로젝트 생성**

```bash
# 1. OPEN-CLI 시작
node dist/cli.js

# 2. 복잡한 요청
You: TypeScript로 간단한 TODO 앱 CLI를 만들어줘. 파일 저장/불러오기 기능과 테스트 코드도 포함해서.

# 예상 동작:
# 1. Plan-and-Execute가 TODO 리스트 생성
#    - ☐ 프로젝트 구조 생성
#    - ☐ TypeScript 설정
#    - ☐ TODO 관리 모듈 구현
#    - ☐ 파일 저장/불러오기 구현
#    - ☐ 테스트 코드 작성
#
# 2. Multi-Layered Execution이 적절한 계층 선택
#    - Tool Layer: 파일 생성
#    - Code-Gen Layer: 코드 구현
#    - TDD Layer: 테스트 작성
#
# 3. Internal Monologue가 각 TODO에 대해 사고
#    - 질문 분해: "어떤 파일 구조가 좋을까?"
#    - 옵션 평가: "JSON vs 텍스트 파일"
#    - 계획 수립: "단계별 구현 순서"
#
# 4. TDD Workflow가 테스트 먼저 작성
#    - Red: 테스트 작성 (실패)
#    - Green: 구현 (통과)
#    - Refactor: 개선
#
# 5. Verification이 각 단계 검증
#    - Rule-based: 빌드 성공
#    - LLM-as-Judge: 코드 품질
```

**검증 포인트**:
1. ✅ TODO 리스트가 자동 생성됨
2. ✅ 각 TODO가 순차적으로 실행됨
3. ✅ 파일이 올바르게 생성됨
4. ✅ 테스트 코드가 포함됨
5. ✅ 모든 테스트가 통과함
6. ✅ 프로젝트가 정상 작동함

**최종 확인**:
```bash
# 생성된 프로젝트 확인
cd todo-cli
npm install
npm test    # 모든 테스트 통과
npm start   # 정상 실행
```

---

### 16. 장시간 실행 테스트

**목적**: 메모리 누수 및 안정성 확인

**테스트 시나리오**:

```bash
# 100개의 TODO를 순차 실행
for i in {1..100}; do
  echo "Iteration $i"
  node dist/cli.js --non-interactive "간단한 파일 $i.txt 생성"

  # 메모리 사용량 확인
  ps aux | grep node
done

# 예상: 메모리 사용량이 선형적으로 증가하지 않음
```

**성공 조건**:
- ✅ 메모리 사용량이 안정적임
- ✅ 모든 반복이 성공함
- ✅ 응답 시간이 일정함

---

## 성능 테스트

### 17. 응답 시간 측정

**테스트 케이스**:

```typescript
describe('Performance Tests', () => {
  it('should respond within acceptable time', async () => {
    const startTime = Date.now();

    const result = await llmClient.chatCompletion({
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    });

    const responseTime = Date.now() - startTime;

    // 검증: 5초 이내 응답
    expect(responseTime).toBeLessThan(5000);
  });
});
```

**벤치마크 기준**:
- 단순 응답: < 3초
- 파일 읽기/쓰기: < 2초
- TODO 계획 생성: < 10초
- 코드 생성: < 15초

---

### 18. 동시성 테스트

**목적**: 여러 요청을 동시에 처리할 수 있는지 확인

```typescript
describe('Concurrency Tests', () => {
  it('should handle multiple requests', async () => {
    const requests = Array(10).fill(null).map((_, i) =>
      llmClient.chatCompletion({
        messages: [{ role: 'user', content: `Test ${i}` }]
      })
    );

    const results = await Promise.all(requests);

    // 모든 요청이 성공해야 함
    expect(results.every(r => r.choices.length > 0)).toBe(true);
  });
});
```

**성공 조건**:
- ✅ 모든 요청이 성공함
- ✅ 응답이 섞이지 않음
- ✅ 메모리 사용량이 합리적임

---

## 🔧 문제 해결 가이드

### 테스트 실패 시 체크리스트

1. **환경 확인**
   - [ ] Node.js 버전 (v20+)
   - [ ] npm 의존성 설치
   - [ ] 빌드 완료

2. **설정 확인**
   - [ ] config.json 파일 존재
   - [ ] LLM 서버 연결
   - [ ] API 키 유효성

3. **로그 확인**
   - [ ] `~/.open-cli/logs/` 디렉토리 확인
   - [ ] 에러 메시지 분석
   - [ ] 스택 트레이스 확인

4. **재시도**
   - [ ] 캐시 삭제: `rm -rf ~/.open-cli/cache`
   - [ ] 재빌드: `npm run build`
   - [ ] 테스트 재실행

---

## 📝 테스트 결과 보고

### 테스트 결과 템플릿

```markdown
## 테스트 결과 보고서

**날짜**: YYYY-MM-DD
**테스터**: [이름]
**버전**: 0.3.0

### 테스트 환경
- OS: [운영체제]
- Node.js: [버전]
- LLM 서버: [서버 정보]

### 테스트 결과 요약
- 총 테스트: [개수]
- 성공: [개수]
- 실패: [개수]
- 스킵: [개수]

### 실패한 테스트
1. [테스트 번호 및 이름]
   - 에러: [에러 메시지]
   - 재현 방법: [단계]
   - 예상 결과: [설명]
   - 실제 결과: [설명]

### 성능 측정
- 평균 응답 시간: [시간]
- 메모리 사용량: [용량]
- CPU 사용률: [퍼센트]

### 추가 의견
[자유 기술]
```

---

## 🎯 다음 단계

이 테스트 시나리오는 지속적으로 업데이트됩니다:

1. **새로운 기능 추가 시**: 해당 기능의 테스트 시나리오 추가
2. **버그 발견 시**: 재현 시나리오 추가
3. **성능 개선 시**: 벤치마크 업데이트

---

**문서 버전**: 1.0
**마지막 업데이트**: 2025-11-05
