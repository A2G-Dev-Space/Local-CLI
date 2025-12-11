/**
 * Compact Prompts
 *
 * System prompt and user prompt builder for conversation compaction.
 * Implements dynamic context injection for TODOs, recent files, etc.
 */

import { Message, TodoItem } from '../../types/index.js';

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
 * System prompt for LLM to compress conversations
 */
export const COMPACT_SYSTEM_PROMPT = `# Role
You are a "Technical Context Compressor" for OPEN-CLI, an AI coding assistant. Your task is to compress a conversation into a minimal, high-density state representation that preserves ALL critical context for seamless continuation.

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
- [What failed] → [Why] → [Solution chosen]

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
      if (todo.description) {
        parts.push(`  Description: ${todo.description}`);
      }
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
 * Creates system message with summary and initial assistant response
 */
export function buildCompactedMessages(
  compactSummary: string,
  context: CompactContext
): Message[] {
  const systemContent = `# Session Resumed from Compact

${compactSummary}

---
*This is a compacted session. Previous conversation was compressed to save context.*
*Working Directory: ${context.workingDirectory || process.cwd()}*
`;

  return [
    {
      role: 'system',
      content: systemContent,
    },
    {
      role: 'assistant',
      content: '세션이 압축되었습니다. 이전 컨텍스트를 기반으로 계속 진행하겠습니다. 무엇을 도와드릴까요?',
    },
  ];
}
