/**
 * Word Modify Agent
 *
 * LLMAgentTool for EDITING existing Word documents using low-level tools.
 * For creating NEW documents, use word-create-agent.ts instead.
 *
 * CLI parity: electron/main/agents/office/word-agent.ts
 */

import { LLMAgentTool } from '../../tools/types.js';
import { WORD_TOOLS } from '../../tools/office/word-tools.js';
import { SubAgent } from '../common/sub-agent.js';
import { WORD_SYSTEM_PROMPT, WORD_PLANNING_PROMPT, WORD_ENHANCEMENT_PROMPT } from './prompts.js';

export function createWordModifyRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'word_modify_agent',
        description:
          'Autonomous Microsoft Word MODIFY agent for editing EXISTING .docx files. Has full access to low-level Word tools (text editing, formatting, tables, styles, track changes, etc.) for precise document modification. For creating NEW documents from scratch, use word_create_agent instead.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description:
                'Detailed instruction for modifying an existing Word document. Include: file path, what to change, specific formatting requirements. The agent will open the file and make precise modifications.',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(llmClient, 'word', WORD_TOOLS, WORD_SYSTEM_PROMPT, { maxIterations: 75, planningPrompt: WORD_PLANNING_PROMPT, enhancementPrompt: WORD_ENHANCEMENT_PROMPT });
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
