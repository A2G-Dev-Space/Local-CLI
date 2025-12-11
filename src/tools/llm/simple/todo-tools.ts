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
 * update-todo-list Tool Definition
 */
const UPDATE_TODO_LIST_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_todo_list',
    description: `Update the status of a TODO item in the current task list.

Use this tool to:
- Mark a TODO as in_progress when you start working on it
- Mark a TODO as completed when you finish it
- Mark a TODO as failed if you cannot complete it

IMPORTANT:
- Always update TODO status to reflect your current progress
- Only one TODO should be in_progress at a time
- Add notes to explain completion or failure reasons`,
    parameters: {
      type: 'object',
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the TODO item to update',
        },
        status: {
          type: 'string',
          enum: ['in_progress', 'completed', 'failed'],
          description: 'The new status for the TODO item',
        },
        note: {
          type: 'string',
          description: 'Optional note explaining the status change (e.g., completion summary or failure reason)',
        },
      },
      required: ['todo_id', 'status'],
    },
  },
};

/**
 * update-todo-list Tool Implementation
 */
async function executeUpdateTodoList(args: Record<string, unknown>): Promise<ToolResult> {
  logger.enter('executeUpdateTodoList', args);

  const todoId = args['todo_id'] as string;
  const status = args['status'] as 'in_progress' | 'completed' | 'failed';
  const note = args['note'] as string | undefined;

  if (!todoId || !status) {
    logger.warn('Missing required parameters');
    return {
      success: false,
      error: 'Missing required parameters: todo_id and status are required',
    };
  }

  if (!['in_progress', 'completed', 'failed'].includes(status)) {
    logger.warn('Invalid status value', { status });
    return {
      success: false,
      error: 'Invalid status. Must be one of: in_progress, completed, failed',
    };
  }

  if (!todoUpdateCallback) {
    logger.warn('TODO update callback not set');
    return {
      success: false,
      error: 'TODO management is not available in current context',
    };
  }

  try {
    logger.flow(`Updating TODO ${todoId} to ${status}`);
    const success = await todoUpdateCallback(todoId, status, note);

    if (success) {
      logger.debug(`TODO ${todoId} updated to ${status}`);
      logger.exit('executeUpdateTodoList', { success: true });
      return {
        success: true,
        result: `TODO ${todoId} has been updated to ${status}${note ? `. Note: ${note}` : ''}`,
        metadata: { todoId, status, note },
      };
    } else {
      logger.warn(`Failed to update TODO ${todoId}`);
      return {
        success: false,
        error: `Failed to update TODO ${todoId}. It may not exist or the update was rejected.`,
      };
    }
  } catch (error) {
    logger.error('Error updating TODO', error as Error);
    return {
      success: false,
      error: `Error updating TODO: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
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
 * LLM Simple Tool: update_todo_list
 */
export const UpdateTodoListTool: LLMSimpleTool = {
  definition: UPDATE_TODO_LIST_DEFINITION,
  execute: executeUpdateTodoList,
  categories: ['llm-simple'] as ToolCategory[],
  description: 'Update TODO item status',
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
export const TODO_TOOLS = [UpdateTodoListTool, GetTodoListTool];

/**
 * Get TODO tool definitions for LLM
 */
export function getTodoToolDefinitions(): ToolDefinition[] {
  return TODO_TOOLS.map(tool => tool.definition);
}

export default TODO_TOOLS;
