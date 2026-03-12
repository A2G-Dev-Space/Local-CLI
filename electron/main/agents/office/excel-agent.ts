/**
 * Excel Modify Agent
 *
 * LLMAgentTool for EDITING existing Excel files using low-level tools.
 * For creating NEW spreadsheets, use excel-create-agent.ts instead.
 *
 * Electron parity: src/agents/office/excel-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { EXCEL_TOOLS } from '../../tools/office/excel-tools';
import { SubAgent } from '../common/sub-agent';
import { EXCEL_SYSTEM_PROMPT, EXCEL_PLANNING_PROMPT, EXCEL_ENHANCEMENT_PROMPT } from './prompts';

export function createExcelModifyRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'excel_modify_agent',
        description:
          'Autonomous Microsoft Excel MODIFY agent for editing EXISTING .xlsx files. Has full access to low-level Excel tools (cells, formulas, formatting, charts, pivot tables, etc.) for precise spreadsheet modification. For creating NEW spreadsheets from scratch, use excel_create_agent instead.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description:
                'Detailed instruction for modifying an existing Excel file. Include: file path, what to change, specific data or formatting requirements. The agent will open the file and make precise modifications.',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new SubAgent(llmClient, 'excel', EXCEL_TOOLS, EXCEL_SYSTEM_PROMPT, { maxIterations: 60, planningPrompt: EXCEL_PLANNING_PROMPT, enhancementPrompt: EXCEL_ENHANCEMENT_PROMPT });
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
