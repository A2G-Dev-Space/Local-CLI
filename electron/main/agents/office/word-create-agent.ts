/**
 * Word Create Agent
 *
 * LLMAgentTool for creating NEW Word documents using high-level section builders.
 * Uses SubAgent architecture with Enhancement → Planning → Execution loop.
 *
 * Electron parity: src/agents/office/word-create-agent.ts
 */

import { LLMAgentTool } from '../../tools/types';
import { WORD_CREATE_TOOLS } from '../../tools/office/word-tools';
import { SubAgent } from '../common/sub-agent';
import {
  WORD_CREATE_SYSTEM_PROMPT,
  WORD_CREATE_PLANNING_PROMPT,
  WORD_CREATE_ENHANCEMENT_PROMPT,
} from './word-create-prompts';

export function createWordCreateRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'word_create_agent',
        description:
          'Autonomous Microsoft Word CREATION agent for building NEW documents from scratch. Uses high-level section builders to produce professional-quality documents with title page, table of contents, styled sections, tables, lists, and conclusions — all automatically. For editing EXISTING .docx files, use word_modify_agent instead.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description:
                'Detailed instruction for document creation. Include: topic/title, desired sections, any specific content requirements, and save path. The agent will autonomously create a professional document.',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(
        llmClient,
        'word-create',
        WORD_CREATE_TOOLS,
        WORD_CREATE_SYSTEM_PROMPT,
        {
          maxIterations: 82,
          planningPrompt: WORD_CREATE_PLANNING_PROMPT,
          enhancementPrompt: WORD_CREATE_ENHANCEMENT_PROMPT,
          minToolCallsBeforeComplete: 25,
        },
      );
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
