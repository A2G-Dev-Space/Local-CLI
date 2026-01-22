/**
 * Planning LLM for Electron Agent
 * Converts user requests into executable TODO lists
 * Supports direct response detection for questions/greetings
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import type { Message, ToolDefinition } from '../../core/llm';
import {
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
} from '../../prompts/agents/docs-search-decision';

// =============================================================================
// Types
// =============================================================================

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PlanningResult {
  todos: TodoItem[];
  complexity: 'simple' | 'moderate' | 'complex';
  directResponse?: string; // If set, skip TODO execution and return this directly
}

export interface PlanningWithDocsResult extends PlanningResult {
  docsSearchNeeded: boolean;
}

// =============================================================================
// Planning Tool Definitions
// =============================================================================

/**
 * create_todos - Used by Planning LLM to create TODO list
 */
const CREATE_TODOS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_todos',
    description: `Create a TODO list for the user's request.
Use this when the user wants you to perform actions, implement features, fix bugs, etc.

GUIDELINES:
- Break down complex tasks into smaller, actionable items
- Each TODO should be specific and achievable
- Order items logically (setup before implementation, etc.)
- Keep titles concise but descriptive`,
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'List of TODO items to execute',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique ID for the TODO (e.g., "todo-1")',
              },
              title: {
                type: 'string',
                description: 'Short, actionable title describing the task',
              },
            },
            required: ['id', 'title'],
          },
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'moderate', 'complex'],
          description: 'Overall complexity of the request',
        },
      },
      required: ['todos', 'complexity'],
    },
  },
};

/**
 * respond_to_user - Used for direct responses (questions, greetings)
 */
const RESPOND_TO_USER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'respond_to_user',
    description: `Respond directly to the user without creating TODOs.
Use this ONLY when the user:
- Asks a question that doesn't require file/code changes
- Sends a greeting (hi, hello, etc.)
- Asks for clarification or explanation
- Makes a simple statement that doesn't require action

Do NOT use this when the user wants you to:
- Create, modify, or delete files
- Run commands
- Implement features
- Fix bugs
- Make any changes to the codebase`,
    parameters: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'Your response to the user (in their language)',
        },
      },
      required: ['response'],
    },
  },
};

const PLANNING_TOOLS: ToolDefinition[] = [CREATE_TODOS_TOOL, RESPOND_TO_USER_TOOL];

// =============================================================================
// Planning LLM Class
// =============================================================================

export class PlanningLLM {
  private llmClient: {
    chatCompletion: (options: {
      messages: Message[];
      tools?: ToolDefinition[];
      temperature?: number;
    }) => Promise<{
      choices: Array<{
        message: Message & { tool_calls?: Array<{ function: { name: string; arguments: string } }> };
      }>;
    }>;
  };
  private getToolSummary: () => string;

  constructor(
    llmClient: {
      chatCompletion: (options: {
        messages: Message[];
        tools?: ToolDefinition[];
        temperature?: number;
      }) => Promise<{
        choices: Array<{
          message: Message & { tool_calls?: Array<{ function: { name: string; arguments: string } }> };
        }>;
      }>;
    },
    getToolSummary: () => string
  ) {
    this.llmClient = llmClient;
    this.getToolSummary = getToolSummary;
  }

