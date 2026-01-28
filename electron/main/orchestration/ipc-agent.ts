/**
 * IPC Agent for Electron
 *
 * Wrapper functions for IPC communication with renderer process.
 * Provides runAgent, abortAgent, simpleChat for ipc-handlers.ts
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 * CLI parity: This is Electron-specific - CLI uses React hooks directly with PlanExecutor
 */

import { BrowserWindow } from 'electron';
import { llmClient, Message } from '../core/llm';
import { logger } from '../utils/logger';
import { detectGitRepo } from '../utils/git-utils';
import { toolRegistry, executeSimpleTool } from '../tools';
import { OptionalToolGroupId } from '../tools/types';
import {
  setWorkingDirectory,
  setTodoWriteCallback,
  setTellToUserCallback,
  setAskUserCallback,
  setGetTodosCallback,
  setFinalResponseCallback,
  clearFinalResponseCallbacks,
  setToolExecutionCallback,
  setToolResponseCallback,
} from '../tools';
import { PLAN_EXECUTE_SYSTEM_PROMPT, buildPlanExecutePrompt } from '../prompts';
import { GIT_COMMIT_RULES } from '../prompts/shared/git-rules';
import { PlanningLLM } from '../agents/planner';
import { getContextTracker } from '../core/compact';
import {
  validateToolMessages,
  truncateMessages,
  buildTodoContext,
  parseToolArguments,
} from './utils';
import { compactConversation } from '../core/compact';
import type { TodoItem, AskUserRequest, AskUserResponse } from './types';

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
  // maxIterations removed - CLI parity: no iteration limit
  enabledToolGroups?: OptionalToolGroupId[];
  workingDirectory?: string;
  enablePlanning?: boolean;
  resumeTodos?: boolean;
  autoMode?: boolean;
}

// =============================================================================
// System Prompt Builder (CLI parity: plan-executor.ts buildSystemPrompt)
// =============================================================================

/**
 * Build system prompt with conditional Git rules
 * Git rules are only added when .git folder exists in working directory
 *
 * CLI parity: src/orchestration/plan-executor.ts buildSystemPrompt()
 */
