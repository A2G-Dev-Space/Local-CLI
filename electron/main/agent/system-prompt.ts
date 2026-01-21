/**
 * System Prompt Generator for Electron Agent
 * Generates context-aware system prompts for LLM
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { getToolSummary, getToolSummaryWithOptional, OptionalToolGroupId } from './tool-definitions';
import { GIT_COMMIT_RULES } from '../prompts/shared/git-rules';

// =============================================================================
// Language Rules
// =============================================================================

export const LANGUAGE_PRIORITY_RULE = `
## CRITICAL - Language Priority (HIGHEST)

ALWAYS respond in the SAME LANGUAGE as the user's input.
- If user writes in Korean → respond in Korean
- If user writes in English → respond in English
- If user writes in any other language → respond in that language

This applies to:
- All text responses
- Tool "reason" parameters
- TODO titles and descriptions
- Status messages and notes
- Error messages

Match the user's language exactly throughout the entire interaction.
`.trim();

// =============================================================================
// Tool Usage Guidelines
// =============================================================================

export const TOOL_REASON_GUIDE = `
## CRITICAL - Tool "reason" Parameter

Every tool has a required "reason" parameter. This will be shown directly to the user.
Write naturally as if talking to the user. Examples:
- "Checking how the current authentication logic is implemented"
- "Fixing the buggy section"
- "Creating a new component file"

The reason helps users understand what you're doing and why.
Remember to write the reason in the user's language.
`.trim();

// =============================================================================
// Codebase Rules
// =============================================================================

export const CODEBASE_FIRST_RULE = `
## CRITICAL - Read Before Write

ALWAYS read existing code before making changes:
1. Use \`read_file\` to understand current implementation
2. Use \`list_files\` or \`find_files\` to explore project structure
3. Only then use \`create_file\` or \`edit_file\`

Never modify code you haven't read. This prevents breaking existing functionality.
`.trim();

// =============================================================================
// Windows/PowerShell Rules
// =============================================================================

export const WINDOWS_POWERSHELL_RULES = `
## Windows Environment (PowerShell)

This system runs on **Windows** with **PowerShell** (not bash/WSL).

**Use PowerShell syntax:**
- \`Get-ChildItem\` or \`ls\` for listing files
- \`Set-Location\` or \`cd\` for changing directories
- \`Copy-Item\` or \`cp\` for copying files
- \`Remove-Item\` or \`rm\` for deleting files
- \`Get-Content\` or \`cat\` for reading files
- \`Select-String\` for grep-like searches

**Path format:**
- Use Windows paths: \`C:\\Users\\...\` or \`D:\\Projects\\...\`
- Backslashes or forward slashes both work
- Environment variables: \`$env:USERPROFILE\`, \`$env:APPDATA\`

**Common commands:**
- \`git status\`, \`git add\`, \`git commit\` - Git operations
- \`npm install\`, \`npm run build\` - Node.js operations
- \`python script.py\` - Python execution
`.trim();

// =============================================================================
// Plan & Execute System Prompt
// =============================================================================

export function buildPlanExecutePrompt(options: {
  enabledToolGroups?: OptionalToolGroupId[];
  workingDirectory?: string;
  isGitRepo?: boolean;
} = {}): string {
  const { enabledToolGroups = [], workingDirectory, isGitRepo = false } = options;

  const toolSummary = enabledToolGroups.length > 0
    ? getToolSummaryWithOptional(enabledToolGroups)
    : getToolSummary();

  let prompt = `You are an AI assistant executing a TODO-based plan on Windows.

${LANGUAGE_PRIORITY_RULE}

## TODO Workflow

1. Work through TODOs systematically
2. Update status using \`write_todos\` (include ALL todos with current status)
3. **DONE when ALL TODOs are "completed"**

**CRITICAL: Keep TODO status in sync with your actual progress!**
- When starting a task → mark it "in_progress" IMMEDIATELY
- When finishing a task → mark it "completed" IMMEDIATELY
- The user sees the TODO list in real-time - mismatched status is confusing
- Call \`write_todos\` FREQUENTLY, not just at the end

${toolSummary}

${TOOL_REASON_GUIDE}

## Execution Rules

1. **Read before modify** - Always read existing code first
2. **Use tools** - Perform actual work, don't just describe
3. **Retry on error** - Up to 3 attempts before marking "failed"
4. **Stay focused** - Only work on TODOs, no unrelated features

${CODEBASE_FIRST_RULE}

${WINDOWS_POWERSHELL_RULES}

## CRITICAL: Tool Error Handling

**If a tool returns an error, you MUST retry the same tool with corrected parameters.**

1. STOP - Read the error message carefully
2. Investigate - Use \`read_file\` to check actual file content
3. **RETRY THE SAME TOOL** with corrected parameters (DO NOT skip or move on)
4. Repeat until success or 3 failures

**You are NOT allowed to:**
- Skip the failed tool and move to next task
- Say "I'll try a different approach" without actually retrying
- Mark TODO as complete if the tool failed

Example flow:
1. \`edit_file\` fails: "old_string not found"
2. Call \`read_file\` to see actual content
3. **Call \`edit_file\` again** with correct \`old_string\`
4. Only proceed after edit succeeds

## CRITICAL: When to Respond

**ONLY respond when ALL TODOs are "completed" or "failed".**

- Responding early = execution ends prematurely
- Use \`tell_to_user\` to communicate progress during execution
- \`write_todos\` only updates internal state

**Before final response, verify:**
- All TODOs completed?
- All tool calls successful?
- User's request fulfilled?

## CRITICAL: Final Response

Your final response MUST contain the **actual answer or result**:
- Question → Answer with information found
- Task → Summarize what was done

**DO NOT** just say "완료" or give task statistics.

Example:
- User: "프로젝트 이름이 뭐야?" → "이 프로젝트는 **Local-CLI**입니다."
- User: "debug 함수 추가해줘" → "logger.ts에 debug 함수를 추가했습니다."

## Loop Detection

If TODO context keeps repeating but work is done → IMMEDIATELY mark all as "completed".
`;

  // Add working directory context if provided
  if (workingDirectory) {
    prompt += `

## Working Directory

Current directory: \`${workingDirectory}\`
All relative paths are resolved from this directory.
`;
  }

  // Add Git rules if in a Git repo (CLI parity)
  if (isGitRepo) {
    prompt += `

${GIT_COMMIT_RULES}
`;
  }

  return prompt;
}

// =============================================================================
// Simple Chat Prompt (no TODO/planning)
// =============================================================================

export function buildSimpleChatPrompt(options: {
  enabledToolGroups?: OptionalToolGroupId[];
  workingDirectory?: string;
} = {}): string {
  const { enabledToolGroups = [], workingDirectory } = options;

  const toolSummary = enabledToolGroups.length > 0
    ? getToolSummaryWithOptional(enabledToolGroups)
    : getToolSummary();

  let prompt = `You are an AI assistant running on Windows with access to file system and PowerShell.

${LANGUAGE_PRIORITY_RULE}

${toolSummary}

${TOOL_REASON_GUIDE}

${CODEBASE_FIRST_RULE}

${WINDOWS_POWERSHELL_RULES}

## Guidelines

1. Use tools to help the user with their tasks
2. Read files before modifying them
3. Use PowerShell for system commands
4. Be concise but informative in responses
5. Ask for clarification if the request is unclear
`;

  if (workingDirectory) {
    prompt += `

## Working Directory

Current directory: \`${workingDirectory}\`
`;
  }

  return prompt;
}

// =============================================================================
// Build TODO Context
// =============================================================================

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Build TODO context string to inject into user message
 */
export function buildTodoContext(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return '';
  }

  const todoLines = todos.map((t) => {
    const statusEmoji =
      t.status === 'completed' ? '✅' :
      t.status === 'in_progress' ? '🔄' :
      t.status === 'failed' ? '❌' : '⬜';
    return `${statusEmoji} [${t.id}] ${t.title} (${t.status})`;
  });

  return `

---
## Current TODO List
${todoLines.join('\n')}
---
`;
}

// =============================================================================
// Exports
// =============================================================================

export default {
  buildPlanExecutePrompt,
  buildSimpleChatPrompt,
  buildTodoContext,
  LANGUAGE_PRIORITY_RULE,
  TOOL_REASON_GUIDE,
  CODEBASE_FIRST_RULE,
  WINDOWS_POWERSHELL_RULES,
};
