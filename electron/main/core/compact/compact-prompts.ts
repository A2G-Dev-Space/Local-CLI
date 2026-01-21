/**
 * Compact Prompts for Electron
 * Prompt templates for conversation compression
 */

import { COMPACT_SYSTEM_PROMPT } from '../../prompts/system/compact';
import type { Message } from '../llm/llm-client';

// =============================================================================
// Types
// =============================================================================

export interface CompactContext {
  workingDirectory?: string;
  currentModel?: string;
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Get compact system prompt
 */
export function getCompactSystemPrompt(): string {
  return COMPACT_SYSTEM_PROMPT;
}

/**
 * Build user prompt for compact
 */
export function buildCompactUserPrompt(messages: Message[], context: CompactContext): string {
  const parts: string[] = [];

  // 1. Current System State
  parts.push('# Current System State');
  parts.push(`Working Directory: ${context.workingDirectory || process.cwd()}`);
  if (context.currentModel) {
    parts.push(`Model: ${context.currentModel}`);
  }

  // 2. Conversation History
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

  // 3. Compression Instructions
  parts.push('');
  parts.push('# Instructions');
  parts.push('Compress the above conversation into the specified format.');
  parts.push('Focus on what matters for continuing the work.');

  return parts.join('\n');
}

/**
 * Build compacted messages from summary
 */
export function buildCompactedMessages(compactSummary: string, context: CompactContext): Message[] {
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
      content: 'Understood. I have the session context and will continue from here.',
    },
  ];
}

export default {
  getCompactSystemPrompt,
  buildCompactUserPrompt,
  buildCompactedMessages,
};
