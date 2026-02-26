/**
 * Complete Tool Definition
 *
 * Sub-Agent 전용 작업 완료 도구.
 * Execution LLM의 final_response와 동일한 역할.
 */

import { ToolDefinition } from '../../types/index.js';

export const COMPLETE_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'complete',
    description:
      '작업이 완료되었을 때 호출합니다. 수행한 작업의 요약을 반환합니다. 모든 작업을 마친 후 반드시 이 도구를 호출하세요.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '수행한 작업의 요약 (어떤 파일/문서에 무엇을 했는지)',
        },
      },
      required: ['summary'],
    },
  },
};
