/**
 * Confluence Work Request Tool
 *
 * LLMAgentTool: Execution LLM에게는 tool로 제공, 내부는 BrowserSubAgent로 동작.
 */

import { LLMAgentTool } from '../../tools/types.js';
import { BROWSER_SUB_AGENT_TOOLS } from '../../tools/browser/browser-tools.js';
import { BrowserSubAgent } from './browser-sub-agent.js';
import { CONFLUENCE_SYSTEM_PROMPT } from './prompts.js';

export function createConfluenceRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'confluence_request',
        description:
          'Delegate a task to the Confluence specialist agent. Capable of page creation/editing, search, comments, reading content, and all Confluence operations. Describe the desired task in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the Confluence task to perform',
            },
            source: {
              type: 'string',
              description: 'Confluence URL to use (specify a particular instance when multiple URLs are configured)',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new BrowserSubAgent(
        llmClient,
        'confluence',
        BROWSER_SUB_AGENT_TOOLS,
        CONFLUENCE_SYSTEM_PROMPT,
        { requiresAuth: true, serviceType: 'confluence' }
      );
      return agent.run(args['instruction'] as string, args['source'] as string | undefined);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
