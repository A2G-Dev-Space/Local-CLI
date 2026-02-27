/**
 * Jira Work Request Tool
 *
 * LLMAgentTool: Execution LLM에게는 tool로 제공, 내부는 BrowserSubAgent로 동작.
 */

import { LLMAgentTool } from '../../tools/types.js';
import { BROWSER_SUB_AGENT_TOOLS } from '../../tools/browser/browser-tools.js';
import { BrowserSubAgent } from './browser-sub-agent.js';
import { JIRA_SYSTEM_PROMPT } from './prompts.js';

export function createJiraRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'jira_request',
        description:
          'Delegate a task to the Jira specialist agent. Capable of issue viewing/creation/editing, comments, status transitions, JQL search, and all Jira operations. Describe the desired task in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the Jira task to perform',
            },
            source: {
              type: 'string',
              description: 'Jira URL to use (specify a particular instance when multiple URLs are configured)',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new BrowserSubAgent(
        llmClient,
        'jira',
        BROWSER_SUB_AGENT_TOOLS,
        JIRA_SYSTEM_PROMPT,
        { requiresAuth: true, serviceType: 'jira' }
      );
      return agent.run(args['instruction'] as string, args['source'] as string | undefined);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