  /**
   * Build planning system prompt
   */
  private buildPlanningSystemPrompt(): string {
    const toolSummary = this.getToolSummary();

    return `You are the PLANNING LLM. Your job is to convert user requests into actionable TODO lists.

## CRITICAL: Language Priority
ALWAYS respond in the SAME LANGUAGE as the user's input.
- Korean input → Korean response
- English input → English response

## Your Role
1. Analyze the user's request
2. Decide if it requires action (create_todos) or just a response (respond_to_user)
3. For actions: Break down into specific, achievable TODOs
4. For questions/greetings: Respond directly

## Available Tools for Execution (Reference Only)
These tools will be available to the Execution LLM:

${toolSummary}

## YOUR Tools (only 2)
1. **create_todos** - For any request that requires action
2. **respond_to_user** - ONLY for questions/greetings that don't need action

## Decision Guide

**Use create_todos when user wants to:**
- Create, modify, or delete files
- Run commands (npm, git, etc.)
- Implement features or fix bugs
- Make any changes to the project
- Search for code and understand it (for later action)

**Use respond_to_user when user:**
- Says hi/hello or greets you
- Asks a general question (not about doing something)
- Asks for clarification about a previous response
- Makes a statement that doesn't require action

## TODO Guidelines

When creating TODOs:
1. Keep titles concise and actionable
2. Order logically (understand before modify, setup before implement)
3. Include verification steps if needed (test, verify)
4. Consider dependencies between tasks

## IMPORTANT
- You are NOT the Execution LLM
- Do NOT use tools like read_file, write_todos, powershell, etc.
- You ONLY have create_todos and respond_to_user
- ALWAYS call one of your tools - never respond with plain text`;
  }

  /**
   * Generate TODO list from user request
   */
  async generateTODOList(
    userRequest: string,
    contextMessages?: Message[]
  ): Promise<PlanningResult> {
    logger.enter('PlanningLLM.generateTODOList', { requestLength: userRequest.length });

    const systemPrompt = this.buildPlanningSystemPrompt();

    // Build messages
    const messages: Message[] = [{ role: 'system', content: systemPrompt }];

    // Add context messages if available
    if (contextMessages && contextMessages.length > 0) {
      const systemMsgs = contextMessages.filter((m) => m.role === 'system');
      const conversationMsgs = contextMessages.filter((m) => m.role !== 'system');
      messages.push(...systemMsgs, ...conversationMsgs);
    }

    // Add user request with marker
    const lastMsg = messages[messages.length - 1];
    if (!(lastMsg?.role === 'user' && lastMsg?.content === userRequest)) {
      messages.push({
        role: 'user',
        content: `[NEW REQUEST]\n${userRequest}`,
      });
    }

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Add retry prompt if needed
        if (attempt > 1) {
          messages.push({
            role: 'user',
            content: `[RETRY ${attempt}/${MAX_RETRIES}] ⚠️ CRITICAL: You are the PLANNING LLM.

You have ONLY 2 tools:
1. 'create_todos' - For action requests
2. 'respond_to_user' - For questions/greetings only

Previous error: ${lastError?.message || 'Invalid response'}

Choose either 'create_todos' or 'respond_to_user' now.`,
          });
          logger.warn(`Planning LLM retry attempt ${attempt}/${MAX_RETRIES}`, {
            lastError: lastError?.message,
          });
        }

        // Call LLM
        const response = await this.llmClient.chatCompletion({
          messages,
          tools: PLANNING_TOOLS,
          temperature: 0.7,
        });

        const message = response.choices?.[0]?.message;
        const toolCalls = message?.tool_calls;

        logger.debug('Planning LLM response', {
          hasToolCalls: !!(toolCalls && toolCalls.length > 0),
          toolCallsCount: toolCalls?.length ?? 0,
        });

        // Handle tool call
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0]!;
          const toolName = toolCall.function?.name;

          let toolArgs;
          try {
            toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
          } catch (error) {
            logger.warn('Failed to parse tool arguments', { args: toolCall.function?.arguments });
            lastError = error as Error;
            continue;
          }

          // Handle create_todos
          if (toolName === 'create_todos') {
            logger.flow('TODO list created via create_todos tool');

            let rawTodos = toolArgs.todos;

            // Handle string-wrapped JSON
            if (typeof rawTodos === 'string') {
              try {
                rawTodos = JSON.parse(rawTodos);
              } catch {
                logger.warn('Failed to parse string todos as JSON');
              }
            }

            if (!Array.isArray(rawTodos)) {
              lastError = new Error('Planning LLM returned invalid todos format');
              continue;
            }

            const todos: TodoItem[] = rawTodos.map((todo: any, index: number) => ({
              id: todo.id || `todo-${Date.now()}-${index}`,
              title: todo.title || 'Untitled task',
              status: (index === 0 ? 'in_progress' : 'pending') as TodoItem['status'],
            }));

            logger.exit('PlanningLLM.generateTODOList', { todoCount: todos.length });

            return {
              todos,
              complexity: toolArgs.complexity || 'moderate',
            };
          }

