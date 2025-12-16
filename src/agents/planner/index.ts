/**
 * Planning Agent
 *
 * Converts user requests into executable TODO lists
 */

import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, TodoItem, PlanningResult, TodoStatus } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { PLANNING_SYSTEM_PROMPT } from '../../prompts/agents/planning.js';

/**
 * Planning LLM
 * Converts user requests into executable TODO lists
 */
export class PlanningLLM {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Convert user request to TODO list
   * @param userRequest The user's request
   * @param contextMessages Optional context messages (e.g., docs search results)
   */
  async generateTODOList(userRequest: string, contextMessages?: Message[]): Promise<PlanningResult> {
    const messages: Message[] = [
      {
        role: 'system',
        content: PLANNING_SYSTEM_PROMPT,
      },
    ];

    // Include context messages (like docs search results) if provided
    if (contextMessages && contextMessages.length > 0) {
      // Filter to only include assistant messages with context (not system messages)
      const contextToInclude = contextMessages.filter(
        m => m.role === 'assistant' && m.content.includes('[Documentation Search')
      );
      messages.push(...contextToInclude);
    }

    messages.push({
      role: 'user',
      content: `Break down this request into a TODO list:\n\n${userRequest}`,
    });

    try {
      const response = await this.llmClient.chatCompletion({
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message.content || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Planning LLM did not return valid JSON');
      }

      const planningData = JSON.parse(jsonMatch[0]);

      // Create TodoItem array with proper status
      const todos: TodoItem[] = planningData.todos.map((todo: any, index: number) => ({
        id: todo.id || `todo-${Date.now()}-${index}`,
        title: todo.title,
        description: todo.description,
        status: 'pending' as TodoStatus,
        requiresDocsSearch: todo.requiresDocsSearch || false,
        dependencies: todo.dependencies || [],
      }));

      return {
        todos,
        estimatedTime: planningData.estimatedTime,
        complexity: planningData.complexity || 'moderate',
      };
    } catch (error) {
      logger.error('Planning LLM error:', error as Error);

      // Fallback: Create single TODO for the entire request
      return {
        todos: [
          {
            id: `todo-${Date.now()}`,
            title: 'Execute task',
            description: userRequest,
            status: 'pending',
            requiresDocsSearch: true,
            dependencies: [],
          },
        ],
        complexity: 'simple',
      };
    }
  }

  /**
   * Validate TODO dependencies
   */
  validateDependencies(todos: TodoItem[]): boolean {
    const todoIds = new Set(todos.map(t => t.id));

    for (const todo of todos) {
      for (const depId of todo.dependencies) {
        if (!todoIds.has(depId)) {
          logger.warn(`Invalid dependency: TODO ${todo.id} depends on non-existent TODO ${depId}`);
          return false;
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (todoId: string): boolean => {
      visited.add(todoId);
      recursionStack.add(todoId);

      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        for (const depId of todo.dependencies) {
          if (!visited.has(depId) && hasCycle(depId)) {
            return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(todoId);
      return false;
    };

    for (const todo of todos) {
      if (!visited.has(todo.id) && hasCycle(todo.id)) {
        logger.warn('Circular dependency detected in TODOs');
        return false;
      }
    }

    return true;
  }

  /**
   * Sort TODOs based on dependencies (topological sort)
   */
  sortByDependencies(todos: TodoItem[]): TodoItem[] {
    const sorted: TodoItem[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (todo: TodoItem) => {
      if (visited.has(todo.id)) return;
      if (visiting.has(todo.id)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(todo.id);

      // Visit dependencies first
      for (const depId of todo.dependencies) {
        const dep = todos.find(t => t.id === depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(todo.id);
      visited.add(todo.id);
      sorted.push(todo);
    };

    for (const todo of todos) {
      if (!visited.has(todo.id)) {
        visit(todo);
      }
    }

    return sorted;
  }
}

export default PlanningLLM;
