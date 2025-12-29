/**
 * Compact Prompts
 *
 * System prompt and user prompt builder for conversation compaction.
 * Implements dynamic context injection for TODOs, recent files, etc.
 */

import { Message, TodoItem } from '../../types/index.js';

// Re-export COMPACT_SYSTEM_PROMPT from centralized location
export { COMPACT_SYSTEM_PROMPT } from '../../prompts/system/compact.js';

/**
 * Context to inject into compact prompt
 */
export interface CompactContext {
  /** Current TODO list from system state */
  todos?: TodoItem[];
  /** Current working directory */
  workingDirectory?: string;
  /** Current model name */
  currentModel?: string;
  /** Recently accessed files */
  recentFiles?: string[];
}

/**
 * Build user prompt with dynamic context injection
 */
export function buildCompactUserPrompt(
  messages: Message[],
  context: CompactContext
): string {
  const parts: string[] = [];

  // 1. Current System State
  parts.push('# Current System State');
  parts.push(`Working Directory: ${context.workingDirectory || process.cwd()}`);
  if (context.currentModel) {
    parts.push(`Model: ${context.currentModel}`);
  }

  // 2. Recent Files (if any)
  if (context.recentFiles && context.recentFiles.length > 0) {
    parts.push('');
    parts.push('Recent Files Accessed:');
    context.recentFiles.forEach(f => parts.push(`- \`${f}\``));
  }

  // 3. Current TODO List (MUST PRESERVE - injected from system state)
  if (context.todos && context.todos.length > 0) {
    parts.push('');
    parts.push('# Current TODO List (MUST PRESERVE)');
    context.todos.forEach(todo => {
      const statusIcon = todo.status === 'completed' ? 'x' :
                        todo.status === 'in_progress' ? '~' : ' ';
      const statusLabel = todo.status === 'in_progress' ? ' [IN PROGRESS]' :
                         todo.status === 'completed' ? ' [DONE]' : '';
      parts.push(`- [${statusIcon}] ${todo.title}${statusLabel}`);
      if (todo.result) {
        parts.push(`  Result: ${todo.result}`);
      }
    });
  }

  // 4. Conversation History
  parts.push('');
  parts.push('# Conversation History to Compress');
  parts.push('```');

  let messageIndex = 0;
  messages.forEach((msg) => {
    // Skip system messages
    if (msg.role === 'system') return;

    messageIndex++;
    const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);

    // Truncate very long messages (keep first 3000 chars)
    const truncated = content.length > 3000
      ? content.slice(0, 3000) + '\n... [truncated]'
      : content;

    parts.push(`[${messageIndex}] ${role}:`);
    parts.push(truncated);
    parts.push('');
  });

  parts.push('```');

  // 5. Compression Instructions
  parts.push('');
  parts.push('# Instructions');
  parts.push('Compress the above conversation into the specified format.');
  if (context.todos && context.todos.length > 0) {
    parts.push('CRITICAL: The TODO list above is the CURRENT state - preserve it exactly in your Active Tasks section.');
  }
  parts.push('Focus on what matters for continuing the work.');

  return parts.join('\n');
}

/**
 * Build messages array after compact
 * Creates user message with session context and assistant acknowledgment
 * Note: System prompt will be added by plan-executor when needed
 */
export function buildCompactedMessages(
  compactSummary: string,
  context: CompactContext
): Message[] {
  // Compact summary as user message (not system) to avoid multiple system messages
  const contextMessage = `[SESSION CONTEXT - Previous conversation was compacted]

${compactSummary}

---
Working Directory: ${context.workingDirectory || process.cwd()}
`;

  return [
    {
      role: 'user',
      content: contextMessage,
    },
    {
      role: 'assistant',
      content: 'Understood. I have the session context. Ready to continue.',
    },
  ];
}
