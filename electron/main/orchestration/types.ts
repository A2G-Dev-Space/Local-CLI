/**
 * Orchestration Types
 *
 * Type definitions for the Plan & Execute pattern
 */

import type { Message } from '../core/llm';

// =============================================================================
// TODO Types
// =============================================================================

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  note?: string;
}

// =============================================================================
// Config Types
// =============================================================================

export interface ExecutorConfig {
  maxIterations?: number;
  workingDirectory?: string;
  isGitRepo?: boolean;
  enablePlanning?: boolean;
  resumeTodos?: boolean;
}

// =============================================================================
// Callback Types
// =============================================================================

export interface AskUserRequest {
  question: string;
  options: string[];
  reason?: string;
}

export interface AskUserResponse {
  selectedOption: string;
  isOther: boolean;
  customText?: string;
}

export interface ExecutorCallbacks {
  onMessage?: (message: Message) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string, success: boolean) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onTellUser?: (message: string) => void;
  onAskUser?: (request: AskUserRequest) => Promise<AskUserResponse>;
  onStreamChunk?: (chunk: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
  onContextWarning?: (usagePercent: number) => void;
}

// =============================================================================
// Result Types
// =============================================================================

export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
}

export interface ExecutionResult {
  success: boolean;
  response: string;
  messages: Message[];
  toolCalls: ToolCallRecord[];
  iterations: number;
  error?: string;
}

// =============================================================================
// State Types
// =============================================================================

export interface ExecutorState {
  isRunning: boolean;
  abortController: AbortController | null;
  currentTodos: TodoItem[];
  workingDirectory: string;
}
