/**
 * Planning Agent
 *
 * System Planning Agent with full PowerShell access.
 * - Clarify requirements with ask_to_user
 * - Create comprehensive TODO lists for Execution LLM
 * - Supports parallel docs search decision
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger';
import type { Message, ToolDefinition } from '../../core/llm';
import { flattenMessagesToHistory } from '../../orchestration/utils';
import {
  buildDocsSearchDecisionPrompt,
  parseDocsSearchDecision,
  DOCS_SEARCH_DECISION_RETRY_PROMPT,
} from '../../prompts/agents/docs-search-decision';
import { buildPlanningSystemPrompt } from '../../prompts/agents/planning';
import { PLANNING_TOOLS } from '../../tools/llm/simple/planning-tools';
import {
  AskUserResponse,
  AskUserCallback,
} from '../../tools/llm/simple/user-interaction-tools';

// =============================================================================
// Types
// =============================================================================

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface PlanningResult {
  todos: TodoItem[];
  complexity: 'simple' | 'moderate' | 'complex';
  directResponse?: string; // If set, skip TODO execution and return this directly
  /** Clarification messages from ask_to_user during planning (Q&A pairs) */
  clarificationMessages?: Message[];
}

export interface PlanningWithDocsResult extends PlanningResult {
  docsSearchNeeded: boolean;
}

// =============================================================================
// Planning LLM Class
// =============================================================================

export class PlanningLLM {
  private llmClient: {
    chatCompletion: (options: {
      messages: Message[];
      tools?: ToolDefinition[];
      tool_choice?: string;
      temperature?: number;
      max_tokens?: number;
    }) => Promise<{
      choices: Array<{
        message: Message & { tool_calls?: Array<{ function: { name: string; arguments: string } }> };
        finish_reason?: string;
      }>;
    }>;
  };
  private getToolSummary: () => string;
  private getOptionalToolsInfo: () => string;
  private askUserCallback: AskUserCallback | null = null;

  constructor(
    llmClient: {
      chatCompletion: (options: {
        messages: Message[];
        tools?: ToolDefinition[];
        tool_choice?: string;
        temperature?: number;
        max_tokens?: number;
      }) => Promise<{
        choices: Array<{
          message: Message & { tool_calls?: Array<{ function: { name: string; arguments: string } }> };
          finish_reason?: string;
        }>;
      }>;
    },
    getToolSummary: () => string,
    getOptionalToolsInfo: () => string = () => ''
  ) {
    this.llmClient = llmClient;
    this.getToolSummary = getToolSummary;
    this.getOptionalToolsInfo = getOptionalToolsInfo;
  }

  /**
   * Set the ask-user callback for Planning LLM
   * This enables the ask_to_user tool during planning
   */
  setAskUserCallback(callback: AskUserCallback): void {
    logger.flow('Setting ask-user callback for Planning LLM');
    this.askUserCallback = callback;
  }

  /**
   * Clear ask-user callback
   */
  clearAskUserCallback(): void {
    logger.flow('Clearing ask-user callback for Planning LLM');
    this.askUserCallback = null;
  }

  /**
   * Build planning system prompt using shared prompt from planning.ts
   * Includes both core tools and enabled optional tools (browser, office, etc.)
   */
  private buildSystemPrompt(): string {
    const toolSummary = this.getToolSummary();
    const optionalToolsInfo = this.getOptionalToolsInfo();
    return buildPlanningSystemPrompt(toolSummary, optionalToolsInfo);
  }

