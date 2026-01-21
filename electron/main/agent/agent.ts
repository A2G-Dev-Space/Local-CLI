/**
 * Agent for Electron
 * Main agent loop with tool execution
 * Includes Planning LLM for TODO auto-generation
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { BrowserWindow } from 'electron';
import { llmClient, Message } from '../llm-client';
import { logger } from '../logger';
import { toolRegistry } from './tools';
import { OptionalToolGroupId } from './tool-definitions';
import {
  executeTool,
  parseToolArguments,
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
  setToolExecutionCallback,
  setWorkingDirectory,
  TodoItem,
  AskUserRequest,
  AskUserResponse,
} from './tool-executor';
import {
  setGetTodosCallback,
  setFinalResponseCallback,
  clearFinalResponseCallbacks,
} from './tools/todo';
import { buildPlanExecutePrompt, buildTodoContext } from './system-prompt';
import { PlanningLLM } from './planning-llm';
import { getContextTracker } from './context-tracker';
import { validateToolMessages, truncateMessages } from './message-utils';
import { hasDocsAvailable } from './docs-manager';

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
  maxIterations?: number;
  enabledToolGroups?: OptionalToolGroupId[];
  workingDirectory?: string;
  isGitRepo?: boolean;
  enablePlanning?: boolean; // Enable Planning LLM for TODO auto-generation
  resumeTodos?: boolean; // Resume from existing TODOs instead of creating new plan
  autoMode?: boolean; // true = allow all permissions, false = supervised mode (ask for approval)
}

export interface AgentCallbacks {
  onMessage?: (message: Message) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string, success: boolean) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onTellUser?: (message: string) => void;
  onAskUser?: (request: AskUserRequest) => Promise<AskUserResponse>;
  onStreamChunk?: (chunk: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
}

export interface AgentResult {
  success: boolean;
  response: string;
  messages: Message[];
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }>;
  iterations: number;
  error?: string;
}

// =============================================================================
// Agent State
// =============================================================================

interface AgentState {
  isRunning: boolean;
  abortController: AbortController | null;
  currentTodos: TodoItem[];
  mainWindow: BrowserWindow | null;
}

const state: AgentState = {
  isRunning: false,
  abortController: null,
  currentTodos: [],
  mainWindow: null,
};

// =============================================================================
// Agent Setup
// =============================================================================

/**
 * Set the main window reference for IPC communication
 */
export function setAgentMainWindow(window: BrowserWindow | null): void {
  state.mainWindow = window;
}

/**
 * Check if agent is currently running
 */
export function isAgentRunning(): boolean {
  return state.isRunning;
}

/**
 * Abort the current agent execution
 */
export function abortAgent(): void {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.isRunning = false;
  llmClient.abort();
  logger.info('Agent aborted');
}

/**
 * Get current todos
 */
export function getCurrentTodos(): TodoItem[] {
  return [...state.currentTodos];
}

/**
 * Set current todos (for initialization)
 */
export function setCurrentTodos(todos: TodoItem[]): void {
  state.currentTodos = [...todos];
}

// =============================================================================
// Main Agent Execution
// =============================================================================

/**
 * Run the agent with a user message
 */
