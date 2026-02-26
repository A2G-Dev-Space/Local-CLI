/**
 * PowerPoint Work Request Tool
 *
 * CLI parity: src/agents/office/powerpoint-agent.ts
 */

import type { LLMAgentTool } from '../../tools/types';
import { POWERPOINT_TOOLS } from '../../tools/office/powerpoint-tools';
import { OfficeSubAgent } from './office-sub-agent';
import { POWERPOINT_SYSTEM_PROMPT } from './prompts';

export function createPowerPointWorkRequestTool(): LLMAgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'powerpoint_work_request',
        description:
          'Microsoft PowerPoint 전문 에이전트에게 작업을 요청합니다. 프레젠테이션 생성/편집, 슬라이드 관리, 텍스트/이미지/도형/표/차트 삽입, 애니메이션, 전환효과, PDF 내보내기 등 모든 PowerPoint 작업을 수행할 수 있습니다. 자연어로 원하는 작업을 지시하세요.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: '수행할 PowerPoint 작업에 대한 자연어 지시',
            },
          },
          required: ['instruction'],
        },
      },
    },
    execute: async (args, llmClient) => {
      const agent = new OfficeSubAgent(
        llmClient,
        'powerpoint',
        POWERPOINT_TOOLS,
        POWERPOINT_SYSTEM_PROMPT
      );
      return agent.run(args['instruction'] as string);
    },
    categories: ['llm-agent'],
    requiresSubLLM: true,
  };
}