          // Handle respond_to_user
          if (toolName === 'respond_to_user') {
            logger.flow('Direct response via respond_to_user tool');
            const directResponse = toolArgs.response || '';

            if (!directResponse) {
              lastError = new Error('Planning LLM returned empty response');
              continue;
            }

            logger.exit('PlanningLLM.generateTODOList', { directResponse: true });

            return {
              todos: [],
              complexity: 'simple',
              directResponse,
            };
          }

          // Unknown tool
          logger.warn(`Unknown tool called: ${toolName}`);
          lastError = new Error(`Invalid tool "${toolName}". Only create_todos or respond_to_user allowed.`);
          continue;
        }

        // No tool call - should not happen with tool_choice
        const contentOnly = message?.content;
        if (contentOnly) {
          logger.warn(`Planning LLM returned content without tool call (attempt ${attempt})`);
          lastError = new Error('You MUST call either create_todos or respond_to_user tool.');
        } else {
          logger.warn(`Planning LLM returned no tool call and no content (attempt ${attempt})`);
          lastError = new Error('Planning LLM must use either create_todos or respond_to_user tool');
        }
      } catch (error) {
        logger.warn(`Planning LLM error (attempt ${attempt}):`, error as Error);
        lastError = error as Error;
      }
    }

    // All retries exhausted - use fallback
    logger.warn('All planning retries exhausted, using fallback TODO', { lastError: lastError?.message });

    return {
      todos: [
        {
          id: `todo-${Date.now()}`,
          title: userRequest.length > 100 ? userRequest.substring(0, 100) + '...' : userRequest,
          status: 'in_progress',
        },
      ],
      complexity: 'simple',
    };
  }

  /**
   * Generate TODO list with parallel docs search decision
   * Runs planning and docs decision in parallel, then injects docs search TODO if needed
   */
  async generateTODOListWithDocsDecision(
    userRequest: string,
    contextMessages?: Message[]
  ): Promise<PlanningWithDocsResult> {
    logger.enter('PlanningLLM.generateTODOListWithDocsDecision', {
      requestLength: userRequest.length,
    });
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

    // If docs search is needed and we have todos, prepend docs search TODO
    if (docsSearchNeeded && planningResult.todos.length > 0) {
      const docsSearchTodo: TodoItem = {
        id: `todo-docs-${Date.now()}`,
        title: 'Search local documentation (use call_docs_search_agent)',
        status: 'pending',
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
   * Based on available documentation structure (same as CLI)
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

    // Build prompt using shared prompt builder
    const prompt = buildDocsSearchDecisionPrompt(folderStructure, userMessage);

    const messages: Message[] = [
      { role: 'user', content: prompt },
    ];

    let retries = 0;
    const MAX_RETRIES = 2;

    while (retries <= MAX_RETRIES) {
      logger.flow(`Asking LLM for docs search decision (attempt ${retries + 1})`);

      try {
        const response = await this.llmClient.chatCompletion({
          messages,
          temperature: 0.1,
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
        if (retries <= MAX_RETRIES) {
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: DOCS_SEARCH_DECISION_RETRY_PROMPT });
          logger.warn('Invalid decision response, retrying', { response: content });
        }
      } catch (error) {
        logger.warn('LLM call failed for docs search decision', error as Error);
        retries++;
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
          } catch (e) {
            // Log but don't fail on subdirectory read errors
            logger.warn(`Could not read subdirectory ${subPath}`, e);
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

// =============================================================================
// Export
// =============================================================================

export default PlanningLLM;
