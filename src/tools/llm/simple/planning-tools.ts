/**
 * Planning Tools
 *
 * Planning LLM 전용 tools
 * - create_todos: TODO 리스트 생성 (action/implementation 필요 시)
 * - respond_to_user: 직접 응답 (단순 질문/대화)
 *
 * Planning LLM은 반드시 이 두 tool 중 하나를 선택해야 함
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
  // NOTE: 이 execute 함수는 PlanningLLM에서 직접 tool_call을 처리하므로 호출되지 않습니다.
  // 오직 tool definition 제공을 위해 존재합니다.
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
 * respond_to_user tool
 * 단순 질문이나 대화에 직접 텍스트로 응답
 */
export const respondToUserTool: LLMSimpleTool = {
  definition: {
    type: 'function',
    function: {
      name: 'respond_to_user',
      description: `Use this tool when the user's request does NOT require any actions or code changes.

When to use:
- Pure knowledge questions (e.g., "What is a React hook?", "Explain async/await")
- Greetings or casual conversation (e.g., "Hello", "How are you?")
- Conceptual explanations that don't need code execution
- Questions about general programming concepts

DO NOT use for:
- ANY task that requires code changes, file operations, or command execution
- Bug fixes, implementation, refactoring, testing
- Exploring codebase or searching files
- Running commands or builds

Guidelines:
- Provide a clear, helpful response in the user's language
- Keep explanations concise but complete
- Use examples if helpful

IMPORTANT: Write your response in the user's language.`,
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
 * All Planning tools
 */
export const PLANNING_TOOLS: LLMSimpleTool[] = [
  createTodosTool,
  respondToUserTool,
];
