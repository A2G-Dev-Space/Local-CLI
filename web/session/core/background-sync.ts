/**
 * Background Auto-Sync
 *
 * No-op for local-web: no ONCE/FREE/Dashboard services to sync with.
 * Function signatures preserved for plan-executor.ts compatibility.
 *
 * CLI parity: electron/main/core/background-sync.ts
 */

import type { LLMClient } from './llm/llm-client.js';
import type { TodoItem, Message } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

export interface AutoSyncResult {
  noteSaved?: { success: boolean; summary: string };
  workItemsAdded?: { success: boolean; count: number };
  workItemsUpdated?: { success: boolean; count: number };
  freeTodoCreated?: { success: boolean; count: number };
  freeTodoCompleted?: { success: boolean; count: number };
  loginRequired?: boolean;
  setupRequired?: { once?: boolean; free?: boolean };
}

export type AutoSyncNotifyCallback = (result: AutoSyncResult) => void;

// =============================================================================
// Compact History Builder (token-efficient)
// =============================================================================

/**
 * 최근 메시지에서 간결한 요약 추출 (토큰 절약용)
 * tool_calls는 이름+결과만, 전체 인자는 생략
 */
export function buildCompactHistory(messages: Message[], maxMessages = 8): string {
  const recent = messages.slice(-maxMessages);
  const lines: string[] = [];

  for (const msg of recent) {
    if (msg.role === 'system') continue;

    if (msg.role === 'user') {
      lines.push(`[USER]: ${msg.content.slice(0, 500)}`);
    } else if (msg.role === 'assistant') {
      if (msg.content) {
        lines.push(`[ASSISTANT]: ${msg.content.slice(0, 300)}`);
      }
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          lines.push(`[TOOL]: ${tc.function.name}`);
        }
      }
    } else if (msg.role === 'tool') {
      const summary = msg.content.length > 200
        ? msg.content.slice(0, 200) + '...'
        : msg.content;
      lines.push(`[RESULT]: ${summary}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Core: Background Auto-Sync Handler (no-op)
// =============================================================================

/**
 * TODO 완료 시 백그라운드에서 노트/보고/작업 자동 저장.
 * No-op for local-web.
 */
export async function handleTodoCompleteAutoSync(_params: {
  todoTitle: string;
  todoId: string;
  allTodos: TodoItem[];
  historyContext: string;
  userMessage: string;
  llmClient: LLMClient;
  toolsAlreadyCalled?: string[];
  notifyCallback: AutoSyncNotifyCallback;
}): Promise<void> {
  // No-op: local-web has no ONCE/FREE/Dashboard services
}

/**
 * AutoSyncResult를 한 줄 메시지로 포맷
 */
export function formatAutoSyncMessage(_result: AutoSyncResult): string {
  // No-op: local-web has no ONCE/FREE/Dashboard services
  return '';
}
