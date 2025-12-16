/**
 * Eval Mode Types
 *
 * --eval 모드의 타입 정의
 */

/**
 * Eval 입력 스키마 (stdin JSON)
 */
export interface EvalInput {
  prompt: string;
  working_dir?: string;
}

/**
 * 이벤트 타입
 */
export type EvalEventType =
  | 'start'
  | 'todo'
  | 'tool_call'
  | 'tool_result'
  | 'response'
  | 'error'
  | 'end';

/**
 * 기본 이벤트 구조
 */
export interface EvalEventBase {
  event: EvalEventType;
  timestamp: string;
}

/**
 * 시작 이벤트
 */
export interface EvalStartEvent extends EvalEventBase {
  event: 'start';
  data: {
    prompt: string;
    model: string;
    endpoint: string;
    working_dir: string;
  };
}

/**
 * TODO 이벤트
 */
export interface EvalTodoEvent extends EvalEventBase {
  event: 'todo';
  data: {
    action: 'created' | 'started' | 'completed' | 'failed';
    id: string;
    title: string;
    status?: string;
  };
}

/**
 * Tool Call 이벤트
 */
export interface EvalToolCallEvent extends EvalEventBase {
  event: 'tool_call';
  data: {
    tool: string;
    args: Record<string, unknown>;
  };
}

/**
 * Tool Result 이벤트
 */
export interface EvalToolResultEvent extends EvalEventBase {
  event: 'tool_result';
  data: {
    tool: string;
    success: boolean;
    result?: string;
    error?: string;
  };
}

/**
 * Response 이벤트 (최종 응답)
 */
export interface EvalResponseEvent extends EvalEventBase {
  event: 'response';
  data: {
    content: string;
  };
}

/**
 * Error 이벤트
 */
export interface EvalErrorEvent extends EvalEventBase {
  event: 'error';
  data: {
    message: string;
    code?: string;
  };
}

/**
 * 종료 이벤트
 */
export interface EvalEndEvent extends EvalEventBase {
  event: 'end';
  data: {
    success: boolean;
    duration_ms: number;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    todos?: {
      total: number;
      completed: number;
      failed: number;
    };
    tool_calls?: number;
    files_modified?: string[];
  };
}

/**
 * 모든 이벤트 타입
 */
export type EvalEvent =
  | EvalStartEvent
  | EvalTodoEvent
  | EvalToolCallEvent
  | EvalToolResultEvent
  | EvalResponseEvent
  | EvalErrorEvent
  | EvalEndEvent;
