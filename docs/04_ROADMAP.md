# OPEN-CLI Roadmap & TODO List

> **문서 버전**: 1.0.1
> **최종 수정일**: 2025-12-10
> **작성자**: Development Team

## 목차

1. [개요](#1-개요)
2. [현재 구조 평가](#2-현재-구조-평가)
3. [Phase 0: 구조 리팩토링](#3-phase-0-구조-리팩토링-선행-작업)
4. [Phase 1: 핵심 기능 강화](#4-phase-1-핵심-기능-강화)
5. [Phase 2: 확장 기능 구현](#5-phase-2-확장-기능-구현)
6. [Phase 3: 고급 기능 구현](#6-phase-3-고급-기능-구현)
7. [우선순위 매트릭스](#7-우선순위-매트릭스)

---

## 1. 개요

### 1.1 프로젝트 비전

OPEN-CLI는 오프라인 기업 환경을 위한 완전한 로컬 LLM CLI 플랫폼입니다.
향후 12개 주요 기능 영역의 개발을 계획하고 있습니다.

### 1.2 향후 기능 목록

| # | 기능 | 우선순위 | 예상 복잡도 |
|---|------|---------|-----------|
| 1 | Plan-Execute 로직 강화 | P0 | High |
| 2 | Docs 다운로드 기능 내재화 | P1 | Medium |
| 3 | UI/UX 개선 | P1 | High |
| 4 | LLM 다중 등록 | P1 | Medium |
| 5 | Native Tool 증가 | P0 | High |
| 6 | Tool RAG 제공 | P2 | High |
| 7 | 승인모드/자율모드 분기 | P1 | Medium |
| 8 | 사용량 추적 | P2 | Medium |
| 9 | MCP 등록 기능 | P2 | High |
| 10 | Agent Tool 추가 | P1 | High |
| 11 | 코드 문서화 기능 | P3 | High |
| 12 | Local RAG 강화 | P2 | High |

---

## 2. 현재 구조 평가

### 2.1 현재 점수: 70/100

#### 강점
- ✅ 명확한 계층 분리 (core → plan-and-execute → execution → ui)
- ✅ 타입 안정성 (중앙 집중식 타입 정의)
- ✅ 구조화된 에러 처리 시스템
- ✅ 레이어 기반 실행 엔진

#### 개선 필요 영역
- ❌ PlanExecuteApp.tsx 과도한 크기 (775줄 → 분할 필요)
- ❌ core/ 폴더 역할 분산 (19개 파일)
- ❌ tools/ 시스템 미흡 (파일 도구만 존재)
- ❌ MCP, RAG 모듈 부재

### 2.2 제안 폴더 구조

```
src/
├── core/
│   ├── llm/                 # LLM 관련 모듈
│   │   ├── llm-client.ts
│   │   ├── planning-llm.ts
│   │   └── token-manager.ts
│   ├── config/              # 설정 관련 모듈
│   │   ├── config-manager.ts
│   │   ├── endpoint-manager.ts
│   │   └── model-manager.ts
│   ├── session/             # 세션 관련 모듈
│   │   ├── session-manager.ts
│   │   └── session-persistence.ts
│   └── knowledge/           # 지식 관련 모듈
│       ├── document-manager.ts
│       ├── docs-search-agent.ts
│       └── docs-downloader.ts
├── tools/                   # 확장된 도구 시스템
│   ├── base/
│   │   ├── base-tool.ts
│   │   └── tool-registry.ts
│   ├── native/
│   │   ├── file-tool.ts
│   │   ├── bash-tool.ts
│   │   ├── git-tool.ts
│   │   └── npm-tool.ts
│   └── rag/
│       └── tool-rag.ts
├── mcp/                     # MCP 서버 통합
│   ├── mcp-client.ts
│   ├── mcp-tool-wrapper.ts
│   └── mcp-resource-manager.ts
├── rag/                     # RAG 시스템
│   ├── embedder.ts
│   ├── vector-store.ts
│   ├── retriever.ts
│   └── rag-pipeline.ts
├── analytics/               # 사용량 추적
│   ├── usage-tracker.ts
│   ├── metrics-aggregator.ts
│   └── cost-calculator.ts
├── documentation/           # 코드 문서화
│   ├── code-analyzer.ts
│   ├── doc-generator.ts
│   └── doc-indexer.ts
└── agents/                  # Agent Tools
    ├── search-agent.ts
    ├── explore-agent.ts
    └── agent-registry.ts
```

---

## 3. Phase 0: 구조 리팩토링 (선행 작업)

> **목표**: 향후 기능 추가를 위한 기반 구조 정립

### 3.1 UI 컴포넌트 분할

#### 3.1.1 PlanExecuteApp.tsx 분할

**현재 상태**: 단일 파일 775줄, 모든 로직 집중

**목표 구조**:
```
ui/components/
├── PlanExecuteApp.tsx          # 상태 관리, 라우팅만 (200줄 이하)
├── views/
│   ├── ChatView.tsx            # 채팅 UI
│   ├── PlanningView.tsx        # 계획 수립 UI
│   └── ExecutionView.tsx       # 실행 UI
├── panels/
│   ├── TodoPanel.tsx           # TODO 패널 (기존)
│   ├── FilePanel.tsx           # 파일 브라우저
│   └── SessionPanel.tsx        # 세션 브라우저
└── dialogs/
    ├── ApprovalDialog.tsx      # 승인 대화상자
    ├── SettingsDialog.tsx      # 설정 대화상자
    └── CommandDialog.tsx       # 명령어 브라우저
```

**TODO**:
- [x] `PlanExecuteApp.tsx`에서 채팅 렌더링 로직 분리 → `ChatView.tsx`
- [x] 파일 브라우저 관련 상태/로직 분리 → `useFileBrowserState.ts` 훅으로 구현
- [ ] 세션 브라우저 관련 상태/로직 분리 → `SessionPanel.tsx`
- [ ] 승인 프롬프트 로직 분리 → `ApprovalDialog.tsx`
- [ ] 설정 브라우저 로직 분리 → `SettingsDialog.tsx`
- [x] 명령어 브라우저 로직 분리 → `useCommandBrowserState.ts` 훅으로 구현
- [x] 커스텀 훅 추출: `usePlanExecution`, `useFileBrowserState`, `useCommandBrowserState`

### 3.2 Core 모듈 재구성

#### 3.2.1 LLM 모듈 분리

**현재**: `core/llm-client.ts` (1,115줄)

**목표**:
```
core/llm/
├── llm-client.ts              # HTTP 통신만 (500줄)
├── planning-llm.ts            # 계획 수립 (기존)
├── token-manager.ts           # 토큰 관리 (신규)
├── prompt-builder.ts          # 프롬프트 생성 (신규)
└── response-parser.ts         # 응답 파싱 (신규)
```

**TODO**:
- [x] `core/llm/` 폴더 구조 생성 완료
- [x] `llm-client.ts` → `core/llm/llm-client.ts` 이동 (re-export 유지)
- [x] `planning-llm.ts` → `core/llm/planning-llm.ts` 이동 (re-export 유지)
- [ ] `llm-client.ts`에서 토큰 카운팅 로직 분리 → `token-manager.ts`
- [ ] 프롬프트 빌더 로직 분리 → `prompt-builder.ts`
- [ ] 응답 파싱 로직 분리 → `response-parser.ts`
- [ ] 스트리밍 핸들러 개선

#### 3.2.2 Config 모듈 분리

**현재**: `core/config-manager.ts`

**목표**:
```
core/config/
├── config-manager.ts          # 전체 설정 관리
├── endpoint-manager.ts        # 엔드포인트 관리 (다중 LLM)
├── model-manager.ts           # 모델 관리
└── preference-manager.ts      # 사용자 설정
```

**TODO**:
- [x] `core/config/` 폴더 구조 생성 완료
- [x] `config-manager.ts` → `core/config/config-manager.ts` 이동 (re-export 유지)
- [x] `project-config.ts` → `core/config/project-config.ts` 이동 (re-export 유지)
- [ ] 엔드포인트 관련 로직 분리 → `endpoint-manager.ts`
- [ ] 모델 관련 로직 분리 → `model-manager.ts`
- [ ] 사용자 설정 로직 분리 → `preference-manager.ts`

### 3.3 Tools 시스템 재설계

#### 3.3.1 베이스 도구 클래스 구현

**신규 파일**: `tools/base/base-tool.ts`

```typescript
// 요구사항
export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
}

export abstract class BaseTool {
  abstract definition: ToolDefinition;
  abstract execute(params: Record<string, any>): Promise<ToolResult>;
  abstract validate(params: Record<string, any>): ValidationResult;
}
```

**TODO**:
- [ ] `BaseTool` 추상 클래스 구현
- [ ] `ToolDefinition` 인터페이스 정의
- [ ] `ToolResult` 타입 정의
- [ ] `ValidationResult` 타입 정의

#### 3.3.2 도구 레지스트리 구현

**신규 파일**: `tools/base/tool-registry.ts`

```typescript
// 요구사항
export class ToolRegistry {
  register(tool: BaseTool): void;
  unregister(toolName: string): void;
  getToolsByCategory(category: ToolCategory): BaseTool[];
  getToolDefinitions(): ToolDefinition[];
  executeTool(name: string, params: any): Promise<ToolResult>;
}
```

**TODO**:
- [ ] `ToolRegistry` 클래스 구현
- [ ] 도구 등록/해제 메서드
- [ ] 카테고리별 도구 필터링
- [ ] 도구 실행 래퍼 (에러 핸들링 포함)

#### 3.3.3 기존 file-tools.ts 마이그레이션

**TODO**:
- [ ] `file-tools.ts` → `tools/native/file-tool.ts` 이동
- [ ] `BaseTool` 상속 구조로 리팩토링
- [ ] 개별 파일 도구 분리 (read, write, list, find)

---

## 4. Phase 1: 핵심 기능 강화

> **목표**: 주요 기능 안정화 및 확장

### 4.1 Plan-Execute 로직 강화

#### 4.1.1 Planning Prompt 다변화

**현재**: `core/planning-llm.ts` - 단일 프롬프트

**목표**:
```
core/llm/prompts/
├── planning-simple.ts         # 단순 작업용
├── planning-complex.ts        # 복잡 작업용
├── planning-debugging.ts      # 디버깅용
├── planning-refactoring.ts    # 리팩토링용
└── prompt-selector.ts         # 자동 선택 로직
```

**TODO**:
- [ ] 작업 유형별 프롬프트 템플릿 작성
  - [ ] 단순 질문/대화 프롬프트
  - [ ] 파일 생성/수정 프롬프트
  - [ ] 버그 수정 프롬프트
  - [ ] 리팩토링 프롬프트
  - [ ] 테스트 작성 프롬프트
- [ ] 프롬프트 자동 선택 로직 구현
- [ ] 작업 복잡도 분석기 구현
- [ ] A/B 테스트 프레임워크 구현

#### 4.1.2 Auto Mode LLM 개입

**현재**: 키워드 기반 단순 분류

**목표**:
```typescript
// 요구사항
interface AutoModeClassifier {
  analyzeRequest(request: string): Promise<{
    complexity: 'simple' | 'moderate' | 'complex';
    suggestedMode: 'no-planning' | 'planning';
    confidence: number;
    reasoning: string;
  }>;
}
```

**TODO**:
- [ ] LLM 기반 요청 분류기 구현
- [ ] 복잡도 점수 계산 로직
- [ ] 신뢰도 기반 모드 선택
- [ ] 사용자 피드백 학습 (선택적)

#### 4.1.3 에러 복구 로직 강화

**TODO**:
- [ ] 실패한 단계 재시도 로직 개선
- [ ] 부분 성공 상태 저장/복원
- [ ] 롤백 메커니즘 구현
- [ ] 에러 분석 및 자동 수정 제안

### 4.2 Native Tool 증가

#### 4.2.1 Bash Tool 구현

**신규 파일**: `tools/native/bash-tool.ts`

**기능 요구사항**:
- [ ] 안전한 명령어 실행 (샌드박싱)
- [ ] 작업 디렉토리 관리
- [ ] 타임아웃 처리
- [ ] 출력 스트리밍
- [ ] 위험 명령어 필터링

**세부 TODO**:
- [ ] `BashTool` 클래스 구현
- [ ] 명령어 화이트리스트/블랙리스트
- [ ] 환경 변수 관리
- [ ] 파이프/리다이렉션 지원
- [ ] 인터랙티브 명령어 처리

#### 4.2.2 Git Tool 구현

**신규 파일**: `tools/native/git-tool.ts`

**기능 요구사항**:
- [ ] git status, diff, log
- [ ] git add, commit, push
- [ ] git branch, checkout, merge
- [ ] 충돌 감지 및 해결 지원

**세부 TODO**:
- [ ] `GitTool` 클래스 구현
- [ ] 각 Git 명령어 래퍼
- [ ] 커밋 메시지 자동 생성
- [ ] PR 생성 지원
- [ ] 충돌 해결 UI 연동

#### 4.2.3 NPM Tool 구현

**신규 파일**: `tools/native/npm-tool.ts`

**기능 요구사항**:
- [ ] npm install, uninstall
- [ ] npm run scripts
- [ ] package.json 분석
- [ ] 의존성 업데이트

**세부 TODO**:
- [ ] `NpmTool` 클래스 구현
- [ ] package.json 파서
- [ ] 스크립트 실행기
- [ ] 의존성 버전 관리

#### 4.2.4 Search Tool 구현

**신규 파일**: `tools/native/search-tool.ts`

**기능 요구사항**:
- [ ] 코드 검색 (grep 스타일)
- [ ] 파일 검색 (glob 패턴)
- [ ] 심볼 검색
- [ ] 정규식 지원

**세부 TODO**:
- [ ] `SearchTool` 클래스 구현
- [ ] ripgrep 통합
- [ ] 결과 하이라이팅
- [ ] 컨텍스트 라인 표시

### 4.3 승인모드/자율모드 분기

#### 4.3.1 실행 모드 정의

**신규 타입**:
```typescript
type ExecutionMode =
  | 'supervised'      // 모든 작업 승인 필요
  | 'semi-autonomous' // 위험 작업만 승인
  | 'autonomous';     // 완전 자율 실행
```

**TODO**:
- [ ] `ExecutionMode` 타입 정의
- [ ] 모드별 승인 정책 구현
- [ ] `/settings`에 모드 선택 추가
- [ ] 모드 전환 시 경고 메시지

#### 4.3.2 위험도 기반 승인 로직

**현재**: `plan-and-execute/risk-analyzer.ts`

**확장 TODO**:
- [ ] 위험도 점수 세분화 (1-10 스케일)
- [ ] 작업 유형별 기본 위험도 설정
- [ ] 사용자 정의 위험도 규칙
- [ ] 위험 작업 미리보기 기능

### 4.4 UI/UX 개선

#### 4.4.1 진행 상태 표시 개선

**TODO**:
- [ ] 실시간 스트리밍 응답 표시
- [ ] 작업 진행률 표시 (프로그레스 바)
- [ ] 예상 완료 시간 표시
- [ ] 작업 취소 기능 개선

#### 4.4.2 입력 경험 개선

**TODO**:
- [ ] 멀티라인 입력 지원
- [ ] 입력 히스토리 네비게이션
- [ ] 자동 완성 개선
- [ ] 문법 하이라이팅

#### 4.4.3 결과 표시 개선

**TODO**:
- [ ] 코드 블록 문법 하이라이팅
- [ ] diff 표시 개선
- [ ] 테이블 렌더링
- [ ] 이미지 미리보기 (터미널 지원 시)

### 4.5 LLM 다중 등록 ✅ 완료

#### 4.5.1 Endpoint Manager 구현 ✅

**파일**: `core/config/config-manager.ts` (ConfigManager에 통합)

**구현된 기능**:
```typescript
// ConfigManager 메서드
getAllEndpoints(): EndpointConfig[]
updateEndpoint(id: string, updates: Partial<EndpointConfig>): Promise<void>
deleteEndpoint(id: string): Promise<void>
setCurrentEndpoint(id: string): Promise<void>
setCurrentModel(id: string): Promise<void>
updateModelHealth(endpointId: string, modelId: string, status: HealthStatus): Promise<void>
updateAllHealthStatus(healthResults: Map<...>): Promise<void>
getHealthyModels(): { endpoint: EndpointConfig; model: ModelInfo }[]
getAllModels(): { endpoint: EndpointConfig; model: ModelInfo; isCurrent: boolean }[]
```

**완료된 TODO**:
- [x] 엔드포인트 CRUD 기능 (ConfigManager에 통합)
- [x] 헬스 체크 로직 (LLMClient.healthCheckAll())
- [x] Health 상태 저장 및 관리

#### 4.5.2 모델 라우팅

**TODO** (미래 작업):
- [ ] 작업 유형별 모델 매핑
- [ ] 비용 기반 라우팅
- [ ] 속도 기반 라우팅
- [ ] 로드 밸런싱
- [ ] 자동 장애 복구 (failover)

#### 4.5.3 Settings UI 확장 ✅

**완료된 TODO**:
- [x] `/settings > 2. LLMs` 메뉴 추가
- [x] 엔드포인트 추가/수정/삭제 UI (방향키 + Enter 네비게이션)
- [x] 연결 테스트 기능
- [x] Health Check 표시 (✓ healthy, ⚠ degraded, ✗ unhealthy)
- [x] 기본 엔드포인트/모델 설정

#### 4.5.4 추가 구현 사항 ✅

**LLMSetupWizard** (`src/ui/components/LLMSetupWizard.tsx`):
- [x] 첫 실행 시 LLM 미등록 감지 → 자동 설정 마법사
- [x] 엔드포인트 정보 입력 폼
- [x] 연결 테스트 후 저장

**ModelSelector** (`src/ui/components/ModelSelector.tsx`):
- [x] `/model` 슬래시 명령어
- [x] Healthy 모델만 선택 가능
- [x] 현재 모델 표시

**CLI 정리**:
- [x] `config` CLI 명령어 제거 (UI로 이전)

### 4.6 Agent Tool 추가

#### 4.6.1 Search Agent

**신규 파일**: `agents/search-agent.ts`

**기능 요구사항**:
- [ ] 코드베이스 전체 검색
- [ ] 시맨틱 검색 (의미 기반)
- [ ] 파일 패턴 검색
- [ ] 심볼 정의 검색

**TODO**:
- [ ] `SearchAgent` 클래스 구현
- [ ] 검색 전략 인터페이스
- [ ] 결과 랭킹 알고리즘
- [ ] 캐싱 메커니즘

#### 4.6.2 Explore Agent

**신규 파일**: `agents/explore-agent.ts`

**기능 요구사항**:
- [ ] 프로젝트 구조 분석
- [ ] 의존성 그래프 생성
- [ ] 코드 복잡도 분석
- [ ] 핫스팟 식별

**TODO**:
- [ ] `ExploreAgent` 클래스 구현
- [ ] AST 기반 코드 분석
- [ ] 의존성 트래킹
- [ ] 시각화 출력

#### 4.6.3 Agent Registry

**신규 파일**: `agents/agent-registry.ts`

**TODO**:
- [ ] `AgentRegistry` 클래스 구현
- [ ] 에이전트 등록/조회
- [ ] 에이전트 체이닝 지원
- [ ] 결과 집계

---

## 5. Phase 2: 확장 기능 구현

> **목표**: 고급 기능 추가

### 5.1 Scripts 내재화 및 확장

#### 5.1.1 Docs Downloader 내재화

**현재**: `scripts/download-*-docs.ts` (외부 스크립트)

**목표**: `/docs download <framework>` 명령어로 통합

**신규 파일**: `core/knowledge/docs-downloader.ts`

**TODO**:
- [ ] `DocsDownloader` 클래스 구현
- [ ] 지원 프레임워크 레지스트리
  - [ ] ADK (Agent Development Kit)
  - [ ] AGNO
  - [ ] React, Vue, Angular
  - [ ] Node.js, Express
  - [ ] Python, FastAPI
- [ ] 문서 버전 관리
- [ ] 증분 업데이트
- [ ] 오프라인 캐싱

#### 5.1.2 Slash Command 추가

**TODO**:
- [ ] `/docs download <framework>` - 문서 다운로드
- [ ] `/docs list` - 다운로드된 문서 목록
- [ ] `/docs search <query>` - 문서 검색
- [ ] `/docs update` - 문서 업데이트

### 5.2 Tool RAG 제공

#### 5.2.1 Tool Embedder

**신규 파일**: `tools/rag/tool-embedder.ts`

**TODO**:
- [ ] 도구 설명 임베딩 생성
- [ ] 사용 예시 임베딩
- [ ] 파라미터 설명 임베딩

#### 5.2.2 Tool Retriever

**신규 파일**: `tools/rag/tool-retriever.ts`

**TODO**:
- [ ] 사용자 요청 기반 도구 검색
- [ ] 유사도 기반 랭킹
- [ ] 컨텍스트 기반 필터링

#### 5.2.3 Tool Selector

**신규 파일**: `tools/rag/tool-selector.ts`

```typescript
// 요구사항
interface ToolSelector {
  selectTools(
    userRequest: string,
    context: ExecutionContext,
    maxTools?: number
  ): Promise<ToolDefinition[]>;
}
```

**TODO**:
- [ ] `ToolSelector` 구현
- [ ] 요청-도구 매핑 로직
- [ ] 도구 조합 최적화
- [ ] 불필요한 도구 제외

### 5.3 사용량 추적

#### 5.3.1 Usage Tracker

**신규 폴더**: `src/analytics/`

**신규 파일**: `analytics/usage-tracker.ts`

```typescript
// 요구사항
interface UsageTracker {
  trackTokens(model: string, input: number, output: number): void;
  trackToolUsage(toolName: string, duration: number): void;
  trackSession(sessionId: string, duration: number): void;
  getUsageReport(period: 'day' | 'week' | 'month'): UsageReport;
}
```

**TODO**:
- [ ] `UsageTracker` 클래스 구현
- [ ] 토큰 사용량 추적
- [ ] 도구 사용 통계
- [ ] 세션별 사용량

#### 5.3.2 Cost Calculator

**신규 파일**: `analytics/cost-calculator.ts`

**TODO**:
- [ ] 모델별 가격 정보 관리
- [ ] 비용 계산 로직
- [ ] 예산 경고 시스템
- [ ] 비용 최적화 제안

#### 5.3.3 Usage Reporter

**신규 파일**: `analytics/usage-reporter.ts`

**TODO**:
- [ ] 일별/주별/월별 리포트
- [ ] 차트 생성 (터미널)
- [ ] CSV/JSON 내보내기
- [ ] `/usage` 명령어 구현

### 5.4 MCP 등록 기능

#### 5.4.1 MCP Client

**신규 폴더**: `src/mcp/`

**신규 파일**: `mcp/mcp-client.ts`

```typescript
// 요구사항
interface MCPClient {
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  listResources(): Promise<MCPResource[]>;
  executeTool(name: string, params: any): Promise<any>;
  readResource(uri: string): Promise<any>;
}
```

**TODO**:
- [ ] MCP 프로토콜 구현
- [ ] 서버 연결 관리
- [ ] 도구/리소스 조회
- [ ] 요청/응답 처리

#### 5.4.2 MCP Tool Wrapper

**신규 파일**: `mcp/mcp-tool-wrapper.ts`

**TODO**:
- [ ] MCP 도구 → 내부 도구 변환
- [ ] 파라미터 매핑
- [ ] 결과 변환

#### 5.4.3 MCP Resource Manager

**신규 파일**: `mcp/mcp-resource-manager.ts`

**TODO**:
- [ ] 리소스 캐싱
- [ ] 리소스 구독
- [ ] 변경 알림

#### 5.4.4 Settings UI 확장

**TODO**:
- [ ] `/settings > 3. MCP Servers` 메뉴 추가
- [ ] 서버 추가/수정/삭제 UI
- [ ] 연결 상태 표시
- [ ] 도구/리소스 목록 표시

### 5.5 Local RAG 강화

#### 5.5.1 Vector Store 구현

**신규 폴더**: `src/rag/`

**신규 파일**: `rag/vector-store.ts`

**TODO**:
- [ ] 로컬 벡터 저장소 구현
- [ ] HNSW 인덱스 지원
- [ ] 증분 업데이트
- [ ] 메모리 최적화

#### 5.5.2 Embedder 개선

**신규 파일**: `rag/embedder.ts`

**TODO**:
- [ ] 로컬 임베딩 모델 지원
- [ ] 청크 전략 개선
- [ ] 메타데이터 임베딩
- [ ] 배치 처리

#### 5.5.3 Retriever 개선

**신규 파일**: `rag/retriever.ts`

**TODO**:
- [ ] 하이브리드 검색 (BM25 + 벡터)
- [ ] 리랭킹 지원
- [ ] 필터링 옵션
- [ ] 결과 다양성 보장

#### 5.5.4 RAG Pipeline

**신규 파일**: `rag/rag-pipeline.ts`

**TODO**:
- [ ] 전체 RAG 파이프라인 구현
- [ ] 쿼리 확장
- [ ] 결과 합성
- [ ] 출처 표시

---

## 6. Phase 3: 고급 기능 구현

> **목표**: 엔터프라이즈 기능 추가

### 6.1 코드 문서화 기능

#### 6.1.1 Code Analyzer

**신규 폴더**: `src/documentation/`

**신규 파일**: `documentation/code-analyzer.ts`

**TODO**:
- [ ] AST 기반 코드 분석
- [ ] 함수/클래스 추출
- [ ] 의존성 분석
- [ ] 복잡도 계산

#### 6.1.2 Doc Generator

**신규 파일**: `documentation/doc-generator.ts`

**TODO**:
- [ ] JSDoc/TSDoc 생성
- [ ] README 자동 생성
- [ ] API 문서 생성
- [ ] 다이어그램 생성 (Mermaid)

#### 6.1.3 Doc Indexer

**신규 파일**: `documentation/doc-indexer.ts`

**TODO**:
- [ ] 폴더/파일/내용 인덱싱
- [ ] 심볼 인덱스
- [ ] 검색 가능 문서 생성
- [ ] RAG 연동

#### 6.1.4 Slash Command 추가

**TODO**:
- [ ] `/document <path>` - 문서화 실행
- [ ] `/document --watch` - 변경 감지 모드
- [ ] `/document --format=md|html` - 출력 포맷

### 6.2 고급 Plan-Execute 기능

#### 6.2.1 병렬 실행 지원

**TODO**:
- [ ] 독립적 작업 병렬 실행
- [ ] 의존성 그래프 기반 스케줄링
- [ ] 리소스 제한 관리
- [ ] 결과 동기화

#### 6.2.2 체크포인트 시스템

**TODO**:
- [ ] 중간 상태 저장
- [ ] 실패 시 복구
- [ ] 재시작 지원
- [ ] 히스토리 관리

#### 6.2.3 학습 기반 최적화

**TODO**:
- [ ] 실행 패턴 분석
- [ ] 성공/실패 학습
- [ ] 자동 최적화 제안
- [ ] 사용자 피드백 반영

---

## 7. 우선순위 매트릭스

### 7.1 Impact vs Effort 매트릭스

```
                    High Impact
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
     │   Quick Wins     │   Major Projects │
     │                  │                  │
     │ • UI 컴포넌트 분할│ • MCP 통합       │
     │ • Native Tool    │ • RAG 강화       │
     │ • 승인모드 분기   │ • 코드 문서화    │
     │                  │                  │
Low ─┼──────────────────┼──────────────────┼─ High
Effort│                 │                  │  Effort
     │   Fill-Ins       │   Money Pits     │
     │                  │                  │
     │ • 사용량 추적    │ • 완전 자율 모드  │
     │ • Docs 내재화    │ • 학습 기반 최적화│
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │
                    Low Impact
```

### 7.2 구현 순서 권장

1. **즉시 시작** (Phase 0)
   - UI 컴포넌트 분할
   - Core 모듈 재구성
   - Tools 베이스 시스템

2. **1개월 내** (Phase 1 전반)
   - Native Tool 추가 (Bash, Git, Search)
   - 승인모드/자율모드 분기
   - Plan-Execute 로직 강화

3. **2개월 내** (Phase 1 후반)
   - LLM 다중 등록
   - Agent Tool 추가
   - UI/UX 개선

4. **3개월 내** (Phase 2)
   - MCP 등록 기능
   - Tool RAG 제공
   - Local RAG 강화

5. **4개월 내** (Phase 3)
   - 코드 문서화 기능
   - 사용량 추적
   - 고급 Plan-Execute 기능

---

## 부록

### A. 파일 생성 체크리스트

#### 신규 폴더
- [x] `src/core/llm/`
- [x] `src/core/config/`
- [x] `src/core/session/`
- [x] `src/core/knowledge/`
- [ ] `src/tools/base/`
- [ ] `src/tools/native/`
- [ ] `src/tools/rag/`
- [ ] `src/agents/`
- [ ] `src/mcp/`
- [ ] `src/rag/`
- [ ] `src/analytics/`
- [ ] `src/documentation/`
- [x] `src/ui/components/views/`
- [x] `src/ui/components/panels/`
- [x] `src/ui/components/dialogs/`
- [x] `src/ui/hooks/` (커스텀 훅 폴더)

#### 신규 파일 (주요)
- [ ] `tools/base/base-tool.ts`
- [ ] `tools/base/tool-registry.ts`
- [ ] `tools/native/bash-tool.ts`
- [ ] `tools/native/git-tool.ts`
- [ ] `tools/native/npm-tool.ts`
- [ ] `tools/native/search-tool.ts`
- [ ] `agents/search-agent.ts`
- [ ] `agents/explore-agent.ts`
- [ ] `mcp/mcp-client.ts`
- [ ] `rag/vector-store.ts`
- [ ] `analytics/usage-tracker.ts`
- [ ] `documentation/code-analyzer.ts`

### B. 테스트 요구사항

각 신규 모듈에 대해:
- [ ] 유닛 테스트 작성
- [ ] E2E 테스트 시나리오 추가
- [ ] 에러 케이스 테스트
- [ ] 성능 벤치마크

### C. 문서화 요구사항

각 Phase 완료 시:
- [ ] API 문서 업데이트
- [ ] 사용자 가이드 업데이트
- [ ] CHANGELOG 업데이트
- [ ] README 업데이트

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
