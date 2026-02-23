/**
 * Background Sync - Stub for local-cli-git (no ONCE/FREE integration)
 */

import type { Message } from '../core/llm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handleTodoCompleteAutoSync(_options: {
  todoTitle: string;
  todoId: string;
  allTodos: Array<{ id: string; title: string; status: string }>;
  historyContext: string;
  userMessage: string;
  llmClient: unknown;
  notifyCallback?: (result: unknown) => void;
}): Promise<void> {
  // No-op: ONCE/FREE auto-sync not available in local-cli-git
}

export function buildCompactHistory(messages: Message[]): string {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 200) : ''}`)
    .join('\n');
}
