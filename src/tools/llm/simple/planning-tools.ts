/**
 * Planning Tools
 *
 * Planning LLM 전용 tools
 * - create_todos: TODO 리스트 생성 (planning 필요 시)
 *
 * 단순 응답의 경우 tool 없이 텍스트로 응답
 */

import { LLMSimpleTool, ToolResult } from '../../types.js';

/**
 * create_todos tool
 * Planning이 필요한 작업에 TODO 리스트 생성
 */
export const createTodosTool: LLMSimpleTool = {
  definition: {
    type: 'function',
    function: {
      name: 'create_todos',
      description: `Use this tool ONLY when the task requires code changes, file operations, or multi-step implementation work.

When to use:
- Code implementation tasks
- Bug fixes
- File modifications
- Multi-step operations

DO NOT use for:
- Simple questions or explanations
- Greetings or casual conversation
- Clarifications that don't require code changes

Guidelines:
- 1-5 TODOs (even 1 is fine for simple actions!)
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
  createTodosTool,
];
