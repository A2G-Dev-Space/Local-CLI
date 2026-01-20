/**
 * Final Response Tool for Electron Agent
 *
 * LLM이 최종 응답을 전달할 때 사용하는 도구
 * - 모든 TODO가 완료되어야만 성공
 * - 미완료 TODO가 있으면 에러 반환 (종료 아님, LLM이 다시 시도)
 * - 성공 시 assistant message로 표시
 */

import type { ToolDefinition } from '../../../llm-client';
import type { LLMSimpleTool, ToolResult } from '../common/types';
import { CORE_CATEGORIES } from '../common/constants';
import type { TodoItem } from './index';

// =============================================================================
// Callbacks
// =============================================================================

export type GetTodosCallback = () => TodoItem[];
export type FinalResponseCallback = (message: string) => void;

let getTodosCallback: GetTodosCallback | null = null;
let finalResponseCallback: FinalResponseCallback | null = null;

export function setGetTodosCallback(callback: GetTodosCallback | null): void {
  getTodosCallback = callback;
}

export function setFinalResponseCallback(callback: FinalResponseCallback | null): void {
  finalResponseCallback = callback;
}

export function clearFinalResponseCallbacks(): void {
  getTodosCallback = null;
  finalResponseCallback = null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function areAllTodosCompleted(todos: TodoItem[]): boolean {
  if (todos.length === 0) return true;
  return todos.every(t => t.status === 'completed' || t.status === 'failed');
}

function getIncompleteTodosSummary(todos: TodoItem[]): string {
  const incomplete = todos.filter(t => t.status !== 'completed' && t.status !== 'failed');
  if (incomplete.length === 0) return '';

  const list = incomplete.map(t => `- [${t.status}] ${t.title}`).join('\n');
  return `Incomplete TODOs:\n${list}`;
}

// =============================================================================
// final_response Tool
// =============================================================================

const FINAL_RESPONSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'final_response',
    description: `Use this tool to deliver your final response to the user after completing all tasks.

IMPORTANT:
- You MUST complete all TODOs before calling this tool
- If any TODO is not completed, this tool will return an error
- After all tasks are done, use this tool to summarize what was accomplished

Example:
{
  "message": "I've completed all the requested tasks:\\n\\n1. Fixed the bug in the login form\\n2. Added input validation\\n3. Updated the tests\\n\\nAll changes have been committed."
}`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Your final response message to the user. Summarize what was accomplished.',
        },
      },
      required: ['message'],
    },
  },
};

async function executeFinalResponse(args: Record<string, unknown>): Promise<ToolResult> {
  const message = args['message'] as string;

  if (!message || typeof message !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: message is required',
    };
  }

  // Get current todos
  if (!getTodosCallback) {
    // If no callback, allow final response (might be in a context without todos)
    if (finalResponseCallback) {
      finalResponseCallback(message);
    }
    return {
      success: true,
      result: message,
      metadata: { isFinalResponse: true },
    };
  }

  const todos = getTodosCallback();

  // Check if all todos are completed
  if (!areAllTodosCompleted(todos)) {
    const incompleteSummary = getIncompleteTodosSummary(todos);

    return {
      success: false,
      error: `Cannot deliver final response: Please complete all TODOs first.\n\n${incompleteSummary}\n\nMark each TODO as "completed" or "failed" using write_todos before calling final_response.`,
    };
  }

  // All todos completed - deliver final response
  if (finalResponseCallback) {
    finalResponseCallback(message);
  }

  return {
    success: true,
    result: message,
    metadata: { isFinalResponse: true },
  };
}

export const finalResponseTool: LLMSimpleTool = {
  definition: FINAL_RESPONSE_DEFINITION,
  execute: executeFinalResponse,
  categories: CORE_CATEGORIES,
  description: 'Deliver final response to user (requires all TODOs completed)',
};

export const FINAL_RESPONSE_TOOLS: LLMSimpleTool[] = [finalResponseTool];
