/**
 * Search Work Request Tool
 *
 * LLMAgentTool: Execution LLM에게는 tool로 제공, 내부는 BrowserSubAgent로 동작.
 * 인증 불필요 (항상 headless).
 */

import { LLMAgentTool } from '../../tools/types.js';
import { BROWSER_SUB_AGENT_TOOLS } from '../../tools/browser/browser-tools.js';
import { BrowserSubAgent } from './browser-sub-agent.js';
import { SEARCH_SYSTEM_PROMPT } from './prompts.js';

export function createSearchRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'search_request',
        description:
          'Delegate a task to the web search specialist agent. Searches Google, StackOverflow, Naver, etc. for information and collects results. Describe what to search for in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the search (can specify engine: "on Google", "on Naver", "on StackOverflow")',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new BrowserSubAgent(
        llmClient,
        'search',
        BROWSER_SUB_AGENT_TOOLS,
        SEARCH_SYSTEM_PROMPT,
        { requiresAuth: false, serviceType: 'search' }
      );
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
