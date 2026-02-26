/**
 * Excel Work Request Tool
 *
 * CLI parity: src/agents/office/excel-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { EXCEL_TOOLS } from '../../tools/office/excel-tools';
import { OfficeSubAgent } from './office-sub-agent';
import { EXCEL_SYSTEM_PROMPT } from './prompts';

export function createExcelWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'excel_work_request',
        description:
          'Microsoft Excel 전문 에이전트에게 작업을 요청합니다. 통합문서 생성/편집, 셀/범위 읽기/쓰기, 수식, 차트, 조건부 서식, 데이터 검증, 필터/정렬, PDF 내보내기 등 모든 Excel 작업을 수행할 수 있습니다. 자연어로 원하는 작업을 지시하세요.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: '수행할 Excel 작업에 대한 자연어 지시',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new OfficeSubAgent(llmClient, 'excel', EXCEL_TOOLS, EXCEL_SYSTEM_PROMPT);
      return agent.run(args.instruction as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
