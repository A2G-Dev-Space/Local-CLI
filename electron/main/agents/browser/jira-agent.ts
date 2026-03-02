/**
 * Jira Request Tool (Electron)
 *
 * CLI parity: src/agents/browser/jira-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { BROWSER_SUB_AGENT_TOOLS } from '../../tools/browser/browser-tools';
import { BrowserSubAgent } from './browser-sub-agent';
import { JIRA_SYSTEM_PROMPT } from './prompts';

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