export async function runAgent(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  const {
    maxIterations = 50,
    enabledToolGroups: _enabledToolGroups = [], // Config provided but registry controls this
    workingDirectory = process.cwd(),
    isGitRepo = false,
    enablePlanning = true, // Default: enable planning
    resumeTodos = false,
  } = config;

  logger.info('Starting agent', {
    userMessage: userMessage.substring(0, 100),
    existingMessagesCount: existingMessages.length,
    workingDirectory,
    maxIterations,
    enablePlanning,
    resumeTodos,
  });

  // Initialize state
  state.isRunning = true;
  state.abortController = new AbortController();

  // Set working directory for tool executor
  setWorkingDirectory(workingDirectory);

  // Setup callbacks
  setTodoWriteCallback(async (todos: TodoItem[]) => {
    state.currentTodos = todos;
    if (callbacks.onTodoUpdate) {
      callbacks.onTodoUpdate(todos);
    }
    // Send to renderer
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:todoUpdate', todos);
    }
    return true;
  });

  // Setup final_response callbacks
  setGetTodosCallback(() => state.currentTodos);
  setFinalResponseCallback((message: string) => {
    // Final response will be handled in the agent loop
    logger.flow('Final response callback received', { messageLength: message.length });
  });

  setTellToUserCallback((message: string) => {
    if (callbacks.onTellUser) {
      callbacks.onTellUser(message);
    }
    // Send to renderer
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:tellUser', message);
    }
  });

  setAskUserCallback(async (request: AskUserRequest) => {
    if (callbacks.onAskUser) {
      return callbacks.onAskUser(request);
    }
    // Default: return first option
    return {
      selectedOption: request.options[0],
      isOther: false,
    };
  });

  setToolExecutionCallback((toolName: string, args: Record<string, unknown>) => {
    if (callbacks.onToolCall) {
      callbacks.onToolCall(toolName, args);
    }
    // Send to renderer
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:toolCall', { toolName, args });
    }
  });

  // Get tools from registry (includes core + enabled optional tools)
  const tools = toolRegistry.getLLMToolDefinitions();

  // Get enabled optional tool groups from registry (not from config)
  // This ensures planning LLM knows about tools enabled via Settings UI
  const actualEnabledToolGroups = toolRegistry.getEnabledToolGroupIds() as OptionalToolGroupId[];
  logger.info('Enabled tool groups from registry', { enabledToolGroups: actualEnabledToolGroups });

  // Build system prompt
  const systemPrompt = buildPlanExecutePrompt({
    enabledToolGroups: actualEnabledToolGroups,
    workingDirectory,
    isGitRepo,
  });

  // Initialize context tracker (used for future context management)
  void getContextTracker();

  // ==========================================================================
  // Planning Phase (if enabled and not resuming)
  // ==========================================================================
  if (enablePlanning && !resumeTodos && state.currentTodos.length === 0) {
    logger.flow('Starting planning phase');

    // Check for abort
    if (state.abortController?.signal.aborted) {
      throw new Error('Agent aborted');
    }

    try {
      const planningLLM = new PlanningLLM(actualEnabledToolGroups);

      // Check if docs are available for search
      const docsAvailable = await hasDocsAvailable();

      // Generate TODO list with docs decision
      const planningResult = await planningLLM.generateTODOListWithDocsDecision(
        userMessage,
        docsAvailable,
        existingMessages
      );

      // Handle direct response (questions, greetings)
      if (planningResult.directResponse) {
        logger.flow('Planning returned direct response, skipping execution');

        // Notify callback
        if (callbacks.onComplete) {
          callbacks.onComplete(planningResult.directResponse);
        }

        // Send to renderer
        if (state.mainWindow) {
          state.mainWindow.webContents.send('agent:complete', {
            response: planningResult.directResponse,
          });
        }

        state.isRunning = false;
        state.abortController = null;

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
        state.currentTodos = planningResult.todos;

        if (callbacks.onTodoUpdate) {
          callbacks.onTodoUpdate(planningResult.todos);
        }

        // Send to renderer
        if (state.mainWindow) {
          state.mainWindow.webContents.send('agent:todoUpdate', planningResult.todos);
        }

        logger.info('Planning complete', {
          todoCount: planningResult.todos.length,
          complexity: planningResult.complexity,
          docsSearchNeeded: planningResult.docsSearchNeeded,
        });
      }
    } catch (planningError) {
      logger.error('Planning failed, falling back to direct execution', planningError as Error);
      // Continue without planning - agent will work without predefined TODOs
    }
  }

  // ==========================================================================
  // Prepare Messages
  // ==========================================================================

  // Validate and clean existing messages
  let messages: Message[] = validateToolMessages([...existingMessages]);

  // Truncate if too many messages
  messages = truncateMessages(messages, 100);

  // Add system message if not present
  const hasSystemMessage = messages.some((m) => m.role === 'system');
  if (!hasSystemMessage) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }

  // Add TODO context to user message
  const todoContext = buildTodoContext(state.currentTodos);
  const userMessageWithContext = todoContext
    ? userMessage + todoContext
    : userMessage;

  // Add user message
  messages.push({ role: 'user', content: userMessageWithContext });

  // Notify callback
  if (callbacks.onMessage) {
    callbacks.onMessage({ role: 'user', content: userMessage });
  }

  // Tool call history
  const toolCallHistory: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }> = [];

  let iterations = 0;
  let finalResponse = '';
  let noToolCallRetries = 0;
  const MAX_NO_TOOL_CALL_RETRIES = 3;

  try {
    // Agent loop
    while (state.isRunning && iterations < maxIterations) {
      iterations++;

      logger.info(`Agent iteration ${iterations}`, { messagesCount: messages.length });

      // Check for abort
      if (state.abortController?.signal.aborted) {
        throw new Error('Agent aborted');
      }

      // Call LLM
      const response = await llmClient.chatCompletion({
        messages,
        tools,
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from LLM');
      }

      // Add assistant message to history
      messages.push(assistantMessage);

      // Notify callback
      if (callbacks.onMessage) {
        callbacks.onMessage(assistantMessage);
      }

      // Send to renderer
      if (state.mainWindow) {
        state.mainWindow.webContents.send('agent:message', assistantMessage);
      }

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Execute tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          // Check for abort
          if (state.abortController?.signal.aborted) {
            throw new Error('Agent aborted');
          }

          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = parseToolArguments(toolCall.function.arguments);
          } catch (parseError) {
            const errorMessage = `Error parsing tool arguments: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`;
            logger.error('Tool argument parse error', { toolName, error: errorMessage });

            // Add error result
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

          logger.info(`Executing tool: ${toolName}`, { args: JSON.stringify(toolArgs).substring(0, 200) });

          // Execute tool
          const result = await executeTool(toolName, toolArgs);

          const toolResultContent = result.success
            ? result.result || '(no output)'
            : `Error: ${result.error}`;

          logger.info(`Tool result: ${toolName}`, {
            success: result.success,
            resultLength: toolResultContent.length,
          });

          // Handle final_response tool specially
          if (toolName === 'final_response' && result.success && result.metadata?.['isFinalResponse']) {
            logger.flow('final_response tool executed successfully - returning');
            finalResponse = result.result || '';

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: toolResultContent,
              tool_call_id: toolCall.id,
            });

            // Track tool call
            toolCallHistory.push({
              tool: toolName,
              args: toolArgs,
              result: toolResultContent,
              success: result.success,
            });

            // Notify callbacks and renderer
            if (callbacks.onToolResult) {
              callbacks.onToolResult(toolName, toolResultContent, result.success);
            }
            if (state.mainWindow) {
              state.mainWindow.webContents.send('agent:toolResult', {
                toolName,
                result: toolResultContent,
                success: result.success,
              });
            }

            // Return early - this is the final response
            if (callbacks.onComplete) {
              callbacks.onComplete(finalResponse);
            }
            if (state.mainWindow) {
              state.mainWindow.webContents.send('agent:complete', { response: finalResponse });
            }

            return {
              success: true,
              response: finalResponse,
              messages,
              toolCalls: toolCallHistory,
              iterations,
            };
          }

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: toolResultContent,
            tool_call_id: toolCall.id,
          });

          // Track tool call
          toolCallHistory.push({
            tool: toolName,
            args: toolArgs,
            result: toolResultContent,
            success: result.success,
          });

          // Notify callback
          if (callbacks.onToolResult) {
            callbacks.onToolResult(toolName, toolResultContent, result.success);
          }

          // Send to renderer
          if (state.mainWindow) {
            state.mainWindow.webContents.send('agent:toolResult', {
              toolName,
              result: toolResultContent,
              success: result.success,
            });
          }
        }
      } else {
        // No tool calls - enforce tool usage
        noToolCallRetries++;
        logger.flow(`No tool call - enforcing tool usage (attempt ${noToolCallRetries}/${MAX_NO_TOOL_CALL_RETRIES})`);

        // Max retries exceeded - return content as final response
        if (noToolCallRetries > MAX_NO_TOOL_CALL_RETRIES) {
          logger.warn('Max no-tool-call retries exceeded - returning content as final response');
          finalResponse = assistantMessage.content || 'Task completed.';
          break;
        }

        // Add retry instruction
        messages.push({
          role: 'user',
          content: 'You must use tools for all actions. Use final_response tool to deliver your final message to the user after completing all tasks.',
        });

        // Continue loop to retry
        continue;
      }
    }

    // Check if we hit max iterations
    if (iterations >= maxIterations) {
      logger.warn('Agent hit max iterations', { maxIterations });
      finalResponse = 'Maximum iterations reached. The task may be incomplete.';
    }

    // Notify completion
    if (callbacks.onComplete) {
      callbacks.onComplete(finalResponse);
    }

    // Send to renderer
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:complete', { response: finalResponse });
    }

    return {
      success: true,
      response: finalResponse,
      messages,
      toolCalls: toolCallHistory,
      iterations,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Agent error', { error: errorMessage });

    // Notify error
    if (callbacks.onError) {
      callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
    }

    // Send to renderer
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:error', { error: errorMessage });
    }

    return {
      success: false,
      response: '',
      messages,
      toolCalls: toolCallHistory,
      iterations,
      error: errorMessage,
    };
  } finally {
    state.isRunning = false;
    state.abortController = null;

    // Clear callbacks
    setTodoWriteCallback(null);
    setTellToUserCallback(null);
    setAskUserCallback(null);
    setToolExecutionCallback(null);
    clearFinalResponseCallbacks();
  }
}

