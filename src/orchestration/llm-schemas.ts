/**
 * LLM I/O Schemas for Plan and Execute Module
 *
 * Defines the structured input and output schemas for LLM interactions
 * in the Plan & Execute workflow.
 */

/**
 * Log entry from LLM execution
 */
export interface LogEntry {
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Input schema for LLM - provided before each execution step
 */
export interface PlanExecuteLLMInput {
  /** The current task/step being executed */
  current_task: {
    id: string;
    title: string;
    description: string;
    dependencies: string[];
  };

  /** Context and results from the previous step */
  previous_context: {
    /** Result from the last successfully executed step */
    last_step_result?: string;
    /** All completed tasks with their results */
    completed_tasks: Array<{
      id: string;
      title: string;
      result: string;
    }>;
  };

  /** Error information if this is a debug step */
  error_log: {
    /** Whether this is a debug/retry step */
    is_debug: boolean;
    /** Error message from previous execution */
    error_message?: string;
    /** Stack trace or detailed error info */
    error_details?: string;
    /** stderr output */
    stderr?: string;
  };

  /** Execution history for context */
  history: Array<{
    /** Step number in the plan */
    step: number;
    /** Task ID */
    task_id: string;
    /** Task title */
    task_title: string;
    /** Execution status */
    status: 'completed' | 'failed' | 'debug';
    /** Brief result summary */
    summary: string;
    /** Timestamp */
    timestamp: string;
  }>;
}

/**
 * Output schema from LLM - expected after each execution step
 */
export interface PlanExecuteLLMOutput {
  /** Execution status */
  status: 'success' | 'failed' | 'needs_debug';

  /** Main result/output of the task execution */
  result: string;

  /** Log entries generated during execution */
  log_entries: LogEntry[];

  /** Optional: files created or modified */
  files_changed?: Array<{
    path: string;
    action: 'created' | 'modified' | 'deleted';
  }>;

  /** Optional: next steps or suggestions */
  next_steps?: string[];

