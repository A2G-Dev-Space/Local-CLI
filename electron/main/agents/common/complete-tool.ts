/**
 * Complete Tool Definition
 *
 * Shared completion tool for all sub-agents.
 * Equivalent to the main Execution LLM's final_response.
 *
 * CLI parity: src/agents/common/complete-tool.ts
 */

import type { ToolDefinition } from '../../core';

export const COMPLETE_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'complete',
    description:
      'Call when the task is complete. Returns a summary of the work performed. You MUST call this tool after finishing all tasks.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of the work performed (what was done to which file/document)',
        },
      },
      required: ['summary'],
    },
  },
};
