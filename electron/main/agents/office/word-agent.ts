/**
 * Word Work Request Tool
 *
 * CLI parity: src/agents/office/word-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { WORD_TOOLS } from '../../tools/office/word-tools';
import { OfficeSubAgent } from './office-sub-agent';
import { WORD_SYSTEM_PROMPT } from './prompts';

export function createWordWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'word_work_request',
        description:
          'Microsoft Word 전문 에이전트에게 작업을 요청합니다. 문서 생성/편집, 서식, 표, 이미지, 헤더/푸터, 북마크, PDF 내보내기 등 모든 Word 작업을 수행할 수 있습니다. 자연어로 원하는 작업을 지시하세요.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: '수행할 Word 작업에 대한 자연어 지시',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new OfficeSubAgent(llmClient, 'word', WORD_TOOLS, WORD_SYSTEM_PROMPT);
      return agent.run(args.instruction as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
