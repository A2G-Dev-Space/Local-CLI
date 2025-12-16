/**
 * Orchestration Types
 *
 * Plan & Execute 워크플로우의 타입 정의
 */

import { Message, TodoItem } from '../types/index.js';
import { LLMClient } from '../core/llm/llm-client.js';
import { CompactResult } from '../core/compact/index.js';

/**
 * 실행 단계
 */
export type ExecutionPhase = 'idle' | 'classifying' | 'planning' | 'executing' | 'compacting';

/**
 * Plan Execution 상태
 */
export interface PlanExecutionState {
  todos: TodoItem[];
  currentTodoId: string | undefined;
  executionPhase: ExecutionPhase;
  isInterrupted: boolean;
  currentActivity: string;
}

/**
 * Ask User 요청
 * - options: LLM이 제공하는 2-4개의 선택지
 * - "Other (직접 입력)" 옵션은 UI에서 자동 추가됨
 */
export interface AskUserRequest {
  question: string;
  options: string[];  // 2-4개의 선택지 (LLM이 결정)
}

/**
 * Ask User 응답
 */
export interface AskUserResponse {
  selectedOption: string;
  isOther: boolean;
  customText?: string;
}

/**
 * Ask User 상태
 */
export interface AskUserState {
  askUserRequest: AskUserRequest | null;
}

/**
 * 상태 업데이트 콜백
 */
export interface StateCallbacks {
  setTodos: (todos: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) => void;
  setCurrentTodoId: (id: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  setExecutionPhase: (phase: ExecutionPhase) => void;
  setIsInterrupted: (interrupted: boolean) => void;
  setCurrentActivity: (activity: string) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setAskUserRequest: (request: AskUserRequest | null) => void;
}

/**
 * 실행 컨텍스트
 */
export interface ExecutionContext {
  llmClient: LLMClient;
  messages: Message[];
  todos: TodoItem[];
  isInterruptedRef: { current: boolean };
  callbacks: StateCallbacks;
}

/**
 * 실행 결과
 */
export interface ExecutionResult {
  success: boolean;
  messages: Message[];
  error?: string;
}

/**
 * Plan Execution Actions 인터페이스
 */
export interface PlanExecutionActions {
  setTodos: (todos: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) => void;
  handleTodoUpdate: (todo: TodoItem) => void;
  handleAskUserResponse: (response: AskUserResponse) => void;
  handleInterrupt: () => 'paused' | 'stopped' | 'none';
  executeAutoMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  ) => Promise<void>;
  executePlanMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  ) => Promise<void>;
  resumeTodoExecution: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  ) => Promise<void>;
  executeDirectMode: (
    userMessage: string,
    llmClient: LLMClient,
    messages: Message[],
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  ) => Promise<void>;
  performCompact: (
    llmClient: LLMClient,
    messages: Message[],
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  ) => Promise<CompactResult>;
  shouldAutoCompact: () => boolean;
  getContextRemainingPercent: () => number;
  getContextUsageInfo: () => { tokens: number; percent: number };
}
