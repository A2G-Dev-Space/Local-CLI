/**
 * Simple Tool Executor
 *
 * LLM Simple Tools의 실행 및 콜백 관리
 * file-tools.ts에서 분리된 모듈
 */

import { ToolResult, isLLMSimpleTool } from '../../types.js';

/**
 * Callback for tool execution events (reason display to user)
 */
type ToolExecutionCallback = (toolName: string, reason: string, args: Record<string, unknown>) => void;
let toolExecutionCallback: ToolExecutionCallback | null = null;

/**
 * Callback for tool response events
 */
type ToolResponseCallback = (toolName: string, success: boolean, result: string) => void;
let toolResponseCallback: ToolResponseCallback | null = null;

/**
 * Callback for plan created events
 */
type PlanCreatedCallback = (todoTitles: string[]) => void;
let planCreatedCallback: PlanCreatedCallback | null = null;

/**
 * Callback for todo start events
 */
type TodoStartCallback = (title: string) => void;
let todoStartCallback: TodoStartCallback | null = null;

/**
 * Callback for todo complete events
 */
type TodoCompleteCallback = (title: string) => void;
let todoCompleteCallback: TodoCompleteCallback | null = null;

/**
 * Callback for todo fail events
 */
type TodoFailCallback = (title: string) => void;
let todoFailCallback: TodoFailCallback | null = null;

/**
 * Callback for tool approval (Supervised Mode)
 * Returns: 'approve' | 'always' | { reject: true; comment: string }
 */
export type ToolApprovalResult = 'approve' | 'always' | { reject: true; comment: string };
type ToolApprovalCallback = (
  toolName: string,
  args: Record<string, unknown>,
  reason?: string
) => Promise<ToolApprovalResult>;
let toolApprovalCallback: ToolApprovalCallback | null = null;

/**
 * Callback for compact events
 */
type CompactCallback = (originalCount: number, newCount: number) => void;
let compactCallback: CompactCallback | null = null;

/**
 * Callback for assistant response events (final LLM response)
 */
type AssistantResponseCallback = (content: string) => void;
let assistantResponseCallback: AssistantResponseCallback | null = null;

/**
 * Callback for reasoning/thinking events (extended thinking from o1 models)
 */
type ReasoningCallback = (content: string, isStreaming: boolean) => void;
let reasoningCallback: ReasoningCallback | null = null;

// ============================================
// Callback Setters
// ============================================

export function setToolExecutionCallback(callback: ToolExecutionCallback | null): void {
  toolExecutionCallback = callback;
}

export function setToolResponseCallback(callback: ToolResponseCallback | null): void {
  toolResponseCallback = callback;
}

export function setPlanCreatedCallback(callback: PlanCreatedCallback | null): void {
  planCreatedCallback = callback;
}

export function setTodoStartCallback(callback: TodoStartCallback | null): void {
  todoStartCallback = callback;
}

export function setTodoCompleteCallback(callback: TodoCompleteCallback | null): void {
  todoCompleteCallback = callback;
}

export function setTodoFailCallback(callback: TodoFailCallback | null): void {
  todoFailCallback = callback;
}

export function setToolApprovalCallback(callback: ToolApprovalCallback | null): void {
  toolApprovalCallback = callback;
}

export function setCompactCallback(callback: CompactCallback | null): void {
  compactCallback = callback;
}

export function setAssistantResponseCallback(callback: AssistantResponseCallback | null): void {
  assistantResponseCallback = callback;
}

export function setReasoningCallback(callback: ReasoningCallback | null): void {
  reasoningCallback = callback;
}

// ============================================
// Callback Getters & Emitters
// ============================================

export function getToolExecutionCallback(): ToolExecutionCallback | null {
  return toolExecutionCallback;
}

export async function requestToolApproval(
  toolName: string,
  args: Record<string, unknown>,
  reason?: string
): Promise<ToolApprovalResult | null> {
  if (!toolApprovalCallback) {
    return null;
  }
  return toolApprovalCallback(toolName, args, reason);
}

export function emitPlanCreated(todoTitles: string[]): void {
  if (planCreatedCallback) {
    planCreatedCallback(todoTitles);
  }
}

export function emitTodoStart(title: string): void {
  if (todoStartCallback) {
    todoStartCallback(title);
  }
}

export function emitTodoComplete(title: string): void {
  if (todoCompleteCallback) {
    todoCompleteCallback(title);
  }
}

export function emitTodoFail(title: string): void {
  if (todoFailCallback) {
    todoFailCallback(title);
  }
}

export function emitCompact(originalCount: number, newCount: number): void {
  if (compactCallback) {
    compactCallback(originalCount, newCount);
  }
}

export function emitAssistantResponse(content: string): void {
  // Skip empty content to prevent blank lines in UI
  if (assistantResponseCallback && content && content.trim()) {
    assistantResponseCallback(content);
  }
}

export function emitReasoning(content: string, isStreaming: boolean = false): void {
  // Skip empty content to prevent blank lines in UI
  if (reasoningCallback && content && content.trim()) {
    reasoningCallback(content, isStreaming);
  }
}

// ============================================
// Tool Executor
// ============================================

/**
 * Execute a simple tool by name
 * Uses tool registry to find and execute tools
 */
export async function executeSimpleTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Dynamic import to avoid circular dependency
  const { toolRegistry } = await import('../../registry.js');
  const tool = toolRegistry.get(toolName);

  if (!tool || !isLLMSimpleTool(tool)) {
    return {
      success: false,
      error: `Unknown or not a simple tool: ${toolName}`,
    };
  }

  // Extract reason from args (not required for TODO tools)
  const reason = args['reason'] as string | undefined;

  // Call the callback to notify UI about tool execution (pass all args)
  // Skip for TODO tools which don't have reason parameter
  if (toolExecutionCallback && reason) {
    toolExecutionCallback(toolName, reason, args);
  }

  // Execute the tool
  const result = await tool.execute(args);

  // Call the response callback to notify UI about tool result
  // Skip response callback for TODO tools to avoid cluttering UI
  const isTodoTool = ['update_todos', 'get_todo_list'].includes(toolName);
  if (toolResponseCallback && !isTodoTool) {
    const resultText = result.success
      ? (result.result || '')
      : (result.error || 'Unknown error');
    toolResponseCallback(toolName, result.success, resultText);
  }

  return result;
}

/**
 * @deprecated Use executeSimpleTool instead
 */
export const executeFileTool = executeSimpleTool;