  /**
   * Generate TODO list from user request
   * Supports ask_to_user for requirement clarification (loops until final decision)
   * Returns clarificationMessages for caller to inject into conversation history
   * @param userRequest The user's request
   * @param contextMessages Optional context messages (e.g., docs search results)
   */
  async generateTODOList(
    userRequest: string,
    contextMessages?: Message[],
  ): Promise<PlanningResult> {
    logger.enter('PlanningLLM.generateTODOList', { requestLength: userRequest.length });

    const systemPrompt = this.buildSystemPrompt();
    const clarificationMessages: Message[] = [];

    // Build messages with XML tag structure for history/request separation
    // CLI parity: src/agents/planner/index.ts
    const messages: Message[] = [{ role: 'system', content: systemPrompt }];

    // Flatten conversation history into chronological text with XML tags
    if (contextMessages && contextMessages.length > 0) {
      const conversationMsgs = contextMessages.filter((m) => m.role !== 'system');

      // Check if last context message is already the same user request (avoid duplicate in history)
      const lastContextMsg = conversationMsgs[conversationMsgs.length - 1];
      const isDuplicate = lastContextMsg?.role === 'user' && lastContextMsg?.content === userRequest;

      // If duplicate, flatten history WITHOUT the last message (it will go in CURRENT_REQUEST)
      const msgsToFlatten = isDuplicate ? conversationMsgs.slice(0, -1) : conversationMsgs;
      const historyText = flattenMessagesToHistory(msgsToFlatten);

      // Build user message with history + current request (always include CURRENT_REQUEST)
      let userContent = '';
      if (historyText) {
        userContent += `<CONVERSATION_HISTORY>\n${historyText}\n</CONVERSATION_HISTORY>\n\n`;
      }
      userContent += `<CURRENT_REQUEST>\n${userRequest}\n</CURRENT_REQUEST>`;
      messages.push({ role: 'user', content: userContent });
    } else {
      messages.push({
        role: 'user',
        content: `<CURRENT_REQUEST>\n${userRequest}\n</CURRENT_REQUEST>`,
      });
    }

    const MAX_RETRIES = 3;
    const MAX_ASK_ITERATIONS = 5;
    let askIterations = 0;
    let lastError: Error | null = null;

    // Main planning loop - continues until create_todos or respond_to_user is called
    while (askIterations < MAX_ASK_ITERATIONS) {
      let shouldContinueMainLoop = false; // Track if we should continue after ask_to_user

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Add retry prompt if needed
          if (attempt > 1) {
            messages.push({
              role: 'user',
              content: `[RETRY ${attempt}/${MAX_RETRIES}] ⚠️ CRITICAL: You are the PLANNING LLM, not the Execution LLM.

You have ONLY 3 tools available:
1. 'ask_to_user' - To clarify ambiguous requirements (use FIRST if unclear)
2. 'create_todos' - For ANY action/implementation request
3. 'respond_to_user' - For pure knowledge questions/greetings only

❌ DO NOT use tools like 'write_todos', 'read_file', 'powershell', etc. Those are for Execution LLM, NOT you.
❌ You saw those tools in conversation history, but they are NOT available to you.

Previous error: ${lastError?.message || 'Invalid response'}

Choose one of your 3 tools now.`,
            });
            logger.warn(`Planning LLM retry attempt ${attempt}/${MAX_RETRIES}`, {
              lastError: lastError?.message,
            });
          }

          // Call LLM with Planning tools definitions
          const planningToolDefs = PLANNING_TOOLS.map(t => t.definition);
          const response = await this.llmClient.chatCompletion({
            messages,
            tools: planningToolDefs,
            tool_choice: 'required',
            temperature: 0.7,
            max_tokens: 2000,
          });

          const message = response.choices?.[0]?.message;
          const toolCalls = message?.tool_calls;
          const finishReason = response.choices?.[0]?.finish_reason;

          logger.debug('Planning LLM response', {
            hasMessage: !!message,
            hasToolCalls: !!(toolCalls && toolCalls.length > 0),
            finishReason,
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
              logger.warn('Failed to parse tool arguments', { args: toolCall.function?.arguments, error });
              lastError = error as Error;
              continue; // Retry
            }

            // Handle ask_to_user - clarify requirements before planning
            if (toolName === 'ask_to_user') {
              logger.flow('Planning LLM asking user for clarification');

              const question = toolArgs.question as string;
              const options = toolArgs.options as string[];

              if (!question || !Array.isArray(options) || options.length < 2) {
                logger.warn('ask_to_user called with invalid parameters', { toolArgs });
                lastError = new Error('ask_to_user requires a question and 2-4 options');
                continue; // Retry
              }

              askIterations++;

              // Check if callback is available
              if (!this.askUserCallback) {
                logger.warn('ask_to_user called but no callback is set, forcing create_todos');
                messages.push({
                  role: 'assistant',
                  content: `[ask_to_user was called but user interaction is not available.]`,
                });
                messages.push({
                  role: 'user',
                  content: `User interaction is unavailable. You MUST call 'create_todos' now with your best judgment. Do NOT call ask_to_user again.`,
                });
                shouldContinueMainLoop = true;
                break; // Exit retry loop, continue main loop
              }

              try {
                // Record the assistant's question in history
                const assistantMsg: Message = {
                  role: 'assistant',
                  content: `[Clarification needed] ${question}\nOptions: ${options.join(', ')}`,
                };
                messages.push(assistantMsg);
                clarificationMessages.push(assistantMsg);

                // Call the UI callback to ask user
                const userResponse: AskUserResponse = await this.askUserCallback({ question, options });

                // Build user response text
                const userAnswerText = userResponse.isOther && userResponse.customText
                  ? userResponse.customText
                  : userResponse.selectedOption;

                // Record user's response in history
                const userMsg: Message = {
                  role: 'user',
                  content: `[User's answer] ${userAnswerText}`,
                };
                messages.push(userMsg);
                clarificationMessages.push(userMsg);

                logger.flow('User responded to clarification question', {
                  question,
                  answer: userAnswerText,
                  isCustom: userResponse.isOther,
                });

                // Continue main loop - LLM will process the answer and decide next step
                shouldContinueMainLoop = true;
                break; // Exit retry loop, continue main loop

              } catch (error) {
                logger.error('Error during ask_to_user', error as Error);
                lastError = error as Error;
                // Continue retry loop
                continue;
              }
            }

            // Handle create_todos - final planning decision
            if (toolName === 'create_todos') {
              logger.flow('TODO list created via create_todos tool');

              // Validate todos is an array (handle string-wrapped JSON from LLM)
              let rawTodos = toolArgs.todos;

              // If todos is a string, try to parse it as JSON
              if (typeof rawTodos === 'string') {
                try {
                  rawTodos = JSON.parse(rawTodos);
                  logger.debug('Parsed string-wrapped todos array');
                } catch {
                  logger.warn('Failed to parse string todos as JSON', { todos: rawTodos });
                }
              }

              if (!Array.isArray(rawTodos)) {
                logger.warn('create_todos called with non-array todos', { toolArgs });
                lastError = new Error('Planning LLM returned invalid todos format (expected array).');
                continue; // Retry
              }

              const todos: TodoItem[] = rawTodos.map((todo: any, index: number) => ({
                id: todo.id || `todo-${Date.now()}-${index}`,
                title: todo.title || 'Untitled task',
                // First TODO starts as in_progress, rest are pending
                status: (index === 0 ? 'in_progress' : 'pending') as TodoItem['status'],
              }));

              logger.exit('PlanningLLM.generateTODOList', { todoCount: todos.length });

              return {
                todos,
                complexity: toolArgs.complexity || 'moderate',
                clarificationMessages: clarificationMessages.length > 0 ? clarificationMessages : undefined,
              };
            }

            // Handle respond_to_user - direct response without TODOs
            if (toolName === 'respond_to_user') {
              logger.flow('Direct response via respond_to_user tool');
              const responseText = toolArgs.response || '';

              if (!responseText) {
                logger.warn('respond_to_user called with empty response');
                lastError = new Error('Planning LLM returned empty response.');
                continue; // Retry
              }

              logger.exit('PlanningLLM.generateTODOList', { directResponse: true });

              return {
                todos: [],
                complexity: 'simple',
                directResponse: responseText,
                clarificationMessages: clarificationMessages.length > 0 ? clarificationMessages : undefined,
              };
            }

            // Unknown tool - retry
            logger.warn(`Unknown tool called: ${toolName}`);
            lastError = new Error(`Invalid tool "${toolName}". You only have 3 tools: ask_to_user, create_todos, or respond_to_user. Tools like write_todos are for Execution LLM, not Planning LLM.`);
            continue; // Retry
          }

          // No tool call - this should not happen with tool_choice: "required"
          const contentOnly = message?.content;
          if (contentOnly) {
            logger.warn(`Planning LLM returned content without tool call (attempt ${attempt}/${MAX_RETRIES})`, {
              contentPreview: contentOnly.substring(0, 100),
            });
            lastError = new Error(
              'You MUST call one of your tools: ask_to_user, create_todos, or respond_to_user. Do NOT respond with plain text.'
            );
          } else {
            logger.warn(`Planning LLM returned no tool call and no content (attempt ${attempt}/${MAX_RETRIES})`);
            lastError = new Error('Planning LLM must use one of: ask_to_user, create_todos, or respond_to_user');
          }
          // Continue to next retry
        } catch (error) {
          // Network or API error - will retry
          logger.warn(`Planning LLM error (attempt ${attempt}/${MAX_RETRIES}):`, error as Error);
          lastError = error as Error;
          // Continue to next retry
        }
      }

      // If ask_to_user was successful, continue main loop for next LLM call
      if (shouldContinueMainLoop) {
        continue;
      }

      // All retries exhausted without successful ask_to_user - break to fallback
      break;
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
      clarificationMessages: clarificationMessages.length > 0 ? clarificationMessages : undefined,
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
    const docsBasePath = path.join(os.homedir(), '.hanseol', 'docs');

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
