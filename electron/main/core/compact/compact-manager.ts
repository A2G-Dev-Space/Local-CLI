/**
 * Compact Manager for Electron
 * Compresses conversation history using LLM
 */

import { logger } from '../../logger';
import type { Message } from '../llm/llm-client';
import {
  getCompactSystemPrompt,
  buildCompactUserPrompt,
  buildCompactedMessages,
  CompactContext,
} from './compact-prompts';

// =============================================================================
// Types
// =============================================================================

export interface CompactResult {
  success: boolean;
  originalMessageCount: number;
  newMessageCount: number;
  compactedSummary?: string;
  compactedMessages?: Message[];
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_MESSAGES_FOR_COMPACT = 5;

// =============================================================================
// Compact Manager Class
// =============================================================================

export class CompactManager {
  private llmClient: {
    sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string>;
  };

  constructor(llmClient: {
    sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string>;
  }) {
    this.llmClient = llmClient;
  }

  /**
   * Execute conversation compaction
   */
  async compact(
    messages: Message[],
    context: CompactContext
  ): Promise<CompactResult> {
    logger.info('Starting compact', { messageCount: messages.length });

    // Validate minimum messages
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    if (nonSystemMessages.length < MIN_MESSAGES_FOR_COMPACT) {
      return {
        success: false,
        originalMessageCount: messages.length,
        newMessageCount: messages.length,
        error: `최소 ${MIN_MESSAGES_FOR_COMPACT}개 이상의 메시지가 필요합니다. (현재: ${nonSystemMessages.length}개)`,
      };
    }

    try {
      // Build the user prompt with context
      const userPrompt = buildCompactUserPrompt(messages, context);
      const systemPrompt = getCompactSystemPrompt();

      logger.info('Calling LLM for compaction', { promptLength: userPrompt.length });

      // Call LLM for compaction
      const response = await this.llmClient.sendMessage(userPrompt, systemPrompt);

      // Validate response
      if (!response || response.trim().length === 0) {
        throw new Error('LLM returned empty response');
      }

      // Build compacted messages
      const compactedMessages = buildCompactedMessages(response, context);

      logger.info('Compact completed', {
        originalCount: messages.length,
        newCount: compactedMessages.length,
        summaryLength: response.length,
      });

      return {
        success: true,
        originalMessageCount: messages.length,
        newMessageCount: compactedMessages.length,
        compactedSummary: response,
        compactedMessages,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Compact failed', error);

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
  canCompact(messages: Message[]): { canCompact: boolean; reason?: string } {
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    if (nonSystemMessages.length < MIN_MESSAGES_FOR_COMPACT) {
      return {
        canCompact: false,
        reason: `최소 ${MIN_MESSAGES_FOR_COMPACT}개 이상의 메시지가 필요합니다. (현재: ${nonSystemMessages.length}개)`,
      };
    }

    return { canCompact: true };
  }
}

// =============================================================================
// Standalone Functions (for backwards compatibility)
// =============================================================================

/**
 * Execute conversation compaction (standalone)
 */
export async function compactConversation(
  messages: Message[],
  context: CompactContext,
  llmClient: { sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string> }
): Promise<CompactResult> {
  const manager = new CompactManager(llmClient);
  return manager.compact(messages, context);
}

/**
 * Check if compact is possible (standalone)
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

export default CompactManager;
