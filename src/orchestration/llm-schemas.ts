/**
 * LLM I/O Schemas for Plan and Execute Module
 *
 * Defines the structured input and output schemas for LLM interactions
 * in the Plan & Execute workflow.
 */

// Re-export prompts from centralized location
export { DEFAULT_SYSTEM_PROMPT } from '../prompts/system/default.js';
export { PLAN_EXECUTE_SYSTEM_PROMPT } from '../prompts/system/plan-execute.js';

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

// Note: DEFAULT_SYSTEM_PROMPT and PLAN_EXECUTE_SYSTEM_PROMPT are now
// re-exported from src/prompts/ at the top of this file
