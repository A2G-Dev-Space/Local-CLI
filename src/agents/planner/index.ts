/**
 * Planning Agent
 *
 * Converts user requests into executable TODO lists
 * Supports parallel docs search decision
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LLMClient } from '../../core/llm/llm-client.js';
import { Message, TodoItem, PlanningResult, TodoStatus } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { PLANNING_SYSTEM_PROMPT } from '../../prompts/agents/planning.js';
import {
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
} from '../../prompts/agents/docs-search-decision.js';

/**
 * Result of parallel planning with docs decision
 */
export interface PlanningWithDocsResult extends PlanningResult {
  docsSearchNeeded: boolean;
}

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

  /**
   * Generate TODO list with parallel docs search decision
   * Runs planning and docs decision in parallel, then injects docs search TODO if needed
   */
  async generateTODOListWithDocsDecision(
    userRequest: string,
    contextMessages?: Message[]
  ): Promise<PlanningWithDocsResult> {
    logger.enter('PlanningLLM.generateTODOListWithDocsDecision', { requestLength: userRequest.length });
    logger.startTimer('parallel-planning');

    // Run planning and docs decision in parallel
    const [planningResult, docsSearchNeeded] = await Promise.all([
      this.generateTODOList(userRequest, contextMessages),
      this.shouldSearchDocs(userRequest),
    ]);

    logger.vars(
      { name: 'todoCount', value: planningResult.todos.length },
      { name: 'docsSearchNeeded', value: docsSearchNeeded }
    );

    // If docs search is needed, prepend a docs search TODO
    if (docsSearchNeeded) {
      const docsSearchTodo: TodoItem = {
        id: `todo-docs-${Date.now()}`,
        title: 'Search local documentation',
        description: `Search ~/.local-cli/docs for relevant information about: ${userRequest.substring(0, 200)}${userRequest.length > 200 ? '...' : ''}

Use call_docs_search_agent tool to search the documentation.
The search results will help inform the subsequent tasks.`,
        status: 'pending' as TodoStatus,
        requiresDocsSearch: true,
        dependencies: [],
      };

      // Update dependencies of original first TODO to depend on docs search
      const updatedTodos = planningResult.todos.map((todo, index) => {
        if (index === 0 && todo.dependencies.length === 0) {
          return {
            ...todo,
            dependencies: [docsSearchTodo.id],
          };
        }
        return todo;
      });

      logger.flow('Prepended docs search TODO');
      logger.endTimer('parallel-planning');
      logger.exit('PlanningLLM.generateTODOListWithDocsDecision', { docsSearchNeeded: true });

      return {
        ...planningResult,
        todos: [docsSearchTodo, ...updatedTodos],
        docsSearchNeeded: true,
      };
    }

    logger.endTimer('parallel-planning');
    logger.exit('PlanningLLM.generateTODOListWithDocsDecision', { docsSearchNeeded: false });

    return {
      ...planningResult,
      docsSearchNeeded: false,
    };
  }

  /**
   * Check if docs search is needed for the given request
   * Based on available documentation structure
   */
  private async shouldSearchDocs(userMessage: string): Promise<boolean> {
    logger.enter('PlanningLLM.shouldSearchDocs', { messageLength: userMessage.length });

    // Get folder structure
    const folderStructure = await this.getDocsFolderStructure();

    // If no docs available, skip search
    if (
      folderStructure.includes('empty') ||
      folderStructure.includes('does not exist')
    ) {
      logger.flow('No docs available, skipping search decision');
      logger.exit('PlanningLLM.shouldSearchDocs', { decision: false, reason: 'no-docs' });
      return false;
    }

    // Build prompt
    const prompt = buildDocsSearchDecisionPrompt(folderStructure, userMessage);

    const messages: Message[] = [
      { role: 'user', content: prompt },
    ];

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      logger.flow(`Asking LLM for docs search decision (attempt ${retries + 1})`);

      const response = await this.llmClient.chatCompletion({
        messages,
        temperature: 0.1,
        max_tokens: 10,
      });

      const content = response.choices[0]?.message?.content || '';
      logger.debug('LLM decision response', { content });

      const decision = parseDocsSearchDecision(content);

      if (decision !== null) {
        logger.exit('PlanningLLM.shouldSearchDocs', { decision, attempts: retries + 1 });
        return decision;
      }

      // Invalid response, retry
      retries++;
      if (retries <= maxRetries) {
        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: DOCS_SEARCH_DECISION_RETRY_PROMPT });
        logger.warn('Invalid decision response, retrying', { response: content });
      }
    }

    // Default to false if all retries failed
    logger.warn('All decision retries failed, defaulting to no search');
    logger.exit('PlanningLLM.shouldSearchDocs', { decision: false, reason: 'retries-exhausted' });
    return false;
  }

  /**
   * Get top-level folder structure of docs directory
   */
  private async getDocsFolderStructure(): Promise<string> {
    const docsBasePath = path.join(os.homedir(), '.local-cli', 'docs');

    try {
      const entries = await fs.readdir(docsBasePath, { withFileTypes: true });

      const lines: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          lines.push(`[DIR]  ${entry.name}/`);

          // Also list immediate children of directories
          try {
            const subPath = path.join(docsBasePath, entry.name);
            const subEntries = await fs.readdir(subPath, { withFileTypes: true });

            for (const subEntry of subEntries.slice(0, 5)) {
              if (subEntry.isDirectory()) {
                lines.push(`       ├── ${subEntry.name}/`);
              } else {
                lines.push(`       ├── ${subEntry.name}`);
              }
            }

            if (subEntries.length > 5) {
              lines.push(`       └── ... (${subEntries.length - 5} more)`);
            }
          } catch {
            // Ignore errors reading subdirectories
          }
        } else if (entry.isFile()) {
          lines.push(`[FILE] ${entry.name}`);
        }
      }

      if (lines.length === 0) {
        return '(empty - no documentation available)';
      }

      return lines.join('\n');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return '(docs directory does not exist)';
      }
      return '(error reading docs directory)';
    }
  }
}

export default PlanningLLM;
