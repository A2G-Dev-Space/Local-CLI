/**
 * Search Request Tool (Electron)
 *
 * CLI parity: src/agents/browser/search-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { BROWSER_SUB_AGENT_TOOLS } from '../../tools/browser/browser-tools';
import { BrowserSubAgent } from './browser-sub-agent';
import { SEARCH_SYSTEM_PROMPT } from './prompts';

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
