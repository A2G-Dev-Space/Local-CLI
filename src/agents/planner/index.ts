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
import { toolRegistry } from '../../tools/registry.js';
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
   * Uses actual tool definitions for Planning LLM
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
      content: userRequest,
    });

    // Get Planning tool definitions
    const planningTools = toolRegistry.getLLMPlanningToolDefinitions();

    try {
      const response = await this.llmClient.chatCompletion({
        messages,
        tools: planningTools,
        tool_choice: 'required',  // Force tool use
        temperature: 0.7,
        max_tokens: 2000,
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls;

      // Handle tool calls
      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0]!;
        const toolName = toolCall.function?.name;
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');

        if (toolName === 'response_to_user') {
          logger.flow('Direct response via response_to_user tool');
          return {
            todos: [],
            complexity: 'simple',
            directResponse: toolArgs.response,
          };
        }

        if (toolName === 'create_todos') {
          logger.flow('TODO list created via create_todos tool');
          const todos: TodoItem[] = toolArgs.todos.map((todo: any, index: number) => ({
            id: todo.id || `todo-${Date.now()}-${index}`,
            title: todo.title,
            status: 'pending' as TodoStatus,
          }));

          return {
            todos,
            complexity: toolArgs.complexity || 'moderate',
          };
        }
      }

      // Fallback: If no tool call, try to parse content as JSON (legacy support)
      const content = message?.content || '';
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const planningData = JSON.parse(jsonMatch[0]);
          if (planningData.response) {
            return {
              todos: [],
              complexity: 'simple',
              directResponse: planningData.response,
            };
          }
          if (planningData.todos) {
            const todos: TodoItem[] = planningData.todos.map((todo: any, index: number) => ({
              id: todo.id || `todo-${Date.now()}-${index}`,
              title: todo.title,
              status: 'pending' as TodoStatus,
            }));
            return {
              todos,
              complexity: planningData.complexity || 'moderate',
            };
          }
        }
      }

      throw new Error('Planning LLM did not return a valid tool call');
    } catch (error) {
      logger.error('Planning LLM error:', error as Error);

      // Fallback: Create single TODO for the entire request
      return {
        todos: [
          {
            id: `todo-${Date.now()}`,
            title: userRequest.length > 100 ? userRequest.substring(0, 100) + '...' : userRequest,
            status: 'pending',
          },
        ],
        complexity: 'simple',
      };
    }
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
        title: 'Search local documentation (use call_docs_search_agent)',
        status: 'pending' as TodoStatus,
      };

      logger.flow('Prepended docs search TODO');
      logger.endTimer('parallel-planning');
      logger.exit('PlanningLLM.generateTODOListWithDocsDecision', { docsSearchNeeded: true });

      return {
        ...planningResult,
        todos: [docsSearchTodo, ...planningResult.todos],
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
   * Get folder structure of docs directory (depth 1 only: root + immediate subdirs)
   */
  private async getDocsFolderStructure(): Promise<string> {
    const docsBasePath = path.join(os.homedir(), '.local-cli', 'docs');

    try {
      const entries = await fs.readdir(docsBasePath, { withFileTypes: true });

      const lines: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Depth 0: Show top-level directory
          lines.push(`📁 ${entry.name}/`);

          // Depth 1: Show only immediate subdirectory names
          try {
            const subPath = path.join(docsBasePath, entry.name);
            const subEntries = await fs.readdir(subPath, { withFileTypes: true });
            const subDirs = subEntries.filter(e => e.isDirectory());

            if (subDirs.length > 0) {
              const subDirNames = subDirs.map(d => d.name).join(', ');
              lines.push(`   └── [${subDirNames}]`);
            }
          } catch {
            // Ignore errors reading subdirectories
          }
        }
        // Skip files at root level - only show directories
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
