/**
 * Background Sync
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
  // No-op: auto-sync not available
}

export function buildCompactHistory(messages: Message[]): string {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 200) : ''}`)
    .join('\n');
}