function buildSystemPrompt(workingDirectory: string): string {
  const isGitRepo = detectGitRepo(workingDirectory);

  // Build base prompt with tool summary and working directory
  const toolSummary = toolRegistry.getToolSummaryForPlanning();
  let prompt = buildPlanExecutePrompt({ toolSummary, workingDirectory });

  // Add Git rules conditionally (CLI parity)
  if (isGitRepo) {
    prompt += `\n\n${GIT_COMMIT_RULES}`;
    logger.debug('Git repo detected - added GIT_COMMIT_RULES to prompt');
  }

  return prompt;
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

export function setAgentMainWindow(window: BrowserWindow | null): void {
  state.mainWindow = window;
}

export function isAgentRunning(): boolean {
  return state.isRunning;
}

export function abortAgent(): void {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.isRunning = false;
  llmClient.abort();
  logger.info('Agent aborted');
}

export function getCurrentTodos(): TodoItem[] {
  return [...state.currentTodos];
}

export function setCurrentTodos(todos: TodoItem[]): void {
  state.currentTodos = [...todos];
}

// =============================================================================
// Main Agent Execution
// =============================================================================

export async function runAgent(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  const {
    // maxIterations removed - CLI parity: no iteration limit, runs until LLM stops
    workingDirectory = process.cwd(),
    enablePlanning = true,
    resumeTodos = false,
  } = config;

  logger.info('Starting agent', {
    userMessage: userMessage.substring(0, 100),
    existingMessagesCount: existingMessages.length,
    workingDirectory,
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
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:todoUpdate', todos);
    }
    return true;
  });

  setGetTodosCallback(() => state.currentTodos);
  setFinalResponseCallback((message: string) => {
    logger.flow('Final response callback received', { messageLength: message.length });
  });

  setTellToUserCallback((message: string) => {
    if (callbacks.onTellUser) {
      callbacks.onTellUser(message);
    }
    if (state.mainWindow) {
      state.mainWindow.webContents.send('agent:tellUser', message);
    }
  });

  setAskUserCallback(async (request: AskUserRequest) => {
    if (callbacks.onAskUser) {
      return callbacks.onAskUser(request);
    }
    return {
      selectedOption: request.options[0],
      isOther: false,
    };
  });

  // Tool execution callback - send to renderer for UI display
  setToolExecutionCallback((toolName: string, reason: string, args: Record<string, unknown>) => {
    if (callbacks.onToolExecution) {
      callbacks.onToolExecution(toolName, reason, args);
    }
    if (state.mainWindow) {
      // Use agent:toolCall to match preload's onToolCall listener
      state.mainWindow.webContents.send('agent:toolCall', { toolName, args: { ...args, reason } });
    }
  });

  // Tool response callback - send to renderer for UI display
  setToolResponseCallback((toolName: string, success: boolean, result: string) => {
    if (callbacks.onToolResponse) {
      callbacks.onToolResponse(toolName, success, result);
    }
    if (state.mainWindow) {
      // Use agent:toolResult to match preload's onToolResult listener
      state.mainWindow.webContents.send('agent:toolResult', { toolName, success, result });
    }
  });

  // Get tools from registry
  const tools = toolRegistry.getLLMToolDefinitions();
  const actualEnabledToolGroups = toolRegistry.getEnabledToolGroupIds() as OptionalToolGroupId[];
  logger.info('Enabled tool groups from registry', { enabledToolGroups: actualEnabledToolGroups });

  // Build system prompt with Git rules if applicable (CLI parity)
  const systemPrompt = buildSystemPrompt(workingDirectory);

  // Initialize context tracker
  void getContextTracker();

  // ==========================================================================
  // Planning Phase
  // ==========================================================================
  if (enablePlanning && !resumeTodos && state.currentTodos.length === 0) {
    logger.flow('Starting planning phase');

    if (state.abortController?.signal.aborted) {
      throw new Error('Agent aborted');
    }

    try {
      // Create PlanningLLM with proper arguments (llmClient and getToolSummary function)
      const planningLLM = new PlanningLLM(
        llmClient,
        () => toolRegistry.getToolSummaryForPlanning()
      );

      // Set ask-user callback for Planning LLM (enables ask_to_user during planning)
      planningLLM.setAskUserCallback(async (request: AskUserRequest) => {
        if (callbacks.onAskUser) {
          return callbacks.onAskUser(request);
        }
        return {
          selectedOption: request.options[0],
          isOther: false,
        };
      });

      const planningResult = await planningLLM.generateTODOListWithDocsDecision(
        userMessage,
        existingMessages
      );

      if (planningResult.directResponse) {
        logger.flow('Planning returned direct response, skipping execution');

        // Chat 로그: 사용자 입력 및 어시스턴트 응답
        logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });
        logger.info('[CHAT] Assistant response (direct)', { content: planningResult.directResponse.substring(0, 500) });

        if (callbacks.onComplete) {
          callbacks.onComplete(planningResult.directResponse);
        }
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

      if (planningResult.todos.length > 0) {
        state.currentTodos = planningResult.todos;

        if (callbacks.onTodoUpdate) {
          callbacks.onTodoUpdate(planningResult.todos);
        }
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
    }
  }

  // ==========================================================================
  // Prepare Messages
  // ==========================================================================
  let messages: Message[] = validateToolMessages([...existingMessages]);
  messages = truncateMessages(messages, 100);

  const hasSystemMessage = messages.some((m) => m.role === 'system');
  if (!hasSystemMessage) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }

  const todoContext = buildTodoContext(state.currentTodos);
  const userMessageWithContext = todoContext ? userMessage + todoContext : userMessage;

  messages.push({ role: 'user', content: userMessageWithContext });

  // Chat 로그: 사용자 입력
  logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });

  // Send user message to renderer and callbacks
  const userMessageObj = { role: 'user' as const, content: userMessage };
  if (callbacks.onMessage) {
    callbacks.onMessage(userMessageObj);
  }
  if (state.mainWindow) {
    state.mainWindow.webContents.send('agent:message', userMessageObj);
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
  let contextCompactRetried = false;
  let finalResponseFailures = 0;
  const MAX_FINAL_RESPONSE_FAILURES = 3;
  const SOFT_ITERATION_LIMIT = 50; // Warn after this many iterations (informational only)
  let softLimitWarned = false;

  try {
    // CLI parity: no iteration limit - runs until LLM stops calling tools
    while (state.isRunning) {
      iterations++;

      logger.info(`Agent iteration ${iterations}`, { messagesCount: messages.length });

      // Soft warning at 50 iterations (informational only, not a limit)
      if (iterations === SOFT_ITERATION_LIMIT && !softLimitWarned) {
        softLimitWarned = true;
        logger.warn(`Reached ${SOFT_ITERATION_LIMIT} iterations (informational)`);
        messages.push({
          role: 'user',
          content: `You have made ${SOFT_ITERATION_LIMIT} tool calls. Please wrap up and call final_response soon to deliver your results.`,
        });
      }

      if (state.abortController?.signal.aborted) {
        throw new Error('Agent aborted');
      }

      // Call LLM with context length error recovery
      let response;
      try {
        response = await llmClient.chatCompletion({
          messages,
          tools,
          tool_choice: 'required', // Force LLM to call a tool (prevents empty responses)
          temperature: 0.7,
        });
      } catch (llmError) {
        if ((llmError as any).isContextLengthError && !contextCompactRetried) {
          logger.warn('Context length exceeded - attempting auto-compact');
          contextCompactRetried = true;

          if (callbacks.onTellUser) {
            callbacks.onTellUser('컨텍스트 길이 초과로 자동 압축을 시도합니다...');
          }
          if (state.mainWindow) {
            state.mainWindow.webContents.send('agent:tellUser', '컨텍스트 길이 초과로 자동 압축을 시도합니다...');
          }

          const compactResult = await compactConversation(messages, { workingDirectory });

          if (compactResult.success && compactResult.compactedMessages) {
            logger.info('Auto-compact successful', {
              originalCount: compactResult.originalMessageCount,
              newCount: compactResult.newMessageCount,
            });

            const systemMessage = messages.find(m => m.role === 'system');
            messages = systemMessage
              ? [systemMessage, ...compactResult.compactedMessages]
              : compactResult.compactedMessages;

            response = await llmClient.chatCompletion({
              messages,
              tools,
              temperature: 0.7,
            });
          } else {
            logger.error('Auto-compact failed', { error: compactResult.error });
            throw llmError;
          }
        } else {
          throw llmError;
        }
      }

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from LLM');
      }

      messages.push(assistantMessage);

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant message', {
        content: assistantMessage.content?.substring(0, 500),
        hasToolCalls: !!assistantMessage.tool_calls?.length,
        toolCount: assistantMessage.tool_calls?.length || 0,
      });

      if (callbacks.onMessage) {
        callbacks.onMessage(assistantMessage);
      }
      if (state.mainWindow) {
        state.mainWindow.webContents.send('agent:message', assistantMessage);
      }

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
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

          // Execute tool via simple tool executor (CLI parity: uses executeFileTool)
          const result = await executeSimpleTool(toolName, toolArgs);

          const toolResultContent = result.success
            ? result.result || '(no output)'
            : `Error: ${result.error}`;

          logger.info(`Tool result: ${toolName}`, {
            success: result.success,
            resultLength: toolResultContent.length,
          });

          // Handle final_response tool specially
          if (toolName === 'final_response') {
            if (result.success && result.metadata?.['isFinalResponse']) {
              logger.flow('final_response tool executed successfully - returning');
              finalResponse = result.result || '';

              messages.push({
                role: 'tool',
                content: toolResultContent,
                tool_call_id: toolCall.id,
              });

              toolCallHistory.push({
                tool: toolName,
                args: toolArgs,
                result: toolResultContent,
                success: result.success,
              });

              // Send agent:toolResult for final_response - AgentContext will display it as chat message
              // NOTE: simple-tool-executor skips final_response, so we send it here (only once)
              if (state.mainWindow) {
                state.mainWindow.webContents.send('agent:toolResult', {
                  toolName,
                  result: finalResponse,
                  success: result.success,
                });
              }

              // Send agent:complete with empty response to signal completion
              // (the actual message is displayed via agent:toolResult above)
              // Chat 로그: 최종 응답
              logger.info('[CHAT] Final response', { content: finalResponse.substring(0, 500) });

              if (callbacks.onComplete) {
                callbacks.onComplete(finalResponse);
              }
              if (state.mainWindow) {
                state.mainWindow.webContents.send('agent:complete', { response: '' });
              }

              return {
                success: true,
                response: finalResponse,
                messages,
                toolCalls: toolCallHistory,
                iterations,
              };
            } else {
              finalResponseFailures++;
              logger.flow(`final_response failed (attempt ${finalResponseFailures}/${MAX_FINAL_RESPONSE_FAILURES}): ${result.error}`);

              if (finalResponseFailures >= MAX_FINAL_RESPONSE_FAILURES) {
                logger.warn('Max final_response failures exceeded - forcing completion');
                const fallbackMessage = (toolArgs['message'] as string) || 'Task completed with incomplete TODOs.';

                messages.push({
                  role: 'tool',
                  content: fallbackMessage,
                  tool_call_id: toolCall.id,
                });

                toolCallHistory.push({
                  tool: toolName,
                  args: toolArgs,
                  result: fallbackMessage,
                  success: false,
                });

                if (callbacks.onToolResult) {
                  callbacks.onToolResult(toolName, fallbackMessage, false);
                }
                if (state.mainWindow) {
                  state.mainWindow.webContents.send('agent:toolResult', {
                    toolName,
                    result: fallbackMessage,
                    success: false,
                  });
                }

                if (callbacks.onTellUser) {
                  callbacks.onTellUser('완료되지 않은 TODO가 있지만, 최대 재시도 횟수에 도달하여 작업을 종료합니다.');
                }
                if (state.mainWindow) {
                  state.mainWindow.webContents.send('agent:tellUser', '완료되지 않은 TODO가 있지만, 최대 재시도 횟수에 도달하여 작업을 종료합니다.');
                }

                // Chat 로그: fallback 응답
                logger.info('[CHAT] Final response (fallback)', { content: fallbackMessage.substring(0, 500) });

                if (callbacks.onComplete) {
                  callbacks.onComplete(fallbackMessage);
                }
                if (state.mainWindow) {
                  state.mainWindow.webContents.send('agent:complete', { response: fallbackMessage });
                }

                return {
                  success: true,
                  response: fallbackMessage,
                  messages,
                  toolCalls: toolCallHistory,
                  iterations,
                };
              }
            }
          }

          messages.push({
            role: 'tool',
            content: toolResultContent,
            tool_call_id: toolCall.id,
          });

          toolCallHistory.push({
            tool: toolName,
            args: toolArgs,
            result: toolResultContent,
            success: result.success,
          });

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
        }
      } else {
        noToolCallRetries++;
        logger.flow(`No tool call - enforcing tool usage (attempt ${noToolCallRetries}/${MAX_NO_TOOL_CALL_RETRIES})`);

        if (noToolCallRetries > MAX_NO_TOOL_CALL_RETRIES) {
          logger.warn('Max no-tool-call retries exceeded - returning content as final response');
          finalResponse = assistantMessage.content || 'Task completed.';
          break;
        }

        const hasMalformedToolCall = assistantMessage.content &&
          (/<tool_call>/i.test(assistantMessage.content) ||
           /<arg_key>/i.test(assistantMessage.content) ||
           /<arg_value>/i.test(assistantMessage.content) ||
           /<\/tool_call>/i.test(assistantMessage.content) ||
           /bash<arg_key>/i.test(assistantMessage.content) ||
           // Grok/xAI XML function call format
           /<xai:function_call/i.test(assistantMessage.content) ||
           /<\/xai:function_call>/i.test(assistantMessage.content) ||
           /<parameter\s+name=/i.test(assistantMessage.content));

        const retryMessage = hasMalformedToolCall
          ? 'Your previous response contained a malformed tool call (XML tags in content). You MUST use the proper tool_calls API format. Use final_response tool to deliver your message to the user.'
          : 'You must use tools for all actions. Use final_response tool to deliver your final message to the user after completing all tasks.';

        if (hasMalformedToolCall) {
          logger.warn('Malformed tool call detected in content', {
            contentSnippet: assistantMessage.content?.substring(0, 200),
          });
        }

        messages.push({
          role: 'user',
          content: retryMessage,
        });

        continue;
      }
    }

    // CLI parity: no max iterations check - loop exits when LLM calls final_response or stops

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Agent error', { error: errorMessage });

    if (callbacks.onError) {
      callbacks.onError(error instanceof Error ? error : new Error(errorMessage));
    }
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

    setTodoWriteCallback(null);
    setTellToUserCallback(null);
    setAskUserCallback(null);
    clearFinalResponseCallbacks();
  }
}

