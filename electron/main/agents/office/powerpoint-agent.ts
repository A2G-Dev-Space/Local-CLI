/**
 * PowerPoint Work Request Tool
 *
 * CLI parity: src/agents/office/powerpoint-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { POWERPOINT_TOOLS } from '../../tools/office/powerpoint-tools';
import { SubAgent } from '../common/sub-agent';
import { POWERPOINT_SYSTEM_PROMPT } from './prompts';

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
