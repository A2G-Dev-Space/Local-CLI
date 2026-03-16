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
          'Delegate a deep research task to the web search specialist agent. Performs comprehensive research across Google AND Naver simultaneously, visits actual source pages, cross-verifies facts, and returns a synthesized answer with citations. Use for any question requiring up-to-date information, fact-checking, comparisons, or multi-source research.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction describing what to research. Be specific about what information, facts, or data you need.',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      // Inject today's date for recency assessment
      const today = new Date().toISOString().split('T')[0];
      const rawInstruction = args['instruction'] as string;
      const instruction = `[Today's Date: ${today}]\n\n${rawInstruction}`;

      const agent = new BrowserSubAgent(
        llmClient,
        'search',
        BROWSER_SUB_AGENT_TOOLS,
        SEARCH_SYSTEM_PROMPT,
        { requiresAuth: false, serviceType: 'search', maxIterations: 30 }
      );
      return agent.run(instruction);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
