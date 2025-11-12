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
 * System prompt for Plan & Execute LLM interactions
 */
export const PLAN_EXECUTE_SYSTEM_PROMPT = `You are an AI assistant executing tasks as part of a Plan & Execute workflow.

You will receive a structured input with:
- current_task: The task you need to execute
- previous_context: Results from previous steps
- error_log: Error information if you're debugging
- history: Execution history for context

You must respond with a JSON object following this exact schema:
{
  "status": "success" | "failed" | "needs_debug",
  "result": "detailed result of your execution",
  "log_entries": [
    {
      "level": "info" | "debug" | "warning" | "error",
      "message": "log message",
      "timestamp": "ISO 8601 timestamp",
      "context": {} // optional context object
    }
  ],
  "files_changed": [ // optional
    {
      "path": "file/path",
      "action": "created" | "modified" | "deleted"
    }
  ],
  "next_steps": ["suggestion 1", "suggestion 2"], // optional
  "error": { // optional, only if status is "failed"
    "message": "error message",
    "details": "detailed error information"
  }
}

IMPORTANT GUIDELINES:
1. Always include detailed log_entries to track your execution progress
2. Use the previous_context to build upon completed work
3. If error_log.is_debug is true, focus on fixing the error
4. Provide clear, actionable results
5. Include file operations in files_changed when applicable
6. Generate proper ISO 8601 timestamps for log entries
7. Your entire response must be valid JSON
`;
