/**
 * Excel Work Request Tool
 *
 * CLI parity: src/agents/office/excel-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { EXCEL_TOOLS } from '../../tools/office/excel-tools';
import { SubAgent } from '../common/sub-agent';
import { EXCEL_SYSTEM_PROMPT } from './prompts';

export function createExcelWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'excel_work_request',
        description:
          'Delegate a task to the Microsoft Excel specialist agent. Capable of workbook creation/editing, cell/range read/write, formulas, charts, conditional formatting, data validation, filtering/sorting, PDF export, and all Excel operations. Describe the desired task in natural language.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the Excel task to perform',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(llmClient, 'excel', EXCEL_TOOLS, EXCEL_SYSTEM_PROMPT, { maxIterations: 40 });
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
