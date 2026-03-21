/**
 * Tool Executor
 *
 * LLM의 tool_calls 응답을 처리하여 안드로이드 도구를 실행하고
 * 결과를 메시지 히스토리에 추가하는 실행기.
 *
 * useChat 훅에 통합되어 자동으로 tool_calls를 처리.
 */

import type { Message, ToolCall, ToolDefinition } from '../types';
import { androidToolRegistry } from './registry';
import type { AndroidToolResult } from './types';
import { logger } from '../utils/logger';

export interface ToolExecutionResult {
  toolMessages: Message[];
  hasToolCalls: boolean;
}

/**
 * Get tool definitions for LLM request
 */
export function getToolDefinitions(): ToolDefinition[] {
  return androidToolRegistry.getToolDefinitions();
}

/**
 * Check if a message has tool calls
 */
export function hasToolCalls(message: Message): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

/**
 * Execute tool calls from an LLM response message
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  onToolStart?: (toolName: string, args: Record<string, unknown>) => void,
  onToolEnd?: (toolName: string, result: AndroidToolResult) => void,
): Promise<Message[]> {
  const toolMessages: Message[] = [];

  for (const toolCall of toolCalls) {
    const { id, function: func } = toolCall;
    const toolName = func.name;

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(func.arguments);
    } catch {
      logger.warn(`Failed to parse tool arguments for ${toolName}:`, func.arguments);
      toolMessages.push({
        role: 'tool',
        content: JSON.stringify({ success: false, error: 'Invalid tool arguments' }),
        tool_call_id: id,
      });
      continue;
    }

    logger.debug(`Executing tool: ${toolName}`, args);
    onToolStart?.(toolName, args);

    const result = await androidToolRegistry.executeTool(toolName, args);

    logger.debug(`Tool result for ${toolName}:`, result.success ? 'success' : result.error);
    onToolEnd?.(toolName, result);

    // Format result as tool message
    const content = result.error
      ? JSON.stringify({ success: false, error: result.error })
      : result.output;

    toolMessages.push({
      role: 'tool',
      content: content,
      tool_call_id: id,
    });
  }

  return toolMessages;
}

/**
 * Get a human-readable summary of a tool execution
 */
export function getToolSummary(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'browser_navigate':
      return `Navigating to ${args.url}`;
    case 'browser_click':
      return `Clicking ${args.selector || args.text}`;
    case 'browser_fill':
      return `Filling ${args.selector} with "${String(args.value).substring(0, 30)}"`;
    case 'browser_get_text':
      return `Getting text${args.selector ? ` from ${args.selector}` : ''}`;
    case 'browser_get_html':
      return `Getting HTML${args.selector ? ` from ${args.selector}` : ''}`;
    case 'browser_screenshot':
      return 'Taking screenshot';
    case 'browser_execute_script':
      return 'Executing JavaScript';
    case 'browser_wait':
      return args.selector ? `Waiting for ${args.selector}` : `Waiting ${args.timeout}ms`;
    case 'file_read':
      return `Reading ${args.path}`;
    case 'file_write':
      return `Writing ${args.path}`;
    case 'file_list':
      return `Listing ${args.path || '/'}`;
    case 'http_request':
      return `${args.method || 'GET'} ${args.url}`;
    case 'localhost_check':
      return `Checking localhost:${args.port}`;
    case 'localhost_scan':
      return 'Scanning local ports';
    case 'localhost_api_test':
      return `Testing :${args.port}${args.path}`;
    case 'localhost_browse':
      return `Opening localhost:${args.port}`;
    default:
      return `Running ${toolName}`;
  }
}
