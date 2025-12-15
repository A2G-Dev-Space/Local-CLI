/**
 * Documentation Search Agent Tools
 *
 * Tool definitions for the docs search agent.
 */

import { ToolDefinition } from '../../types/index.js';

/**
 * Bash command tool definition for LLM
 */
export const RUN_BASH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_bash',
    description: 'Execute bash command to search and read documentation. Commands run in ~/.local-cli/docs directory.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Bash command to execute (e.g., find, grep, cat, ls, tree)',
        },
      },
      required: ['command'],
    },
  },
};

export default RUN_BASH_TOOL;
