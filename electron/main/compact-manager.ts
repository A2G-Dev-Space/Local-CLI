/**
 * Compact Manager for Electron
 * Compresses conversation history using LLM
 *
 * NOTE: Uses shared COMPACT_SYSTEM_PROMPT from prompts/system/compact.ts
 */

import { llmClient, Message } from './llm-client';
import { logger } from './logger';
import { COMPACT_SYSTEM_PROMPT } from './prompts/system/compact';

// Minimum messages required for compact
const MIN_MESSAGES_FOR_COMPACT = 5;

export interface CompactResult {
  success: boolean;
  originalMessageCount: number;
  newMessageCount: number;
  compactedSummary?: string;
  compactedMessages?: Message[];
  error?: string;
}

export interface CompactContext {
  workingDirectory?: string;
  currentModel?: string;
}

/**
 * Get compact system prompt (for external use)
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

/**
 * Execute conversation compaction (CLI parity - enhanced logging)
 */
export async function compactConversation(
  messages: Message[],
  context: CompactContext
): Promise<CompactResult> {
  logger.enter('compactConversation', {
    messageCount: messages.length,
    workingDirectory: context.workingDirectory,
  });

  // Validate minimum messages
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  if (nonSystemMessages.length < MIN_MESSAGES_FOR_COMPACT) {
    logger.flow('Compact skipped - not enough messages');
    logger.exit('compactConversation', { skipped: true });
    return {
      success: false,
      originalMessageCount: messages.length,
      newMessageCount: messages.length,
      error: `최소 ${MIN_MESSAGES_FOR_COMPACT}개 이상의 메시지가 필요합니다. (현재: ${nonSystemMessages.length}개)`,
    };
  }

  try {
    logger.flow('Building compact prompt');

    // Build the user prompt with context
    const userPrompt = buildCompactUserPrompt(messages, context);

    logger.vars({ promptLength: userPrompt.length, nonSystemCount: nonSystemMessages.length });

    // Call LLM for compaction
    logger.flow('Calling LLM for compaction');
    logger.startTimer('compact-llm');

    const response = await llmClient.sendMessage(userPrompt, COMPACT_SYSTEM_PROMPT);

    const elapsed = logger.endTimer('compact-llm');
    logger.debug('Compact LLM response received', { elapsed: `${elapsed}ms`, responseLength: response.length });

    // Validate response
    if (!response || response.trim().length === 0) {
      throw new Error('LLM returned empty response');
    }

    // Build compacted messages
    const compactedMessages = buildCompactedMessages(response, context);

    logger.flow('Compact completed successfully');
    logger.vars({
      originalCount: messages.length,
      newCount: compactedMessages.length,
      summaryLength: response.length,
    });

    logger.exit('compactConversation', { success: true });

    return {
      success: true,
      originalMessageCount: messages.length,
      newMessageCount: compactedMessages.length,
      compactedSummary: response,
      compactedMessages,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Compact failed', { error: errorMessage });
    logger.exit('compactConversation', { success: false, error: errorMessage });

    return {
      success: false,
      originalMessageCount: messages.length,
      newMessageCount: messages.length,
      error: `Compact 실패: ${errorMessage}`,
    };
  }
}

/**
 * Check if compact is possible
 */
export function canCompact(messages: Message[]): { canCompact: boolean; reason?: string } {
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  if (nonSystemMessages.length < MIN_MESSAGES_FOR_COMPACT) {
    return {
      canCompact: false,
      reason: `최소 ${MIN_MESSAGES_FOR_COMPACT}개 이상의 메시지가 필요합니다. (현재: ${nonSystemMessages.length}개)`,
    };
  }

  return { canCompact: true };
}