// =============================================================================
// Streaming Agent (for real-time response)
// =============================================================================

/**
 * Run agent with streaming response
 * Note: Streaming only applies to the final response, not tool calls
 */
export async function runAgentStream(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  // For now, use non-streaming implementation
  // Streaming with tools is complex due to tool execution interrupting the stream
  // TODO: Implement true streaming with tool execution
  return runAgent(userMessage, existingMessages, config, callbacks);
}

// =============================================================================
// Simple Chat (no planning/tools)
// =============================================================================

/**
 * Simple chat without tools (for basic Q&A)
 */
export async function simpleChat(
  userMessage: string,
  existingMessages: Message[] = [],
  systemPrompt?: string,
  onChunk?: (chunk: string) => void
): Promise<{ response: string; messages: Message[] }> {
  logger.info('Simple chat', { userMessage: userMessage.substring(0, 100) });

  let messages: Message[] = [...existingMessages];

  // Add system message if provided and not present
  if (systemPrompt && !messages.some((m) => m.role === 'system')) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }

  // Add user message
  messages.push({ role: 'user', content: userMessage });

  try {
    if (onChunk) {
      // Streaming response
      const result = await llmClient.chatCompletionStream(
        { messages },
        (chunk, done) => {
          if (!done && chunk) {
            onChunk(chunk);
          }
        }
      );

      const assistantMessage: Message = { role: 'assistant', content: result.content };
      messages.push(assistantMessage);

      return { response: result.content, messages };
    } else {
      // Non-streaming response
      const result = await llmClient.chat(messages, false);
      messages.push(result.message);

      return { response: result.content, messages };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Simple chat error', { error: errorMessage });
    throw error;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  runAgent,
  runAgentStream,
  simpleChat,
  abortAgent,
  isAgentRunning,
  getCurrentTodos,
  setCurrentTodos,
  setAgentMainWindow,
};
