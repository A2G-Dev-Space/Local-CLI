/**
 * E2E 테스트 타입 정의
 */

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  enabled: boolean;
  timeout?: number; // ms, default 30000
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  steps: TestStep[];
}

export type TestCategory =
  | 'file-tools'      // read_file, write_file, list_files, find_files
  | 'llm-client'      // chatCompletion, streaming
  | 'plan-execute'    // Plan & Execute 아키텍처
  | 'agent-loop'      // Gather → Act → Verify
  | 'hitl'            // Human-in-the-Loop 승인
  | 'local-rag'       // 문서 검색
  | 'session'         // 세션 저장/로드
  | 'config'          // 설정 관리
  | 'slash-commands'  // /exit, /clear, /mode 등
  | 'integration';    // 통합 테스트

export interface TestStep {
  name: string;
  action: TestAction;
  validation: TestValidation;
}

export type TestAction =
  | { type: 'llm_chat'; prompt: string; useTools?: boolean }
  | { type: 'llm_stream'; prompt: string }
  | { type: 'file_read'; path: string }
  | { type: 'file_write'; path: string; content: string }
  | { type: 'file_list'; directory: string }
  | { type: 'file_find'; pattern: string; directory?: string }
  | { type: 'plan_generate'; userRequest: string }
  | { type: 'plan_execute'; todos: any[] }
  | { type: 'agent_loop'; todo: any; maxIterations?: number }
  | { type: 'docs_search'; query: string; searchPath?: string }
  | { type: 'session_save'; sessionId?: string }
  | { type: 'session_load'; sessionId: string }
  | { type: 'session_list' }
  | { type: 'config_get'; key?: string }
  | { type: 'config_set'; key: string; value: any }
  | { type: 'custom'; fn: () => Promise<any> };

export type TestValidation =
  | { type: 'exists' }
  | { type: 'not_empty' }
  | { type: 'contains'; value: string }
  | { type: 'not_contains'; value: string }
  | { type: 'equals'; value: any }
  | { type: 'matches'; pattern: string }
  | { type: 'is_array'; minLength?: number }
  | { type: 'is_object'; hasKeys?: string[] }
  | { type: 'file_exists'; path: string }
  | { type: 'file_not_exists'; path: string }
  | { type: 'file_contains'; path: string; content: string }
  | { type: 'llm_response_valid' } // LLM 응답이 유효한지 (빈 문자열 아님, 에러 아님)
  | { type: 'todos_generated'; minCount?: number }
  | { type: 'custom'; fn: (result: any) => Promise<boolean> };

export interface TestResult {
  scenario: TestScenario;
  status: TestStatus;
  duration: number; // ms
  steps: StepResult[];
  error?: Error;
  startedAt: Date;
  finishedAt?: Date;
}

export interface StepResult {
  step: TestStep;
  status: TestStatus;
  duration: number;
  result?: any;
  error?: Error;
}

export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  results: TestResult[];
  startedAt: Date;
  finishedAt: Date;
}

export interface TestRunnerOptions {
  verbose?: boolean;       // 상세 로그 출력
  filter?: string;         // 특정 카테고리만 실행
  failFast?: boolean;      // 첫 실패 시 중단
  timeout?: number;        // 전역 타임아웃
  parallel?: boolean;      // 병렬 실행 (기본 false)
}
