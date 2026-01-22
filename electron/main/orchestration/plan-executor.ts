/**
 * Plan Executor for Electron
 * Core execution logic for TODO-based plan execution
 *
 * This is the main orchestration module that:
 * 1. Receives user requests
 * 2. Generates TODOs via Planning LLM (if enabled)
 * 3. Executes TODOs using tools
 * 4. Handles auto-compact when context is near limit
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { logger } from '../utils/logger';
import type { Message, ToolDefinition } from '../core/llm';
import { getContextTracker } from '../core/compact';
import { PlanningLLM } from '../agents/planner';
import { buildPlanExecutePrompt } from '../prompts/system/plan-execute';
import {
  validateToolMessages,
  truncateMessages,
  buildTodoContext,
  parseToolArguments,
} from './utils';
import type {
  TodoItem,
  ExecutorConfig,
  ExecutorCallbacks,
  ExecutionResult,
  ToolCallRecord,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_ITERATIONS = 50;
const MAX_NO_TOOL_CALL_RETRIES = 3;
const AUTO_COMPACT_THRESHOLD_PERCENT = 70;

// =============================================================================
// Plan Executor Class
// =============================================================================

export class PlanExecutor {
  private llmClient: {
    chatCompletion: (options: {
      messages: Message[];
      tools?: ToolDefinition[];
      temperature?: number;
    }) => Promise<{
      choices: Array<{
        message: Message & {
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>;
    sendMessage: (userMessage: string, systemPrompt?: string) => Promise<string>;
    abort: () => void;
    resetInterrupt: () => void;
  };

  private toolExecutor: {
    execute: (toolName: string, args: Record<string, unknown>) => Promise<{
      success: boolean;
      result?: string;
      error?: string;
      metadata?: Record<string, unknown>;
    }>;
  };

  private getTools: () => ToolDefinition[];
  private getToolSummary: () => string;

  // State
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  private currentTodos: TodoItem[] = [];
  private workingDirectory: string = process.cwd();

  // Callbacks
  private callbacks: ExecutorCallbacks = {};

  constructor(
    llmClient: PlanExecutor['llmClient'],
    toolExecutor: PlanExecutor['toolExecutor'],
    getTools: () => ToolDefinition[],
    getToolSummary: () => string
  ) {
    this.llmClient = llmClient;
    this.toolExecutor = toolExecutor;
    this.getTools = getTools;
    this.getToolSummary = getToolSummary;
  }

  // ==========================================================================
  // Getters / Setters
  // ==========================================================================

  isExecuting(): boolean {
    return this.isRunning;
  }

  getTodos(): TodoItem[] {
    return [...this.currentTodos];
  }

  setTodos(todos: TodoItem[]): void {
    this.currentTodos = [...todos];
    this.callbacks.onTodoUpdate?.(this.currentTodos);
  }

  setCallbacks(callbacks: ExecutorCallbacks): void {
    this.callbacks = callbacks;
  }

  setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  // ==========================================================================
  // Abort
  // ==========================================================================

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
    this.llmClient.abort();
    logger.info('PlanExecutor aborted');
  }

  // ==========================================================================
  // Main Execution
  // ==========================================================================

  async execute(
    userMessage: string,
    existingMessages: Message[] = [],
    config: ExecutorConfig = {}
  ): Promise<ExecutionResult> {
    const {
      maxIterations = DEFAULT_MAX_ITERATIONS,
      workingDirectory = this.workingDirectory,
      isGitRepo = false,
      enablePlanning = true,
      resumeTodos = false,
    } = config;

    logger.info('PlanExecutor starting', {
      userMessage: userMessage.substring(0, 100),
      existingMessagesCount: existingMessages.length,
      workingDirectory,
      maxIterations,
      enablePlanning,
      resumeTodos,
    });

    // Initialize state
    this.isRunning = true;
    this.abortController = new AbortController();
    this.workingDirectory = workingDirectory;
    this.llmClient.resetInterrupt();

    // Initialize context tracker
    const contextTracker = getContextTracker();

    // Tool call history
    const toolCallHistory: ToolCallRecord[] = [];

    try {
      // =======================================================================
      // Planning Phase
      // =======================================================================
      if (enablePlanning && !resumeTodos && this.currentTodos.length === 0) {
        logger.flow('Starting planning phase');

        if (this.abortController.signal.aborted) {
          throw new Error('Agent aborted');
        }

        try {
          const planningLLM = new PlanningLLM(
            this.llmClient,
            this.getToolSummary
          );

          // Generate TODO list with docs decision (docs availability checked internally)
          const planningResult = await planningLLM.generateTODOListWithDocsDecision(
            userMessage,
            existingMessages
          );

          // Handle direct response
          if (planningResult.directResponse) {
            logger.flow('Planning returned direct response');
            this.callbacks.onComplete?.(planningResult.directResponse);

            return {
              success: true,
              response: planningResult.directResponse,
              messages: existingMessages,
              toolCalls: [],
              iterations: 0,
            };
          }

          // Update TODOs
          if (planningResult.todos.length > 0) {
            this.currentTodos = planningResult.todos;
            this.callbacks.onTodoUpdate?.(this.currentTodos);

            logger.info('Planning complete', {
              todoCount: planningResult.todos.length,
              complexity: planningResult.complexity,
            });
          }
        } catch (planningError) {
          logger.error('Planning failed, falling back to direct execution', planningError as Error);
        }
      }

      // =======================================================================
      // Prepare Messages
      // =======================================================================
      let messages = validateToolMessages([...existingMessages]);
      messages = truncateMessages(messages, 100);

      // Build system prompt
      const systemPrompt = buildPlanExecutePrompt({
        toolSummary: this.getToolSummary(),
        workingDirectory,
        isGitRepo,
      });

      // Add system message if not present
      if (!messages.some((m) => m.role === 'system')) {
        messages = [{ role: 'system', content: systemPrompt }, ...messages];
      }

      // Add TODO context to user message
      const todoContext = buildTodoContext(this.currentTodos);
      const userMessageWithContext = todoContext
        ? userMessage + todoContext
        : userMessage;

      messages.push({ role: 'user', content: userMessageWithContext });
      this.callbacks.onMessage?.({ role: 'user', content: userMessage });

      // =======================================================================
      // Execution Loop
      // =======================================================================
      let iterations = 0;
      let finalResponse = '';
      let noToolCallRetries = 0;
      const tools = this.getTools();

      while (this.isRunning && iterations < maxIterations) {
        iterations++;
        logger.info(`PlanExecutor iteration ${iterations}`, { messagesCount: messages.length });

        // Check for abort
        if (this.abortController?.signal.aborted) {
          throw new Error('Agent aborted');
        }

        // Check for auto-compact
        const usage = contextTracker.getContextUsage();
        if (usage.usagePercent >= AUTO_COMPACT_THRESHOLD_PERCENT) {
          this.callbacks.onContextWarning?.(usage.usagePercent);
          logger.warn('Context near limit, consider compact', { usagePercent: usage.usagePercent });
        }

        // Call LLM
        const response = await this.llmClient.chatCompletion({
          messages,
          tools,
          temperature: 0.7,
        });

        // Update context tracker
        if (response.usage) {
          contextTracker.updateUsage(
            response.usage.prompt_tokens,
            response.usage.completion_tokens
          );
        }

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
          throw new Error('No response from LLM');
        }

        messages.push(assistantMessage as Message);
        this.callbacks.onMessage?.(assistantMessage as Message);

        // Check for tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          for (const toolCall of assistantMessage.tool_calls) {
            if (this.abortController?.signal.aborted) {
              throw new Error('Agent aborted');
            }

            const toolName = toolCall.function.name;
            let toolArgs: Record<string, unknown>;

            try {
              toolArgs = parseToolArguments(toolCall.function.arguments);
            } catch (parseError) {
              const errorMessage = `Error parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`;
              logger.error('Tool argument parse error', { toolName, error: errorMessage });

              messages.push({
                role: 'tool',
                content: errorMessage,
                tool_call_id: toolCall.id,
              });

              toolCallHistory.push({
                tool: toolName,
                args: {},
                result: errorMessage,
                success: false,
              });

              continue;
            }

            this.callbacks.onToolCall?.(toolName, toolArgs);
            logger.info(`Executing tool: ${toolName}`);

            // Execute tool
            const result = await this.toolExecutor.execute(toolName, toolArgs);
            const resultContent = result.success
              ? result.result || '(no output)'
              : `Error: ${result.error}`;

            // Handle final_response specially
            if (toolName === 'final_response' && result.success && result.metadata?.['isFinalResponse']) {
              logger.flow('final_response executed - returning');
              finalResponse = result.result || '';

              messages.push({
                role: 'tool',
                content: resultContent,
                tool_call_id: toolCall.id,
              });

              toolCallHistory.push({
                tool: toolName,
                args: toolArgs,
                result: resultContent,
                success: result.success,
              });

              this.callbacks.onToolResult?.(toolName, resultContent, result.success);
              this.callbacks.onComplete?.(finalResponse);

              return {
                success: true,
                response: finalResponse,
                messages,
                toolCalls: toolCallHistory,
                iterations,
              };
            }

            // Add tool result
            messages.push({
              role: 'tool',
              content: resultContent,
              tool_call_id: toolCall.id,
            });

            toolCallHistory.push({
              tool: toolName,
              args: toolArgs,
              result: resultContent,
              success: result.success,
            });

            this.callbacks.onToolResult?.(toolName, resultContent, result.success);
          }
        } else {
          // No tool calls - enforce usage
          noToolCallRetries++;
          logger.flow(`No tool call (attempt ${noToolCallRetries}/${MAX_NO_TOOL_CALL_RETRIES})`);

          if (noToolCallRetries > MAX_NO_TOOL_CALL_RETRIES) {
            logger.warn('Max retries exceeded - returning content');
            finalResponse = assistantMessage.content || 'Task completed.';
            break;
          }

          messages.push({
            role: 'user',
            content: 'You must use tools for all actions. Use final_response tool to deliver your final message after completing all tasks.',
          });
        }
      }

      // Check max iterations
      if (iterations >= maxIterations) {
        logger.warn('Max iterations reached');
        finalResponse = 'Maximum iterations reached. Task may be incomplete.';
      }

      this.callbacks.onComplete?.(finalResponse);

      return {
        success: true,
        response: finalResponse,
        messages,
        toolCalls: toolCallHistory,
        iterations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('PlanExecutor error', { error: errorMessage });

      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        response: '',
        messages: existingMessages,
        toolCalls: toolCallHistory,
        iterations: 0,
        error: errorMessage,
      };
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  // ==========================================================================
  // Resume Execution
  // ==========================================================================

  async resumeTodoExecution(
    existingMessages: Message[],
    config: ExecutorConfig = {}
  ): Promise<ExecutionResult> {
    if (this.currentTodos.length === 0) {
      return {
        success: false,
        response: 'No TODOs to resume.',
        messages: existingMessages,
        toolCalls: [],
        iterations: 0,
        error: 'No TODOs to resume',
      };
    }

    // Find incomplete TODOs
    const incompleteTodos = this.currentTodos.filter(
      (t) => t.status !== 'completed' && t.status !== 'failed'
    );

    if (incompleteTodos.length === 0) {
      return {
        success: true,
        response: 'All TODOs are already completed.',
        messages: existingMessages,
        toolCalls: [],
        iterations: 0,
      };
    }

    // Build resume message
    const resumeMessage = `Resume execution of the following TODOs:
${incompleteTodos.map((t) => `- ${t.title}`).join('\n')}

Continue from where you left off. Update TODO status as you work.`;

    return this.execute(resumeMessage, existingMessages, {
      ...config,
      enablePlanning: false,
      resumeTodos: true,
    });
  }

  // ==========================================================================
  // Perform Compact
  // ==========================================================================

  async performCompact(
    messages: Message[],
    compactManager: {
      compact: (messages: Message[], context: { workingDirectory?: string }) => Promise<{
        success: boolean;
        compactedMessages?: Message[];
        error?: string;
      }>;
    }
  ): Promise<Message[]> {
    logger.flow('Performing compact');

    const result = await compactManager.compact(messages, {
      workingDirectory: this.workingDirectory,
    });

    if (result.success && result.compactedMessages) {
      const contextTracker = getContextTracker();
      contextTracker.resetAutoCompactTrigger();
      logger.info('Compact completed', { newMessageCount: result.compactedMessages.length });
      return result.compactedMessages;
    }

    logger.warn('Compact failed', { error: result.error });
    return messages;
  }
}

// =============================================================================
// Export
// =============================================================================

export default PlanExecutor;
