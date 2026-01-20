/**
 * Message Utilities for Electron Agent
 * Message validation, normalization, and cleanup
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { Message, ToolCall } from '../llm-client';
import { logger } from '../logger';

// =============================================================================
// Types
// =============================================================================

export interface NormalizedMessage extends Message {
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// =============================================================================
// Message Validation
// =============================================================================

/**
 * Validate and clean up tool messages
 * Removes orphaned tool results (tool results without matching tool calls)
 */
export function validateToolMessages(messages: Message[]): Message[] {
  logger.enter('validateToolMessages', { messageCount: messages.length });

  // Collect all tool_call_ids from assistant messages
  const validToolCallIds = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const toolCall of msg.tool_calls) {
        validToolCallIds.add(toolCall.id);
      }
    }
  }

  // Filter out orphaned tool results
  const validMessages = messages.filter((msg) => {
    // Keep non-tool messages
    if (msg.role !== 'tool') {
      return true;
    }

    // For tool messages, check if there's a matching tool call
    if (msg.tool_call_id && validToolCallIds.has(msg.tool_call_id)) {
      return true;
    }

    // Orphaned tool result - remove it
    logger.debug('Removing orphaned tool result', { tool_call_id: msg.tool_call_id });
    return false;
  });

  const removedCount = messages.length - validMessages.length;
  if (removedCount > 0) {
    logger.info('Removed orphaned tool messages', { removedCount });
  }

  logger.exit('validateToolMessages', { validCount: validMessages.length });
  return validMessages;
}

/**
 * Normalize messages for LLM API
 * Ensures all messages have proper structure
 */
export function normalizeMessages(messages: Message[]): NormalizedMessage[] {
  return messages.map((msg) => {
    const normalized: NormalizedMessage = {
      role: msg.role,
      content: msg.content || '',
    };

    // Preserve tool_calls for assistant messages
    if (msg.role === 'assistant' && msg.tool_calls) {
      normalized.tool_calls = msg.tool_calls;
    }

    // Preserve tool_call_id for tool messages
    if (msg.role === 'tool' && msg.tool_call_id) {
      normalized.tool_call_id = msg.tool_call_id;
    }

    return normalized;
  });
}

/**
 * Check if message history is valid for LLM API
 * Returns issues found (empty array if valid)
 */
export function checkMessageValidity(messages: Message[]): string[] {
  const issues: string[] = [];

  // Check for empty messages array
  if (messages.length === 0) {
    issues.push('Messages array is empty');
    return issues;
  }

  // Check for proper role sequence
  let lastRole: string | null = null;
  const toolCallIds = new Set<string>();
  const toolResultIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Check for valid role
    if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
      issues.push(`Invalid role "${msg.role}" at index ${i}`);
    }

    // System message should be first if present
    if (msg.role === 'system' && i > 0 && lastRole !== 'system') {
      issues.push(`System message at index ${i} is not at the beginning`);
    }

    // Tool message must follow an assistant message with tool_calls
    if (msg.role === 'tool') {
      if (lastRole !== 'assistant' && lastRole !== 'tool') {
        issues.push(`Tool message at index ${i} doesn't follow an assistant message`);
      }
      if (msg.tool_call_id) {
        toolResultIds.add(msg.tool_call_id);
      }
    }

    // Collect tool call IDs from assistant messages
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCallIds.add(tc.id);
      }
    }

    lastRole = msg.role;
  }

  // Check for unmatched tool results
  for (const resultId of toolResultIds) {
    if (!toolCallIds.has(resultId)) {
      issues.push(`Orphaned tool result with ID: ${resultId}`);
    }
  }

  return issues;
}

/**
 * Prepare messages for session storage
 * Filters out pending/incomplete tool results
 */
export function prepareMessagesForStorage(messages: Message[]): Message[] {
  // Only keep messages with content or valid tool_calls
  return messages.filter((msg) => {
    // Keep user and system messages
    if (msg.role === 'user' || msg.role === 'system') {
      return true;
    }

    // Keep assistant messages with content or tool_calls
    if (msg.role === 'assistant') {
      return !!(msg.content || msg.tool_calls);
    }

    // Keep tool messages with content and valid tool_call_id
    if (msg.role === 'tool') {
      return !!(msg.content && msg.tool_call_id);
    }

    return false;
  });
}

/**
 * Get message statistics
 */
export function getMessageStats(messages: Message[]): {
  total: number;
  byRole: Record<string, number>;
  toolCallCount: number;
  estimatedTokens: number;
} {
  const stats = {
    total: messages.length,
    byRole: {} as Record<string, number>,
    toolCallCount: 0,
    estimatedTokens: 0,
  };

  for (const msg of messages) {
    // Count by role
    stats.byRole[msg.role] = (stats.byRole[msg.role] || 0) + 1;

    // Count tool calls
    if (msg.tool_calls) {
      stats.toolCallCount += msg.tool_calls.length;
    }

    // Estimate tokens (rough: ~4 chars per token)
    if (msg.content) {
      stats.estimatedTokens += Math.ceil(msg.content.length / 4);
    }
  }

  return stats;
}

/**
 * Truncate old messages to stay within context limit
 * Keeps system message and recent messages
 */
export function truncateMessages(
  messages: Message[],
  maxMessages: number = 50,
  keepSystemMessage: boolean = true
): Message[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  const systemMessages = keepSystemMessage
    ? messages.filter((m) => m.role === 'system')
    : [];

  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  // Keep the most recent messages
  const recentMessages = nonSystemMessages.slice(-(maxMessages - systemMessages.length));

  logger.info('Truncated message history', {
    originalCount: messages.length,
    newCount: systemMessages.length + recentMessages.length,
  });

  return [...systemMessages, ...recentMessages];
}

export default {
  validateToolMessages,
  normalizeMessages,
  checkMessageValidity,
  prepareMessagesForStorage,
  getMessageStats,
  truncateMessages,
};
