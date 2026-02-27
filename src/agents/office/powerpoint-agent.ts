/**
 * PowerPoint Work Request Tool
 *
 * LLMAgentTool: Execution LLM에게는 tool로 제공, 내부는 Sub-Agent로 동작.
 */

import { LLMAgentTool } from '../../tools/types.js';
import { POWERPOINT_TOOLS } from '../../tools/office/powerpoint-tools.js';
import { SubAgent } from '../common/sub-agent.js';
import { POWERPOINT_SYSTEM_PROMPT } from './prompts.js';

export function createPowerPointWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'powerpoint_work_request',
        description:
          'Delegate a task to the Microsoft PowerPoint specialist agent. Capable of presentation creation/editing, slide management, text/image/shape/table/chart insertion, animations, transitions, PDF export, and all PowerPoint operations. Describe the desired task in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the PowerPoint task to perform',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(
        llmClient,
        'powerpoint',
        POWERPOINT_TOOLS,
        POWERPOINT_SYSTEM_PROMPT,
        { maxIterations: 70 }
      );
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
