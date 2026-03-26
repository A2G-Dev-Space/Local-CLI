/**
 * Confluence Edit/Create Request Tool
 *
 * LLMAgentTool: Edits or creates Confluence pages via visible browser.
 * Receives a specific Confluence page URL and performs modifications.
 * Search functionality is handled by the deep research agent instead.
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
          'Delegate a Confluence page edit or creation task to the specialist agent. Opens a visible browser to directly access Confluence and perform modifications. Handles macros, tables, markdown, rich text formatting, and all Confluence-specific content. Provide a specific page URL for editing, or a space URL for page creation.',
        parameters: {
          type: 'object',
          properties: {
            target_url: {
              type: 'string',
              description: 'Confluence page URL to edit, or space URL to create a new page in. Example: https://confluence.example.com/wiki/spaces/TEAM/pages/12345',
            },
            instruction: {
              type: 'string',
              description: 'Detailed instruction for what to edit or create. Include specific content changes, formatting requirements, macro usage, table modifications, etc.',
            },
          },
          required: ['target_url', 'instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const targetUrl = args['target_url'] as string;
      const instruction = args['instruction'] as string;

      const agent = new BrowserSubAgent(
        llmClient,
        'confluence',
        BROWSER_SUB_AGENT_TOOLS,
        CONFLUENCE_SYSTEM_PROMPT,
        {
          requiresAuth: true,
          serviceType: 'confluence',
          maxIterations: 30,
          headless: false,
        }
      );
      return agent.run(instruction, targetUrl);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
