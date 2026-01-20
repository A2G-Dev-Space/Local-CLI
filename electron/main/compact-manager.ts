/**
 * Compact Manager for Electron
 * Compresses conversation history using LLM
 */

import { llmClient, Message } from './llm-client';
import { logger } from './logger';

// Compact system prompt
const COMPACT_SYSTEM_PROMPT = `# Role

You are a "Technical Context Compressor" for Local CLI, an AI coding assistant. Your task is to compress a conversation into a minimal, high-density state representation that preserves ALL critical context for seamless continuation.

# Objective

Reduce token usage by 70-90% while preserving 100% of:
- What the user is building and why
- All technical decisions made
- Current progress and blockers
- Files modified or created
- Constraints discovered (what failed and why)

# CRITICAL: Preserve These Exactly

1. **Active TODO Items**: Tasks in progress or pending - these MUST appear in output
2. **File Paths**: All file paths mentioned (created, modified, discussed)
3. **Error Patterns**: Errors encountered and their solutions
4. **User Preferences**: Coding style, language preferences, specific requirements

# DISCARD

- Greetings, thanks, confirmations ("Sure!", "Great!", "I'll help you")
- Redundant explanations of the same concept
- Failed code attempts (UNLESS they reveal constraints)
- Tool call details (keep only results)
- Intermediate reasoning steps

# Output Format

You MUST output valid markdown following this exact structure:

## Session Context

### Goal
[One sentence: What is the user building?]

### Status
[Current state: e.g., "Implementing compact feature, 3/5 tasks complete"]

### Key Decisions
- [Decision 1]: [Reason]
- [Decision 2]: [Reason]

### Constraints Learned
- [What failed] -> [Why] -> [Solution chosen]

### Files Modified
- \`path/to/file.ts\`: [What was done]

### Active Tasks
- [ ] [Task 1 - specific details]
- [x] [Task 2 - completed]
- [ ] [Task 3 - in progress]

### Technical Notes
[Critical code patterns, API details, or implementation notes to remember]

### Next Steps
1. [Immediate next action]
2. [Following action]

# Rules

- Maximum 2000 tokens output
- Use bullet points, not paragraphs
- Include specific file paths, function names, variable names
- If code is critical, include it; otherwise summarize intent
- NEVER use generic phrases like "discussed various options"
- Output in the same language as the conversation (Korean if Korean, English if English)
`;

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
 * Build user prompt for compact
 */
function buildCompactUserPrompt(messages: Message[], context: CompactContext): string {
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
function buildCompactedMessages(compactSummary: string, context: CompactContext): Message[] {
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
 * Execute conversation compaction
 */
export async function compactConversation(
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

    logger.info('Calling LLM for compaction', { promptLength: userPrompt.length });

    // Call LLM for compaction
    const response = await llmClient.sendMessage(userPrompt, COMPACT_SYSTEM_PROMPT);

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
