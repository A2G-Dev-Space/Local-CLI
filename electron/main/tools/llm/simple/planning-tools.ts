/**
 * Planning Tools
 *
 * Planning LLM 전용 tools
 * - ask_to_user: 요구사항 명확화 (모호할 경우 먼저 사용)
 * - create_todos: TODO 리스트 생성 (action/implementation 필요 시)
 * - respond_to_user: 직접 응답 (단순 질문/대화)
 *
 * Planning LLM은 반드시 이 세 tool 중 하나를 선택해야 함
 *
 * CLI parity: src/tools/llm/simple/planning-tools.ts
 */

import type { LLMSimpleTool, ToolResult } from '../../types';

/**
 * ask_to_user tool (Planning LLM용)
 * 요구사항이 모호할 경우 사용자에게 질문하여 명확화
 */
export const askToUserPlanningTool: LLMSimpleTool = {
  definition: {
    type: 'function',
    function: {
      name: 'ask_to_user',
      description: `Use this tool BEFORE creating TODOs when the user's request is ambiguous or unclear.

**WHEN TO USE:**
- The request is vague (e.g., "add authentication" - what type?)
- Multiple approaches are possible and user preference matters
- Missing critical information (e.g., deployment target, tech stack)
- You need to understand the user's environment or constraints

**HOW TO USE:**
- Ask specific, focused questions
- Provide 2-4 clear, distinct options
- You can call this tool MULTIPLE TIMES to gather all necessary info
- It's better to ask and do it right than to guess and do it wrong

**IMPORTANT:**
- An "Other (custom input)" option is automatically added
- Write questions in the user's language
- After getting answers, proceed with create_todos`,
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'A specific question to clarify the requirement (in user language)',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of 2-4 clear options for the user to choose from',
            minItems: 2,
            maxItems: 4,
          },
        },
        required: ['question', 'options'],
      },
    },
  },
  // NOTE: 이 execute 함수는 PlanningLLM에서 직접 tool_call을 처리하므로 호출되지 않습니다.
  // 실제 ask_to_user 실행은 PlanningLLM에서 user-interaction-tools의 callback을 사용합니다.
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const question = args['question'] as string;
    const options = args['options'] as string[];
    return {
      success: true,
      result: JSON.stringify({ question, options }),
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
      description: `Use this tool for ANY task that requires ACTION - this is the PRIMARY tool for most requests.

When to use (almost everything!):
- Code work: implementation, bug fixes, refactoring, testing
- File operations: create, edit, organize, search files
- System tasks: run commands, install packages, build, deploy
- Document work: create/edit documents, spreadsheets, presentations
- Research tasks: search codebase, explore files, gather information
- Any task that requires the Execution Agent to DO something

DO NOT use ONLY for:
- Pure knowledge questions (e.g., "What is React?")
- Simple greetings (e.g., "Hello")

Guidelines:
- 1-5 TODOs (even 1 is fine for simple actions!)
- Actionable titles that clearly describe what to do
- Sequential order (execution order matters)
- Write titles in the user's language

When in doubt, USE THIS TOOL. The Execution Agent is powerful and can handle almost any task.`,
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
      description: `Use this tool ONLY for pure knowledge questions or greetings - NO actions involved.

When to use (very limited!):
- Pure knowledge questions (e.g., "What is a React hook?", "Explain async/await")
- Simple greetings (e.g., "Hello", "How are you?")
- General concept explanations from your training data

DO NOT use for (use create_todos instead!):
- ANY task that involves files, code, or commands
- Codebase exploration or file searching (use create_todos!)
- Questions that require reading actual files to answer
- Bug fixes, implementation, refactoring, testing
- Running commands or builds
- Document creation or editing

⚠️ If the user asks about THEIR project/codebase, use create_todos - you need to actually read files!

Guidelines:
- Write response in the user's language
- Keep it concise`,
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
  askToUserPlanningTool,
  createTodosTool,
  respondToUserTool,
];
