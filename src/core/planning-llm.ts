/**
 * Planning LLM for Plan-and-Execute Architecture
 *
 * Converts user requests into executable TODO lists
 */

import { LLMClient } from './llm-client.js';
import { Message, TodoItem, PlanningResult, TodoStatus } from '../types/index.js';

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
   */
  async generateTODOList(userRequest: string): Promise<PlanningResult> {
    const systemPrompt = `
You are a task planning expert. Analyze user requests and break them into executable TODO items.

**Your Mission**:
Break down user requests into detailed tasks (TODO items).

**TODO Item Creation Rules**:
1. **Specific**: Each TODO must be clear and executable
2. **Sequential**: TODOs listed in execution order
3. **Independent**: Each TODO should be as independent as possible
4. **Docs Search**: Set requiresDocsSearch: true if information is needed
5. **Dependencies**: Specify dependencies if TODO needs results from others

**TODO Examples**:
User: "Create a REST API with TypeScript"
→ TODOs:
  1. Research TypeScript project setup (requiresDocsSearch: true)
  2. Install Express.js and initial setup
  3. Create basic route structure
  4. Implement API endpoints
  5. Write test code

**Important**:
- Don't over-subdivide (max 5-7 TODOs)
- Each TODO should be completable in 10-30 minutes
- Break complex tasks into multiple TODOs

**Response Format** (JSON):
{
  "todos": [
    {
      "id": "todo-1",
      "title": "TODO title",
      "description": "Detailed description",
      "requiresDocsSearch": true/false,
      "dependencies": []
    }
  ],
  "estimatedTime": "30-60 minutes",
  "complexity": "moderate"
}
`;

    const messages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Break down this request into a TODO list:\n\n${userRequest}`,
      },
    ];

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
      console.error('Planning LLM error:', error);

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
          console.warn(`Invalid dependency: TODO ${todo.id} depends on non-existent TODO ${depId}`);
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
        console.warn('Circular dependency detected in TODOs');
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