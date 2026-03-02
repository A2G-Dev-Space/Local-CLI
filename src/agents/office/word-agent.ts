/**
 * Word Work Request Tool
 *
 * LLMAgentTool: Execution LLM에게는 tool로 제공, 내부는 Sub-Agent로 동작.
 */

import { LLMAgentTool } from '../../tools/types.js';
import { WORD_TOOLS } from '../../tools/office/word-tools.js';
import { SubAgent } from '../common/sub-agent.js';
import { WORD_SYSTEM_PROMPT } from './prompts.js';

export function createWordWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'word_work_request',
        description:
          'Delegate a task to the Microsoft Word specialist agent. Capable of document creation/editing, formatting, tables, images, headers/footers, bookmarks, PDF export, and all Word operations. Describe the desired task in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the Word task to perform',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(llmClient, 'word', WORD_TOOLS, WORD_SYSTEM_PROMPT, { maxIterations: 50 });
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