// =============================================================================
// Streaming Agent
// =============================================================================

export async function runAgentStream(
  userMessage: string,
  existingMessages: Message[] = [],
  config: AgentConfig = {},
  callbacks: AgentCallbacks = {}
): Promise<AgentResult> {
  return runAgent(userMessage, existingMessages, config, callbacks);
}

// =============================================================================
// Simple Chat (no planning/tools)
// =============================================================================

export async function simpleChat(
  userMessage: string,
  existingMessages: Message[] = [],
  systemPrompt?: string,
  onChunk?: (chunk: string) => void
): Promise<{ response: string; messages: Message[] }> {
  logger.info('Simple chat', { userMessage: userMessage.substring(0, 100) });

  // Chat 로그: 사용자 입력
  logger.info('[CHAT] User message', { content: userMessage.substring(0, 500) });

  let messages: Message[] = [...existingMessages];

  if (systemPrompt && !messages.some((m) => m.role === 'system')) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    if (onChunk) {
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

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant response', { content: result.content.substring(0, 500) });

      return { response: result.content, messages };
    } else {
      const result = await llmClient.chat(messages, false);
      messages.push(result.message);

      // Chat 로그: 어시스턴트 응답
      logger.info('[CHAT] Assistant response', { content: result.content.substring(0, 500) });

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
