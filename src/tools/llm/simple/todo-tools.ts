/**
 * TODO Management LLM Tools
 *
 * LLM이 TODO 리스트를 관리할 수 있는 도구
 */

import { LLMSimpleTool, ToolResult, ToolCategory } from '../../types.js';
import { ToolDefinition } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';

/**
 * TODO 상태 업데이트 콜백 타입
 */
export type TodoUpdateCallback = (
  todoId: string,
  status: 'in_progress' | 'completed' | 'failed',
  note?: string
) => Promise<boolean>;

/**
 * TODO 리스트 조회 콜백 타입
 */
export type TodoListCallback = () => Array<{
  id: string;
  title: string;
  description: string;
  status: string;
}>;

// Global callbacks - set by orchestrator
let todoUpdateCallback: TodoUpdateCallback | null = null;
let todoListCallback: TodoListCallback | null = null;

/**
 * Set the TODO update callback
 */
export function setTodoUpdateCallback(callback: TodoUpdateCallback): void {
  logger.flow('Setting TODO update callback');
  todoUpdateCallback = callback;
}

/**
 * Set the TODO list callback
 */
export function setTodoListCallback(callback: TodoListCallback): void {
  logger.flow('Setting TODO list callback');
  todoListCallback = callback;
}

/**
 * Clear TODO callbacks
 */
export function clearTodoCallbacks(): void {
  logger.flow('Clearing TODO callbacks');
  todoUpdateCallback = null;
  todoListCallback = null;
}

/**
 * update_todos Tool Definition (batch update)
 */
const UPDATE_TODOS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_todos',
    description: `Update multiple TODO items at once. Use this to batch update TODO statuses efficiently.

CRITICAL: TODO list must ALWAYS reflect your actual progress accurately.
- Update TODO status IMMEDIATELY when status changes
- Mark completed tasks right after finishing them
- Mark the next task as in_progress before starting

Example updates array:
[
  { "todo_id": "1", "status": "completed", "note": "파일 생성 완료" },
  { "todo_id": "2", "status": "in_progress" }
]`,
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          description: 'Array of TODO updates to apply',
          items: {
            type: 'object',
            properties: {
              todo_id: {
                type: 'string',
                description: 'The ID of the TODO item to update',
              },
              status: {
                type: 'string',
                enum: ['in_progress', 'completed', 'failed'],
                description: 'The new status',
              },
              note: {
                type: 'string',
                description: 'Optional note explaining the status change',
              },
            },
            required: ['todo_id', 'status'],
          },
        },
      },
      required: ['updates'],
    },
  },
};

/**
 * update_todos Tool Implementation (batch update)
 */
async function executeUpdateTodos(args: Record<string, unknown>): Promise<ToolResult> {
  logger.enter('executeUpdateTodos', args);

  const updates = args['updates'] as Array<{
    todo_id: string;
    status: 'in_progress' | 'completed' | 'failed';
    note?: string;
  }>;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    logger.warn('Missing or empty updates array');
    return {
      success: false,
      error: 'Missing required parameter: updates array is required and must not be empty',
    };
  }

  if (!todoUpdateCallback) {
    logger.warn('TODO update callback not set');
    return {
      success: false,
      error: 'TODO management is not available in current context',
    };
  }

  const results: string[] = [];
  const errors: string[] = [];

  for (const update of updates) {
    const { todo_id, status, note } = update;

    if (!todo_id || !status) {
      errors.push(`Invalid update: missing todo_id or status`);
      continue;
    }

    if (!['in_progress', 'completed', 'failed'].includes(status)) {
      errors.push(`Invalid status for ${todo_id}: ${status}`);
      continue;
    }

    try {
      logger.flow(`Updating TODO ${todo_id} to ${status}`);
      const success = await todoUpdateCallback(todo_id, status, note);

      if (success) {
        results.push(`✓ ${todo_id}: ${status}${note ? ` (${note})` : ''}`);
      } else {
        errors.push(`✗ ${todo_id}: update failed`);
      }
    } catch (error) {
      errors.push(`✗ ${todo_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const summary = [
    `Updated ${results.length}/${updates.length} TODOs`,
    results.length > 0 ? `\nSuccessful:\n${results.join('\n')}` : '',
    errors.length > 0 ? `\nFailed:\n${errors.join('\n')}` : '',
  ].filter(Boolean).join('');

  logger.exit('executeUpdateTodos', { successCount: results.length, errorCount: errors.length });

  return {
    success: errors.length === 0,
    result: summary,
    metadata: { successCount: results.length, errorCount: errors.length },
  };
}

/**
 * get-todo-list Tool Definition
 */
const GET_TODO_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_todo_list',
    description: `Get the current TODO list with all items and their statuses.

Use this tool to:
- Check the current state of all TODOs
- Find the next TODO to work on
- Review progress before updating status`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * get-todo-list Tool Implementation
 */
async function executeGetTodoList(_args: Record<string, unknown>): Promise<ToolResult> {
  logger.enter('executeGetTodoList');

  if (!todoListCallback) {
    logger.warn('TODO list callback not set');
    return {
      success: false,
      error: 'TODO management is not available in current context',
    };
  }

  try {
    const todos = todoListCallback();
    logger.vars({ name: 'todoCount', value: todos.length });

    const formattedList = todos.map(todo =>
      `- [${todo.status.toUpperCase()}] ${todo.id}: ${todo.title}\n  ${todo.description}`
    ).join('\n\n');

    const result = todos.length > 0
      ? `Current TODO List (${todos.length} items):\n\n${formattedList}`
      : 'No TODOs in the current list.';

    logger.exit('executeGetTodoList', { todoCount: todos.length });
    return {
      success: true,
      result,
      metadata: { todoCount: todos.length, todos },
    };
  } catch (error) {
    logger.error('Error getting TODO list', error as Error);
    return {
      success: false,
      error: `Error getting TODO list: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * LLM Simple Tool: update_todos (batch)
 */
export const UpdateTodosTool: LLMSimpleTool = {
  definition: UPDATE_TODOS_DEFINITION,
  execute: executeUpdateTodos,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Batch update TODO items',
};

/**
 * LLM Simple Tool: get_todo_list
 */
export const GetTodoListTool: LLMSimpleTool = {
  definition: GET_TODO_LIST_DEFINITION,
  execute: executeGetTodoList,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Get current TODO list',
};

/**
 * All TODO Tools
 */
export const TODO_TOOLS = [UpdateTodosTool, GetTodoListTool];

/**
 * Get TODO tool definitions for LLM
 */
export function getTodoToolDefinitions(): ToolDefinition[] {
  return TODO_TOOLS.map(tool => tool.definition);
}

export default TODO_TOOLS;
