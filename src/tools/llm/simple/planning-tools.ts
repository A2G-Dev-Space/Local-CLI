/**
 * Planning Tools
 *
 * Planning LLM 전용 tools
 * - response_to_user: 단순 응답 (planning 불필요)
 * - create_todos: TODO 리스트 생성 (planning 필요)
 */

import { LLMSimpleTool, ToolResult } from '../../types.js';

/**
 * response_to_user tool
 * Planning 불필요한 단순 질문/응답에 사용
 */
export const responseToUserTool: LLMSimpleTool = {
  definition: {
    type: 'function',
    function: {
      name: 'response_to_user',
      description: `Use this tool when NO planning is needed - for simple questions or requests that can be answered directly.

When to use:
- Simple questions (e.g., "What is X?", "How does Y work?")
- Greetings or casual conversation
- Requests for explanations or clarifications
- Questions that don't require code changes or file operations

IMPORTANT: Write the response in the user's language.`,
      parameters: {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Your direct response to the user (in their language)',
          },
        },
        required: ['response'],
      },
    },
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const response = args['response'] as string;
    return {
      success: true,
      result: response,
    };
  },
  categories: ['llm-planning'],
};

/**
 * create_todos tool
 * Planning이 필요한 작업에 TODO 리스트 생성
 */
export const createTodosTool: LLMSimpleTool = {
  definition: {
    type: 'function',
    function: {
      name: 'create_todos',
      description: `Use this tool when planning IS needed - for tasks requiring code changes, file operations, or multi-step work.

When to use:
- Code implementation tasks
- Bug fixes
- File modifications
- Multi-step operations

Guidelines:
- 3-5 TODOs maximum
- Actionable titles that clearly describe what to do
- Sequential order (execution order)
- Include details in title

IMPORTANT: Write TODO titles in the user's language.`,
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'List of TODO items',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier (e.g., "1", "2", "3")',
                },
                title: {
                  type: 'string',
                  description: 'Clear, actionable task title (in user language)',
                },
              },
              required: ['id', 'title'],
            },
          },
          complexity: {
            type: 'string',
            enum: ['simple', 'moderate', 'complex'],
            description: 'Estimated complexity of the overall task',
          },
        },
        required: ['todos', 'complexity'],
      },
    },
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const todos = args['todos'] as Array<{ id: string; title: string }>;
    const complexity = args['complexity'] as string;
    return {
      success: true,
      result: JSON.stringify({ todos, complexity }),
    };
  },
  categories: ['llm-planning'],
};

/**
 * All Planning tools
 */
export const PLANNING_TOOLS: LLMSimpleTool[] = [
  responseToUserTool,
  createTodosTool,
];