  /** Optional: error information if status is 'failed' */
  error?: {
    message: string;
    details?: string;
  };
}

/**
 * Validates the LLM output against the expected schema
 */
export function validateLLMOutput(output: any): {
  valid: boolean;
  errors: string[];
  parsed?: PlanExecuteLLMOutput;
} {
  const errors: string[] = [];

  // Check if output is an object
  if (typeof output !== 'object' || output === null) {
    return {
      valid: false,
      errors: ['Output must be a valid JSON object'],
    };
  }

  // Validate required fields
  if (!output.status) {
    errors.push('Missing required field: status');
  } else if (!['success', 'failed', 'needs_debug'].includes(output.status)) {
    errors.push(
      'Invalid status value. Must be one of: success, failed, needs_debug'
    );
  }

  if (!output.result && output.result !== '') {
    errors.push('Missing required field: result');
  }

  if (!Array.isArray(output.log_entries)) {
    errors.push('Missing or invalid field: log_entries (must be an array)');
  } else {
    // Validate each log entry
    output.log_entries.forEach((entry: any, index: number) => {
      if (!entry.level || !entry.message || !entry.timestamp) {
        errors.push(
          `Invalid log entry at index ${index}: missing level, message, or timestamp`
        );
      }
      if (
        entry.level &&
        !['debug', 'info', 'warning', 'error'].includes(entry.level)
      ) {
        errors.push(
          `Invalid log entry level at index ${index}: ${entry.level}`
        );
      }
    });
  }

  // Validate optional fields if present
  if (output.files_changed && !Array.isArray(output.files_changed)) {
    errors.push('files_changed must be an array');
  }

  if (output.next_steps && !Array.isArray(output.next_steps)) {
    errors.push('next_steps must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (output as PlanExecuteLLMOutput) : undefined,
  };
}

/**
 * Safely parses JSON response from LLM, handling malformed responses
 */
export function parseLLMResponse(response: string): {
  success: boolean;
  data?: PlanExecuteLLMOutput;
  error?: string;
} {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : response;

    const parsed = JSON.parse((jsonString || '').trim());
    const validation = validateLLMOutput(parsed);

    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid LLM output schema: ${validation.errors.join(', ')}`,
      };
    }

    return {
      success: true,
      data: validation.parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse LLM response as JSON: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Creates a formatted input for the LLM
 */
export function formatLLMInput(input: PlanExecuteLLMInput): string {
  return JSON.stringify(input, null, 2);
}

/**
 * Default system prompt for general chat interactions
 * Informs users about CLI's full development capabilities
 */
export const DEFAULT_SYSTEM_PROMPT = `You are OPEN-CLI, an AI-powered coding assistant running in a terminal environment.

**Important**: This CLI is a full-featured development tool, not just a chat interface.

**Your Capabilities**:
1. **Code Implementation**: You can create, read, write, and modify files directly
2. **Build & Test**: You can run build commands, execute tests, and verify code
3. **Project Analysis**: You can analyze project structure, dependencies, and codebase
4. **Multi-step Tasks**: Complex requests are automatically broken into TODO items and executed

**When users ask simple questions or seek advice**:
- If they want code, offer to create actual files and run builds/tests
- Remind them: "I can implement this directly. Should I create the files and run tests?"
- Don't just provide code snippets - offer to write real files

**Available Tools**:
- read_file: Read file contents
- create_file: Create a NEW file (fails if file exists)
- edit_file: Edit an EXISTING file by replacing specific lines (requires line_number, original_text, new_text)
- list_files: List directory contents
- find_files: Search for files by pattern

**File Modification Rules**:
- For NEW files: Use create_file
- For EXISTING files: First use read_file to see content, then use edit_file with exact line matches

**Response Guidelines**:
- Be concise and direct
- For implementation requests, use tools to create actual files
- After writing code, offer to run build/test commands
- Use Korean if the user writes in Korean

**⚠️ CRITICAL - UNDERSTAND CODEBASE FIRST**:
For ANY coding-related request, you MUST first understand the user's codebase in ./ directory:
- Use list_files to understand project structure
- Use read_file to examine existing code patterns, conventions, and dependencies
- NEVER assume or guess about existing code - always verify first
- Follow the existing code style, naming conventions, and architectural patterns
This prevents breaking existing functionality and ensures consistency.

**CRITICAL - Tool "reason" Parameter**:
Every tool has a required "reason" parameter. This will be shown directly to the user.
Write naturally as if talking to the user. Examples:
- "현재 인증 로직이 어떻게 구현되어 있는지 확인해볼게요"
- "버그가 있는 부분을 수정할게요"
- "새로운 컴포넌트 파일을 만들게요"
The reason helps users understand what you're doing and why.

Remember: You are a development tool that can DO things, not just EXPLAIN things.`;

/**
 * System prompt for Plan & Execute LLM interactions
 * Now with tool support for actual file operations
 */
export const PLAN_EXECUTE_SYSTEM_PROMPT = `You are an AI assistant executing tasks as part of a Plan & Execute workflow.

**Your Mission**: Execute the current task using available tools to make REAL changes.

## ⚠️ CRITICAL: TODO LIST MANAGEMENT (HIGHEST PRIORITY)

**The TODO list must ALWAYS accurately reflect your current progress.**

1. **update_todos tool**: Use this to batch update multiple TODO statuses at once
2. **Immediate updates**: Update TODO status the MOMENT it changes:
   - When starting a task → mark as "in_progress"
   - When finishing a task → mark as "completed"
   - When starting next task → batch update: complete previous + start new
3. **Never leave stale status**: If TODO shows "in_progress" but you moved on, UPDATE IT NOW

Example batch update when moving to next task:
\`\`\`json
{
  "updates": [
    {"todo_id": "1", "status": "completed", "note": "구현 완료"},
    {"todo_id": "2", "status": "in_progress"}
  ]
}
\`\`\`

## Available Tools

- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific lines
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **tell_to_user**: Send a status message directly to the user
- **update_todos**: Batch update multiple TODO statuses at once
- **get_todo_list**: Check current TODO list state

## Execution Rules

1. **ALWAYS update TODO status** before and after task execution
2. Use tools to perform actual work - don't just describe
3. Read files before editing to understand current state
4. Use create_file for new files, edit_file for existing files

## ⚠️ CRITICAL - UNDERSTAND CODEBASE FIRST

For ANY coding-related task, you MUST first understand the user's codebase in ./ directory:
- Use list_files to understand project structure
- Use read_file to examine existing code patterns, conventions, and dependencies
- NEVER assume or guess about existing code - always verify first
- Follow the existing code style, naming conventions, and architectural patterns
This prevents breaking existing functionality and ensures consistency.

## Tool "reason" Parameter

Every tool (except tell_to_user, update_todos, get_todo_list) has a required "reason" parameter.
Write naturally as if talking to the user:
- "현재 인증 로직이 어떻게 구현되어 있는지 확인해볼게요"
- "버그가 있는 부분을 수정할게요"

## tell_to_user for Status Updates

Use tell_to_user to communicate progress:
- At the START of a task: Tell them what you're about to do
- When you COMPLETE something: Confirm what was done

**Language**: Use Korean if the task description is in Korean, English otherwise.

Remember: TODO accuracy is your TOP PRIORITY. Update it immediately when status changes.
`;
